from copy import deepcopy

from fastapi.testclient import TestClient
import pytest

from app.config import Settings
from app.examples import signup_example
from app.main import create_app
from app.models import User
from app.schemas import AirConditioning, ElectricityBilling, Intent


@pytest.mark.parametrize("policy", [
    {"billing_method": "included_in_rent"},
    {"billing_method": "fixed_monthly", "fixed_monthly_amount": 1500, "split": {"method": "equal", "split_between": 3}},
    {"billing_method": "per_kwh", "rate_per_kwh": 8.5, "split": {"method": "metered_usage"}},
    {"billing_method": "per_kwh", "rate_per_kwh": 0, "split": {"method": "tenant_pays_full"}},
    {"billing_method": "actual_bill", "split": {"method": "fixed_percentage", "tenant_share_percentage": 25}},
    {"billing_method": "actual_bill", "split": {"method": "custom", "custom_details": "Residents pay according to occupied days; owner covers vacant rooms."}},
])
def test_electricity_billing_supports_common_household_arrangements(policy):
    stored = ElectricityBilling.model_validate(policy).model_dump(mode="json", exclude_none=True)
    assert stored == policy


@pytest.mark.parametrize("policy", [
    {"available": False},
    {"available": True, "billing_method": "included_in_rent"},
    {"available": True, "billing_method": "included_in_electricity"},
    {"available": True, "billing_method": "separate_per_kwh", "rate_per_kwh": 9.75, "split": {"method": "metered_usage"}},
    {"available": True, "billing_method": "separate_per_hour", "rate_per_hour": 20, "split": {"method": "tenant_pays_full"}},
    {"available": True, "billing_method": "separate_fixed_monthly", "fixed_monthly_amount": 1200, "split": {"method": "equal", "split_between": 2}},
])
def test_ac_billing_distinguishes_included_and_separate_usage(policy):
    parsed = AirConditioning.model_validate(policy)
    assert parsed.available == policy["available"]
    assert parsed.billing_method == policy.get("billing_method")


@pytest.mark.parametrize("field, invalid", [
    ("electricity", {"billing_method": "included_in_rent", "rate_per_kwh": 8.5}),
    ("electricity", {"billing_method": "included_in_rent", "split": {"method": "equal", "split_between": 3}}),
    ("electricity", {"billing_method": "per_kwh", "split": {"method": "tenant_pays_full"}}),
    ("electricity", {"billing_method": "per_kwh", "rate_per_kwh": 8.5}),
    ("electricity", {"billing_method": "per_kwh", "rate_per_kwh": -1, "split": {"method": "tenant_pays_full"}}),
    ("electricity", {"billing_method": "per_kwh", "rate_per_kwh": "NaN", "split": {"method": "tenant_pays_full"}}),
    ("electricity", {"billing_method": "actual_bill", "rate_per_kwh": 8.5, "split": {"method": "tenant_pays_full"}}),
    ("electricity", {"billing_method": "fixed_monthly", "fixed_monthly_amount": 1500, "split": {"method": "equal"}}),
    ("electricity", {"billing_method": "actual_bill", "split": {"method": "fixed_percentage", "tenant_share_percentage": 101}}),
    ("electricity", {"billing_method": "actual_bill", "split": {"method": "tenant_pays_full", "split_between": 3}}),
    ("electricity", {"billing_method": "actual_bill", "split": {"method": "custom", "custom_details": "  "}}),
    ("air_conditioning", {"available": False, "billing_method": "separate_per_hour", "rate_per_hour": 20, "split": {"method": "tenant_pays_full"}}),
    ("air_conditioning", {"available": False, "locations": ["Bedroom"]}),
    ("air_conditioning", {"available": True}),
    ("air_conditioning", {"available": True, "billing_method": "included_in_rent", "rate_per_hour": 20}),
    ("air_conditioning", {"available": True, "billing_method": "included_in_electricity", "split": {"method": "equal", "split_between": 2}}),
    ("air_conditioning", {"available": True, "billing_method": "separate_per_hour", "rate_per_kwh": 8.5, "split": {"method": "tenant_pays_full"}}),
    ("air_conditioning", {"available": True, "billing_method": "separate_fixed_monthly", "fixed_monthly_amount": 1000}),
])
def test_contradictory_or_incomplete_billing_is_rejected_at_signup(client, field, invalid):
    body = signup_example(Intent.offer_shared_home)
    body["offering"][field] = invalid
    response = client.post("/api/auth/signup", json=body)
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_error"
    assert any(f"offering.{field}" in error["field"] for error in response.json()["error"]["fields"])


