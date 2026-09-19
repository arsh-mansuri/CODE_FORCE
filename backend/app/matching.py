"""Intent/city eligibility and explainable preference-first suggestion ranking."""
from dataclasses import dataclass
from datetime import timezone
from math import isclose, sqrt

from .models import User
from .media_views import gallery_assets, gallery_view, onboarding_status
from .schemas import (
    AccountDeletionStatus, Candidate, CardLocation, Compatibility, Diet, Intent, Lifestyle, ListingInput, ListingView,
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
        deletion_request=AccountDeletionStatus(
            requested_at=user.deletion_request.requested_at.replace(tzinfo=timezone.utc),
            scheduled_for=user.deletion_request.scheduled_for.replace(tzinfo=timezone.utc),
        ) if user.deletion_request else None,
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


def household_differences(preferences: RoommatePreferences, candidate: UserProfileInput) -> list[str]:
    habits = candidate.lifestyle
    differences = []
    if preferences.genders and candidate.gender not in preferences.genders:
        differences.append("Sharing preference differs or gender is undisclosed.")
    if habits:
        if preferences.smoking_ok is False and habits.smokes:
            differences.append("Smoking preference differs; discuss before connecting.")
        if preferences.pets_ok is False and habits.has_pets:
            differences.append("Pet preference differs; discuss before connecting.")
        if preferences.diets and habits.diet and habits.diet not in preferences.diets:
            differences.append("Shared-kitchen food preference differs.")
    return differences


@dataclass
class PreferenceFit:
    score: float
    reasons: list[str]
    matched_preferences: list[str]
    compromises: list[str]


def preference_score(checks: list[tuple[bool, int, str, str]]) -> PreferenceFit:
    total = sum(weight for _, weight, _, _ in checks)
    score = sum(weight for fits, weight, _, _ in checks if fits) / total if total else 1.0
    return PreferenceFit(
        score=score,
        reasons=[yes if fits else no for fits, _, yes, no in checks],
        matched_preferences=[yes for fits, _, yes, _ in checks if fits],
        compromises=[no for fits, _, _, no in checks if not fits],
    )


def home_fits(seeker: UserProfileInput, provider: User) -> PreferenceFit | None:
    if provider.listing is None or not provider.listing.is_active:
        return None
    home = ListingInput.model_validate(provider.listing.data)
    search = seeker.search
    if search is None or normal(search.location.city) != normal(home.location.city):
        return None
    preferred_locality = ", ".join([*search.location.areas, *search.location.pincodes])
    budget_difference = (
        f"₹{home.monthly_rent - search.budget.maximum:g} above your maximum"
        if home.monthly_rent > search.budget.maximum
        else f"₹{search.budget.minimum - home.monthly_rent:g} below your minimum"
    )
    checks = [
        (locality_matches(search.location, home), 2, "Home is in your preferred area.", f"You wanted {preferred_locality}; this home is in {home.location.area} ({home.location.pincode}), in the same city."),
        (search.budget.minimum <= home.monthly_rent <= search.budget.maximum, 4, "Rent is in your preferred range.", f"Rent is outside your preferred range: you wanted ₹{search.budget.minimum:g}–₹{search.budget.maximum:g}/month; this home is ₹{home.monthly_rent:g}/month ({budget_difference})."),
        (home.property_type in search.property_types, 1, "Home layout matches your preferences.", f"You wanted {', '.join(p.value.upper() for p in search.property_types)}; this home is {home.property_type.value.upper()}."),
        (home.available_from <= search.move_in_by, 3, "Move-in timing fits.", f"You wanted to move in by {search.move_in_by}; this home is available from {home.available_from}, {(home.available_from - search.move_in_by).days} days later."),
        (home.minimum_stay_months <= search.stay_months, 1, "Minimum stay fits.", f"You wanted a {search.stay_months}-month stay; this home requires at least {home.minimum_stay_months} months."),
    ]
    if search.ac_required:
        checks.append((home.air_conditioning is not None and home.air_conditioning.available, 2,
                       "An installed AC is available to the incoming tenant.",
                       "You wanted AC; preferred AC access is unavailable or unconfirmed. " +
                       ("The provider has not confirmed AC availability." if home.air_conditioning is None else "This home has no AC accessible to you.")))
    for preference in search.location.nearby:
        place = preference.name or preference.kind.value.replace('_', ' ')
        checks.append((landmark_matches(preference, home), 2 if preference.importance == "required" else 1,
                       f"Within {preference.max_distance_km:g} km of {place} (provider-declared).",
                        f"You wanted to be within {preference.max_distance_km:g} km of {place}; this distance is not met or unconfirmed in the provider's listing."))
    return preference_score(checks)


def search_fit(a: UserProfileInput, b: UserProfileInput) -> PreferenceFit | None:
    x, y = a.search, b.search
    if x is None or y is None or normal(x.location.city) != normal(y.location.city):
        return None
    locality = True
    if (x.location.areas or x.location.pincodes) and (y.location.areas or y.location.pincodes):
        locality = bool({normal(v) for v in x.location.areas}.intersection(normal(v) for v in y.location.areas)
            or set(x.location.pincodes).intersection(y.location.pincodes)
        )
    return preference_score([
        (locality, 2, "Shared search area.", "Different preferred neighbourhoods in the same city."),
        (max(x.budget.minimum, y.budget.minimum) <= min(x.budget.maximum, y.budget.maximum), 4, "Overlapping rent budgets.", "Different rent budgets; discuss a comfortable split."),
        (max(x.move_in_from, y.move_in_from) <= min(x.move_in_by, y.move_in_by), 3, "Overlapping move-in windows.", "Move-in windows differ; some flexibility may be needed."),
        (bool(set(x.property_types).intersection(y.property_types)), 1, "Shared home layout preferences.", "Different preferred home layouts."),
    ])


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


def weighted_cosine(a: Lifestyle | None, b: Lifestyle | None, weights) -> tuple[float | None, list[str]]:
    left, right, factors = [], [], []
    for key, weight in weights.model_dump().items():
        if weight == 0 or a is None or b is None or getattr(a, key) is None or getattr(b, key) is None:
            continue
        if key == "diet" and Diet.prefer_not_to_say in (a.diet, b.diet):
            continue
        x, y = feature(getattr(a, key), key), feature(getattr(b, key), key)
        left.extend(sqrt(weight) * v for v in x)
        right.extend(sqrt(weight) * v for v in y)
        overlap = sum(i * j for i, j in zip(x, y))
        factors.append((overlap, weight, key))
    denominator = sqrt(sum(v * v for v in left) * sum(v * v for v in right))
    if not denominator:
        return None, ["Lifestyle fit is still unknown. Add preferences to personalize suggestions."]
    score = min(1.0, max(0.0, sum(x * y for x, y in zip(left, right)) / denominator))
    reasons = [
        f"{'Similar' if isclose(overlap, 1.0, abs_tol=1e-9) else 'Different'} {key.replace('_', ' ')} preferences."
        for overlap, _, key in sorted(factors, reverse=True)
    ]
    return score, reasons


def compatibility(viewer: User, candidate: User) -> Compatibility | None:
    if viewer.id == candidate.id:
        return None
    a, b = profile_of(viewer), profile_of(candidate)
    a_goals, b_goals = set(a.selected_intents), set(b.selected_intents)
    shared = False
    if Intent.seek_roommate in a_goals and Intent.seek_roommate in b_goals:
        housing = search_fit(a, b)
        if housing is None:
            return None
        reasons = housing.reasons
        if a.search.ac_required or b.search.ac_required:
            reasons.append("AC access is a priority when you choose a property together.")
        if any(p.importance == "required" for s in (a.search, b.search) for p in s.location.nearby):
            reasons.append("Check preferred landmark distances when you choose a property together.")
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
        housing = home_fits(seeker, provider)
        if housing is None:
            return None
        reasons = housing.reasons
    else:
        return None
    matched_preferences = housing.matched_preferences
    compromises = housing.compromises
    if shared:
        differences = list(dict.fromkeys(household_differences(a.roommate_preferences, b) + household_differences(b.roommate_preferences, a)))
        cosine, lifestyle_reasons = weighted_cosine(a.lifestyle, b.lifestyle, a.compatibility_weights)
        matched_preferences += [reason for reason in lifestyle_reasons if reason.startswith("Similar")]
        compromises += differences + [reason for reason in lifestyle_reasons if not reason.startswith("Similar")]
        score = max(0, 100 * (0.55 * housing.score + 0.45 * (cosine if cosine is not None else 0.5)) - 8 * len(differences))
        return Compatibility(score=round(score, 2), cosine_similarity=round(cosine, 6) if cosine is not None else None,
            method="weighted_cosine", reasons=reasons + differences + lifestyle_reasons,
            match_type="exact" if isclose(score, 100, abs_tol=1e-9) and not compromises else "alternative",
            matched_preferences=matched_preferences, compromises=compromises)
    # A landlord's personal lifestyle is not relevant to renting an empty home.
    return Compatibility(score=round(100 * housing.score, 2), method="housing_fit", reasons=reasons,
        match_type="exact" if not compromises else "alternative",
        matched_preferences=matched_preferences, compromises=compromises)


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
        badges.extend(value.replace("_", " ") for value in (p.lifestyle.sleep_schedule, p.lifestyle.work_style) if value)
        if p.lifestyle.diet and p.lifestyle.diet != Diet.prefer_not_to_say:
            badges.append(p.lifestyle.diet.value)
    return Candidate(
        id=user.id, full_name=p.full_name, age=p.age, gender=p.gender, occupation=p.occupation,
        bio=p.bio, intent=p.intent, intents=p.selected_intents, lifestyle=p.lifestyle,
        offering=offering, compatibility=score, match_score=score.score,
        card_type="property" if offering else "person", title=offering.title if offering else p.full_name,
        location=location, media=offering.media if offering else profile_media, profile_media=profile_media,
        budget=p.search.budget if p.search else None, badges=badges,
    )
