"""Shared media DTOs and discovery readiness, independent of upload processing."""
from datetime import timezone

from .models import Listing, MediaAsset, User
from .schemas import ListingPublicationStatus, MediaGallery, MediaResponse, MediaView, OnboardingStatus
from .security import problem


def media_view(asset: MediaAsset) -> MediaView:
    return MediaView(
        id=asset.id, kind=asset.kind, url=f"/api/media/files/{asset.id}",
        thumbnail_url=f"/api/media/files/{asset.id}/thumbnail", content_type=asset.content_type,
        byte_size=asset.byte_size, width=asset.width, height=asset.height,
        duration_seconds=asset.duration_seconds, position=asset.position, caption=asset.caption,
        created_at=asset.created_at.replace(tzinfo=timezone.utc),
    )


def gallery_view(assets) -> MediaGallery:
    photos = sorted((a for a in assets if a.kind == "photo"), key=lambda a: (a.position, a.id))
    video = next((a for a in assets if a.kind == "video"), None)
    return MediaGallery(
        photos=[media_view(a) for a in photos], video=media_view(video) if video else None,
        cover_photo_url=f"/api/media/files/{photos[0].id}" if photos else None,
        photo_count=len(photos), ready=3 <= len(photos) <= 6,
    )


def gallery_assets(user: User, target: str):
    if target == "profile":
        return [a for a in user.media_assets if a.target == "profile"]
    return list(user.listing.media_assets) if user.listing else []


def listing_publication_status(listing: Listing | None) -> ListingPublicationStatus | None:
    if listing is None:
        return None
    if not listing.is_active:
        return "paused"
    photos = sum(asset.kind == "photo" for asset in listing.media_assets)
    return "published" if 3 <= photos <= 6 else "needs_photos"


def onboarding_status(user: User) -> OnboardingStatus:
    profile_count = sum(a.kind == "photo" for a in gallery_assets(user, "profile"))
    property_count = sum(a.kind == "photo" for a in gallery_assets(user, "property"))
    profile_needed = max(0, 3 - profile_count)
    property_needed = max(0, 3 - property_count) if user.listing else 0
    steps = []
    if profile_needed:
        steps.append(f"Upload {profile_needed} more profile photo(s) via POST /api/media/profile/photos.")
    if property_needed:
        steps.append(f"Upload {property_needed} more property photo(s) via POST /api/media/property/photos.")
    return OnboardingStatus(
        complete=not steps, profile_photos_needed=profile_needed,
        property_photos_needed=property_needed, next_steps=steps,
        listing_status=listing_publication_status(user.listing),
    )


def require_discovery_ready(user: User):
    status = onboarding_status(user)
    if not status.complete:
        raise problem(409, "media_onboarding_incomplete", " ".join(status.next_steps))


def media_response(user: User, target: str) -> MediaResponse:
    return MediaResponse(target=target, gallery=gallery_view(gallery_assets(user, target)), onboarding=onboarding_status(user))
