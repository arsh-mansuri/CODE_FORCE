from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .database import get_db
from .media_storage import prepare_photo, prepare_video, remove_files
from .media_views import gallery_assets, media_response, media_view
from .models import MediaAsset, User
from .schemas import ErrorResponse, MediaCaption, MediaResponse, MediaTarget, MediaView, PhotoOrder
from .security import current_user, problem


router = APIRouter(prefix="/api/media", tags=["Media"], responses={
    401: {"model": ErrorResponse, "description": "A bearer session is required to manage uploads."},
    404: {"model": ErrorResponse, "description": "Media is unavailable or belongs to another account."},
    409: {"model": ErrorResponse, "description": "Gallery limit, duplicate media, or invalid state."},
    413: {"model": ErrorResponse, "description": "File or total upload exceeds the size limit."},
    415: {"model": ErrorResponse, "description": "Unsupported or invalid image/video content."},
    422: {"model": ErrorResponse, "description": "Invalid dimensions, duration, or gallery order."},
    503: {"model": ErrorResponse, "description": "Media storage is temporarily unavailable."},
})
DB = Annotated[Session, Depends(get_db)]
Account = Annotated[User, Depends(current_user)]


def refresh_galleries(db: Session, user: User):
    db.expire(user, ["media_assets", "listing"])
    if user.listing:
        db.expire(user.listing, ["media_assets"])


def lock_gallery(db: Session, user: User, target: str):
    # A harmless write locks this account on SQLite as well as PostgreSQL. Counts
    # are re-read under the lock so simultaneous uploads cannot bypass six photos.
    db.execute(update(User).where(User.id == user.id).values(email=User.email))
    refresh_galleries(db, user)
    if target == "property" and user.listing is None:
        raise problem(409, "offering_required", "Add your property through PUT /api/users/me before uploading its media.")


@router.post("/{target}/photos", status_code=201, response_model=MediaResponse, summary="Upload photos to your profile or property gallery")
def upload_photos(
    target: MediaTarget, request: Request, user: Account, db: DB,
    files: Annotated[list[UploadFile], File(min_length=1, max_length=6, description="One to six JPEG, PNG, or WebP files, at most 10 MiB each. Use multipart field 'files' repeatedly.")],
):
    """Append actual image files. The whole batch succeeds or fails together. Each
    gallery needs 3–6 distinct photos to appear in discovery. Images are decoded,
    oriented, resized to at most 2048 px, and re-encoded as JPEG without EXIF.
    A 480 px thumbnail is also saved. The first photo is the cover; reorder later.
    """
    settings = request.app.state.settings
    prepared = []
    try:
        if target == MediaTarget.property and user.listing is None:
            raise problem(409, "offering_required", "Add your property through PUT /api/users/me before uploading its media.")
        for upload in files:
            prepared.append(prepare_photo(upload, settings))
        lock_gallery(db, user, target.value)
        existing = [a for a in gallery_assets(user, target.value) if a.kind == "photo"]
        if len(existing) + len(prepared) > 6:
            raise problem(409, "photo_limit", "Keep at most 6 photos per gallery. Delete an existing photo before adding another.")
        checksums = {a.checksum for a in existing}
        for asset in prepared:
            if asset.checksum in checksums:
                raise problem(409, "duplicate_photo", "Choose distinct photos; this gallery already contains one of the uploaded images.")
            checksums.add(asset.checksum)
        start = max((a.position for a in existing), default=-1) + 1
        for index, asset in enumerate(prepared):
            db.add(MediaAsset(
                **asdict(asset), owner_id=user.id, target=target.value,
                listing_id=user.listing.id if target == MediaTarget.property else None,
                position=start + index,
                caption=f"{'Property' if target == MediaTarget.property else 'Profile'} photo {start + index + 1}",
            ))
        db.commit()
    except Exception:
        db.rollback()
        remove_files(settings.media_root, prepared)
        raise
    finally:
        for upload in files:
            upload.file.close()
    refresh_galleries(db, user)
    return media_response(user, target.value)


