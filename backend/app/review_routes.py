from datetime import timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from .database import get_db
from .matching import listing_view
from .media_storage import prepare_photo, remove_files
from .media_views import gallery_view, listing_publication_status
from .models import Listing, Match, PropertyReview, ReviewHelpful, ReviewPhoto, User
from .review_schemas import HelpfulInput, PropertyReviewFeed, PropertyReviewView, ReviewedProperty, ReviewExperience, ReviewPhotoView
from .schemas import ErrorResponse, Notice
from .security import current_user, problem


router = APIRouter(prefix="/api", tags=["Property Reviews"], responses={401: {"model": ErrorResponse}})
DB = Annotated[Session, Depends(get_db)]
Account = Annotated[User, Depends(current_user)]


def property_match(db: Session, user_id: str, owner_id: str):
    left, right = sorted((user_id, owner_id))
    return db.scalar(select(Match).where(Match.user1_id == left, Match.user2_id == right))


def visible_listing(db: Session, listing_id: str, user: User):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise problem(404, "property_not_found", "This property is no longer available.")
    match = property_match(db, user.id, listing.owner_id)
    if listing.owner_id != user.id and not match and listing_publication_status(listing) != "published":
        raise problem(404, "property_not_found", "This property is not available to your account.")
    return listing, match


def author_avatar(author: User):
    return gallery_view(a for a in author.media_assets if a.target == "profile").cover_photo_url


def review_view(review: PropertyReview, user: User, counts: dict[str, int], voted: set[str]):
    return PropertyReviewView(
        id=review.id, listing_id=review.listing_id, author_id=review.author_id,
        author_name=review.author.profile.data["full_name"], author_avatar=author_avatar(review.author),
        rating=review.rating, experience=review.experience, content=review.content,
        created_at=review.created_at.replace(tzinfo=timezone.utc),
        photos=[ReviewPhotoView(id=photo.id, url=f"/api/review-photos/{photo.id}",
            thumbnail_url=f"/api/review-photos/{photo.id}/thumbnail", width=photo.width, height=photo.height)
            for photo in sorted(review.photos, key=lambda photo: (photo.position, photo.id))],
        helpful_count=counts.get(review.id, 0), helpful_by_me=review.id in voted, is_mine=review.author_id == user.id,
    )


@router.get("/reviews/properties", response_model=list[ReviewedProperty], summary="Review history grouped by your matched properties")
def matched_properties(user: Account, db: DB):
    """Includes past matches so a paused connection doesn't hide its property's history.
    Providers can also read all reviews of their own property here.
    """
    matches = db.scalars(select(Match).where(or_(Match.user1_id == user.id, Match.user2_id == user.id))
        .order_by(Match.created_at.desc(), Match.id)).all()
    by_owner = {match.user2_id if match.user1_id == user.id else match.user1_id: match for match in matches}
    owners = db.scalars(select(User).where(User.id.in_([user.id, *by_owner]))
        .options(selectinload(User.listing).selectinload(Listing.media_assets), selectinload(User.profile), selectinload(User.media_assets))).all()
    stats = {listing_id: (count, average) for listing_id, count, average in db.execute(
        select(PropertyReview.listing_id, func.count(), func.avg(PropertyReview.rating))
        .where(PropertyReview.listing_id.in_([owner.listing.id for owner in owners if owner.listing]))
        .group_by(PropertyReview.listing_id))}
    items = []
    for owner in owners:
        if owner.listing is None:
            continue
        match = by_owner.get(owner.id)
        count, average = stats.get(owner.listing.id, (0, None))
        items.append(ReviewedProperty(
            listing=listing_view(owner.listing), provider_name=owner.profile.data["full_name"],
            provider_avatar=author_avatar(owner), match_id=match.id if match else None,
            match_score=match.compatibility_score if match else None, active_match=bool(match and match.is_active),
            is_owner=owner.id == user.id, review_count=count, average_rating=round(average, 1) if average is not None else None,
        ))
    order = {owner_id: index for index, owner_id in enumerate(by_owner)}
    return sorted(items, key=lambda item: (not item.is_owner, order.get(item.listing.owner_id, -1)))


