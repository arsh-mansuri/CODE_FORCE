"""Offline demo illustrations, clearly labelled rather than posing as real photos."""
from dataclasses import asdict
from io import BytesIO

from fastapi import UploadFile
from PIL import Image, ImageDraw, ImageFont

from .media_storage import prepare_photo
from .models import MediaAsset


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
    for position in range(3):
        data = demo_photo(target, name, position, palette)
        upload = UploadFile(filename="demo.jpg", file=BytesIO(data), size=len(data))
        try:
            prepared = prepare_photo(upload, settings, target=target)
        finally:
            upload.file.close()
        created_files.append(prepared)
        asset = MediaAsset(
            **asdict(prepared), owner_id=user.id,
            listing_id=user.listing.id if target == "property" else None,
            target=target, position=position, caption=f"Generated demo illustration: {target} view {position + 1}",
        )
        db.add(asset)
