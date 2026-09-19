from datetime import date, timedelta

import pytest

from app.schemas import Intent


def test_no_exact_listing_returns_ranked_alternatives_with_explicit_tradeoffs(client, register):
    _, headers, seeker = register(Intent.seek_entire_home, lambda b: b["profile"]["search"].update(ac_required=True))
    search = seeker["profile"]["search"]

    def different(body):
        body["offering"].update(
            monthly_rent=32000, property_type="studio", minimum_stay_months=24,
            available_from=(date.fromisoformat(search["move_in_by"]) + timedelta(days=7)).isoformat(),
            air_conditioning={"available": False}, nearby_landmarks=[],
            location={"city": "Ahmedabad", "area": "Bopal", "pincode": "380058"},
        )

    poor, _, _ = register(Intent.offer_entire_home, different)
    close, _, _ = register(Intent.offer_entire_home, lambda b: b["offering"].update(air_conditioning={"available": False}))
    register(Intent.offer_entire_home, lambda b: b["offering"]["location"].update(city="Mumbai"))
    register(Intent.offer_entire_home, lambda b: b["offering"].update(is_active=False))
    register(Intent.offer_entire_home, complete_media=False)
    register(Intent.offer_shared_home)

    response = client.get("/api/listings", headers=headers)
    assert response.status_code == 200
    feed = response.json()
    assert feed["total"] == 2
    assert [item["listing"]["owner_id"] for item in feed["items"]] == [close["user"]["id"], poor["user"]["id"]]
    close_item, poor_item = feed["items"]
    assert 0 < close_item["match_score"] < 100
    assert poor_item["match_score"] == 0
    for item in feed["items"]:
        assert item["match_score"] == item["compatibility"]["score"]
        assert item["compatibility"]["match_type"] == "alternative"
        assert set(item["compatibility"]["compromises"]).isdisjoint(item["compatibility"]["matched_preferences"])
    assert len(close_item["compatibility"]["compromises"]) == 1
    assert close_item["compatibility"]["matched_preferences"]
    compromises = poor_item["compatibility"]["compromises"]
    assert len(compromises) == 7
    for detail in ("Navrangpura", "Bopal", "₹2000 above your maximum", "STUDIO", "7 days later", "24 months", "no AC accessible", "2 km"):
        assert any(detail in reason for reason in compromises), detail

    # Pagination and explicit score filters must work for alternatives too.
    first = client.get("/api/listings?limit=1", headers=headers).json()
    assert first["has_more"] and first["next_offset"] == 1
    second = client.get("/api/listings?limit=1&offset=1", headers=headers).json()
    assert second["items"] == [poor_item] and not second["has_more"]
    assert client.get("/api/listings?min_match_score=100", headers=headers).json()["total"] == 0
    assert client.get(f"/api/listings/{poor_item['listing']['id']}", headers=headers).status_code == 200
    # Both public aliases and discovery expose the same explanations and percentage.
    assert client.get("/listings", headers=headers).json() == feed
    discovery = client.get("/api/list", headers=headers).json()["items"]
    assert discovery[0]["compatibility"] == close_item["compatibility"]


@pytest.mark.parametrize("seeking,offering", [
    (Intent.seek_entire_home, Intent.offer_entire_home),
    (Intent.seek_room, Intent.offer_shared_home),
])
def test_exact_matches_rank_first_and_explanations_update_with_preferences(client, register, seeking, offering):
    _, headers, body = register(seeking, lambda b: b["profile"]["search"].update(ac_required=True))
    register(offering, lambda b: b["offering"].update(air_conditioning={"available": False}))
    exact, _, _ = register(offering)
    items = client.get("/api/listings", headers=headers).json()["items"]
    assert items[0]["listing"]["owner_id"] == exact["user"]["id"]
    assert items[0]["match_score"] == 100
    assert items[0]["compatibility"]["match_type"] == "exact"
    assert items[0]["compatibility"]["compromises"] == []
    assert items[1]["compatibility"]["match_type"] == "alternative"

    body["profile"]["search"]["ac_required"] = False
    assert client.put("/api/users/me", headers=headers, json={"profile": body["profile"]}).status_code == 200
    refreshed = client.get("/api/listings", headers=headers).json()["items"]
    assert all(item["compatibility"]["match_type"] == "exact" for item in refreshed)
    assert all(item["compatibility"]["compromises"] == [] for item in refreshed)


def test_missing_ac_is_unconfirmed_and_unknown_lifestyle_is_disclosed(client, register):
    def search(body):
        body["profile"]["search"]["ac_required"] = True
        body["profile"].pop("lifestyle")
    _, headers, _ = register(Intent.seek_room, search)
    register(Intent.offer_shared_home, lambda b: b["offering"].update(air_conditioning=None))
    item = client.get("/api/listings", headers=headers).json()["items"][0]
    compromises = item["compatibility"]["compromises"]
    assert any("not confirmed AC availability" in reason for reason in compromises)
    assert not any("no AC accessible" in reason for reason in compromises)
    assert any("Lifestyle fit is still unknown" in reason for reason in compromises)
    assert item["compatibility"]["match_type"] == "alternative"
    assert item["match_score"] < 100


def test_shared_home_lifestyle_drawbacks_are_not_hidden_behind_top_reasons(client, register):
    _, headers, _ = register(Intent.seek_room)
    register(Intent.offer_shared_home, lambda b: b["profile"]["lifestyle"].update(sleep_schedule="night_owl"))
    item = client.get("/api/listings", headers=headers).json()["items"][0]
    assert item["compatibility"]["match_type"] == "alternative"
    assert "Different sleep schedule preferences." in item["compatibility"]["compromises"]
    assert item["match_score"] < 100
