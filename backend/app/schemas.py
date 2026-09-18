from datetime import date, datetime
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator, model_validator


class Schema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class Intent(str, Enum):
    seek_entire_home = "seek_entire_home"
    seek_room = "seek_room"
    seek_roommate = "seek_roommate"
    offer_entire_home = "offer_entire_home"
    offer_shared_home = "offer_shared_home"


SEEKING = {Intent.seek_entire_home, Intent.seek_room, Intent.seek_roommate}
OFFERING = {Intent.offer_entire_home, Intent.offer_shared_home}
SHARING = {Intent.seek_room, Intent.seek_roommate, Intent.offer_shared_home}


class Gender(str, Enum):
    woman = "woman"
    man = "man"
    non_binary = "non_binary"
    self_described = "self_described"
    prefer_not_to_say = "prefer_not_to_say"


class PropertyType(str, Enum):
    studio = "studio"
    rk1 = "1rk"
    bhk1 = "1bhk"
    bhk2 = "2bhk"
    bhk3 = "3bhk"
    bhk4plus = "4bhk_plus"
    other = "other"


class Diet(str, Enum):
    vegetarian = "vegetarian"
    vegan = "vegan"
    jain = "jain"
    omnivore = "omnivore"
    other = "other"
    prefer_not_to_say = "prefer_not_to_say"


class LandmarkKind(str, Enum):
    jain_derasar = "jain_derasar"
    mosque = "mosque"
    temple = "temple"
    church = "church"
    gurdwara = "gurdwara"
    public_transport = "public_transport"
    university = "university"
    workplace = "workplace"
    hospital = "hospital"
    park = "park"
    grocery = "grocery"
    other = "other"


Scale = Annotated[int, Field(ge=1, le=5)]
Weight = Annotated[int, Field(ge=0, le=5)]
Money = Annotated[float, Field(ge=0, le=10_000_000, allow_inf_nan=False, multiple_of=0.01)]
Pincode = Annotated[str, Field(pattern=r"^[1-9][0-9]{5}$", description="Six-digit Indian PIN code, kept as text.")]
ShortText = Annotated[str, Field(min_length=1, max_length=120)]


class Budget(Schema):
    minimum: Money = Field(description="Minimum monthly rent in INR; use 0 for no lower bound.")
    maximum: Money = Field(description="Maximum monthly rent in INR, excluding deposit and utilities.")

    @model_validator(mode="after")
    def valid_range(self):
        if self.maximum <= 0 or self.minimum > self.maximum:
            raise ValueError("Budget maximum must be positive and at least the minimum.")
        return self


class LandmarkPreference(Schema):
    kind: LandmarkKind
    name: ShortText | None = Field(default=None, description="Optional named landmark, e.g. a particular derasar or metro station.")
    max_distance_km: float = Field(default=3, gt=0, le=50)
    importance: Literal["preferred", "required"] = "preferred"


class SearchLocation(Schema):
    city: ShortText
    areas: list[ShortText] = Field(default_factory=list, max_length=20, description="Acceptable neighbourhoods. Empty means any area.")
    pincodes: list[Pincode] = Field(default_factory=list, max_length=20)
    nearby: list[LandmarkPreference] = Field(default_factory=list, max_length=10, description="Optional proximity preferences, never interpreted as religious identity.")


class HousingSearch(Schema):
    location: SearchLocation
    budget: Budget
    property_types: list[PropertyType] = Field(min_length=1, max_length=7)
    move_in_from: date = Field(description="Earliest acceptable move-in date (YYYY-MM-DD).")
    move_in_by: date = Field(description="Latest acceptable move-in date, inclusive.")
    stay_months: int = Field(ge=1, le=60, description="Planned duration, used against a listing's minimum lease.")

    @model_validator(mode="after")
    def dates_in_order(self):
        if self.move_in_by < self.move_in_from:
            raise ValueError("move_in_by must be on or after move_in_from.")
        return self


class Lifestyle(Schema):
    cleanliness: Scale = Field(description="1: relaxed about clutter; 5: prefer frequent tidying. Neither end is better.")
    social_energy: Scale = Field(description="1: mostly private time; 5: frequent shared activities.")
    guests: Scale = Field(description="1: rarely host; 5: host frequently.")
    noise_tolerance: Scale = Field(description="1: prefer quiet; 5: comfortable with a lively home.")
    sleep_schedule: Literal["early_bird", "night_owl", "flexible"]
    work_style: Literal["office", "hybrid", "remote", "varies"]
    diet: Diet
    smokes: bool = Field(description="Do you currently smoke? Used only for explicit household preferences.")
    has_pets: bool