@router.get("/listings/{listing_id}/reviews", response_model=PropertyReviewFeed, summary="Read all property reviews and two decision-making highlights")
def property_reviews(listing_id: str, user: Account, db: DB,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["recent", "helpful"] = "recent",
):
    listing, match = visible_listing(db, listing_id, user)
    base = select(PropertyReview).where(PropertyReview.listing_id == listing_id)
    votes = select(ReviewHelpful.review_id, func.count().label("count")).group_by(ReviewHelpful.review_id).subquery()
    ranked = base.outerjoin(votes, votes.c.review_id == PropertyReview.id)
    recent_order = (PropertyReview.created_at.desc(), PropertyReview.id.desc())
    helpful_order = (func.coalesce(votes.c.count, 0).desc(), *recent_order)
    options = (selectinload(PropertyReview.photos), selectinload(PropertyReview.author).selectinload(User.profile),
        selectinload(PropertyReview.author).selectinload(User.media_assets))
    total, average = db.execute(select(func.count(), func.avg(PropertyReview.rating))
        .where(PropertyReview.listing_id == listing_id)).one()
    own_id = db.scalar(select(PropertyReview.id).where(PropertyReview.listing_id == listing_id, PropertyReview.author_id == user.id))
    rows = db.scalars(ranked.order_by(*(helpful_order if sort == "helpful" else recent_order))
        .offset(offset).limit(limit).options(*options)).all()
    newest = db.scalar(base.order_by(*recent_order).limit(1).options(*options))
    highlights = [newest] if newest else []
    if newest:
        best_other = db.scalar(ranked.where(PropertyReview.id != newest.id).order_by(*helpful_order).limit(1).options(*options))
        if best_other:
            highlights.append(best_other)
    ids = {review.id for review in [*rows, *highlights]}
    counts = dict(db.execute(select(ReviewHelpful.review_id, func.count()).where(ReviewHelpful.review_id.in_(ids)).group_by(ReviewHelpful.review_id)).all())
    voted = set(db.scalars(select(ReviewHelpful.review_id).where(ReviewHelpful.review_id.in_(ids), ReviewHelpful.user_id == user.id)))
    can_review = bool(match and match.is_active and listing.owner_id != user.id and not own_id)
    message = "Share your connection, visit, or living experience." if can_review else (
        "You've reviewed this property. Remove your review to replace it." if own_id else
        "Reviews of your property appear here." if listing.owner_id == user.id else
        "An active mutual match with this property's provider is required to write a review.")
    return PropertyReviewFeed(items=[review_view(row, user, counts, voted) for row in rows],
        highlights=[review_view(row, user, counts, voted) for row in highlights], total=total,
        average_rating=round(average, 1) if average is not None else None, limit=limit, offset=offset,
        has_more=offset + limit < total, next_offset=offset + limit if offset + limit < total else None,
        can_review=can_review, own_review_id=own_id, eligibility_message=message)


@router.post("/listings/{listing_id}/reviews", response_model=PropertyReviewView, status_code=201,
    summary="Publish a matched-property review with up to six photographs")
