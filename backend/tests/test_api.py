from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import Settings
from app.examples import RENT_EXAMPLE, signup_example
from app.main import create_app
from app.models import AuthSession, Match, Profile, User, utcnow
from app.schemas import Intent


def like(client, headers, target_id, direction="like"):
    return client.post("/api/swipe", headers=headers, json={"target_id": target_id, "direction": direction})


@pytest.mark.parametrize("intent", list(Intent))
def test_each_signup_intent_is_complete_and_private(client, register, app, intent):
    result, headers, body = register(intent)
    me = client.get("/api/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["profile"]["intent"] == intent.value
    assert "password" not in me.text
    assert result["access_token"] not in me.text
    offering = me.json()["offering"]
    assert bool(offering) == intent.value.startswith("offer_")
    with app.state.session_factory() as db:
        user = db.get(User, result["user"]["id"])
        assert user.password_hash.startswith("pbkdf2_sha256$")
        assert body["password"] not in user.password_hash
        session = db.scalar(select(AuthSession))
        assert session.token_hash != result["access_token"]


@pytest.mark.parametrize("mutation", [
    lambda b: b["profile"].pop("search"),
    lambda b: b["profile"]["lifestyle"].update(cleanliness=6),
    lambda b: b["profile"].update(age=17),
    lambda b: b["profile"]["search"]["budget"].update(minimum=20000, maximum=10000),
    lambda b: b["profile"]["search"]["location"].update(pincodes=["38000"]),
    lambda b: b["profile"]["search"].update(move_in_by="2000-01-01"),
    lambda b: b["profile"]["search"].update(property_types=[]),
    lambda b: b["profile"].update(intent="offer_shared_home", search=None),
    lambda b: b.update(offering=signup_example(Intent.offer_entire_home)["offering"]),
    lambda b: b.update(password="tiny!7"),
    lambda b: b["profile"].update(unknown_field="reject typos"),
])
def test_invalid_signup_is_atomic_and_errors_do_not_echo_passwords(client, app, mutation):
    body = signup_example()
    mutation(body)
    response = client.post("/api/auth/signup", json=body)
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_error"
    assert body["password"] not in response.text
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0
        assert db.scalar(select(func.count()).select_from(Profile)) == 0


def test_auth_case_insensitive_login_duplicate_and_revocation(client, register):
    result, headers, body = register()
    duplicate = dict(body, email=body["email"].upper())
    assert client.post("/api/auth/signup", json=duplicate).status_code == 409
    login = client.post("/api/auth/login", json={"email": body["email"].upper(), "password": body["password"]})
    assert login.status_code == 200
    second_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/users/me").status_code == 401
    bad = client.post("/api/auth/login", json={"email": body["email"], "password": "wrong-password"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/users/me", headers=headers).status_code == 401
    assert client.get("/api/users/me", headers=second_headers).status_code == 200


def test_expired_session_is_rejected(client, app, register):
    _, headers, _ = register()
    with app.state.session_factory() as db:
        db.scalar(select(AuthSession)).expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/users/me", headers=headers).status_code == 401


def test_feed_ranks_household_preferences_but_filters_incompatible_intents(client, register):
    me, headers, _ = register(mutate=lambda b: b["profile"].update(gender="woman"))
    compatible, _, _ = register(mutate=lambda b: b["profile"].update(gender="man"))

    def excludes_me(body):
        body["profile"]["roommate_preferences"]["genders"] = ["man"]
    register(mutate=excludes_me)
    register(mutate=lambda b: b["profile"]["lifestyle"].update(smokes=True))
    register(Intent.seek_entire_home)
    response = client.get("/api/users/feed", headers=headers).json()
    assert response["items"][0]["id"] == compatible["user"]["id"]
    assert len(response["items"]) == 3
    assert all(p["match_score"] < response["items"][0]["match_score"] for p in response["items"][1:])
    assert any("Smoking preference differs" in reason for p in response["items"] for reason in p["compatibility"]["reasons"])
    assert response["items"][0]["compatibility"]["method"] == "weighted_cosine"
    assert "email" not in response["items"][0]
    assert "search" not in response["items"][0]
    assert "roommate_preferences" not in response["items"][0]
    assert like(client, headers, compatible["user"]["id"]).status_code == 200
    assert client.get("/api/users/feed", headers=headers).json()["total"] == 2
    assert client.get("/api/users/feed?include_seen=true", headers=headers).json()["total"] == 3


@pytest.mark.parametrize("kind", ["jain_derasar", "mosque", "temple"])
def test_whole_home_location_pincode_and_required_landmarks(client, register, kind):
    def search(body):
        body["profile"]["search"]["location"] = {
            "city": "AHMEDABAD", "areas": [], "pincodes": ["380009"],
            "nearby": [{"kind": kind, "max_distance_km": 1.5, "importance": "required"}],
        }

    _, headers, _ = register(Intent.seek_entire_home, search)
    def home(body):
        body["offering"]["nearby_landmarks"] = [{"kind": kind, "name": "Local landmark", "distance_km": 1.5}]
    provider, provider_headers, _ = register(Intent.offer_entire_home, home)
    register(Intent.offer_entire_home, lambda b: b["offering"].update(nearby_landmarks=[]))
    items = client.get("/api/listings", headers=headers).json()["items"]
    assert len(items) == 2
    assert items[0]["match_score"] > items[1]["match_score"]
    assert any("not met or unconfirmed" in reason for reason in items[1]["compatibility"]["reasons"])
    assert items[0]["listing"]["owner_id"] == provider["user"]["id"]
    assert items[0]["compatibility"]["method"] == "housing_fit"
    assert any("provider-declared" in reason for reason in items[0]["compatibility"]["reasons"])
    assert client.get("/api/users/feed", headers=provider_headers).json()["total"] == 1


def test_shared_home_prioritizes_price_layout_date_stay_and_provider_preferences(client, register):
    _, headers, _ = register(Intent.seek_room)
    good, _, _ = register(Intent.offer_shared_home)
    register(Intent.offer_shared_home, lambda b: b["offering"].update(monthly_rent=15001))
    register(Intent.offer_shared_home, lambda b: b["offering"].update(property_type="4bhk_plus"))
    register(Intent.offer_shared_home, lambda b: b["offering"].update(available_from="2099-01-01"))
    register(Intent.offer_shared_home, lambda b: b["offering"].update(minimum_stay_months=24))
    register(Intent.offer_shared_home, lambda b: b["profile"]["roommate_preferences"].update(genders=["woman"]))
    register(Intent.offer_entire_home)
    feed = client.get("/api/users/feed", headers=headers).json()
    assert feed["items"][0]["id"] == good["user"]["id"]
    assert feed["total"] == 6
    assert all(p["match_score"] < feed["items"][0]["match_score"] for p in feed["items"][1:])


def test_mutual_swipes_idempotency_and_private_messaging(client, register, app):
    a, ha, _ = register()
    b, hb, _ = register()
    _, outsider, _ = register()
    assert like(client, ha, a["user"]["id"]).status_code == 422
    first = like(client, ha, b["user"]["id"]).json()
    assert first == {"matched": False, "match_id": None, "message": "Your choice has been saved. A connection needs both people's approval."}
    assert client.get("/api/matches", headers=ha).json() == []
    mutual = like(client, hb, a["user"]["id"], "superlike").json()
    assert mutual["matched"] is True
    match_id = mutual["match_id"]
    assert like(client, ha, b["user"]["id"]).json()["match_id"] == match_id
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Match)) == 1
    url = f"/api/matches/{match_id}/messages"
    assert client.post(url, headers=outsider, json={"content": "intrusion"}).status_code == 404
    assert client.get(url, headers=outsider).status_code == 404
    assert client.post(url, headers=ha, json={"content": "   "}).status_code == 422
    sent = client.post(url, headers=ha, json={"content": "Let's discuss quiet hours."})
    assert sent.status_code == 201
    assert client.get(url, headers=hb).json()[0]["content"] == "Let's discuss quiet hours."
    assert like(client, hb, a["user"]["id"], "pass").json()["matched"] is False
    assert client.get(url, headers=ha).status_code == 404
    assert client.get("/api/matches", headers=ha).json() == []


def test_concurrent_reciprocal_likes_create_one_match(client, register, app):
    a, ha, _ = register()
    b, hb, _ = register()
    jobs = [(ha, b["user"]["id"]), (hb, a["user"]["id"])]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda job: like(client, *job), jobs))
    assert all(r.status_code in (200, 409) for r in results)
    for headers, target in jobs:
        assert like(client, headers, target).status_code == 200
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Match)) == 1