def test_billing_is_saved_and_returned_in_cards_listings_and_updates(client, register, app):
    provider, headers, body = register(Intent.offer_shared_home)
    _, seeker, _ = register(Intent.seek_room)
    listing_id = provider["user"]["offering"]["id"]
    expected = provider["user"]["offering"]
    assert expected["electricity"]["rate_per_kwh"] == 8.5
    assert expected["electricity"]["split"]["split_between"] == 3
    assert expected["air_conditioning"]["billing_method"] == "separate_per_kwh"
    with app.state.session_factory() as db:
        stored = db.get(User, provider["user"]["id"]).listing.data
        assert stored["electricity"] == expected["electricity"]
        assert stored["air_conditioning"] == expected["air_conditioning"]
    card = client.get("/api/list", headers=seeker).json()["items"][0]
    assert card["offering"]["electricity"] == expected["electricity"]
    assert card["offering"]["air_conditioning"] == expected["air_conditioning"]
    assert "AC available" in card["badges"] and "AC billed separately" in card["badges"]
    listing = client.get("/api/listings", headers=seeker).json()["items"][0]["listing"]
    assert listing["electricity"] == expected["electricity"]
    assert client.get(f"/api/listings/{listing_id}", headers=seeker).json()["air_conditioning"] == expected["air_conditioning"]
    replacement = deepcopy(body["offering"])
    replacement["electricity"] = {"billing_method": "included_in_rent"}
    replacement["air_conditioning"] = {
        "available": True, "locations": ["Offered bedroom"], "billing_method": "separate_per_hour",
        "rate_per_hour": 20, "split": {"method": "tenant_pays_full"},
    }
    updated = client.put("/api/listings/me", headers=headers, json=replacement)
    assert updated.status_code == 200, updated.text
    assert client.get("/api/listings/me", headers=headers).json()["air_conditioning"]["rate_per_hour"] == 20
    updated_card = client.get("/api/list", headers=seeker).json()["items"][0]
    assert "Electricity included" in updated_card["badges"]
    assert "AC billed separately" in updated_card["badges"]
    # A bad replacement must preserve the previous valid terms.
    replacement["air_conditioning"]["available"] = False
    assert client.put("/api/listings/me", headers=headers, json=replacement).status_code == 422
    assert client.get("/api/listings/me", headers=headers).json()["air_conditioning"]["rate_per_hour"] == 20


def test_ac_priority_ranks_alternatives_without_revoking_connections(client, register):
    seeker, hs, _ = register(Intent.seek_room, mutate=lambda b: b["profile"]["search"].update(ac_required=True))
    good, hg, body = register(Intent.offer_shared_home)
    register(Intent.offer_shared_home, mutate=lambda b: b["offering"].update(air_conditioning={"available": False}))
    register(Intent.offer_shared_home, mutate=lambda b: b["offering"].pop("air_conditioning"))
    for path in ("/api/list", "/api/listings"):
        response = client.get(path, headers=hs).json()
        assert response["total"] == 3
        assert response["items"][0]["match_score"] > response["items"][1]["match_score"]
    card = client.get("/api/list", headers=hs).json()["items"][0]
    assert card["id"] == good["user"]["id"]
    assert any("AC is available" in reason for reason in card["compatibility"]["reasons"])
    client.post("/api/swipe", headers=hs, json={"target_id": good["user"]["id"], "direction": "like"})
    assert client.post("/api/swipe", headers=hg, json={"target_id": seeker["user"]["id"], "direction": "like"}).json()["matched"] is True
    body["offering"]["air_conditioning"] = {"available": False}
    assert client.put("/api/listings/me", headers=hg, json=body["offering"]).status_code == 200
    assert client.get("/api/list", headers=hs).json()["total"] == 2
    matches = client.get("/api/matches", headers=hs).json()
    assert len(matches) == 1
    assert any("unavailable or unconfirmed" in reason for reason in matches[0]["other_user"]["compatibility"]["reasons"])
    assert client.post("/api/swipe", headers=hs, json={"target_id": good["user"]["id"], "direction": "like"}).status_code == 200


