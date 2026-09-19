"""Seed galleries from supplied property photos and labelled profile illustrations."""
from dataclasses import asdict
from io import BytesIO

from fastapi import UploadFile
from PIL import Image, ImageDraw, ImageFont

from .config import BACKEND_DIR
from .media_storage import prepare_photo, remove_files
from .media_views import gallery_assets
from .models import MediaAsset


def property_photo_paths(image_set: str):
    """Seed originals live beside the backend, independently of MEDIA_ROOT."""
    paths = [BACKEND_DIR / "uploads" / f"{image_set}{suffix}.jpeg" for suffix in ("", "i1", "i2")]
    for path in paths:
        if not path.is_file():
            raise FileNotFoundError(f"Missing seed property photo: {path}")
    return paths


def sync_property_gallery(db, user, target, settings, image_set, created_files, retired_files):
    """Use exactly the chosen three photos, keeping unchanged media IDs on reruns."""
    existing = gallery_assets(user, target)
    retained = set()
    for position, path in enumerate(property_photo_paths(image_set)):
        with path.open("rb") as source:
            upload = UploadFile(filename=path.name, file=source, size=path.stat().st_size)
            # These fixed, curated seed files bypass the upload face heuristic
            # (which flags p1's facade), but retain decoding/size validation.
            prepared = prepare_photo(upload, settings)
        asset = next((a for a in existing if a.kind == "photo" and a.checksum == prepared.checksum), None)
        if asset is not None and all((settings.media_root / name).is_file() for name in (asset.filename, asset.thumbnail_filename)):
            remove_files(settings.media_root, [prepared])
        else:
            created_files.append(prepared)
            if asset is not None:
                retired_files.append(asset)
                db.delete(asset)
                db.flush()
                existing.remove(asset)
            asset = MediaAsset(
                **asdict(prepared), owner_id=user.id,
                listing_id=user.listing.id if target == "property" else None,
                target=target,
            )
            db.add(asset)
        asset.position = position
        asset.caption = f"Seed property photo: {path.name}"
        retained.add(asset.id)
    for asset in existing:
        if asset.id not in retained:
            retired_files.append(asset)
            db.delete(asset)


def demo_photo(target: str, name: str, variant: int, palette: int) -> bytes:
    colours = [(49, 64, 110), (111, 57, 87), (39, 101, 91), (126, 85, 47)]
    base = colours[palette % len(colours)]
    image = Image.new("RGB", (600, 800), base)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=26)
    small = ImageFont.load_default(size=18)
    if target == "profile":
        draw.ellipse((180 + variant * 8, 120, 410 + variant * 8, 350), fill=(232, 204, 179))
        draw.rounded_rectangle((90, 390, 510, 700), radius=100, fill=(107 + variant * 25, 149, 187))
        draw.ellipse((235 + variant * 8, 215, 245 + variant * 8, 225), fill=base)
        draw.ellipse((330 + variant * 8, 215, 340 + variant * 8, 225), fill=base)
        draw.arc((260 + variant * 8, 260, 320 + variant * 8, 300), 0, 180, fill=base, width=4)
    else:
        draw.rectangle((45, 120, 555, 650), fill=(228, 219, 200))
        draw.polygon([(45, 570), (555, 570), (555, 700), (45, 700)], fill=(171, 137, 98))
        draw.rectangle((90 + variant * 100, 165, 230 + variant * 100, 340), fill=(123, 184, 201))
        draw.rounded_rectangle((100, 420, 500, 590), radius=25, fill=(base[0] + 40, base[1] + 40, base[2] + 40))
        draw.rectangle((390, 360, 465, 390), fill=(204, 168, 82))
    draw.rectangle((0, 0, 600, 78), fill=(20, 25, 38))
    draw.text((22, 22), "DEMO ILLUSTRATION", font=font, fill="white")
    draw.rectangle((0, 712, 600, 800), fill=(20, 25, 38))
    draw.text((22, 728), name[:35], font=small, fill="white")
    draw.text((22, 764), f"{target.title()} view {variant + 1} / Replace with real uploads", font=small, fill=(186, 201, 227))
    output = BytesIO()
    image.save(output, format="JPEG", quality=90)
    return output.getvalue()


def add_demo_gallery(db, user, target, settings, palette, created_files):
    name = user.listing.data["title"] if target == "property" else user.profile.data["full_name"]
    existing = [asset for asset in gallery_assets(user, target) if asset.kind == "photo"]
    checksums = {asset.checksum for asset in existing}
    count = len(existing)
    position = max((asset.position for asset in existing), default=-1) + 1
    for variant in range(3):
        if count >= 3:
            break
        data = demo_photo(target, name, variant, palette)
        upload = UploadFile(filename="demo.jpg", file=BytesIO(data), size=len(data))
        try:
            prepared = prepare_photo(upload, settings, target=target)
        finally:
            upload.file.close()
        if prepared.checksum in checksums:
            remove_files(settings.media_root, [prepared])
            continue
        created_files.append(prepared)
        asset = MediaAsset(
            **asdict(prepared), owner_id=user.id,
            listing_id=user.listing.id if target == "property" else None,
            target=target, position=position, caption=f"Generated demo illustration: {target} view {position + 1}",
        )
        db.add(asset)
        checksums.add(prepared.checksum)
        count += 1
        position += 1