def test_pause_listing_revokes_connection_and_requires_new_mutual_opt_in(client, register):
    a, ha, _ = register(Intent.seek_room)
    b, hb, bbody = register(Intent.offer_shared_home)
    like(client, ha, b["user"]["id"])
    mutual = like(client, hb, a["user"]["id"]).json()
    offering = dict(bbody["offering"], is_active=False)
    assert client.put("/api/listings/me", headers=hb, json=offering).status_code == 200
    assert client.get("/api/listings", headers=ha).json()["items"] == []
    assert client.get(f"/api/matches/{mutual['match_id']}/messages", headers=ha).status_code == 404
    assert like(client, ha, b["user"]["id"]).status_code == 409
    offering["is_active"] = True
    assert client.put("/api/listings/me", headers=hb, json=offering).status_code == 200
    assert like(client, ha, b["user"]["id"]).json()["matched"] is False
    assert like(client, hb, a["user"]["id"]).json()["matched"] is True


def test_change_intent_replaces_offering_atomically(client, register):
    user, headers, _ = register()
    body = signup_example(Intent.offer_entire_home)
    update = {"profile": body["profile"], "offering": body["offering"]}
    response = client.put("/api/users/me", headers=headers, json=update)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == user["user"]["id"]
    assert response.json()["offering"]["owner_id"] == user["user"]["id"]
    listing_id = response.json()["offering"]["id"]
    body = signup_example()
    assert client.put("/api/users/me", headers=headers, json={"profile": body["profile"]}).status_code == 200
    assert client.get(f"/api/listings/{listing_id}", headers=headers).status_code == 404


