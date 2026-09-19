from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from io import BytesIO

import av
from fastapi.testclient import TestClient
from PIL import Image
import pytest
from sqlalchemy import func, select

from app.config import Settings
from app.examples import signup_example
from app.main import create_app
from app.models import MediaAsset
from app.schemas import Intent
from conftest import photo_bytes


def video_bytes(*, variant=0, seconds=1, container_format="mp4"):
    output = BytesIO()
    with av.open(output, mode="w", format=container_format) as container:
        stream = container.add_stream("libx264" if container_format == "mp4" else "libvpx-vp9", rate=5)
        stream.width, stream.height, stream.pix_fmt = 320, 240, "yuv420p"
        for index in range(seconds * 5):
            frame = av.VideoFrame(320, 240, "yuv420p")
            for plane in frame.planes:
                plane.update(bytes([80 + variant * 20 + index % 20]) * plane.buffer_size)
            frame.pts = index
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
    return output.getvalue()


def upload_video(client, headers, data, target="profile", content_type="video/mp4"):
    return client.post(f"/api/media/{target}/video", headers=headers, files={"file": ("walkthrough.mp4", data, content_type)})


def test_signup_can_browse_before_photos_but_connecting_requires_photos(client, register, upload_photos):
    ready, ready_headers, _ = register()
    draft, headers, _ = register(complete_media=False)
    progress = draft["user"]["onboarding"]
    assert progress["complete"] is False
    assert progress["profile_photos_needed"] == 3
    assert client.get("/api/list", headers=headers).json()["items"][0]["id"] == ready["user"]["id"]
    assert client.post("/api/swipe", headers=headers, json={"target_id": ready["user"]["id"], "direction": "like"}).json()["error"]["code"] == "media_onboarding_incomplete"
    assert client.get("/api/list", headers=ready_headers).json()["items"] == []
    swipe = client.post("/api/swipe", headers=ready_headers, json={"target_id": draft["user"]["id"], "direction": "like"})
    assert swipe.status_code == 409
    assert upload_photos(headers, indices=(0, 1)).json()["onboarding"]["profile_photos_needed"] == 1
    assert client.get("/api/list", headers=headers).status_code == 200
    result = upload_photos(headers, indices=(2,)).json()
    assert result["gallery"]["ready"] is True
    assert result["onboarding"]["complete"] is True
    assert result["gallery"]["video"] is None
    assert client.get("/api/list", headers=headers).json()["items"][0]["id"] == ready["user"]["id"]


def test_property_and_person_galleries_are_distinct_and_both_required(client, register, upload_photos):
    _, seeker, _ = register(Intent.seek_room)
    host, headers, _ = register(Intent.offer_shared_home, complete_media=False)
    assert upload_photos(headers).json()["onboarding"]["property_photos_needed"] == 3
    assert client.get("/api/listings", headers=seeker).json()["items"] == []
    result = upload_photos(headers, "property").json()
    assert result["onboarding"]["complete"] is True
    card = client.get("/api/list", headers=seeker).json()["items"][0]
    assert card["card_type"] == "property"
    assert card["title"] == host["user"]["offering"]["title"]
    assert card["full_name"] == host["user"]["profile"]["full_name"]
    assert card["location"]["label"] == "Navrangpura, Ahmedabad"
    assert card["location"]["kind"] == "property"
    assert card["location"]["pincodes"] == ["380009"]
    assert card["match_score"] == card["compatibility"]["score"]
    assert 0 <= card["match_score"] <= 100
    assert card["media"]["cover_photo_url"] == result["gallery"]["cover_photo_url"]
    assert card["media"]["cover_photo_url"] != card["profile_media"]["cover_photo_url"]
    listed = client.get("/api/listings", headers=seeker).json()["items"][0]
    assert listed["match_score"] == card["match_score"]
    assert listed["provider_name"] == card["full_name"]
    assert listed["listing"]["media"]["photo_count"] == 3