class RoommatePreferences(Schema):
    genders: list[Gender] = Field(default_factory=list, max_length=5, description="Empty means open to anyone. Undisclosed genders do not satisfy a specific gender requirement.")
    smoking_ok: bool | None = Field(default=None, description="false: smoke-free household required; null/true: no smoker exclusion.")
    pets_ok: bool | None = Field(default=None, description="false: cannot live with pets; null/true: no pet exclusion.")
    diets: list[Diet] = Field(default_factory=list, max_length=6, description="Empty means any food routine. No belief or identity is inferred.")


class CompatibilityWeights(Schema):
    cleanliness: Weight = 3
    social_energy: Weight = 3
    guests: Weight = 3
    noise_tolerance: Weight = 3
    sleep_schedule: Weight = 3
    work_style: Weight = 2
    diet: Weight = 2
    smokes: Weight = 3
    has_pets: Weight = 2

    @model_validator(mode="after")
    def some_weight(self):
        if not any(self.model_dump().values()):
            raise ValueError("Choose at least one lifestyle factor with non-zero importance.")
        return self


class RoomPriorities(Schema):
    size: Weight = 3
    private_bathroom: Weight = 3
    balcony: Weight = 2
    natural_light: Weight = 3
    quiet: Weight = 3


class UserProfileInput(Schema):
    full_name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=18, le=120)
    gender: Gender = Gender.prefer_not_to_say
    gender_description: str | None = Field(default=None, min_length=1, max_length=80)
    occupation: str | None = Field(default=None, min_length=1, max_length=100)
    bio: str = Field(default="", max_length=1000)
    intent: Intent
    search: HousingSearch | None = None
    lifestyle: Lifestyle | None = None
    roommate_preferences: RoommatePreferences = Field(default_factory=RoommatePreferences)
    compatibility_weights: CompatibilityWeights = Field(default_factory=CompatibilityWeights)
    room_priorities: RoomPriorities = Field(default_factory=RoomPriorities, description="Initial amenity priorities; final per-room INR valuations are collected in a rent session.")

    @model_validator(mode="after")
    def intent_fields(self):
        if self.intent in SEEKING and self.search is None:
            raise ValueError("A housing search is required when looking for a home, room, or roommate.")
        if self.intent in OFFERING and self.search is not None:
            raise ValueError("Offering profiles describe location and rent in offering, not search.")
        if self.intent in SHARING and self.lifestyle is None:
            raise ValueError("Lifestyle answers are required for shared-living discovery.")
        if self.gender != Gender.self_described and self.gender_description:
            raise ValueError("gender_description is only used with self_described gender.")
        if self.intent not in SHARING and self.roommate_preferences != RoommatePreferences():
            raise ValueError("Roommate preferences apply to shared homes; whole-home discovery uses housing requirements.")
        return self


class ListingLocation(Schema):
    city: ShortText
    area: ShortText
    pincode: Pincode


class NearbyLandmark(Schema):
    kind: LandmarkKind
    name: ShortText
    distance_km: float = Field(ge=0, le=100, description="Provider-declared distance; not independently geocoded or verified.")


class ListingInput(Schema):
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(default="", max_length=3000)
    kind: Literal["entire_home", "private_room", "shared_room"]
    property_type: PropertyType
    provider_relationship: Literal["owner", "tenant"] = Field(description="Owner or an existing tenant offering space.")
    location: ListingLocation
    monthly_rent: Money = Field(gt=0, description="INR for the entire tenancy if entire_home; per incoming person otherwise.")
    deposit: Money = 0
    available_from: date
    minimum_stay_months: int = Field(default=1, ge=1, le=60)
    available_spaces: int = Field(default=1, ge=1, le=20, description="Incoming-person capacity for shared homes; 1 tenancy for an entire home.")
    furnishing: Literal["unfurnished", "semi_furnished", "furnished"] = "unfurnished"
    amenities: list[ShortText] = Field(default_factory=list, max_length=30)
    nearby_landmarks: list[NearbyLandmark] = Field(default_factory=list, max_length=30)
    is_active: bool = True

    @model_validator(mode="after")
    def entire_tenancy(self):
        if self.kind == "entire_home" and self.available_spaces != 1:
            raise ValueError("An entire_home listing offers one tenancy; use available_spaces=1.")
        return self


class OnboardingSubmission(Schema):
    profile: UserProfileInput
    offering: ListingInput | None = Field(default=None, description="Required for either offering intent; one active or paused listing per account in the MVP.")

    @model_validator(mode="after")
    def offering_matches_intent(self):
        intent = self.profile.intent
        if intent in OFFERING:
            if self.offering is None:
                raise ValueError("Tell us about the home or space you are offering before completing signup.")
            if (self.offering.kind == "entire_home") != (intent == Intent.offer_entire_home):
                raise ValueError("offer_entire_home needs an entire_home listing; offer_shared_home needs a private_room or shared_room.")
        elif self.offering is not None:
            raise ValueError("Only offering intents can include a property listing.")
        return self


