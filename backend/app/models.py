from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, Boolean, CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_id() -> str:
    return str(uuid4())


def utcnow() -> datetime:
    # UTC-naive storage is portable between SQLite and PostgreSQL.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    profile: Mapped["Profile"] = relationship(cascade="all, delete-orphan", uselist=False)
    listing: Mapped["Listing | None"] = relationship(cascade="all, delete-orphan", uselist=False)
    media_assets: Mapped[list["MediaAsset"]] = relationship(cascade="all, delete-orphan")
    deletion_request: Mapped["AccountDeletionRequest | None"] = relationship(cascade="all, delete-orphan", uselist=False)


class AccountDeletionRequest(Base):
    __tablename__ = "account_deletion_requests"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    requested_at: Mapped[datetime] = mapped_column(default=utcnow)
    scheduled_for: Mapped[datetime] = mapped_column(index=True)


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    # Structured, validated value objects; identity and transactional entities remain relational.
    data: Mapped[dict] = mapped_column(JSON)


class Listing(Base):
    __tablename__ = "listings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    data: Mapped[dict] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    media_assets: Mapped[list["MediaAsset"]] = relationship(cascade="all, delete-orphan")


class MediaAsset(Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        UniqueConstraint("owner_id", "target", "checksum"),
        CheckConstraint("target IN ('profile', 'property')"),
        CheckConstraint("kind IN ('photo', 'video')"),
        CheckConstraint("(target = 'profile' AND listing_id IS NULL) OR (target = 'property' AND listing_id IS NOT NULL)"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    listing_id: Mapped[str | None] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), index=True)
    target: Mapped[str] = mapped_column(String(12))
    kind: Mapped[str] = mapped_column(String(8))
    filename: Mapped[str] = mapped_column(String(64), unique=True)
    thumbnail_filename: Mapped[str] = mapped_column(String(64), unique=True)
    content_type: Mapped[str] = mapped_column(String(40))
    byte_size: Mapped[int]
    width: Mapped[int]
    height: Mapped[int]
    duration_seconds: Mapped[float | None]
    position: Mapped[int] = mapped_column(default=0)
    caption: Mapped[str] = mapped_column(String(160), default="")
    checksum: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime]


class PasswordReset(Base):
    __tablename__ = "password_resets"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime]


class Swipe(Base):
    __tablename__ = "swipes"
    __table_args__ = (
        UniqueConstraint("swiper_id", "target_id"),
        CheckConstraint("swiper_id <> target_id"),
        CheckConstraint("direction IN ('like', 'pass', 'superlike')"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    swiper_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    direction: Mapped[str] = mapped_column(String(12))
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class SwipeNote(Base):
    __tablename__ = "swipe_notes"
    swipe_id: Mapped[str] = mapped_column(ForeignKey("swipes.id", ondelete="CASCADE"), primary_key=True)
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("user1_id", "user2_id"),
        CheckConstraint("user1_id < user2_id"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user1_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user2_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    compatibility_score: Mapped[float]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    match_id: Mapped[str] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class PropertyReview(Base):
    __tablename__ = "property_reviews"
    __table_args__ = (
        UniqueConstraint("listing_id", "author_id"),
        CheckConstraint("rating BETWEEN 1 AND 5"),
        CheckConstraint("experience IN ('connected', 'visited', 'lived_here')"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int]
    experience: Mapped[str] = mapped_column(String(12))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    author: Mapped["User"] = relationship()
    photos: Mapped[list["ReviewPhoto"]] = relationship(cascade="all, delete-orphan")


class ReviewPhoto(Base):
    __tablename__ = "review_photos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    review_id: Mapped[str] = mapped_column(ForeignKey("property_reviews.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(64), unique=True)
    thumbnail_filename: Mapped[str] = mapped_column(String(64), unique=True)
    width: Mapped[int]
    height: Mapped[int]
    position: Mapped[int]


class ReviewHelpful(Base):
    __tablename__ = "review_helpful"
    review_id: Mapped[str] = mapped_column(ForeignKey("property_reviews.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class RentSession(Base):
    __tablename__ = "rent_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    creator_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    request_data: Mapped[dict] = mapped_column(JSON)
    result_data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