def test_cards_rank_requirements_not_photos_and_paginate(client, register, upload_photos):
    _, headers, _ = register()
    perfect, hp, _ = register()
    less_aligned, _, _ = register(mutate=lambda body: body["profile"]["lifestyle"].update(cleanliness=1, sleep_schedule="night_owl"))
    response = client.get("/api/list?limit=1", headers=headers).json()
    assert response["total"] == 2
    assert response["has_more"] is True and response["next_offset"] == 1
    first = response["items"][0]
    assert first["id"] == perfect["user"]["id"]
    assert first["match_score"] == 100
    assert first["card_type"] == "person"
    assert first["location"]["kind"] == "search_preference"
    assert first["budget"]["maximum"] == 15000
    assert "email" not in first and "roommate_preferences" not in first
    second = client.get("/api/list?limit=1&offset=1", headers=headers).json()
    assert second["items"][0]["id"] == less_aligned["user"]["id"]
    assert second["items"][0]["match_score"] < first["match_score"]
    assert second["next_offset"] is None
    filtered = client.get("/api/list?min_match_score=100", headers=headers).json()
    assert filtered["total"] == 1
    assert client.get("/api/list?min_match_score=101", headers=headers).status_code == 422
    # Changing the cover/gallery has no effect on the numerical requirements score.
    assert upload_photos(hp, indices=(3,)).status_code == 201
    assert client.get("/api/users/feed?min_match_score=100", headers=headers).json()["items"][0]["match_score"] == 100


def test_photo_content_thumbnails_orientation_and_exif_removal(client, register):
    _, headers, _ = register(complete_media=False)
    output = BytesIO()
    exif = Image.Exif()
    exif[274] = 6  # Rotate the original landscape image into portrait orientation.
    exif[270] = "private EXIF description"
    Image.new("RGB", (320, 240), color="purple").save(output, format="JPEG", exif=exif)
    result = client.post("/api/media/profile/photos", headers=headers, files={"files": ("../../portrait.jpg", output.getvalue(), "image/jpeg")})
    assert result.status_code == 201, result.text
    photo = result.json()["gallery"]["photos"][0]
    assert (photo["width"], photo["height"]) == (240, 320)
    fetched = client.get(photo["url"])
    assert fetched.status_code == 200
    assert fetched.headers["content-type"] == "image/jpeg"
    assert fetched.headers["x-content-type-options"] == "nosniff"
    with Image.open(BytesIO(fetched.content)) as image:
        assert not image.getexif()
    assert client.get(photo["thumbnail_url"]).status_code == 200
    assert "portrait.jpg" not in photo["url"]


def test_photo_count_duplicates_and_failed_batches_are_atomic(client, register, upload_photos, app):
    _, headers, _ = register(complete_media=False)
    assert upload_photos(headers, indices=(0, 0, 1)).status_code == 409
    assert not list(app.state.settings.media_root.iterdir())
    response = client.post("/api/media/profile/photos", headers=headers, files=[
        ("files", ("good.jpg", photo_bytes(), "image/jpeg")),
        ("files", ("fake.jpg", b"not actually an image", "image/jpeg")),
    ])
    assert response.status_code == 415
    assert not list(app.state.settings.media_root.iterdir())
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(MediaAsset)) == 0
    assert upload_photos(headers, indices=(0, 1, 2, 3, 4, 5)).status_code == 201
    assert upload_photos(headers, indices=(6,)).json()["error"]["code"] == "photo_limit"
    assert len(list(app.state.settings.media_root.iterdir())) == 12  # originals + thumbnails
    assert upload_photos(headers, indices=(0, 1, 2, 3, 4, 5, 6)).status_code == 422
    assert client.get("/api/media/profile", headers=headers).json()["gallery"]["photo_count"] == 6


def test_photo_file_size_and_dimensions(client, register, app):
    _, headers, _ = register(complete_media=False)
    app.state.settings = replace(app.state.settings, max_photo_bytes=100)
    response = client.post("/api/media/profile/photos", headers=headers, files={"files": ("photo.jpg", photo_bytes(), "image/jpeg")})
    assert response.status_code == 413
    app.state.settings = replace(app.state.settings, max_photo_bytes=10 * 1024 * 1024)
    small = BytesIO()
    Image.new("RGB", (80, 80)).save(small, format="PNG")
    assert client.post("/api/media/profile/photos", headers=headers, files={"files": ("small.png", small.getvalue(), "image/png")}).status_code == 422
    assert client.post("/api/media/profile/photos", headers=headers, files={"files": ("empty.jpg", b"", "image/jpeg")}).status_code == 422
    assert client.post("/api/media/profile/photos", files={"files": ("photo.jpg", photo_bytes(), "image/jpeg")}).status_code == 401