class SignupRequest(OnboardingSubmission):
    email: EmailStr
    password: SecretStr = Field(min_length=10, max_length=128, description="10–128 characters. Stored only as a salted PBKDF2 hash.")

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, value):
        return value.strip().casefold() if isinstance(value, str) else value


class LoginRequest(Schema):
    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=128)


class MediaTarget(str, Enum):
    profile = "profile"
    property = "property"


class MediaView(Schema):
    id: str
    kind: Literal["photo", "video"]
    url: str = Field(description="API-origin-relative URL, usable in img/video elements after resolving against the backend origin.")
    thumbnail_url: str
    content_type: str
    byte_size: int
    width: int
    height: int
    duration_seconds: float | None
    position: int
    caption: str
    created_at: datetime


class MediaGallery(Schema):
    photos: list[MediaView]
    video: MediaView | None
    cover_photo_url: str | None
    photo_count: int
    minimum_photos: int = 3
    maximum_photos: int = 6
    ready: bool = Field(description="At least 3 and at most 6 photos; the video is optional.")


class OnboardingStatus(Schema):
    complete: bool
    profile_photos_needed: int
    property_photos_needed: int
    next_steps: list[str]


class MediaResponse(Schema):
    target: MediaTarget
    gallery: MediaGallery
    onboarding: OnboardingStatus


class PhotoOrder(Schema):
    photo_ids: list[str] = Field(min_length=1, max_length=6, description="All current photo IDs exactly once, in display order. The first becomes the cover.")

    @model_validator(mode="after")
    def unique_ids(self):
        if len(set(self.photo_ids)) != len(self.photo_ids):
            raise ValueError("Each photo ID must appear exactly once.")
        return self


class MediaCaption(Schema):
    caption: str = Field(max_length=160, description="Accessible description, e.g. 'Bedroom with balcony' or 'Me hiking'.")


class ListingView(ListingInput):
    id: str
    owner_id: str
    created_at: datetime
    media: MediaGallery


class UserProfile(Schema):
    id: str
    email: EmailStr
    profile: UserProfileInput
    offering: ListingView | None
    created_at: datetime
    media: MediaGallery
    onboarding: OnboardingStatus


class AuthResponse(Schema):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    user: UserProfile


class ErrorDetail(Schema):
    code: str
    message: str
    fields: list[dict] = Field(default_factory=list)


class ErrorResponse(Schema):
    error: ErrorDetail


class HealthResponse(Schema):
    status: Literal["ok"] = "ok"
    database: Literal["connected"] = "connected"
    version: str = "0.2.0"


class Notice(Schema):
    message: str


class Compatibility(Schema):
    score: float = Field(ge=0, le=100, description="Ranking score, not a probability of relationship success.")
    cosine_similarity: float | None = Field(default=None, ge=0, le=1)
    method: Literal["weighted_cosine", "housing_fit"]
    reasons: list[str]


class CardLocation(Schema):
    city: str
    areas: list[str]
    pincodes: list[str]
    label: str
    kind: Literal["property", "search_preference"] = Field(description="A seeker's displayed location is where they want to live, not a claim about their current address.")


class Candidate(Schema):
    id: str
    full_name: str
    age: int
    gender: Gender
    occupation: str | None
    bio: str
    intent: Intent
    lifestyle: Lifestyle | None
    offering: ListingView | None
    compatibility: Compatibility
    match_score: float = Field(ge=0, le=100, description="Same value as compatibility.score, directly usable for the match badge.")
    card_type: Literal["person", "property"]
    title: str = Field(description="Person's name or offered property's title, depending on card_type.")
    location: CardLocation
    media: MediaGallery = Field(description="Primary swipe gallery: property media for offers, person media for seekers.")
    profile_media: MediaGallery = Field(description="The person's own gallery, including when the main card shows a property.")
    budget: Budget | None
    badges: list[str]


class FeedResponse(Schema):
    items: list[Candidate]
    total: int
    limit: int
    offset: int
    has_more: bool
    next_offset: int | None


class ListingFeedItem(Schema):
    listing: ListingView
    compatibility: Compatibility
    match_score: float = Field(ge=0, le=100)
    provider_name: str


class ListingFeed(Schema):
    items: list[ListingFeedItem]
    total: int
    limit: int
    offset: int
    has_more: bool
    next_offset: int | None


class SwipeRequest(Schema):
    target_id: str = Field(min_length=1, max_length=36)
    direction: Literal["like", "pass", "superlike"]


class SwipeResponse(Schema):
    matched: bool
    match_id: str | None
    message: str


class MatchView(Schema):
    id: str
    other_user: Candidate
    compatibility_score: float
    created_at: datetime