@router.post("/{target}/video", status_code=201, response_model=MediaResponse, summary="Upload or replace an optional intro/walkthrough video")
def upload_video(
    target: MediaTarget, request: Request, user: Account, db: DB,
    file: Annotated[UploadFile, File(description="MP4 (H.264) or WebM (VP8/VP9), up to 50 MiB and 60 seconds, at most 1080p/60fps.")],
):
    """One optional video per gallery. An invalid replacement leaves the existing
    video intact. Actual container, codec, dimensions, duration, and a decoded
    first frame are checked. A poster thumbnail is generated for the swipe card.
    """
    settings = request.app.state.settings
    prepared = None
    retired = []
    try:
        if target == MediaTarget.property and user.listing is None:
            raise problem(409, "offering_required", "Add a property before uploading its walkthrough.")
        prepared = prepare_video(file, settings)
        lock_gallery(db, user, target.value)
        retired = [a for a in gallery_assets(user, target.value) if a.kind == "video"]
        for asset in retired:
            db.delete(asset)
        db.flush()
        db.add(MediaAsset(
            **asdict(prepared), owner_id=user.id, target=target.value,
            listing_id=user.listing.id if target == MediaTarget.property else None,
            caption="Property walkthrough" if target == MediaTarget.property else "Personal introduction",
        ))
        db.commit()
    except Exception:
        db.rollback()
        if prepared:
            remove_files(settings.media_root, [prepared])
        raise
    finally:
        file.file.close()
    remove_files(settings.media_root, retired)
    refresh_galleries(db, user)
    return media_response(user, target.value)


@router.get("/files/{media_id}", response_class=FileResponse, summary="Display a photo or play a video by its media URL", responses={200: {"description": "Image/video bytes. Video responses support HTTP Range seeking."}})
def media_file(media_id: str, request: Request, db: DB):
    """Media URLs are public opaque-ID URLs so img/video tags work without bearer
    headers. Management is owner-only. Only files with live database records are served.
    """
    return serve_file(media_id, False, request, db)


@router.get("/files/{media_id}/thumbnail", response_class=FileResponse, summary="Display a lightweight photo thumbnail or video poster")
def media_thumbnail(media_id: str, request: Request, db: DB):
    return serve_file(media_id, True, request, db)


def serve_file(media_id: str, thumbnail: bool, request: Request, db: Session):
    asset = db.get(MediaAsset, media_id)
    if asset is None:
        raise problem(404, "media_not_found", "This media file is no longer available.")
    filename = asset.thumbnail_filename if thumbnail else asset.filename
    path = request.app.state.settings.media_root / filename
    if not path.is_file():
        raise problem(404, "media_not_found", "This media file is no longer available.")
    return FileResponse(
        path, media_type="image/jpeg" if thumbnail else asset.content_type,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600"},
    )


@router.get("/{target}", response_model=MediaResponse, summary="Read your gallery and media onboarding progress")
def my_gallery(target: MediaTarget, user: Account):
    return media_response(user, target.value)


@router.put("/{target}/photos/order", response_model=MediaResponse, summary="Reorder the carousel and choose the cover photo")
def reorder_photos(target: MediaTarget, body: PhotoOrder, user: Account, db: DB):
    lock_gallery(db, user, target.value)
    photos = {a.id: a for a in gallery_assets(user, target.value) if a.kind == "photo"}
    if set(body.photo_ids) != set(photos):
        raise problem(422, "invalid_photo_order", "Supply every current photo ID in this gallery exactly once; the first becomes the cover.")
    for position, photo_id in enumerate(body.photo_ids):
        photos[photo_id].position = position
    db.commit()
    refresh_galleries(db, user)
    return media_response(user, target.value)


@router.patch("/items/{media_id}", response_model=MediaView, summary="Describe one of your photos or videos")
def update_caption(media_id: str, body: MediaCaption, user: Account, db: DB):
    asset = db.scalar(select(MediaAsset).where(MediaAsset.id == media_id, MediaAsset.owner_id == user.id))
    if asset is None:
        raise problem(404, "media_not_found", "This media is not available to your account.")
    asset.caption = body.caption
    db.commit()
    return media_view(asset)


@router.delete("/items/{media_id}", response_model=MediaResponse, summary="Remove one of your photos or videos")
def delete_media(media_id: str, request: Request, user: Account, db: DB):
    lock_gallery(db, user, "profile")
    asset = db.scalar(select(MediaAsset).where(MediaAsset.id == media_id, MediaAsset.owner_id == user.id))
    if asset is None:
        raise problem(404, "media_not_found", "This media is not available to your account.")
    target = asset.target
    db.delete(asset)
    photos = sorted(
        (a for a in gallery_assets(user, target) if a.kind == "photo" and a.id != media_id),
        key=lambda a: (a.position, a.id),
    )
    for position, photo in enumerate(photos):
        photo.position = position
    db.commit()
    remove_files(request.app.state.settings.media_root, [asset])
    refresh_galleries(db, user)
    return media_response(user, target)