@pytest.mark.parametrize("chunked", [False, True])
def test_total_upload_limit_before_multipart_spooling(tmp_path, chunked):
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'limits.db'}", media_root=tmp_path / "uploads", max_photo_bytes=100, max_video_bytes=100)
    with TestClient(create_app(settings)) as client:
        body = b'--boundary\r\nContent-Disposition: form-data; name="files"; filename="large.jpg"\r\nContent-Type: image/jpeg\r\n\r\n' + b"x" * 1_100_000 + b"\r\n--boundary--\r\n"
        content = (body[i:i + 65536] for i in range(0, len(body), 65536)) if chunked else body
        response = client.post("/api/media/profile/photos", headers={"Content-Type": "multipart/form-data; boundary=boundary"}, content=content)
        assert response.status_code == 413, response.text
        assert response.json()["error"]["code"] == "upload_too_large"


def test_gallery_order_cover_captions_deletion_and_ownership(client, register):
    user, headers, _ = register()
    _, outsider, _ = register()
    photos = user["user"]["media"]["photos"]
    ids = [p["id"] for p in photos]
    assert client.patch(f"/api/media/items/{ids[0]}", headers=outsider, json={"caption": "Changed"}).status_code == 404
    assert client.delete(f"/api/media/items/{ids[0]}", headers=outsider).status_code == 404
    assert client.put("/api/media/profile/photos/order", headers=headers, json={"photo_ids": ids[:2]}).status_code == 422
    ordered = client.put("/api/media/profile/photos/order", headers=headers, json={"photo_ids": ids[::-1]}).json()["gallery"]
    assert [p["id"] for p in ordered["photos"]] == ids[::-1]
    assert ordered["cover_photo_url"] == photos[-1]["url"]
    caption = client.patch(f"/api/media/items/{ids[-1]}", headers=headers, json={"caption": "Me on a weekend walk"})
    assert caption.json()["caption"] == "Me on a weekend walk"
    deleted = client.delete(f"/api/media/items/{ids[-1]}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["onboarding"]["profile_photos_needed"] == 1
    assert client.get(photos[-1]["url"]).status_code == 404
    assert client.get(photos[-1]["thumbnail_url"]).status_code == 404
    assert client.get("/api/list", headers=headers).status_code == 200
    assert client.get("/api/list", headers=outsider).json()["items"] == []


def test_concurrent_uploads_cannot_exceed_six_photos(client, register, upload_photos):
    _, headers, _ = register()
    assert upload_photos(headers, indices=(3, 4)).status_code == 201
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda i: upload_photos(headers, indices=(i,)), (5, 6)))
    assert sorted(r.status_code for r in results) == [201, 409]
    assert client.get("/api/media/profile", headers=headers).json()["gallery"]["photo_count"] == 6


@pytest.mark.parametrize("container_format", ["mp4", "webm"])
def test_real_video_upload_thumbnail_and_range_playback(client, register, container_format):
    _, headers, _ = register()
    data = video_bytes(container_format=container_format)
    response = upload_video(client, headers, data, content_type=f"video/{container_format}")
    assert response.status_code == 201, response.text
    video = response.json()["gallery"]["video"]
    assert video["duration_seconds"] == pytest.approx(1, abs=0.1)
    assert video["width"] == 320 and video["height"] == 240
    assert video["content_type"] == f"video/{container_format}"
    assert client.get(video["thumbnail_url"]).headers["content-type"] == "image/jpeg"
    partial = client.get(video["url"], headers={"Range": "bytes=0-15"})
    assert partial.status_code == 206
    assert partial.content == data[:16]
    assert partial.headers["accept-ranges"] == "bytes"