class MessageInput(Schema):
    content: str = Field(min_length=1, max_length=2000)


class MessageView(MessageInput):
    id: str
    match_id: str
    sender_id: str
    created_at: datetime


class StableRequest(Schema):
    participant_ids: list[str] = Field(min_length=2, max_length=20, description="Even cohort of distinct seek_roommate accounts, including you. Other participants must be your active mutual matches.")

    @model_validator(mode="after")
    def even_unique_cohort(self):
        if len(self.participant_ids) % 2 or len(set(self.participant_ids)) != len(self.participant_ids):
            raise ValueError("Irving requires an even number of distinct participants (2–20).")
        return self


class StablePair(Schema):
    user1_id: str
    user2_id: str
    score: float


class StableResponse(Schema):
    algorithm: Literal["irving"] = "irving"
    status: Literal["stable", "no_stable_matching"]
    pairs: list[StablePair]
    unpaired_ids: list[str]
    message: str
    tie_break: str = "Equal cosine scores are ordered by user UUID (ascending)."


class RentRoom(Schema):
    id: ShortText
    name: ShortText
    amenities: list[ShortText] = Field(default_factory=list, max_length=20)


class RentParticipant(Schema):
    id: ShortText = Field(description="Session-local participant ID; need not be a user UUID.")
    name: ShortText
    valuations: dict[str, Money] = Field(description="Your value for each room in INR/month, keyed by room ID. Utility = declared value minus rent.")
    max_budget: Money | None = Field(default=None, description="Used to report affordability, not to alter the envy calculation.")


class RentRequest(Schema):
    apartment_name: ShortText = "Our home"
    total_rent: Money = Field(gt=0)
    rooms: list[RentRoom] = Field(min_length=2, max_length=3)
    participants: list[RentParticipant] = Field(min_length=2, max_length=3)
    resolution: int = Field(default=60, ge=4, le=100, description="Number of price-grid divisions; higher is finer. MVP supports 2 or 3 rooms.")
    tolerance: Money = Field(default=50, description="Maximum acceptable envy in INR/month, explicitly reported in the result.")

    @model_validator(mode="after")
    def square_valuations(self):
        room_ids = {room.id for room in self.rooms}
        if len(room_ids) != len(self.rooms):
            raise ValueError("Room IDs must be unique.")
        if len(self.participants) != len(self.rooms) or len({p.id for p in self.participants}) != len(self.participants):
            raise ValueError("Provide one distinct participant per room (2 or 3).")
        if any(set(p.valuations) != room_ids for p in self.participants):
            raise ValueError("Every participant must value every room exactly once using its room ID.")
        return self


class RentAllocation(Schema):
    participant_id: str
    room_id: str
    monthly_rent: float
    utility: float
    envy: float = Field(description="Best alternative room utility minus assigned utility, floored at zero (INR).")
    within_budget: bool | None


class RentCalculation(Schema):
    id: str
    algorithm: Literal["sperner_discrete_approximation"] = "sperner_discrete_approximation"
    method: Literal["fully_labelled_simplex", "grid_fallback"]
    status: Literal["envy_free_within_tolerance", "approximate"]
    total_rent: float
    allocations: list[RentAllocation]
    max_envy: float
    tolerance: float
    resolution: int
    grid_step: float
    fully_labelled_simplices: int
    message: str


class LeaseRequest(Schema):
    text: str = Field(min_length=10, max_length=20000)


class LeaseClause(Schema):
    clause: str
    risk: Literal["high", "medium", "info"]
    explanation: str
    question_to_ask: str


class LeaseAnalysis(Schema):
    engine: Literal["local_heuristic"] = "local_heuristic"
    clauses: list[LeaseClause]
    summary: str


class QuestionOption(Schema):
    value: str
    label: str


class Question(Schema):
    field: str
    prompt: str
    help_text: str
    input_type: Literal["text", "number", "date", "single_choice", "multi_choice", "boolean", "scale", "object", "list", "password", "email", "photos", "video"]
    required: bool = False
    applies_to: list[Intent] = Field(default_factory=lambda: list(Intent))
    options: list[QuestionOption] = Field(default_factory=list)
    used_for: list[str] = Field(default_factory=list)
    upload_endpoint: str | None = Field(default=None, description="For media questions: upload after signup using the bearer token, not as a JSON signup field.")
    minimum_files: int | None = None
    maximum_files: int | None = None
    accepted_types: list[str] = Field(default_factory=list)
    max_file_bytes: int | None = None
    max_duration_seconds: int | None = None


class QuestionSection(Schema):
    id: str
    title: str
    questions: list[Question]


class Questionnaire(Schema):
    version: str = "1.1"
    introduction: str
    sections: list[QuestionSection]
    validation_schema: str = "/openapi.json#/components/schemas/SignupRequest"
