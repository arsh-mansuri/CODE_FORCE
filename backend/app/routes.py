from datetime import date, timedelta, timezone
import secrets
from typing import Annotated

from fastapi import APIRouter, Body, Depends, Query, Request
from sqlalchemy import delete, or_, select, text
from sqlalchemy.orm import Session, selectinload

from .algorithms import irving, rent_harmony
from .database import get_db
from .examples import RENT_EXAMPLE, SIGNUP_EXAMPLES
from .lease import analyze_lease
from .matching import candidate_view, compatibility, listing_view, profile_of, user_view
from .media_storage import remove_files
from .media_views import onboarding_status, require_discovery_ready
from .models import AccountDeletionRequest, AuthSession, Listing, Match, Message, PasswordReset, Profile, RentSession, Swipe, User, new_id, utcnow
from .password_reset import require_reset_email, send_reset_email
from .onboarding import questionnaire
from .schemas import (
    AuthResponse, EmailRequest, EmailStatus, ErrorResponse, FeedResponse, HealthResponse, Intent, LeaseAnalysis,
    LeaseRequest, ListingFeed, ListingFeedItem, ListingInput, ListingView, LoginRequest,
    MatchView, MessageInput, MessageView, Notice, OnboardingSubmission, Questionnaire,
    RentCalculation, RentRequest, SignupRequest, StablePair, StableRequest, StableResponse,
    ResetPasswordRequest, SwipeRequest, SwipeResponse, UserProfile,
)
from .security import (
    DUMMY_HASH, current_session, current_user, hash_password, issue_session, problem, token_digest, verify_password,
)


router = APIRouter(prefix="/api", responses={
    401: {"model": ErrorResponse, "description": "Missing, invalid, or expired bearer session."},
    404: {"model": ErrorResponse, "description": "Resource not found or not visible to this account."},
    409: {"model": ErrorResponse, "description": "Account/state conflict. Concurrent writes may be retried."},
    422: {"model": ErrorResponse, "description": "Invalid input; error.fields identifies each field without echoing credentials."},
})
DB = Annotated[Session, Depends(get_db)]
Account = Annotated[User, Depends(current_user)]
Limit = Annotated[int, Query(ge=1, le=100, description="Maximum number of items to return.")]
Offset = Annotated[int, Query(ge=0, le=10000)]


def all_users(db: Session):
    return db.scalars(select(User).options(
        selectinload(User.profile), selectinload(User.media_assets),
        selectinload(User.listing).selectinload(Listing.media_assets),
    )).all()


def pair_match(db: Session, a: str, b: str):
    left, right = sorted((a, b))
    return db.scalar(select(Match).where(Match.user1_id == left, Match.user2_id == right))


def remove_incompatible_connections(db: Session, user: User):
    """A changed intent/dealbreaker or paused home must not retain a stale opt-in."""
    db.flush()
    swipes = db.scalars(select(Swipe).where(or_(Swipe.swiper_id == user.id, Swipe.target_id == user.id))).all()
    for swipe in swipes:
        other = db.get(User, swipe.target_id if swipe.swiper_id == user.id else swipe.swiper_id)
        if compatibility(user, other) is None:
            db.delete(swipe)
    matches = db.scalars(select(Match).where(or_(Match.user1_id == user.id, Match.user2_id == user.id))).all()
    for match in matches:
        other = db.get(User, match.user2_id if match.user1_id == user.id else match.user1_id)
        score = compatibility(user, other)
        if score is None:
            match.is_active = False
        else:
            match.compatibility_score = score.score


def apply_onboarding(user: User, body: OnboardingSubmission):
    if user.profile is None:
        user.profile = Profile(data=body.profile.model_dump(mode="json"))
    else:
        user.profile.data = body.profile.model_dump(mode="json")
    if body.offering is None:
        user.listing = None
    elif user.listing is None:
        user.listing = Listing(data=body.offering.model_dump(mode="json"), is_active=body.offering.is_active)
    else:
        user.listing.data = body.offering.model_dump(mode="json")
        user.listing.is_active = body.offering.is_active


