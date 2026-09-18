"""Runnable, non-secret example payloads shared by Swagger and demo seeding."""
from copy import deepcopy
from datetime import date, timedelta

from .schemas import Intent


def signup_example(intent: Intent = Intent.seek_roommate, name: str = "Aarav Shah", index: int = 1) -> dict:
    start = date.today() + timedelta(days=14)
    profile = {
        "full_name": name, "age": 24, "gender": "prefer_not_to_say",
        "occupation": "Software engineer", "bio": "Looking for a comfortable home and clear shared expectations.",
        "intent": intent.value,
        "lifestyle": {
            "cleanliness": 4, "social_energy": 3, "guests": 2, "noise_tolerance": 2,
            "sleep_schedule": "early_bird", "work_style": "hybrid", "diet": "vegetarian",
            "smokes": False, "has_pets": False,
        },
        "roommate_preferences": {"genders": [], "smoking_ok": False, "pets_ok": None, "diets": []},
        "room_priorities": {"size": 3, "private_bathroom": 4, "balcony": 2, "natural_light": 4, "quiet": 4},
    }
    if intent in (Intent.seek_entire_home, Intent.offer_entire_home):
        profile.pop("lifestyle")
        profile.pop("roommate_preferences")
    result = {"email": f"demo{index}@example.com", "password": "PropVibe-demo-2026", "profile": profile}
    if intent in (Intent.seek_entire_home, Intent.seek_room, Intent.seek_roommate):
        profile["search"] = {
            "location": {
                "city": "Ahmedabad", "areas": ["Navrangpura", "Naranpura"], "pincodes": ["380009", "380013"],
                "nearby": [{"kind": "jain_derasar", "max_distance_km": 2, "importance": "preferred"}],
            },
            "budget": {"minimum": 5000, "maximum": 30000 if intent == Intent.seek_entire_home else 15000},
            "property_types": ["1rk", "1bhk", "2bhk"],
            "move_in_from": start.isoformat(), "move_in_by": (start + timedelta(days=30)).isoformat(),
            "stay_months": 12,
        }
    else:
        entire = intent == Intent.offer_entire_home
        result["offering"] = {
            "title": "Bright 2BHK in Navrangpura" if entire else "One room in a relaxed 2BHK flatshare",
            "description": "Close to transit and daily essentials. Happy to discuss expectations before moving in.",
            "kind": "entire_home" if entire else "private_room", "property_type": "2bhk",
            "provider_relationship": "owner" if entire else "tenant",
            "location": {"city": "Ahmedabad", "area": "Navrangpura", "pincode": "380009"},
            "monthly_rent": 24000 if entire else 11000, "deposit": 24000 if entire else 11000,
            "available_from": start.isoformat(), "minimum_stay_months": 6,
            "available_spaces": 1, "furnishing": "semi_furnished", "amenities": ["balcony", "natural_light"],
            "nearby_landmarks": [
                {"kind": "jain_derasar", "name": "Neighbourhood Jain Derasar", "distance_km": 1.2},
                {"kind": "public_transport", "name": "Local bus stop", "distance_km": 0.3},
            ],
        }
    return deepcopy(result)


SIGNUP_EXAMPLES = {
    intent.value: {"summary": intent.value.replace("_", " ").title(), "value": signup_example(intent, index=i)}
    for i, intent in enumerate(Intent, start=1)
}

RENT_EXAMPLE = {
    "apartment_name": "Navrangpura home", "total_rent": 30000,
    "rooms": [
        {"id": "balcony", "name": "Room with balcony", "amenities": ["balcony", "private_bathroom"]},
        {"id": "quiet", "name": "Quiet courtyard room", "amenities": ["quiet", "natural_light"]},
    ],
    "participants": [
        {"id": "aarav", "name": "Aarav", "valuations": {"balcony": 19000, "quiet": 13000}, "max_budget": 18000},
        {"id": "meera", "name": "Meera", "valuations": {"balcony": 16000, "quiet": 16000}, "max_budget": 16000},
    ],
    "resolution": 60, "tolerance": 50,
}
