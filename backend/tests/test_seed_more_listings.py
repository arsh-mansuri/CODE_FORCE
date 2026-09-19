import pytest
from hashlib import sha256
from io import BytesIO

from PIL import Image, ImageOps
from sqlalchemy import func, select

import seed_db
import seed_more_listings
import seed_team
from app.models import Listing, MediaAsset, User
from app.demo_media import property_photo_paths
from app.media_storage import jpeg_bytes
from app.schemas import Intent
from test_seed_team import assert_mutual_discovery, login_team


def legacy_team(app, client):
    seed_team.seed(app.state.settings)
    # Reproduce the old accounts that only selected seek_roommate.
    with app.state.session_factory() as db:
        for user in db.scalars(select(User)):
            user.profile.data = {**user.profile.data, "intents": None}
        db.commit()
    return login_team(client)


def test_catalog_reaches_all_four_accounts_and_reruns_preserve_existing_data(app, client, register):
    accounts = legacy_team(app, client)
    _, outsider_headers, _ = register(Intent.seek_roommate)
    outsider = client.get("/api/users/me", headers=outsider_headers).json()
    original_files = set(app.state.settings.media_root.iterdir())
    summary = seed_more_listings.seed_more(app.state.settings, for_team=True)
    assert len(summary) == 4
    expected_count = len(seed_more_listings.MOCK_PROPERTIES)
    listing_ids = set()
    for original, headers in accounts:
        current = client.get("/api/users/me", headers=headers).json()
        assert current["id"] == original["id"]
        assert current["media"] == original["media"]
        assert current["profile"] == {**original["profile"], "intents": [intent.value for intent in seed_team.TEAM_DISCOVERY_INTENTS]}
        feed = client.get("/api/listings?limit=100", headers=headers).json()
        assert feed["total"] == expected_count
        assert all(item["listing"]["media"]["ready"] for item in feed["items"])
        assert {item["listing"]["kind"] for item in feed["items"]} == {"entire_home", "private_room", "shared_room"}
        assert any(item["compatibility"]["match_type"] == "exact" for item in feed["items"])
        assert any(item["compatibility"]["compromises"] for item in feed["items"])
        top = client.get("/api/listings?min_match_score=85", headers=headers).json()["items"]
        assert top and all(item["match_score"] >= 85 for item in top)
        assert any(item["listing"]["air_conditioning"]["available"] for item in top)
        assert client.get(top[0]["listing"]["media"]["cover_photo_url"]).status_code == 200
        listing_ids = {item["listing"]["id"] for item in feed["items"]}
    assert_mutual_discovery(client, accounts)

    # A tour request can reach a seeded provider and survives reseeding.
    seeker, headers = accounts[0]
    provider_id = top[0]["listing"]["owner_id"]
    assert client.post("/api/swipe", headers=headers, json={"target_id": provider_id, "direction": "like", "note": "Can I tour this demo home?"}).status_code == 200
    with app.state.session_factory() as db:
        provider = db.get(User, provider_id)
        email = provider.email
    login = client.post("/api/auth/login", json={"email": email, "password": "PropVibe-demo-2026"}).json()
    host_headers = {"Authorization": f"Bearer {login['access_token']}"}
    inbox = client.get("/api/connections/requests", headers=host_headers).json()
    assert inbox["items"][0]["requester"]["id"] == seeker["id"]

    seeded_files = set(app.state.settings.media_root.iterdir())
    assert original_files <= seeded_files
    seed_more_listings.seed_more(app.state.settings, for_team=True)
    assert set(app.state.settings.media_root.iterdir()) == seeded_files
    assert client.get("/api/connections/requests", headers=host_headers).json() == inbox
    assert client.get("/api/users/me", headers=outsider_headers).json() == outsider
    assert {item["listing"]["id"] for item in client.get("/api/listings?limit=100", headers=headers).json()["items"]} == listing_ids
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Listing)) == expected_count

    # Fill a partially deleted gallery without replacing its remaining photos.
    photo = top[0]["listing"]["media"]["photos"][1]
    assert client.delete(f"/api/media/items/{photo['id']}", headers=host_headers).status_code == 200
    seed_more_listings.seed_more(app.state.settings, for_team=True)
    assert client.get("/api/listings", headers=headers).json()["total"] == expected_count
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(MediaAsset).where(MediaAsset.owner_id == provider_id)) == 6


def test_failed_catalog_seed_rolls_back_team_goal_updates_and_files(app, client, monkeypatch):
    accounts = legacy_team(app, client)
    original_files = set(app.state.settings.media_root.iterdir())
    add_gallery = seed_more_listings.sync_property_gallery
    def fail_after_gallery(*args, **kwargs):
        add_gallery(*args, **kwargs)
        raise RuntimeError("Simulated failure")
    monkeypatch.setattr(seed_more_listings, "sync_property_gallery", fail_after_gallery)
    with pytest.raises(RuntimeError, match="Simulated failure"):
        seed_more_listings.seed_more(app.state.settings, for_team=True)
    assert set(app.state.settings.media_root.iterdir()) == original_files
    for original, headers in accounts:
        assert client.get("/api/users/me", headers=headers).json() == original
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Listing)) == 0


