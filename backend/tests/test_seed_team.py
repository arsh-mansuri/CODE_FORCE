from datetime import date

import pytest
from sqlalchemy import func, select

import seed_team
from app.models import Match, MediaAsset, Message, Swipe, User
from app.schemas import Intent
from app.security import hash_password


def login_team(client):
    accounts = []
    for email, _ in seed_team.TEAM_ACCOUNTS:
        response = client.post("/api/auth/login", json={"email": email, "password": "1234567890"})
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["user"]["onboarding"]["complete"]
        assert date.fromisoformat(data["user"]["profile"]["search"]["move_in_from"]) >= date.today()
        accounts.append((data["user"], {"Authorization": f"Bearer {data['access_token']}"}))
    return accounts


def assert_mutual_discovery(client, accounts):
    ids = {user["id"] for user, _ in accounts}
    for user, headers in accounts:
        response = client.get("/api/users/feed", headers=headers)
        assert response.status_code == 200, response.text
        cards = {card["id"]: card for card in response.json()["items"]}
        assert ids - {user["id"]} <= cards.keys()
        assert user["id"] not in cards
        for other_id in ids - {user["id"]}:
            assert cards[other_id]["match_score"] == 100
            assert len(cards[other_id]["media"]["photos"]) == 3
            for photo in cards[other_id]["media"]["photos"]:
                assert client.get(photo["url"]).status_code == 200


def test_team_reset_restores_login_and_discovery_without_touching_other_accounts(app, client, register):
    outsider, outsider_headers, _ = register(Intent.offer_entire_home)
    original_outsider = client.get("/api/users/me", headers=outsider_headers).json()
    settings = app.state.settings
    seed_team.seed(settings)
    accounts = login_team(client)
    assert_mutual_discovery(client, accounts)

    first, first_headers = accounts[0]
    second, second_headers = accounts[1]
    for user, headers in accounts:
        for other, _ in accounts:
            if user["id"] != other["id"]:
                response = client.post("/api/swipe", headers=headers, json={"target_id": other["id"], "direction": "like"})
                assert response.status_code == 200
    assert client.get("/api/users/feed", headers=first_headers).json()["total"] == 0
    matches = client.get("/api/matches", headers=first_headers).json()
    assert len(matches) == 3
    assert client.post(f"/api/matches/{matches[0]['id']}/messages", headers=first_headers, json={"content": "Demo chat"}).status_code == 201
    # Also exercise a pass, which must not keep a teammate hidden after reset.
    assert client.post("/api/swipe", headers=second_headers, json={"target_id": first["id"], "direction": "pass"}).status_code == 200

    with app.state.session_factory() as db:
        old_files = [name for asset in db.scalars(select(MediaAsset).where(MediaAsset.owner_id == first["id"]))
                     for name in (asset.filename, asset.thumbnail_filename)]
        user = db.get(User, first["id"])
        user.password_hash = hash_password("changed-password")
        user.profile.data = {**user.profile.data, "full_name": "Edited name"}
        db.commit()

    seed_team.seed(settings)
    refreshed = login_team(client)
    assert_mutual_discovery(client, refreshed)
    for _, headers in accounts:
        assert client.get("/api/users/me", headers=headers).status_code == 401
    assert refreshed[0][0]["profile"]["full_name"] == seed_team.TEAM_ACCOUNTS[0][1]
    assert client.get("/api/users/me", headers=outsider_headers).json() == original_outsider
    for photo in outsider["user"]["media"]["photos"]:
        assert client.get(photo["url"]).status_code == 200
    assert all(not (settings.media_root / filename).exists() for filename in old_files)
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 5
        assert db.scalar(select(func.count()).select_from(MediaAsset)) == 18
        for model in (Swipe, Match, Message):
            assert db.scalar(select(func.count()).select_from(model)) == 0


def test_failed_team_reset_restores_accounts_and_cleans_new_uploads(app, client, monkeypatch):
    settings = app.state.settings
    seed_team.seed(settings)
    accounts = login_team(client)
    original_files = set(settings.media_root.iterdir())
    add_gallery = seed_team.add_demo_gallery

    def fail_after_creating_gallery(*args, **kwargs):
        add_gallery(*args, **kwargs)
        raise RuntimeError("Simulated media failure")

    monkeypatch.setattr(seed_team, "add_demo_gallery", fail_after_creating_gallery)
    with pytest.raises(RuntimeError, match="Simulated media failure"):
        seed_team.seed(settings)

    assert set(settings.media_root.iterdir()) == original_files
    for user, headers in accounts:
        assert client.get("/api/users/me", headers=headers).json() == user
    assert_mutual_discovery(client, accounts)