def create_review(listing_id: str, request: Request, user: Account, db: DB,
    rating: Annotated[int, Form(ge=1, le=5)], experience: Annotated[ReviewExperience, Form()],
    content: Annotated[str, Form(min_length=10, max_length=3000)],
    files: Annotated[list[UploadFile] | None, File(description="Optional JPEG, PNG or WebP photos, up to 6 files, 10 MiB each.")] = None,
):
    prepared = []
    uploads = files or []
    settings = request.app.state.settings
    try:
        # Serialize same-author writes on both SQLite and PostgreSQL; the unique
        # constraint is the final defense against duplicate submissions/retries.
        db.execute(update(User).where(User.id == user.id).values(email=User.email))
        listing, match = visible_listing(db, listing_id, user)
        if listing.owner_id == user.id or not match or not match.is_active:
            raise problem(403, "review_match_required", "Match with this property's provider before leaving a review.")
        if db.scalar(select(PropertyReview.id).where(PropertyReview.listing_id == listing_id, PropertyReview.author_id == user.id)):
            raise problem(409, "already_reviewed", "You've already reviewed this property. Refresh to see your review.")
        content = content.strip()
        if len(content) < 10:
            raise problem(422, "review_too_short", "Please describe your experience in at least 10 characters.")
        if len(uploads) > 6:
            raise problem(422, "review_photo_limit", "Attach up to six photos to your review.")
        for upload in uploads:
            prepared.append(prepare_photo(upload, settings, target="review"))
        if len({photo.checksum for photo in prepared}) != len(prepared):
            raise problem(409, "duplicate_photo", "Choose distinct photos for your review.")
        review = PropertyReview(listing_id=listing_id, author_id=user.id, author=user,
            rating=rating, experience=experience, content=content,
            photos=[ReviewPhoto(id=photo.id, filename=photo.filename, thumbnail_filename=photo.thumbnail_filename,
                width=photo.width, height=photo.height, position=index) for index, photo in enumerate(prepared)])
        db.add(review)
        db.commit()
    except Exception:
        db.rollback()
        remove_files(settings.media_root, prepared)
        raise
    finally:
        for upload in uploads:
            upload.file.close()
    return review_view(review, user, {}, set())


@router.delete("/reviews/{review_id}", response_model=Notice, summary="Remove your own review and its photos")
def delete_review(review_id: str, request: Request, user: Account, db: DB):
    review = db.scalar(select(PropertyReview).where(PropertyReview.id == review_id, PropertyReview.author_id == user.id))
    if review is None:
        raise problem(404, "review_not_found", "This review is not available to your account.")
    photos = list(review.photos)
    db.delete(review)
    db.commit()
    remove_files(request.app.state.settings.media_root, photos)
    return Notice(message="Your review and photographs have been removed.")


@router.put("/reviews/{review_id}/helpful", response_model=PropertyReviewView, summary="Mark or unmark another person's review as helpful")
def helpful_review(review_id: str, body: HelpfulInput, user: Account, db: DB):
    db.execute(update(User).where(User.id == user.id).values(email=User.email))
    review = db.get(PropertyReview, review_id)
    if review is None:
        raise problem(404, "review_not_found", "This review is no longer available.")
    visible_listing(db, review.listing_id, user)
    if review.author_id == user.id:
        raise problem(403, "own_review_vote", "Helpful votes are for other people's reviews.")
    vote = db.get(ReviewHelpful, (review_id, user.id))
    if body.helpful and vote is None:
        db.add(ReviewHelpful(review_id=review_id, user_id=user.id))
    elif not body.helpful:
        db.execute(delete(ReviewHelpful).where(ReviewHelpful.review_id == review_id, ReviewHelpful.user_id == user.id))
    db.commit()
    count = db.scalar(select(func.count()).select_from(ReviewHelpful).where(ReviewHelpful.review_id == review_id))
    return review_view(review, user, {review_id: count}, {review_id} if body.helpful else set())


def serve_review_photo(photo_id: str, thumbnail: bool, request: Request, db: Session):
    photo = db.get(ReviewPhoto, photo_id)
    if photo is None:
        raise problem(404, "review_photo_not_found", "This review photo is no longer available.")
    path = request.app.state.settings.media_root / (photo.thumbnail_filename if thumbnail else photo.filename)
    if not path.is_file():
        raise problem(404, "review_photo_not_found", "This review photo is no longer available.")
    return FileResponse(path, media_type="image/jpeg", headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600"})


@router.get("/review-photos/{photo_id}", response_class=FileResponse)
def review_photo(photo_id: str, request: Request, db: DB):
    return serve_review_photo(photo_id, False, request, db)


@router.get("/review-photos/{photo_id}/thumbnail", response_class=FileResponse)
def review_photo_thumbnail(photo_id: str, request: Request, db: DB):
    return serve_review_photo(photo_id, True, request, db)