def test_invalid_video_replacement_preserves_previous_video(client, register, app):
    _, headers, _ = register()
    original = upload_video(client, headers, video_bytes()).json()["gallery"]["video"]
    assert upload_video(client, headers, b"fake video").status_code == 415
    app.state.settings = replace(app.state.settings, max_video_seconds=1)
    too_long = upload_video(client, headers, video_bytes(seconds=2))
    assert too_long.status_code == 422
    assert too_long.json()["error"]["code"] == "video_too_long"
    app.state.settings = replace(app.state.settings, max_video_bytes=100)
    assert upload_video(client, headers, video_bytes()).status_code == 413
    app.state.settings = replace(app.state.settings, max_video_bytes=50 * 1024 * 1024)
    assert client.get(original["url"]).status_code == 200
    replacement = upload_video(client, headers, video_bytes(variant=1))
    assert replacement.status_code == 201, replacement.text
    current = replacement.json()["gallery"]["video"]
    assert current["id"] != original["id"]
    assert client.get(original["url"]).status_code == 404
    assert client.get(original["thumbnail_url"]).status_code == 404
    assert client.delete(f"/api/media/items/{current['id']}", headers=headers).json()["gallery"]["video"] is None
    assert len(list(app.state.settings.media_root.iterdir())) == 6  # profile photos only


def test_property_walkthrough_and_intent_change_remove_property_files(client, register, app):
    user, headers, _ = register(Intent.offer_shared_home)
    listing = user["user"]["offering"]
    uploaded = upload_video(client, headers, video_bytes(), target="property")
    assert uploaded.status_code == 201, uploaded.text
    property_urls = [photo["url"] for photo in listing["media"]["photos"]] + [uploaded.json()["gallery"]["video"]["url"]]
    payload = signup_example()
    response = client.put("/api/users/me", headers=headers, json={"profile": payload["profile"]})
    assert response.status_code == 200, response.text
    assert response.json()["onboarding"]["complete"] is True
    assert all(client.get(url).status_code == 404 for url in property_urls)
    assert len(list(app.state.settings.media_root.iterdir())) == 6
    assert client.post("/api/media/property/photos", headers=headers, files={"files": ("home.jpg", photo_bytes(), "image/jpeg")}).status_code == 409


def test_media_files_and_gallery_survive_app_restart(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'media.db'}", media_root=tmp_path / "uploads")
    with TestClient(create_app(settings)) as first:
        account = first.post("/api/auth/signup", json=signup_example()).json()
        headers = {"Authorization": f"Bearer {account['access_token']}"}
        response = first.post("/api/media/profile/photos", headers=headers, files=[("files", (f"{i}.jpg", photo_bytes(i), "image/jpeg")) for i in range(3)])
        assert response.status_code == 201
        gallery = response.json()["gallery"]
    with TestClient(create_app(settings)) as second:
        assert second.get("/api/media/profile", headers=headers).json()["gallery"] == gallery
        assert second.get(gallery["cover_photo_url"]).status_code == 200
        assert second.get("/api/users/me", headers=headers).json()["onboarding"]["complete"] is True


def test_swagger_describes_media_and_questionnaire_upload_flow(client):
    schema = client.get("/openapi.json").json()
    assert "/api/list" in schema["paths"]
    for endpoint in ("/api/media/{target}/photos", "/api/media/{target}/video"):
        assert "multipart/form-data" in schema["paths"][endpoint]["post"]["requestBody"]["content"]
        assert schema["paths"][endpoint]["post"]["security"] == [{"HTTPBearer": []}]
    questions = client.get("/api/onboarding/questions").json()
    media = next(s for s in questions["sections"] if s["id"] == "media")
    photos = [q for q in media["questions"] if q["input_type"] == "photos"]
    assert len(photos) == 2
    assert all(q["required"] and q["minimum_files"] == 3 and q["maximum_files"] == 6 for q in photos)
    videos = [q for q in media["questions"] if q["input_type"] == "video"]
    assert all(not q["required"] and q["max_duration_seconds"] == 60 for q in videos)