def test_main_seed_uses_uploaded_photos_and_rishi_can_discover_three_properties(app, client):
    seed_db.seed(settings=app.state.settings)
    login = client.post("/api/auth/login", json={"email": seed_more_listings.RISHI_EMAIL, "password": "1234567890"})
    assert login.status_code == 200
    data = login.json()
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    assert data["user"]["onboarding"]["complete"]
    assert set(data["user"]["profile"]["intents"]) == {i.value for i in seed_team.TEAM_DISCOVERY_INTENTS}
    feed = client.get("/api/listings", headers=headers).json()
    assert feed["total"] == 3
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 4
        assert db.scalar(select(User).where(User.email == seed_more_listings.RISHI_EMAIL)).listing is None
        for prop in seed_more_listings.MOCK_PROPERTIES:
            user = db.scalar(select(User).where(User.email == prop["email"]))
            expected = []
            for path in property_photo_paths(prop["image_set"]):
                with Image.open(path) as source:
                    image = ImageOps.exif_transpose(source).convert("RGB")
                    image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
                    expected.append(sha256(jpeg_bytes(image, (2048, 2048))).hexdigest())
            for target in ("profile", "property"):
                photos = sorted((a for a in user.media_assets if a.target == target), key=lambda a: a.position)
                assert [a.checksum for a in photos] == expected
                for photo in photos:
                    response = client.get(f"/api/media/files/{photo.id}")
                    assert response.status_code == 200
                    assert sha256(response.content).hexdigest() == photo.checksum
                    thumb = client.get(f"/api/media/files/{photo.id}/thumbnail")
                    assert thumb.status_code == 200
                    with Image.open(BytesIO(thumb.content)) as image:
                        assert max(image.size) <= 480
    files = set(app.state.settings.media_root.iterdir())
    seed_db.seed(settings=app.state.settings)
    assert set(app.state.settings.media_root.iterdir()) == files
    assert client.get("/api/listings", headers=headers).json() == feed


def test_seed_migrates_old_galleries_and_offerings_transactionally(app, client, register, monkeypatch):
    _, rishi_headers, _ = register(Intent.offer_entire_home, mutate=lambda data: data.update(email=seed_more_listings.RISHI_EMAIL))
    host, host_headers, _ = register(Intent.offer_entire_home, mutate=lambda data: data.update(email="aarav.shah@example.com"))
    old, old_headers, _ = register(Intent.offer_entire_home, mutate=lambda data: data.update(email="devang.joshi@example.com"))
    outsider, outsider_headers, _ = register(Intent.offer_entire_home)
    originals = {email: client.get("/api/users/me", headers=headers).json() for email, headers in (
        ("rishi", rishi_headers), ("host", host_headers), ("old", old_headers), ("outsider", outsider_headers),
    )}
    root = app.state.settings.media_root
    original_files = set(root.iterdir())
    with app.state.session_factory() as db:
        host_files = [root / name for asset in db.scalars(select(MediaAsset).where(MediaAsset.owner_id == host["user"]["id"]))
                      for name in (asset.filename, asset.thumbnail_filename)]
    sync_gallery = seed_more_listings.sync_property_gallery

    def fail_after_replacement(*args, **kwargs):
        sync_gallery(*args, **kwargs)
        raise RuntimeError("Replacement failure")

    with monkeypatch.context() as patch:
        patch.setattr(seed_more_listings, "sync_property_gallery", fail_after_replacement)
        with pytest.raises(RuntimeError, match="Replacement failure"):
            seed_db.seed(settings=app.state.settings)
    assert set(root.iterdir()) == original_files
    assert client.get("/api/users/me", headers=rishi_headers).json() == originals["rishi"]
    assert client.get("/api/users/me", headers=host_headers).json() == originals["host"]
    assert client.get("/api/users/me", headers=old_headers).json() == originals["old"]

    seed_db.seed(settings=app.state.settings)
    rishi = client.get("/api/users/me", headers=rishi_headers).json()
    assert rishi["offering"] is None
    assert rishi["onboarding"]["complete"]
    assert rishi["media"] == originals["rishi"]["media"]
    current_host = client.get("/api/users/me", headers=host_headers).json()
    assert current_host["offering"]["id"] == host["user"]["offering"]["id"]
    assert all(not path.exists() for path in host_files)
    assert not client.get("/api/users/me", headers=old_headers).json()["offering"]["is_active"]
    assert client.get("/api/users/me", headers=outsider_headers).json() == outsider["user"]
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Listing).where(Listing.is_active)) == 4
