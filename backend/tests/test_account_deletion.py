from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.examples import signup_example
from app.main import create_app
from app.models import AccountDeletionRequest, User


URL = "/api/users/me/deletion-request"


def test_request_is_authenticated_owned_and_idempotent(client, app, register, monkeypatch):
    assert client.post(URL).status_code == 401
    assert client.delete(URL).status_code == 401
    account, headers, body = register(complete_media=False)
    other, other_headers, _ = register(complete_media=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    monkeypatch.setattr("app.routes.utcnow", lambda: now)

    # Client-supplied IDs/deadlines cannot affect the authenticated account or deadline.
    result = client.post(URL, headers=headers, json={"user_id": other["user"]["id"], "scheduled_for": "2099-01-01"})
    assert result.status_code == 200, result.text
    pending = result.json()["deletion_request"]
    requested = datetime.fromisoformat(pending["requested_at"])
    scheduled = datetime.fromisoformat(pending["scheduled_for"])
    assert requested == now.replace(tzinfo=timezone.utc)
    assert scheduled - requested == timedelta(days=7)
    assert client.get("/api/users/me", headers=other_headers).json()["deletion_request"] is None

    monkeypatch.setattr("app.routes.utcnow", lambda: now + timedelta(hours=1))
    assert client.post(URL, headers=headers).json()["deletion_request"] == pending
    updated = client.put("/api/users/me", headers=headers, json={"profile": body["profile"]})
    assert updated.status_code == 200
    assert updated.json()["deletion_request"] == pending
    login = client.post("/api/auth/login", json={"email": body["email"], "password": body["password"]})
    assert login.status_code == 200
    assert login.json()["user"]["deletion_request"] == pending
    with app.state.session_factory() as db:
        requests = db.scalars(select(AccountDeletionRequest)).all()
        assert len(requests) == 1
        assert requests[0].user_id == account["user"]["id"]
        assert db.get(User, account["user"]["id"]) is not None


def test_cancel_only_clears_own_request_and_can_be_repeated(client, app, register, monkeypatch):
    account, headers, _ = register(complete_media=False)
    _, other_headers, _ = register(complete_media=False)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    monkeypatch.setattr("app.routes.utcnow", lambda: now)
    first = client.post(URL, headers=headers).json()["deletion_request"]
    other = client.post(URL, headers=other_headers).json()["deletion_request"]
    for _ in range(2):
        response = client.delete(URL, headers=headers)
        assert response.status_code == 200
        assert response.json()["deletion_request"] is None
    assert client.get("/api/users/me", headers=other_headers).json()["deletion_request"] == other
    with app.state.session_factory() as db:
        assert db.get(AccountDeletionRequest, account["user"]["id"]) is None
    monkeypatch.setattr("app.routes.utcnow", lambda: now + timedelta(days=1))
    second = client.post(URL, headers=headers).json()["deletion_request"]
    assert datetime.fromisoformat(second["scheduled_for"]) - datetime.fromisoformat(first["scheduled_for"]) == timedelta(days=1)


def test_deletion_flag_is_private_and_does_not_immediately_remove_account(client, register):
    account, headers, _ = register()
    _, other_headers, _ = register()
    assert client.post(URL, headers=headers).status_code == 200
    feed = client.get("/api/users/feed", headers=other_headers)
    assert feed.status_code == 200
    candidate = next(item for item in feed.json()["items"] if item["id"] == account["user"]["id"])
    assert "deletion_request" not in candidate
    assert client.get("/api/users/me", headers=headers).json()["deletion_request"] is not None


def test_existing_database_gets_request_table_and_flag_survives_restart(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'persistent.db'}", media_root=tmp_path / "uploads")
    app = create_app(settings)
    with TestClient(app) as first:
        signup = first.post("/api/auth/signup", json=signup_example()).json()
        # Simulate a database from before deletion requests were introduced.
        AccountDeletionRequest.__table__.drop(app.state.engine)
    headers = {"Authorization": f"Bearer {signup['access_token']}"}
    with TestClient(create_app(settings)) as second:
        assert second.get("/api/users/me", headers=headers).json()["deletion_request"] is None
        response = second.post(URL, headers=headers)
        assert response.status_code == 200, response.text
        pending = response.json()["deletion_request"]
    with TestClient(create_app(settings)) as third:
        assert third.get("/api/users/me", headers=headers).json()["deletion_request"] == pending