def test_stable_cohort_uses_mutual_edges_and_reports_impossibility(client, register):
    accounts = [register() for _ in range(4)]
    ids = [a[0]["user"]["id"] for a in accounts]
    ha = accounts[0][1]
    assert client.post("/api/matching/stable", headers=ha, json={"participant_ids": ids}).status_code == 409
    # A four-person star has mutual edges but cannot have a perfect pairing.
    for account, person_id in zip(accounts[1:], ids[1:]):
        like(client, ha, person_id)
        like(client, account[1], ids[0])
    result = client.post("/api/matching/stable", headers=ha, json={"participant_ids": ids})
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "no_stable_matching"
    assert result.json()["pairs"] == []
    assert len(result.json()["unpaired_ids"]) == 4
    # A two-person mutually approved cohort has a stable pairing.
    result = client.post("/api/matching/stable", headers=ha, json={"participant_ids": ids[:2]})
    assert result.json()["status"] == "stable"
    assert len(result.json()["pairs"]) == 1
    assert client.post("/api/matching/stable", headers=ha, json={"participant_ids": ids[:3]}).status_code == 422
    assert client.post("/api/matching/stable", headers=ha, json={"participant_ids": [ids[0], ids[0]]}).status_code == 422


def test_rent_calculation_persistence_ownership_and_bad_matrix(client, register):
    _, headers, _ = register()
    _, other, _ = register()
    response = client.post("/api/rent-harmony/calculate", headers=headers, json=RENT_EXAMPLE)
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["max_envy"] <= result["tolerance"]
    url = f"/api/rent-harmony/sessions/{result['id']}"
    assert client.get(url, headers=headers).json() == result
    assert client.get(url, headers=other).status_code == 404
    invalid = dict(RENT_EXAMPLE, participants=[{"id": "a", "name": "A", "valuations": {}}, {"id": "b", "name": "B", "valuations": {}}])
    assert client.post("/api/rent-harmony/calculate", headers=headers, json=invalid).status_code == 422


def test_docs_questions_errors_cors_and_lease_fallback(client, register):
    assert client.get("/api/health").json()["database"] == "connected"
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200
    schema = client.get("/openapi.json").json()
    signup = schema["paths"]["/api/auth/signup"]["post"]
    assert len(signup["requestBody"]["content"]["application/json"]["examples"]) == 5
    assert "HTTPBearer" in schema["components"]["securitySchemes"]
    assert schema["paths"]["/api/users/me"]["get"]["security"] == [{"HTTPBearer": []}]
    assert "security" not in signup
    questions = client.get("/api/onboarding/questions").json()
    nearby = next(q for s in questions["sections"] for q in s["questions"] if q["field"] == "profile.search.location.nearby")
    assert {"jain_derasar", "mosque", "temple"} <= {o["value"] for o in nearby["options"]}
    assert client.get("/does-not-exist").json()["error"]["message"] == "Not Found"
    cors = client.options("/api/users/me", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "Authorization"})
    assert cors.status_code == 200
    assert cors.headers["access-control-allow-origin"] == "http://localhost:5173"
    _, headers, _ = register()
    analysis = client.post("/api/lease/analyze", headers=headers, json={"text": "The deposit is non-refundable. Rent is due on the fifth day."}).json()
    assert analysis["engine"] == "local_heuristic"
    assert [c["risk"] for c in analysis["clauses"]] == ["high", "info"]


def test_data_and_session_survive_app_restart(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'persistent.db'}", media_root=tmp_path / "uploads")
    with TestClient(create_app(settings)) as first:
        signup = first.post("/api/auth/signup", json=signup_example()).json()
    headers = {"Authorization": f"Bearer {signup['access_token']}"}
    with TestClient(create_app(settings)) as second:
        response = second.get("/api/users/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["id"] == signup["user"]["id"]