def validate_future_dates(body: OnboardingSubmission):
    # Validate writes only: saved profiles must remain readable after their dates pass.
    fields = {}
    if body.profile.search:
        fields["profile.search.move_in_from"] = body.profile.search.move_in_from
        fields["profile.search.move_in_by"] = body.profile.search.move_in_by
    if body.offering:
        fields["offering.available_from"] = body.offering.available_from
    for field, value in fields.items():
        if value < date.today():
            error = problem(422, "validation_error", "Choose today or a future date.")
            error.detail["fields"] = [{"field": field, "message": "Past dates are not allowed."}]
            raise error


@router.get("/health", tags=["Health"], response_model=HealthResponse, summary="Check the API and database")
def health(db: DB):
    db.execute(text("SELECT 1"))
    return HealthResponse()


@router.get("/onboarding/questions", tags=["Onboarding"], response_model=Questionnaire, summary="Get conditional, neutral signup questions")
def onboarding_questions(request: Request):
    """Public metadata for building an intent-aware signup form. Ordinary `field`
    values map to signup JSON paths. Media questions instead provide upload_endpoint
    for the post-signup multipart step. `required` applies within `applies_to`
    intents when every `show_when` condition is satisfied.
    Optional fields use the defaults in the linked OpenAPI schema.
    Nearby religious landmarks describe proximity only, never personal identity.
    """
    return questionnaire(request.app.state.settings)


@router.post("/auth/signup", tags=["Authentication"], status_code=201, response_model=AuthResponse, summary="Create an account with complete housing intent")
def signup(request: Request, body: Annotated[SignupRequest, Body(openapi_examples=SIGNUP_EXAMPLES)], db: DB):
    """Atomically create credentials, completed profile, optional offered home, and a
    bearer session. No account is stored if conditional answers fail. Photo
    onboarding follows signup using this token: 3–6 profile photos, plus 3–6
    property photos for providers. Discovery stays locked until uploads complete.
    Choose one of the five Swagger examples. Emails are case-insensitive and unique.
    Shared-living profiles require lifestyle answers; whole-home providers do not.
    Offerings can disclose electricity rates/split rules and AC availability/charges.
    """
    validate_future_dates(body)
    if db.scalar(select(User.id).where(User.email == str(body.email))):
        raise problem(409, "email_in_use", "An account already uses this email. Please log in.")
    user = User(email=str(body.email), password_hash=hash_password(body.password.get_secret_value()))
    apply_onboarding(user, body)
    db.add(user)
    db.flush()
    token, expiry = issue_session(db, user.id, request.app.state.settings.session_days)
    db.commit()
    return AuthResponse(access_token=token, expires_at=expiry, user=user_view(user))


@router.post("/auth/check-email", tags=["Authentication"], response_model=EmailStatus)
def check_email(body: EmailRequest, db: DB):
    return EmailStatus(exists=db.scalar(select(User.id).where(User.email == str(body.email))) is not None)


@router.post("/auth/forgot-password", tags=["Authentication"], response_model=Notice)
def forgot_password(body: EmailRequest, request: Request, db: DB):
    settings = request.app.state.settings
    require_reset_email(settings)
    notice = Notice(message="If this email has an account, a reset link has been sent. Check your inbox and spam folder.")
    user = db.scalar(select(User).where(User.email == str(body.email)).with_for_update())
    if user is None:
        return notice
    recent = db.scalar(select(PasswordReset).where(
        PasswordReset.user_id == user.id, PasswordReset.created_at > utcnow() - timedelta(minutes=1),
    ))
    if recent:
        return notice
    token = secrets.token_urlsafe(32)
    db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
    db.add(PasswordReset(token_hash=token_digest(token), user_id=user.id, expires_at=utcnow() + timedelta(minutes=30)))
    db.flush()
    send_reset_email(settings, user.email, token)
    db.commit()
    return notice


@router.post("/auth/reset-password", tags=["Authentication"], response_model=Notice)
def reset_password(body: ResetPasswordRequest, db: DB):
    # Atomic consumption prevents two requests from using the same link.
    user_id = db.execute(delete(PasswordReset).where(
        PasswordReset.token_hash == token_digest(body.token.get_secret_value()),
        PasswordReset.expires_at > utcnow(),
    ).returning(PasswordReset.user_id)).scalar_one_or_none()
    if user_id is None:
        raise problem(400, "invalid_reset_link", "This reset link is invalid or expired. Request a new link.")
    user = db.get(User, user_id)
    user.password_hash = hash_password(body.password.get_secret_value())
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))
    db.execute(delete(PasswordReset).where(PasswordReset.user_id == user_id))
    db.commit()
    return Notice(message="Your password has been changed. Sign in with your new password.")


