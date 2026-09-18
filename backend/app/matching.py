"""Intent/dealbreaker filtering and explainable, per-viewer weighted cosine ranking."""
from datetime import timezone
from math import sqrt

from .models import User
from .media_views import gallery_assets, gallery_view, onboarding_status
from .schemas import (
    Candidate, CardLocation, Compatibility, Diet, Intent, Lifestyle, ListingInput, ListingView,
    RoommatePreferences, SearchLocation, UserProfile, UserProfileInput,
)


def profile_of(user: User) -> UserProfileInput:
    return UserProfileInput.model_validate(user.profile.data)


def listing_view(listing) -> ListingView | None:
    if listing is None:
        return None
    return ListingView(
        **{**listing.data, "is_active": listing.is_active},
        id=listing.id, owner_id=listing.owner_id,
        created_at=listing.created_at.replace(tzinfo=timezone.utc),
        media=gallery_view(listing.media_assets),
    )


def user_view(user: User) -> UserProfile:
    return UserProfile(
        id=user.id, email=user.email, profile=profile_of(user), offering=listing_view(user.listing),
        created_at=user.created_at.replace(tzinfo=timezone.utc),
        media=gallery_view(gallery_assets(user, "profile")), onboarding=onboarding_status(user),
    )


def normal(value: str) -> str:
    return " ".join(value.casefold().split())


def locality_matches(location: SearchLocation, listing: ListingInput) -> bool:
    actual = listing.location
    if normal(location.city) != normal(actual.city):
        return False
    if location.areas or location.pincodes:
        return normal(actual.area) in {normal(a) for a in location.areas} or actual.pincode in location.pincodes
    return True


def landmark_matches(preference, listing: ListingInput) -> bool:
    return any(
        place.kind == preference.kind
        and (preference.name is None or normal(place.name) == normal(preference.name))
        and place.distance_km <= preference.max_distance_km
        for place in listing.nearby_landmarks
    )


def household_accepts(preferences: RoommatePreferences, candidate: UserProfileInput) -> bool:
    habits = candidate.lifestyle
    if preferences.genders and candidate.gender not in preferences.genders:
        return False
    if habits is None:
        return False
    return not (
        (preferences.smoking_ok is False and habits.smokes)
        or (preferences.pets_ok is False and habits.has_pets)
        or (preferences.diets and habits.diet not in preferences.diets)
    )


def home_fits(seeker: UserProfileInput, provider: User) -> tuple[bool, list[str]]:
    if provider.listing is None or not provider.listing.is_active:
        return False, []
    home = ListingInput.model_validate(provider.listing.data)
    search = seeker.search
    if search is None or not locality_matches(search.location, home):
        return False, []
    if not search.budget.minimum <= home.monthly_rent <= search.budget.maximum:
        return False, []
    if home.property_type not in search.property_types or home.available_from > search.move_in_by:
        return False, []
    if home.minimum_stay_months > search.stay_months:
        return False, []
    if search.ac_required and (home.air_conditioning is None or not home.air_conditioning.available):
        return False, []
    if any(p.importance == "required" and not landmark_matches(p, home) for p in search.location.nearby):
        return False, []
    reasons = ["Home is in your requested location and rent range.", "Move-in timing and minimum stay fit."]
    if search.ac_required:
        reasons.append("An installed AC is available to the incoming tenant, as requested.")
    for preference in search.location.nearby:
        if landmark_matches(preference, home):
            reasons.append(f"Within {preference.max_distance_km:g} km of {preference.name or preference.kind.value.replace('_', ' ')} (provider-declared).")
    return True, reasons


def searches_overlap(a: UserProfileInput, b: UserProfileInput) -> bool:
    x, y = a.search, b.search
    if normal(x.location.city) != normal(y.location.city):
        return False
    if max(x.budget.minimum, y.budget.minimum) > min(x.budget.maximum, y.budget.maximum):
        return False
    if max(x.move_in_from, y.move_in_from) > min(x.move_in_by, y.move_in_by):
        return False
    if not set(x.property_types).intersection(y.property_types):
        return False
    if (x.location.areas or x.location.pincodes) and (y.location.areas or y.location.pincodes):
        if not (
            {normal(v) for v in x.location.areas}.intersection(normal(v) for v in y.location.areas)
            or set(x.location.pincodes).intersection(y.location.pincodes)
        ):
            return False
    return True


SCALARS = {"cleanliness", "social_energy", "guests", "noise_tolerance"}
CATEGORIES = {
    "sleep_schedule": ["early_bird", "night_owl", "flexible"],
    "work_style": ["office", "hybrid", "remote", "varies"],
    "diet": list(Diet),
    "smokes": [False, True],
    "has_pets": [False, True],
}


def feature(value, key: str) -> list[float]:
    if key in SCALARS:
        x = (value - 1) / 4
        values = [x, 1 - x]
        norm = sqrt(sum(v * v for v in values))
        return [v / norm for v in values]
    return [float(value == option) for option in CATEGORIES[key]]


