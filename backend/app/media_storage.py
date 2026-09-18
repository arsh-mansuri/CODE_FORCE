"""Local validated media storage. Filenames are generated, never supplied by clients."""
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import logging
from pathlib import Path
import warnings

import av
from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import Settings
from .models import new_id
from .security import problem


@dataclass
class PreparedMedia:
    id: str
    kind: str
    filename: str
    thumbnail_filename: str
    content_type: str
    byte_size: int
    width: int
    height: int
    duration_seconds: float | None
    checksum: str


def remove_files(root: Path, assets):
    for asset in assets:
        for filename in (asset.filename, asset.thumbnail_filename):
            try:
                (root / filename).unlink(missing_ok=True)
            except OSError:
                logging.getLogger(__name__).warning("Could not remove a retired media file: %s", filename)


def read_limited(upload: UploadFile, maximum: int) -> bytes:
    if upload.size is not None and upload.size > maximum:
        raise problem(413, "file_too_large", f"This file exceeds the {maximum // (1024 * 1024)} MiB limit.")
    data = bytearray()
    while chunk := upload.file.read(64 * 1024):
        data.extend(chunk)
        if len(data) > maximum:
            raise problem(413, "file_too_large", f"This file exceeds the {maximum // (1024 * 1024)} MiB limit.")
    if not data:
        raise problem(422, "empty_media", "Choose a non-empty photo or video file.")
    return bytes(data)


def jpeg_bytes(image: Image.Image, maximum: tuple[int, int]) -> bytes:
    image = image.convert("RGB")
    image.thumbnail(maximum, Image.Resampling.LANCZOS)
    output = BytesIO()
    # No EXIF/ICC metadata is carried into the encoded image.
    image.save(output, format="JPEG", quality=87, optimize=True)
    return output.getvalue()


def prepare_photo(upload: UploadFile, settings: Settings) -> PreparedMedia:
    data = read_limited(upload, settings.max_photo_bytes)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as probe:
                if probe.format not in {"JPEG", "PNG", "WEBP"}:
                    raise problem(415, "unsupported_photo", "Upload a JPEG, PNG, or WebP photo.")
                if probe.width * probe.height > 20_000_000 or min(probe.size) < 160:
                    raise problem(422, "photo_dimensions", "Photos must be at least 160 × 160 pixels and at most 20 megapixels.")
                if getattr(probe, "is_animated", False):
                    raise problem(415, "animated_photo", "Choose a still photo; use the video endpoint for motion.")
                probe.verify()
            with Image.open(BytesIO(data)) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
                image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
                width, height = image.size
                encoded = jpeg_bytes(image, (2048, 2048))
                thumbnail = jpeg_bytes(image, (480, 480))
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise problem(415, "invalid_photo", "The file could not be decoded as a supported photo.") from exc
    media_id = new_id()
    asset = PreparedMedia(
        id=media_id, kind="photo", filename=f"{media_id}.jpg", thumbnail_filename=f"{media_id}.thumb.jpg",
        content_type="image/jpeg", byte_size=len(encoded), width=width, height=height,
        duration_seconds=None, checksum=sha256(encoded).hexdigest(),
    )
    try:
        (settings.media_root / asset.filename).write_bytes(encoded)
        (settings.media_root / asset.thumbnail_filename).write_bytes(thumbnail)
    except OSError as exc:
        remove_files(settings.media_root, [asset])
        raise problem(503, "media_storage_unavailable", "The media could not be saved. Please retry shortly.") from exc
    return asset


def prepare_video(upload: UploadFile, settings: Settings) -> PreparedMedia:
    data = read_limited(upload, settings.max_video_bytes)
    # Recognise the actual container before asking a decoder to inspect it.
    if len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] != b"qt  ":
        extension, content_type, codecs = "mp4", "video/mp4", {"h264"}
    elif data.startswith(b"\x1a\x45\xdf\xa3"):
        extension, content_type, codecs = "webm", "video/webm", {"vp8", "vp9"}
    else:
        raise problem(415, "unsupported_video", "Upload an MP4 (H.264) or WebM (VP8/VP9) video.")
    try:
        with av.open(BytesIO(data)) as container:
            if not container.streams.video:
                raise problem(422, "video_track_required", "The upload must contain a playable video track, not only audio.")
            if len(container.streams.video) != 1:
                raise problem(422, "single_video_track", "Upload a video with one video track.")
            stream = container.streams.video[0]
            if stream.codec_context.name not in codecs:
                raise problem(415, "unsupported_video_codec", "Use H.264 in MP4 or VP8/VP9 in WebM for browser playback.")
            allowed_audio = {"aac", "mp3"} if extension == "mp4" else {"opus", "vorbis"}
            if any(s.codec_context.name not in allowed_audio for s in container.streams.audio):
                raise problem(415, "unsupported_audio_codec", "Use AAC/MP3 audio in MP4 or Opus/Vorbis audio in WebM.")
            durations = [container.duration / av.time_base] if container.duration is not None else []
            if stream.duration is not None and stream.time_base is not None:
                durations.append(float(stream.duration * stream.time_base))
            if not durations or min(durations) <= 0:
                raise problem(422, "unknown_video_duration", "Export the video with a valid duration before uploading.")
            duration = max(durations)
            if duration > settings.max_video_seconds:
                raise problem(422, "video_too_long", f"Keep your introduction or walkthrough within {settings.max_video_seconds} seconds.")
            width, height = stream.codec_context.width, stream.codec_context.height
            if width <= 0 or height <= 0 or width * height > 1920 * 1080:
                raise problem(422, "video_dimensions", "Upload a video up to 1920 × 1080 pixels (portrait is also supported).")
            if stream.average_rate is not None and float(stream.average_rate) > 60:
                raise problem(422, "video_frame_rate", "Upload a video at 60 frames per second or less.")
            first_frame = next(container.decode(stream), None)
            if first_frame is None:
                raise problem(422, "empty_video", "No video frame could be decoded from this file.")
            if first_frame.format.name not in {"yuv420p", "yuvj420p"}:
                raise problem(415, "unsupported_pixel_format", "Export a standard 8-bit 4:2:0 video for browser playback.")
            thumbnail = jpeg_bytes(first_frame.to_image(), (480, 480))
    except (av.FFmpegError, ValueError, OSError) as exc:
        raise problem(415, "invalid_video", "The video is damaged or could not be decoded.") from exc
    media_id = new_id()
    asset = PreparedMedia(
        id=media_id, kind="video", filename=f"{media_id}.{extension}", thumbnail_filename=f"{media_id}.thumb.jpg",
        content_type=content_type, byte_size=len(data), width=width, height=height,
        duration_seconds=round(duration, 3), checksum=sha256(data).hexdigest(),
    )
    try:
        (settings.media_root / asset.filename).write_bytes(data)
        (settings.media_root / asset.thumbnail_filename).write_bytes(thumbnail)
    except OSError as exc:
        remove_files(settings.media_root, [asset])
        raise problem(503, "media_storage_unavailable", "The media could not be saved. Please retry shortly.") from exc
    return asset