@router.post("/auth/login", tags=["Authentication"], response_model=AuthResponse, summary="Sign in and issue a revocable bearer session")
def login(request: Request, body: LoginRequest, db: DB):
    user = db.scalar(select(User).where(User.email == str(body.email).casefold()))
    valid = verify_password(body.password.get_secret_value(), user.password_hash if user else DUMMY_HASH)
    if user is None or not valid:
        raise problem(401, "invalid_credentials", "The email or password is incorrect.")
    db.execute(delete(AuthSession).where(AuthSession.expires_at <= utcnow()))
    token, expiry = issue_session(db, user.id, request.app.state.settings.session_days)
    db.commit()
    return AuthResponse(access_token=token, expires_at=expiry, user=user_view(user))


@router.post("/auth/logout", tags=["Authentication"], response_model=Notice, summary="Revoke this bearer session")
def logout(db: DB, session: Annotated[AuthSession, Depends(current_session)]):
    db.delete(session)
    db.commit()
    return Notice(message="This session has been revoked.")


@router.get("/users/me", tags=["Profiles"], response_model=UserProfile, summary="Read your complete private profile and offering")
def get_me(user: Account):
    return user_view(user)


@router.put("/users/me", tags=["Profiles"], response_model=UserProfile, summary="Replace your onboarding answers and optional offering")
def update_me(body: OnboardingSubmission, request: Request, user: Account, db: DB):
    """Submit the complete profile and offering (same shape as signup without credentials).
    Supports changing intent atomically. A newly incompatible connection is deactivated
    and its swipes removed; changing back requires fresh mutual likes.
    """
    validate_future_dates(body)
    retired_media = list(user.listing.media_assets) if user.listing and body.offering is None else []
    apply_onboarding(user, body)
    remove_incompatible_connections(db, user)
    db.commit()
    remove_files(request.app.state.settings.media_root, retired_media)
    db.expire(user, ["media_assets"])
    return user_view(user)


@router.post("/users/me/deletion-request", tags=["Profiles"], response_model=UserProfile, summary="Flag your account for deletion in seven days")
def request_account_deletion(user: Account, db: DB):
    """Persist a private deletion request. Repeated requests retain the original deadline.
    This queues the account for deletion processing; it does not immediately remove data.
    """
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    if user.deletion_request is None:
        now = utcnow()
        user.deletion_request = AccountDeletionRequest(requested_at=now, scheduled_for=now + timedelta(days=7))
        db.commit()
    return user_view(user)


@router.delete("/users/me/deletion-request", tags=["Profiles"], response_model=UserProfile, summary="Cancel your pending account deletion request")
def cancel_account_deletion(user: Account, db: DB):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    user.deletion_request = None
    db.commit()
    return user_view(user)


@router.get("/list", tags=["Discovery"], response_model=FeedResponse, summary="Get photo-first swipe cards with names, locations, and match scores")
@router.get("/users/feed", tags=["Discovery"], response_model=FeedResponse, summary="Discover compatible people or housing providers")
def feed(user: Account, db: DB, limit: Limit = 20, offset: Offset = 0, include_seen: bool = False, min_match_score: Annotated[float, Query(ge=0, le=100)] = 0):
    """Uses the authenticated profile. First filters complementary intent, geography,
    budget, layout, dates, required AC access, and bilateral household requirements, then ranks by weighted
    lifestyle cosine (shared living) or housing fit (whole homes). Previously swiped
    profiles are hidden unless include_seen=true. Both accounts must finish photo
    onboarding. match_score is computed from requirements/lifestyle, never appearance.
    Cards contain a primary gallery, person gallery, display location, badges,
    and has_more/next_offset pagination. /list and /users/feed have identical contracts.
    """
    require_discovery_ready(user)
    seen = set() if include_seen else set(db.scalars(select(Swipe.target_id).where(Swipe.swiper_id == user.id)))
    items = []
    for other in all_users(db):
        if other.id in seen or not onboarding_status(other).complete:
            continue
        score = compatibility(user, other)
        if score is not None and score.score >= min_match_score:
            items.append(candidate_view(other, score))
    items.sort(key=lambda candidate: (-candidate.compatibility.score, candidate.id))
    has_more = offset + limit < len(items)
    return FeedResponse(items=items[offset:offset + limit], total=len(items), limit=limit, offset=offset, has_more=has_more, next_offset=offset + limit if has_more else None)


