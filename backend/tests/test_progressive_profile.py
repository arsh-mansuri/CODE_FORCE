from datetime import date, timedelta

import pytest

from app.models import User
from app.schemas import Intent, LandmarkKind


@pytest.mark.parametrize("intent", list(Intent))
def test_lifestyle_can_be_deferred_and_completed_in_parts(client, register, intent):
    account, headers, body = register(intent, lambda b: b["profile"].pop("lifestyle", None), complete_media=False)
    assert account["user"]["profile"]["lifestyle"] is None
    body["profile"]["lifestyle"] = {"cleanliness": 5}
    response = client.put("/api/users/me", headers=headers, json={"profile": body["profile"], "offering": body.get("offering")})
    assert response.status_code == 200, response.text
    lifestyle = response.json()["profile"]["lifestyle"]
    assert lifestyle["cleanliness"] == 5
    assert lifestyle["smokes"] is None and lifestyle["diet"] is None
    assert client.get("/api/users/me", headers=headers).json()["profile"]["lifestyle"] == lifestyle


def test_unanswered_lifestyle_is_unknown_not_a_perfect_match(client, register):
    _, headers, _ = register(mutate=lambda b: b["profile"].pop("lifestyle"))
    candidate, _, _ = register(mutate=lambda b: b["profile"].update(lifestyle={"has_pets": True}))
    card = client.get("/api/list", headers=headers).json()["items"][0]
    assert card["id"] == candidate["user"]["id"]
    assert card["compatibility"]["cosine_similarity"] is None
    assert 0 < card["match_score"] < 100
    assert any("unknown" in reason for reason in card["compatibility"]["reasons"])
    assert "vegetarian" not in card["badges"]


def test_only_lower_fit_option_still_appears_and_accepts_mutual_likes(client, register):
    seeker, headers, _ = register(Intent.seek_room)
    def different(body):
        body["offering"].update(monthly_rent=18000, property_type="studio", minimum_stay_months=24)
        body["offering"]["location"]["area"] = "Another area"
        body["offering"]["location"]["pincode"] = "380001"
        body["profile"]["lifestyle"]["smokes"] = True
    alternative, other_headers, _ = register(Intent.offer_shared_home, different)
    register(Intent.offer_shared_home, lambda b: b["offering"]["location"].update(city="Mumbai"))
    register(Intent.offer_shared_home, lambda b: b["offering"].update(is_active=False))
    feed = client.get("/api/list", headers=headers).json()
    assert feed["total"] == 1
    card = feed["items"][0]
    assert card["id"] == alternative["user"]["id"]
    assert any("outside your preferred range" in reason for reason in card["compatibility"]["reasons"])
    assert client.post("/api/swipe", headers=headers, json={"target_id": card["id"], "direction": "like"}).status_code == 200
    assert client.post("/api/swipe", headers=other_headers, json={"target_id": seeker["user"]["id"], "direction": "like"}).json()["matched"]


def test_rejection_count_tracks_distinct_accounts_and_survives_feed_reload(client, register):
    _, headers, _ = register(complete_media=False)
    a, _, _ = register()
    b, _, _ = register()
    assert client.get("/api/list", headers=headers).json()["passed_count"] == 0
    for target in [a, a, b]:
        assert client.post("/api/swipe", headers=headers, json={"target_id": target["user"]["id"], "direction": "pass"}).status_code == 200
    feed = client.get("/api/list", headers=headers).json()
    assert feed["passed_count"] == 2
    assert feed["items"] == []
    assert client.get("/api/list?include_seen=true", headers=headers).json()["passed_count"] == 2


def test_nearby_questions_expose_every_landmark_kind(client):
    fields = {q["field"]: q for section in client.get("/api/onboarding/questions").json()["sections"] for q in section["questions"]}
    for field in ("profile.search.location.nearby", "offering.nearby_landmarks"):
        assert {option["value"] for option in fields[field]["options"]} == {kind.value for kind in LandmarkKind}
    assert all(not question["required"] for field, question in fields.items() if field.startswith("profile.lifestyle."))


def test_completing_profile_preserves_unchanged_historical_dates(client, register, app):
    account, headers, _ = register(complete_media=False)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    with app.state.session_factory() as db:
        user = db.get(User, account["user"]["id"])
        user.profile.data = {**user.profile.data, "search": {**user.profile.data["search"], "move_in_from": yesterday, "move_in_by": yesterday}}
        db.commit()
    profile = client.get("/api/users/me", headers=headers).json()["profile"]
    profile["lifestyle"] = {"cleanliness": 5}
    assert client.put("/api/users/me", headers=headers, json={"profile": profile}).status_code == 200
    profile["search"]["move_in_from"] = "2020-01-01"
    assert client.put("/api/users/me", headers=headers, json={"profile": profile}).status_code == 422
