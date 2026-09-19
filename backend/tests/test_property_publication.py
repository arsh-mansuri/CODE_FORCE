import pytest
from sqlalchemy import func, select

from app import photo_screening
from app.models import Listing, MediaAsset
from app.schemas import Intent
from conftest import photo_bytes
from photo_fixtures import portrait_bytes


@pytest.mark.parametrize("seeking,offering", [
    (Intent.seek_entire_home, Intent.offer_entire_home),
    (Intent.seek_room, Intent.offer_shared_home),
])
def test_signup_automatically_publishes_same_listing_with_property_photos(client, register, upload_photos, app, seeking, offering):
    _, seeker, _ = register(seeking, complete_media=False)
    host, headers, body = register(offering, complete_media=False)
    listing_id = host["user"]["offering"]["id"]
    assert host["user"]["onboarding"]["listing_status"] == "needs_photos"
    assert client.get("/api/listings", headers=seeker).json()["items"] == []
    assert upload_photos(headers, "property", indices=(0, 1)).json()["onboarding"]["listing_status"] == "needs_photos"
    assert client.get(f"/api/listings/{listing_id}", headers=seeker).status_code == 404

    uploaded = upload_photos(headers, "property", indices=(2,)).json()
    assert uploaded["onboarding"]["listing_status"] == "published"
    assert uploaded["onboarding"]["complete"] is False  # Personal photos can come later.
    assert uploaded["onboarding"]["profile_photos_needed"] == 3
    item = client.get("/api/listings", headers=seeker).json()["items"][0]
    assert item["listing"]["id"] == listing_id
    assert item["provider_name"] == host["user"]["profile"]["full_name"]
    for key in ("title", "location", "monthly_rent", "deposit", "amenities", "available_from", "electricity", "air_conditioning"):
        assert item["listing"][key] == host["user"]["offering"][key]
    assert item["listing"]["media"]["cover_photo_url"] == uploaded["gallery"]["photos"][0]["url"]
    assert client.get(f"/api/listings/{listing_id}", headers=seeker).status_code == 200
    assert client.get(item["listing"]["media"]["cover_photo_url"]).status_code == 200

    # Profile edits synchronize the single existing listing, preserving its photos.
    body["offering"].update(title="Updated home", monthly_rent=12500, amenities=["balcony", "wifi"])
    update = {"profile": body["profile"], "offering": body["offering"]}
    assert client.put("/api/users/me", headers=headers, json=update).status_code == 200
    refreshed = client.get("/api/listings", headers=seeker).json()
    assert refreshed["total"] == 1
    assert refreshed["items"][0]["listing"]["monthly_rent"] == 12500
    assert refreshed["items"][0]["listing"]["id"] == listing_id
    assert refreshed["items"][0]["listing"]["media"] == uploaded["gallery"]
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Listing)) == 1

    # Profile portraits never become the property's cover or gallery photos.
    portrait = client.post("/api/media/profile/photos", headers=headers, files={"files": ("portrait.jpg", portrait_bytes(), "image/jpeg")})
    assert portrait.status_code == 201
    property_gallery = client.get("/api/listings", headers=seeker).json()["items"][0]["listing"]["media"]
    assert property_gallery == uploaded["gallery"]

    body["offering"]["is_active"] = False
    assert client.put("/api/listings/me", headers=headers, json=body["offering"]).status_code == 200
    assert client.get("/api/users/me", headers=headers).json()["onboarding"]["listing_status"] == "paused"
    assert client.get("/api/listings", headers=seeker).json()["items"] == []
    body["offering"]["is_active"] = True
    assert client.put("/api/listings/me", headers=headers, json=body["offering"]).status_code == 200
    assert client.get("/api/listings", headers=seeker).json()["total"] == 1
    removed = client.delete(f"/api/media/items/{uploaded['gallery']['photos'][0]['id']}", headers=headers)
    assert removed.json()["onboarding"]["listing_status"] == "needs_photos"
    assert client.get("/api/listings", headers=seeker).json()["items"] == []


@pytest.mark.parametrize("rotation,image_format", [(0, "JPEG"), (90, "PNG"), (180, "WEBP")])
def test_real_face_is_rejected_from_property_but_allowed_in_profile(client, register, app, rotation, image_format):
    _, headers, _ = register(Intent.offer_entire_home, complete_media=False)
    image = portrait_bytes(rotation, image_format)
    # Filename and MIME cannot bypass decoded-content recognition.
    files = {"files": ("empty-kitchen.jpg", image, "application/octet-stream")}
    response = client.post("/api/media/property/photos", headers=headers, files=files)
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "property_photo_contains_face"
    assert "profile gallery" in response.json()["error"]["message"]
    assert not list(app.state.settings.media_root.iterdir())
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(MediaAsset)) == 0
    assert client.post("/api/media/profile/photos", headers=headers, files=files).status_code == 201


def test_mixed_property_photo_batch_rolls_back_without_changing_existing_gallery(client, register, upload_photos, app):
    _, headers, _ = register(Intent.offer_shared_home, complete_media=False)
    original = upload_photos(headers, "property", indices=(0, 1)).json()
    original_files = set(app.state.settings.media_root.iterdir())
    response = client.post("/api/media/property/photos", headers=headers, files=[
        ("files", ("room.jpg", photo_bytes(2), "image/jpeg")),
        ("files", ("portrait.jpg", portrait_bytes(), "image/jpeg")),
    ])
    assert response.status_code == 422
    assert set(app.state.settings.media_root.iterdir()) == original_files
    assert client.get("/api/media/property", headers=headers).json() == original


def test_screening_failure_is_retryable_and_does_not_save_unchecked_photos(client, register, app, monkeypatch):
    _, headers, _ = register(Intent.offer_entire_home, complete_media=False)
    def unavailable():
        raise RuntimeError("Missing model")
    monkeypatch.setattr(photo_screening, "face_detectors", unavailable)
    files = {"files": ("room.jpg", photo_bytes(), "image/jpeg")}
    response = client.post("/api/media/property/photos", headers=headers, files=files)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "photo_screening_unavailable"
    assert not list(app.state.settings.media_root.iterdir())
    assert client.post("/api/media/profile/photos", headers=headers, files=files).status_code == 201