@router.get("/listings", tags=["Listings"], response_model=ListingFeed, summary="Find homes matching your signup requirements")
def listings(user: Account, db: DB, limit: Limit = 20, offset: Offset = 0, min_match_score: Annotated[float, Query(ge=0, le=100)] = 0):
    """For seek_entire_home and seek_room accounts. Only active, eligible listings are
    returned. Areas and PIN codes are OR alternatives within the selected city;
    required nearby landmarks must have a provider-declared distance within the limit.
    Electricity split/rate and AC charging details are included in each listing.
    Seekers can require confirmed AC access via profile.search.ac_required.
    """
    require_discovery_ready(user)
    items = []
    for other in all_users(db):
        if other.listing and other.listing.is_active and onboarding_status(other).complete:
            score = compatibility(user, other)
            if score is not None and score.score >= min_match_score:
                items.append(ListingFeedItem(listing=listing_view(other.listing), compatibility=score, match_score=score.score, provider_name=profile_of(other).full_name))
    items.sort(key=lambda item: (-item.compatibility.score, item.listing.id))
    has_more = offset + limit < len(items)
    return ListingFeed(items=items[offset:offset + limit], total=len(items), limit=limit, offset=offset, has_more=has_more, next_offset=offset + limit if has_more else None)


@router.get("/listings/me", tags=["Listings"], response_model=ListingView, summary="Read your active or paused offering")
def own_listing(user: Account):
    if user.listing is None:
        raise problem(404, "no_offering", "This account is not currently offering a home or shared space.")
    return listing_view(user.listing)


@router.put("/listings/me", tags=["Listings"], response_model=ListingView, summary="Replace, pause, or reopen your offering")
def update_listing(body: ListingInput, user: Account, db: DB):
    profile = profile_of(user)
    if profile.intent not in (Intent.offer_entire_home, Intent.offer_shared_home):
        raise problem(409, "offering_intent_required", "Use PUT /api/users/me to change your intent and add an offering together.")
    listing_intent = Intent.offer_entire_home if body.kind == "entire_home" else Intent.offer_shared_home
    if listing_intent not in profile.selected_intents:
        raise problem(422, "listing_intent_mismatch", "The listing kind must match your whole-home or shared-home intent.")
    if profile.intent != listing_intent:
        profile = profile.model_copy(update={"intent": listing_intent})
    submission = OnboardingSubmission(profile=profile, offering=body)
    validate_future_dates(submission)
    apply_onboarding(user, submission)
    remove_incompatible_connections(db, user)
    db.commit()
    return listing_view(user.listing)


@router.get("/listings/{listing_id}", tags=["Listings"], response_model=ListingView, summary="Read an eligible listing")
def get_listing(listing_id: str, user: Account, db: DB):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise problem(404, "listing_not_found", "This listing is not available to your account.")
    if listing.owner_id != user.id:
        require_discovery_ready(user)
        provider = db.get(User, listing.owner_id)
        if not onboarding_status(provider).complete or compatibility(user, provider) is None:
            raise problem(404, "listing_not_found", "This listing is not available to your account.")
    return listing_view(listing)


