from datetime import datetime
from typing import Literal

from pydantic import Field

from .schemas import ListingView, Schema


ReviewExperience = Literal["connected", "visited", "lived_here"]


class ReviewPhotoView(Schema):
    id: str
    url: str
    thumbnail_url: str
    width: int
    height: int


class PropertyReviewView(Schema):
    id: str
    listing_id: str
    author_id: str
    author_name: str
    author_avatar: str | None
    rating: int = Field(ge=1, le=5)
    experience: ReviewExperience
    content: str
    created_at: datetime
    photos: list[ReviewPhotoView]
    helpful_count: int
    helpful_by_me: bool
    is_mine: bool


class PropertyReviewFeed(Schema):
    items: list[PropertyReviewView]
    highlights: list[PropertyReviewView]
    total: int
    average_rating: float | None
    limit: int
    offset: int
    has_more: bool
    next_offset: int | None
    can_review: bool
    own_review_id: str | None
    eligibility_message: str


class ReviewedProperty(Schema):
    listing: ListingView
    provider_name: str
    provider_avatar: str | None
    match_id: str | None
    match_score: float | None
    active_match: bool
    is_owner: bool
    review_count: int
    average_rating: float | None


class HelpfulInput(Schema):
    helpful: bool