def test_legacy_listing_details_remain_unknown_and_no_ac_is_explicit(client, register, app):
    provider, hp, _ = register(Intent.offer_shared_home)
    _, hs, _ = register(Intent.seek_room)
    with app.state.session_factory() as db:
        user = db.get(User, provider["user"]["id"])
        data = dict(user.listing.data)
        data.pop("electricity")
        data.pop("air_conditioning")
        user.listing.data = data
        db.commit()
    card = client.get("/api/list", headers=hs).json()["items"][0]
    assert card["offering"]["electricity"] is None
    assert card["offering"]["air_conditioning"] is None
    assert "AC not specified" in card["badges"]
    assert "No AC" not in card["badges"]
    assert "Electricity included" not in card["badges"]
    body = signup_example(Intent.offer_shared_home)["offering"]
    body["air_conditioning"] = {"available": False}
    assert client.put("/api/listings/me", headers=hp, json=body).status_code == 200
    assert "No AC" in client.get("/api/list", headers=hs).json()["items"][0]["badges"]


def test_searching_together_keeps_ac_as_future_home_requirement(client, register):
    _, headers, _ = register(mutate=lambda b: b["profile"]["search"].update(ac_required=True))
    register()
    card = client.get("/api/list", headers=headers).json()["items"][0]
    assert card["card_type"] == "person"
    assert any("AC access is a priority" in reason for reason in card["compatibility"]["reasons"])


def test_utility_onboarding_conditions_and_swagger(client):
    questions = client.get("/api/onboarding/questions").json()
    fields = {q["field"]: q for section in questions["sections"] for q in section["questions"]}
    rate = fields["offering.electricity.rate_per_kwh"]
    assert rate["required"] is True
    assert rate["show_when"] == {"offering.electricity.billing_method": ["per_kwh"]}
    assert set(rate["applies_to"]) == {"offer_entire_home", "offer_shared_home"}
    ac = fields["offering.air_conditioning.billing_method"]
    assert ac["show_when"] == {"offering.air_conditioning.available": [True]}
    assert "separate_per_hour" in {option["value"] for option in ac["options"]}
    assert "profile.search.ac_required" in fields
    schema = client.get("/openapi.json").json()
    assert {"ElectricityBilling", "AirConditioning", "BillSplitPolicy"} <= set(schema["components"]["schemas"])
    examples = schema["paths"]["/api/auth/signup"]["post"]["requestBody"]["content"]["application/json"]["examples"]
    assert examples["offer_shared_home"]["value"]["offering"]["electricity"]["rate_per_kwh"] == 8.5


def test_utility_details_survive_restart(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'billing.db'}", media_root=tmp_path / "uploads")
    with TestClient(create_app(settings)) as client:
        account = client.post("/api/auth/signup", json=signup_example(Intent.offer_shared_home)).json()
        headers = {"Authorization": f"Bearer {account['access_token']}"}
        expected = account["user"]["offering"]
    with TestClient(create_app(settings)) as client:
        restored = client.get("/api/listings/me", headers=headers).json()
        assert restored["electricity"] == expected["electricity"]
        assert restored["air_conditioning"] == expected["air_conditioning"]
