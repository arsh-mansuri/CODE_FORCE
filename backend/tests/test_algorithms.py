from itertools import permutations, product
import random

import pytest
from pydantic import ValidationError

from app.algorithms import irving, rent_harmony
from app.examples import RENT_EXAMPLE, signup_example
from app.matching import weighted_cosine
from app.schemas import CompatibilityWeights, Lifestyle, RentRequest


def all_pairings(people, preferences):
    if not people:
        yield []
        return
    first, *rest = people
    for second in rest:
        if second in preferences[first]:
            for remaining in all_pairings([p for p in rest if p != second], preferences):
                yield [(first, second)] + remaining


def is_stable(pairs, preferences):
    partner = {p: q for a, b in pairs for p, q in ((a, b), (b, a))}
    for p, choices in preferences.items():
        if p not in partner or partner[p] not in choices:
            return False
        for q in choices[:choices.index(partner[p])]:
            if preferences[q].index(p) < preferences[q].index(partner[q]):
                return False
    return True


def check_against_oracle(preferences):
    exact = next((pairs for pairs in all_pairings(list(preferences), preferences) if is_stable(pairs, preferences)), None)
    result = irving(preferences)
    assert (result is None) == (exact is None), preferences
    if result is not None:
        assert is_stable(result, preferences)
        assert len(result) * 2 == len(preferences)


def test_irving_all_1296_strict_four_person_profiles():
    people = list("abcd")
    choices = [list(permutations([q for q in people if q != p])) for p in people]
    for rows in product(*choices):
        check_against_oracle({p: list(row) for p, row in zip(people, rows)})


@pytest.mark.parametrize("size", [4, 6, 8])
def test_irving_complete_and_incomplete_against_brute_force(size):
    rng = random.Random(2026 + size)
    people = [str(i) for i in range(size)]
    for trial in range(200):
        rows = {p: rng.sample([q for q in people if q != p], size - 1) for p in people}
        if trial % 2:
            for i, p in enumerate(people):
                for q in people[i + 1:]:
                    if rng.random() < 0.3:
                        rows[p].remove(q)
                        rows[q].remove(p)
        check_against_oracle(rows)


def test_irving_does_not_hide_odd_cohorts_or_asymmetric_acceptability():
    with pytest.raises(ValueError):
        irving({"a": ["b", "c"], "b": ["a", "c"], "c": ["a", "b"]})
    with pytest.raises(ValueError):
        irving({"a": ["b"], "b": []})
    assert irving({"a": [], "b": []}) is None


def test_weighted_cosine_identity_and_opposite_scalar_endpoints():
    habits = Lifestyle.model_validate(signup_example()["profile"]["lifestyle"])
    score, _ = weighted_cosine(habits, habits, CompatibilityWeights())
    assert score == pytest.approx(1)
    weights = CompatibilityWeights.model_validate({key: int(key == "cleanliness") for key in CompatibilityWeights.model_fields})
    low = habits.model_copy(update={"cleanliness": 1})
    high = habits.model_copy(update={"cleanliness": 5})
    assert weighted_cosine(low, high, weights)[0] == 0
    assert weighted_cosine(low, habits.model_copy(update={"cleanliness": 3}), weights)[0] == pytest.approx(2 ** -0.5)
    with pytest.raises(ValidationError):
        CompatibilityWeights.model_validate({key: 0 for key in CompatibilityWeights.model_fields})


def assert_rent_certificate(request, result):
    assert sum(round(a.monthly_rent * 100) for a in result.allocations) == round(request.total_rent * 100)
    assert {a.room_id for a in result.allocations} == {r.id for r in request.rooms}
    assert {a.participant_id for a in result.allocations} == {p.id for p in request.participants}
    prices = {a.room_id: a.monthly_rent for a in result.allocations}
    for allocation in result.allocations:
        assert allocation.monthly_rent >= 0
        person = next(p for p in request.participants if p.id == allocation.participant_id)
        assigned_utility = person.valuations[allocation.room_id] - allocation.monthly_rent
        envy = max(person.valuations[room.id] - prices[room.id] for room in request.rooms) - assigned_utility
        assert allocation.utility == pytest.approx(assigned_utility, abs=0.005)
        assert allocation.envy == pytest.approx(max(0, envy), abs=0.005)
    assert result.max_envy == max(a.envy for a in result.allocations)
    assert (result.status == "envy_free_within_tolerance") == (result.max_envy <= request.tolerance)


def test_rent_two_rooms_known_envy_free_solution():
    request = RentRequest.model_validate(RENT_EXAMPLE)
    result = rent_harmony(request, "session")
    assert_rent_certificate(request, result)
    assert result.max_envy == 0
    assert result.fully_labelled_simplices > 0


def test_rent_three_rooms_balanced_simplex_and_paise_rounding():
    request = RentRequest.model_validate({
        "total_rent": 900.01,
        "rooms": [{"id": r, "name": r} for r in "abc"],
        "participants": [{"id": p, "name": p, "valuations": {r: 1000 if r == p else 0 for r in "abc"}} for p in "abc"],
        "resolution": 15, "tolerance": 0,
    })
    result = rent_harmony(request, "session")
    assert_rent_certificate(request, result)
    assert result.method == "fully_labelled_simplex"
    assert result.fully_labelled_simplices > 0
    assert result.max_envy == 0


def test_rent_does_not_claim_unconditional_envy_free_solution():
    request = RentRequest.model_validate({
        "total_rent": 100,
        "rooms": [{"id": r, "name": r} for r in "ab"],
        "participants": [{"id": p, "name": p, "valuations": {"a": 1000, "b": 0}, "max_budget": 10} for p in "xy"],
        "resolution": 10, "tolerance": 0,
    })
    result = rent_harmony(request, "session")
    assert_rent_certificate(request, result)
    assert result.status == "approximate"
    assert result.max_envy == 900
    assert result.fully_labelled_simplices == 0
    assert result.method == "grid_fallback"
    assert any(a.within_budget is False for a in result.allocations)


def test_random_rent_certificates():
    rng = random.Random(42)
    for count in (2, 3):
        for _ in range(10):
            rooms = [str(i) for i in range(count)]
            request = RentRequest.model_validate({
                "total_rent": rng.randint(1, 100000) / 100,
                "rooms": [{"id": r, "name": r} for r in rooms],
                "participants": [{"id": p, "name": p, "valuations": {r: rng.randint(0, 100000) / 100 for r in rooms}} for p in rooms],
                "resolution": 8,
            })
            assert_rent_certificate(request, rent_harmony(request, "test"))