@router.post("/swipe", tags=["Connections"], response_model=SwipeResponse, summary="Like, pass, or superlike an eligible profile")
def swipe(body: SwipeRequest, user: Account, db: DB):
    """A single stored swipe per ordered pair makes repeated requests idempotent.
    like/superlike require current eligibility. Only reciprocal positive swipes create
    one canonical match and unlock messaging. Passing revokes an existing match;
    another positive swipe can reconnect only if the other person's like still exists.
    """
    if body.target_id == user.id:
        raise problem(422, "self_swipe", "Choose someone else's profile.")
    target = db.get(User, body.target_id)
    if target is None:
        raise problem(404, "profile_not_found", "This profile does not exist.")
    # PostgreSQL serialises reciprocal writes on this canonical user pair. SQLite
    # already serialises writes; its dialect ignores FOR UPDATE.
    db.execute(select(User.id).where(User.id.in_((user.id, target.id))).order_by(User.id).with_for_update()).all()
    if body.direction != "pass":
        require_discovery_ready(user)
        if not onboarding_status(target).complete:
            raise problem(409, "profile_not_ready", "This person is still completing their photo gallery.")
    score = compatibility(user, target)
    if body.direction != "pass" and score is None:
        raise problem(409, "incompatible_profile", "Your current intents, housing requirements, or household preferences do not align.")
    record = db.scalar(select(Swipe).where(Swipe.swiper_id == user.id, Swipe.target_id == target.id))
    if record is None:
        db.add(Swipe(swiper_id=user.id, target_id=target.id, direction=body.direction))
    else:
        record.direction = body.direction
        record.updated_at = utcnow()
    reverse = db.scalar(select(Swipe).where(Swipe.swiper_id == target.id, Swipe.target_id == user.id))
    match = pair_match(db, user.id, target.id)
    mutual = body.direction != "pass" and reverse is not None and reverse.direction != "pass" and score is not None
    if mutual:
        if match is None:
            left, right = sorted((user.id, target.id))
            match = Match(user1_id=left, user2_id=right, compatibility_score=score.score)
            db.add(match)
        match.is_active = True
        reverse_score = compatibility(target, user)
        match.compatibility_score = round((score.score + reverse_score.score) / 2, 2)
    elif match is not None:
        match.is_active = False
    db.commit()
    return SwipeResponse(
        matched=mutual, match_id=match.id if mutual else None,
        message="You both chose to connect. Messaging is now available." if mutual else "Your choice has been saved. A connection needs both people's approval.",
    )


@router.get("/matches", tags=["Connections"], response_model=list[MatchView], summary="List your active mutual connections")
def matches(user: Account, db: DB, limit: Limit = 20, offset: Offset = 0):
    rows = db.scalars(select(Match).where(
        Match.is_active.is_(True), or_(Match.user1_id == user.id, Match.user2_id == user.id),
    ).order_by(Match.created_at.desc(), Match.id)).all()
    items = []
    for match in rows:
        other = db.get(User, match.user2_id if match.user1_id == user.id else match.user1_id)
        score = compatibility(user, other)
        if score is not None:
            items.append(MatchView(
                id=match.id, other_user=candidate_view(other, score), compatibility_score=match.compatibility_score,
                created_at=match.created_at.replace(tzinfo=timezone.utc),
            ))
    return items[offset:offset + limit]


def require_match(db: Session, user: User, match_id: str) -> Match:
    match = db.get(Match, match_id)
    if match is None or not match.is_active or user.id not in (match.user1_id, match.user2_id):
        raise problem(404, "match_not_found", "An active mutual connection is required to access this conversation.")
    other = db.get(User, match.user2_id if match.user1_id == user.id else match.user1_id)
    if compatibility(user, other) is None:
        raise problem(409, "connection_changed", "This connection no longer meets the current housing requirements.")
    return match


def message_view(message: Message):
    return MessageView(
        id=message.id, match_id=message.match_id, sender_id=message.sender_id,
        content=message.content, created_at=message.created_at.replace(tzinfo=timezone.utc),
    )


@router.post("/matches/{match_id}/messages", tags=["Messaging"], status_code=201, response_model=MessageView, summary="Send a message after mutual approval")
def send_message(match_id: str, body: MessageInput, user: Account, db: DB):
    require_match(db, user, match_id)
    message = Message(match_id=match_id, sender_id=user.id, content=body.content)
    db.add(message)
    db.commit()
    return message_view(message)


@router.get("/matches/{match_id}/messages", tags=["Messaging"], response_model=list[MessageView], summary="Read messages in an active mutual connection")
def get_messages(match_id: str, user: Account, db: DB, limit: Limit = 50, offset: Offset = 0):
    """Polling-based MVP chat. Returns chronological messages, oldest first, with offset pagination."""
    require_match(db, user, match_id)
    rows = db.scalars(select(Message).where(Message.match_id == match_id).order_by(Message.created_at, Message.id).offset(offset).limit(limit)).all()
    return [message_view(message) for message in rows]