def weighted_cosine(a: Lifestyle, b: Lifestyle, weights) -> tuple[float, list[str]]:
    left, right, factors = [], [], []
    for key, weight in weights.model_dump().items():
        if weight == 0:
            continue
        x, y = feature(getattr(a, key), key), feature(getattr(b, key), key)
        left.extend(sqrt(weight) * v for v in x)
        right.extend(sqrt(weight) * v for v in y)
        overlap = sum(i * j for i, j in zip(x, y))
        factors.append((overlap, weight, key))
    denominator = sqrt(sum(v * v for v in left) * sum(v * v for v in right))
    score = min(1.0, max(0.0, sum(x * y for x, y in zip(left, right)) / denominator))
    reasons = [
        f"{'Similar' if overlap >= 0.8 else 'Different'} {key.replace('_', ' ')} preferences."
        for overlap, _, key in sorted(factors, reverse=True)[:3]
    ]
    return score, reasons


def compatibility(viewer: User, candidate: User) -> Compatibility | None:
    if viewer.id == candidate.id:
        return None
    a, b = profile_of(viewer), profile_of(candidate)
    a_goals, b_goals = set(a.selected_intents), set(b.selected_intents)
    shared = False
    if Intent.seek_roommate in a_goals and Intent.seek_roommate in b_goals:
        if not searches_overlap(a, b):
            return None
        reasons = ["Shared search area, budget, property types, and move-in window."]
        if a.search.ac_required or b.search.ac_required:
            reasons.append("AC access is required when you choose a property together.")
        if any(p.importance == "required" for s in (a.search, b.search) for p in s.location.nearby):
            reasons.append("Required landmark distances must be checked when you choose a property together.")
        shared = True
    elif (a.search is not None) != (b.search is not None):
        seeker, provider = (a, candidate) if a.search is not None else (b, viewer)
        # An offering's actual listing kind determines its rent unit and household.
        # Saved additional offering goals must never relabel a whole home as a room.
        if provider.listing is None:
            return None
        shared = provider.listing.data["kind"] != "entire_home"
        required_goal = Intent.seek_room if shared else Intent.seek_entire_home
        if required_goal not in seeker.selected_intents:
            return None
        fits, reasons = home_fits(seeker, provider)
        if not fits:
            return None
    else:
        return None
    if shared:
        if not household_accepts(a.roommate_preferences, b) or not household_accepts(b.roommate_preferences, a):
            return None
        score, lifestyle_reasons = weighted_cosine(a.lifestyle, b.lifestyle, a.compatibility_weights)
        return Compatibility(score=round(score * 100, 2), cosine_similarity=round(score, 6), method="weighted_cosine", reasons=reasons + lifestyle_reasons)
    # A landlord's personal lifestyle is not relevant to renting an empty home.
    home = ListingInput.model_validate(provider.listing.data)
    soft = [p for p in seeker.search.location.nearby if p.importance == "preferred"]
    proximity = sum(landmark_matches(p, home) for p in soft) / len(soft) if soft else 1
    return Compatibility(score=round(80 + 20 * proximity, 2), method="housing_fit", reasons=reasons)


def candidate_view(user: User, score: Compatibility) -> Candidate:
    p = profile_of(user)
    offering = listing_view(user.listing) if user.listing and user.listing.is_active else None
    profile_media = gallery_view(gallery_assets(user, "profile"))
    if offering:
        location = CardLocation(
            city=offering.location.city, areas=[offering.location.area], pincodes=[offering.location.pincode],
            label=f"{offering.location.area}, {offering.location.city}", kind="property",
        )
        badges = [offering.property_type.value.upper(), offering.kind.replace("_", " "), offering.furnishing.replace("_", " ")]
        if offering.air_conditioning is None:
            badges.append("AC not specified")
        elif offering.air_conditioning.available:
            badges.append("AC available")
            if offering.air_conditioning.billing_method.startswith("separate_"):
                badges.append("AC billed separately")
        else:
            badges.append("No AC")
        if offering.electricity and offering.electricity.billing_method == "included_in_rent":
            badges.append("Electricity included")
    else:
        # Existing matches may still show a paused property card; its declared
        # locality remains available without claiming a search location.
        if p.search is not None:
            search = p.search.location
            location = CardLocation(
                city=search.city, areas=search.areas, pincodes=search.pincodes,
                label=", ".join([*search.areas[:2], search.city]), kind="search_preference",
            )
        else:
            declared = user.listing.data["location"]
            location = CardLocation(
                city=declared["city"], areas=[declared["area"]], pincodes=[declared["pincode"]],
                label=f"{declared['area']}, {declared['city']}", kind="property",
            )
        badges = []
    if p.lifestyle:
        badges.extend([p.lifestyle.sleep_schedule.replace("_", " "), p.lifestyle.work_style])
        if p.lifestyle.diet != Diet.prefer_not_to_say:
            badges.append(p.lifestyle.diet.value)
    return Candidate(
        id=user.id, full_name=p.full_name, age=p.age, gender=p.gender, occupation=p.occupation,
        bio=p.bio, intent=p.intent, intents=p.selected_intents, lifestyle=p.lifestyle,
        offering=offering, compatibility=score, match_score=score.score,
        card_type="property" if offering else "person", title=offering.title if offering else p.full_name,
        location=location, media=offering.media if offering else profile_media, profile_media=profile_media,
        budget=p.search.budget if p.search else None, badges=badges,
    )
