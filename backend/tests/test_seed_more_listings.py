import pytest
from sqlalchemy import func, select

import seed_more_listings
import seed_team
from app.models import Listing, MediaAsset, User
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
    add_gallery = seed_more_listings.add_demo_gallery
    def fail_after_gallery(*args, **kwargs):
        add_gallery(*args, **kwargs)
        raise RuntimeError("Simulated failure")
    monkeypatch.setattr(seed_more_listings, "add_demo_gallery", fail_after_gallery)
    with pytest.raises(RuntimeError, match="Simulated failure"):
        seed_more_listings.seed_more(app.state.settings, for_team=True)
    assert set(app.state.settings.media_root.iterdir()) == original_files
    for original, headers in accounts:
        assert client.get("/api/users/me", headers=headers).json() == original
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Listing)) == 0