@router.post("/matching/stable", tags=["Algorithms"], response_model=StableResponse, summary="Find stable roommate pairs using Irving's algorithm")
def stable_matching(body: StableRequest, user: Account, db: DB):
    """For 2–20 people seeking a roommate to search together. You must be in the cohort,
    and every other participant must already be your active mutual match. Edges require
    bilateral eligibility and reciprocal likes between the two people. Per-person
    weighted cosine ranks these edges; UUIDs break ties. Irving runs on the resulting
    strict, possibly incomplete lists. It may report no stable PERFECT pairing; it
    never fabricates a pair, silently drops a participant, or creates a new match.
    """
    if user.id not in body.participant_ids:
        raise problem(422, "requester_not_in_cohort", "Include your own user ID in the cohort.")
    people = {}
    for person_id in body.participant_ids:
        person = db.get(User, person_id)
        if person is None:
            raise problem(404, "participant_not_found", "A participant is unavailable.")
        if Intent.seek_roommate not in profile_of(person).selected_intents:
            raise problem(422, "invalid_stable_intent", "Everyone in a stable roommate cohort must include finding a roommate in their selected goals.")
        if person.id != user.id:
            connection = pair_match(db, user.id, person.id)
            if connection is None or not connection.is_active or compatibility(user, person) is None:
                raise problem(409, "mutual_connection_required", "Every other participant must be your active mutual connection.")
        people[person_id] = person
    likes = set(db.execute(select(Swipe.swiper_id, Swipe.target_id).where(
        Swipe.swiper_id.in_(people), Swipe.target_id.in_(people), Swipe.direction.in_(("like", "superlike")),
    )).all())
    scores, preferences = {}, {}
    for a, person in people.items():
        acceptable = []
        for b, other in people.items():
            if (a, b) not in likes or (b, a) not in likes:
                continue
            score = compatibility(person, other)
            if score is not None:
                scores[a, b] = score.score
                acceptable.append(b)
        preferences[a] = sorted(acceptable, key=lambda b: (-scores[a, b], b))
    pairs = irving(preferences)
    return StableResponse(
        status="stable" if pairs is not None else "no_stable_matching",
        pairs=[] if pairs is None else [StablePair(user1_id=a, user2_id=b, score=round((scores[a, b] + scores[b, a]) / 2, 2)) for a, b in pairs],
        unpaired_ids=sorted(people) if pairs is None else [],
        message="No acceptable blocking pair exists under these strict, tie-broken rankings." if pairs is not None else "No stable perfect matching exists for this cohort's current mutual likes and requirements. Try a different even cohort; partial pairings are not returned.",
    )


@router.post("/rent-harmony/calculate", tags=["Rent Harmony"], response_model=RentCalculation, status_code=201, summary="Calculate and save an explainable approximate rent split")
def calculate_rent(body: Annotated[RentRequest, Body(openapi_examples={"two_rooms": {"summary": "Two different rooms and subjective INR valuations", "value": RENT_EXAMPLE}})], user: Account, db: DB):
    """Bounded Sperner-style simplex triangulation for 2 or 3 rooms/people, with a
    deterministic grid fallback. Each person values EVERY room in INR/month. Prices
    sum exactly to the total rent at paise precision. The response reports the actual
    envy, tolerance, affordability, and method used; it does not promise an exact
    fixed point. No external API key is required. The saved session is private to you.
    """
    session_id = new_id()
    result = rent_harmony(body, session_id)
    db.add(RentSession(id=session_id, creator_id=user.id, request_data=body.model_dump(mode="json"), result_data=result.model_dump(mode="json")))
    db.commit()
    return result


@router.get("/rent-harmony/sessions/{session_id}", tags=["Rent Harmony"], response_model=RentCalculation, summary="Read your saved rent calculation")
def get_rent_session(session_id: str, user: Account, db: DB):
    session = db.get(RentSession, session_id)
    if session is None or session.creator_id != user.id:
        raise problem(404, "rent_session_not_found", "This rent calculation is not available to your account.")
    return RentCalculation.model_validate(session.result_data)


@router.post("/lease/analyze", tags=["Lease Review"], response_model=LeaseAnalysis, summary="Flag lease discussion points with an offline heuristic")
def analyze(body: Annotated[LeaseRequest, Body(openapi_examples={"lease": {"value": {"text": "The deposit is non-refundable. A twelve-month lock-in applies. The tenant pays all maintenance costs."}}})], user: Account):
    """Local deterministic keyword rules. Explicitly labelled local_heuristic, not an
    LLM analysis or legal opinion. No-match clauses receive info, never a safe verdict.
    Submitted lease text is not persisted by this endpoint.
    """
    return analyze_lease(body.text)
