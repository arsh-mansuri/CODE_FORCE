from dataclasses import replace
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import func, select

from app.examples import signup_example
from app.models import PasswordReset, User, utcnow
from app.password_reset import send_reset_email
from app.schemas import Intent
from app.security import problem, token_digest


@pytest.fixture
def outbox(app, monkeypatch):
    app.state.settings = replace(app.state.settings, smtp_host="smtp.example.com", smtp_from="hello@example.com")
    messages = []
    monkeypatch.setattr("app.routes.send_reset_email", lambda settings, email, token: messages.append((email, token)))
    return messages


def test_email_lookup_routes_existing_and_new_users(client, register):
    _, _, body = register(complete_media=False)
    result = client.post("/api/auth/check-email", json={"email": f"  {body['email'].upper()}  "})
    assert result.json() == {"exists": True}
    assert client.post("/api/auth/check-email", json={"email": "new@example.com"}).json() == {"exists": False}
    assert client.post("/api/auth/check-email", json={"email": "invalid"}).status_code == 422


def test_reset_is_single_use_and_revokes_existing_sessions(client, register, app, outbox):
    account, headers, body = register(complete_media=False)
    response = client.post("/api/auth/forgot-password", json={"email": body["email"].upper()})
    assert response.status_code == 200
    email, token = outbox[0]
    assert email == body["email"]
    assert token not in response.text
    with app.state.session_factory() as db:
        record = db.scalar(select(PasswordReset))
        assert record.user_id == account["user"]["id"]
        assert record.token_hash == token_digest(token) and record.token_hash != token
        assert timedelta(minutes=29) < record.expires_at - utcnow() <= timedelta(minutes=30)
    new_password = "My-new-password-2026"
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "short"}).status_code == 422
    assert client.post("/api/auth/reset-password", json={"token": token, "password": new_password}).status_code == 200
    assert client.get("/api/users/me", headers=headers).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": body["password"]}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": new_password}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "Another-password-2026"}).status_code == 400


def test_unknown_email_does_not_send_mail_and_resends_have_cooldown(client, register, outbox):
    _, _, body = register(complete_media=False)
    missing = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert missing.status_code == 200 and not outbox
    known = client.post("/api/auth/forgot-password", json={"email": body["email"]})
    assert known.json() == missing.json()
    assert client.post("/api/auth/forgot-password", json={"email": body["email"]}).status_code == 200
    assert len(outbox) == 1


def test_expired_link_and_replaced_link_cannot_reset_password(client, register, app, outbox):
    _, _, body = register(complete_media=False)
    client.post("/api/auth/forgot-password", json={"email": body["email"]})
    token = outbox[0][1]
    with app.state.session_factory() as db:
        record = db.scalar(select(PasswordReset))
        record.expires_at = utcnow() - timedelta(seconds=1)
        record.created_at = utcnow() - timedelta(minutes=31)
        db.commit()
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "New-password-2026"}).status_code == 400
    client.post("/api/auth/forgot-password", json={"email": body["email"]})
    assert len(outbox) == 2 and outbox[1][1] != token
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "New-password-2026"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": outbox[1][1], "password": "New-password-2026"}).status_code == 200


def test_resend_invalidates_previously_valid_link(client, register, app, outbox):
    _, _, body = register(complete_media=False)
    client.post("/api/auth/forgot-password", json={"email": body["email"]})
    old_token = outbox[0][1]
    with app.state.session_factory() as db:
        db.scalar(select(PasswordReset)).created_at = utcnow() - timedelta(minutes=2)
        db.commit()
    client.post("/api/auth/forgot-password", json={"email": body["email"]})
    assert client.post("/api/auth/reset-password", json={"token": old_token, "password": "New-password-2026"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": outbox[-1][1], "password": "New-password-2026"}).status_code == 200


def test_mail_configuration_and_delivery_failures_are_not_fake_success(client, register, app, monkeypatch):
    _, _, body = register(complete_media=False)
    assert client.post("/api/auth/forgot-password", json={"email": body["email"]}).status_code == 503
    app.state.settings = replace(app.state.settings, smtp_host="smtp.example.com", smtp_from="hello@example.com")
    def fail(*args):
        raise problem(503, "email_unavailable", "Email unavailable")
    monkeypatch.setattr("app.routes.send_reset_email", fail)
    assert client.post("/api/auth/forgot-password", json={"email": body["email"]}).status_code == 503
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(PasswordReset)) == 0


def test_reset_email_contains_frontend_link_in_fragment(app):
    settings = replace(app.state.settings, smtp_host="smtp.example.com", smtp_from="hello@example.com", frontend_url="https://propvibe.example")
    with patch("app.password_reset.smtplib.SMTP") as smtp:
        send_reset_email(settings, "person@example.com", "opaque-token")
    connection = smtp.return_value.__enter__.return_value
    connection.starttls.assert_called_once()
    message = connection.send_message.call_args.args[0]
    assert message["To"] == "person@example.com"
    assert "https://propvibe.example/#reset-password=opaque-token" in message.get_content()


@pytest.mark.parametrize("intent", list(Intent))
def test_signup_rejects_past_dates_without_creating_account(client, app, intent):
    body = signup_example(intent)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    if "search" in body["profile"]:
        body["profile"]["search"]["move_in_from"] = yesterday
    else:
        body["offering"]["available_from"] = yesterday
    response = client.post("/api/auth/signup", json=body)
    assert response.status_code == 422
    assert "Past dates" in response.text
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0


@pytest.mark.parametrize("intent", [Intent.seek_roommate, Intent.offer_shared_home])
def test_today_is_valid_and_updates_reject_past_dates(client, register, intent):
    def today(body):
        if "search" in body["profile"]:
            body["profile"]["search"].update(move_in_from=date.today().isoformat(), move_in_by=date.today().isoformat())
        else:
            body["offering"]["available_from"] = date.today().isoformat()
    _, headers, body = register(intent, today, complete_media=False)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    if "search" in body["profile"]:
        body["profile"]["search"]["move_in_from"] = yesterday
    else:
        body["offering"]["available_from"] = yesterday
        assert client.put("/api/listings/me", headers=headers, json=body["offering"]).status_code == 422
    response = client.put("/api/users/me", headers=headers, json={"profile": body["profile"], "offering": body.get("offering")})
    assert response.status_code == 422
    saved = client.get("/api/users/me", headers=headers).json()
    assert (saved["profile"]["search"]["move_in_from"] if saved["profile"]["search"] else saved["offering"]["available_from"]) == date.today().isoformat()


def test_old_saved_dates_do_not_break_login_or_profile_reads(client, register, app):
    account, headers, body = register(complete_media=False)
    with app.state.session_factory() as db:
        user = db.get(User, account["user"]["id"])
        data = dict(user.profile.data)
        data["search"] = {**data["search"], "move_in_from": "2020-01-01", "move_in_by": "2020-02-01"}
        user.profile.data = data
        db.commit()
    assert client.get("/api/users/me", headers=headers).status_code == 200
    assert client.post("/api/auth/login", json={"email": body["email"], "password": body["password"]}).status_code == 200
