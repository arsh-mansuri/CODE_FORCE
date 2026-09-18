"""Bounded, deterministic solvers with explicit failure/approximation results."""
from collections import deque
from itertools import permutations

from .schemas import RentAllocation, RentCalculation, RentRequest


def irving(preferences: dict[str, list[str]]) -> list[tuple[str, str]] | None:
    """Irving proposal reduction + rotation elimination, strict symmetric lists.

    Incomplete lists represent unacceptable pairs. A result is a stable PERFECT
    matching; None means no stable perfect matching exists in this cohort.
    The caller must break ties before invoking the solver.
    """
    people = set(preferences)
    if not people or len(people) % 2:
        raise ValueError("Provide an even, nonempty cohort.")
    for person, choices in preferences.items():
        if len(choices) != len(set(choices)) or person in choices or not set(choices) <= people:
            raise ValueError("Rankings must be strict and contain only other participants.")
        if any(person not in preferences[other] for other in choices):
            raise ValueError("Acceptability must be symmetric.")
    table = {p: list(choices) for p, choices in preferences.items()}
    if any(not choices for choices in table.values()):
        return None
    ranks = {p: {q: i for i, q in enumerate(choices)} for p, choices in preferences.items()}

    def remove(a, b):
        if b in table[a]:
            table[a].remove(b)
        if a in table[b]:
            table[b].remove(a)

    # Phase 1: each person proposes and each receiver holds its best proposal.
    held = {}
    free = deque(table)
    while free:
        proposer = free.popleft()
        while True:
            if not table[proposer]:
                return None
            receiver = table[proposer][0]
            previous = held.get(receiver)
            if previous is None:
                held[receiver] = proposer
                break
            if ranks[receiver][proposer] < ranks[receiver][previous]:
                held[receiver] = proposer
                remove(receiver, previous)
                free.append(previous)
                break
            remove(proposer, receiver)

    for receiver, proposer in held.items():
        if proposer not in table[receiver]:
            return None
        for rejected in table[receiver][table[receiver].index(proposer) + 1:]:
            remove(receiver, rejected)
    if any(not choices for choices in table.values()):
        return None

    # Phase 2: find exposed rotations, then let each second choice trade up.
    while any(len(choices) > 1 for choices in table.values()):
        start = next(p for p, choices in table.items() if len(choices) > 1)
        cycle, positions = [], {}
        person = start
        while person not in positions:
            positions[person] = len(cycle)
            second = table[person][1]
            cycle.append((person, second))
            person = table[second][-1]
        rotation = cycle[positions[person]:]
        deletions = []
        for proposer, receiver in rotation:
            deletions.extend((receiver, rejected) for rejected in table[receiver][table[receiver].index(proposer) + 1:])
        for a, b in deletions:
            remove(a, b)
        if any(not choices for choices in table.values()):
            return None

    partners = {p: choices[0] for p, choices in table.items()}
    # A certificate gate protects against returning unstable pairings.
    if any(partners.get(q) != p for p, q in partners.items()):
        raise RuntimeError("Irving reduction produced asymmetric partners")
    for p, choices in preferences.items():
        for q in choices[:ranks[p][partners[p]]]:
            if ranks[q][p] < ranks[q][partners[q]]:
                raise RuntimeError("Irving reduction produced a blocking pair")
    return sorted((p, q) for p, q in partners.items() if p < q)


def rent_harmony(request: RentRequest, session_id: str) -> RentCalculation:
    """Triangulate the nonnegative price simplex for 2–3 rooms.

    Vertices have a balanced owner colouring. Each owner labels a vertex with
    their utility-maximising room. Fully labelled cells supply assignments and
    barycentric prices. All grid-vertex assignments are also evaluated, including
    boundaries, because arbitrary quasilinear values need not satisfy Sperner's
    boundary condition. Report measured envy; never assert unconditional fairness.
    """
    count = len(request.rooms)
    divisions = request.resolution
    total_cents = round(request.total_rent * 100)
    values = [[p.valuations[room.id] for room in request.rooms] for p in request.participants]
    assignments = list(permutations(range(count)))
    vertices = {}
    best = None
    fully_labelled = 0

    def prices_at(coords):
        raw = [total_cents * coordinate / divisions for coordinate in coords]
        cents = [int(v) for v in raw]
        remainder = total_cents - sum(cents)
        for index in sorted(range(count), key=lambda i: (-(raw[i] - cents[i]), i))[:remainder]:
            cents[index] += 1
        return [v / 100 for v in cents]

    def consider(prices, assignment, method):
        nonlocal best
        utilities = [values[i][room] - prices[room] for i, room in enumerate(assignment)]
        envies = [max(0.0, max(values[i][r] - prices[r] for r in range(count)) - utilities[i]) for i in range(count)]
        # Prefer lower max envy, then lower total envy; deterministic on ties.
        key = (round(max(envies), 8), round(sum(envies), 8), 0 if method == "fully_labelled_simplex" else 1)
        if best is None or key < best[0]:
            best = (key, prices, assignment, utilities, envies, method)

    def add_vertex(coords, owner):
        prices = prices_at(coords)
        # Fixed room-index tie break keeps the labelling deterministic.
        label = max(range(count), key=lambda r: (values[owner][r] - prices[r], -r))
        vertices[coords] = (owner, label)
        for assignment in assignments:
            consider(prices, assignment, "grid_fallback")

    def inspect_cell(coords):
        nonlocal fully_labelled
        labels = [vertices[v][1] for v in coords]
        if len(set(labels)) != count:
            return
        fully_labelled += 1
        assignment = [0] * count
        for v in coords:
            owner, label = vertices[v]
            assignment[owner] = label
        centroid = [sum(v[i] for v in coords) / count for i in range(count)]
        consider(prices_at(centroid), tuple(assignment), "fully_labelled_simplex")

    if count == 2:
        for a in range(divisions + 1):
            add_vertex((a, divisions - a), a % 2)
        for a in range(divisions):
            inspect_cell([(a, divisions - a), (a + 1, divisions - a - 1)])
    else:
        for a in range(divisions + 1):
            for b in range(divisions - a + 1):
                add_vertex((a, b, divisions - a - b), (a + 2 * b) % 3)
        for a in range(divisions):
            for b in range(divisions - a):
                c = divisions - a - b
                inspect_cell([(a, b, c), (a + 1, b, c - 1), (a, b + 1, c - 1)])
                if c >= 2:
                    inspect_cell([(a + 1, b, c - 1), (a, b + 1, c - 1), (a + 1, b + 1, c - 2)])

    _, prices, assignment, utilities, envies, method = best
    allocations = [
        RentAllocation(
            participant_id=person.id, room_id=request.rooms[assignment[i]].id,
            monthly_rent=prices[assignment[i]], utility=round(utilities[i], 2), envy=round(envies[i], 2),
            within_budget=None if person.max_budget is None else prices[assignment[i]] <= person.max_budget,
        ) for i, person in enumerate(request.participants)
    ]
    max_envy = round(max(envies), 2)
    within_tolerance = max_envy <= request.tolerance
    return RentCalculation(
        id=session_id, method=method,
        status="envy_free_within_tolerance" if within_tolerance else "approximate",
        total_rent=request.total_rent, allocations=allocations, max_envy=max_envy,
        tolerance=request.tolerance, resolution=divisions,
        grid_step=round(request.total_rent / divisions, 4), fully_labelled_simplices=fully_labelled,
        message=(
            "Measured envy is within your requested tolerance for the supplied valuations."
            if within_tolerance else
            "This grid did not find a split within your tolerance. Increase resolution or revisit valuations; a nonnegative envy-free split may not exist."
        ) + " All prices are nonnegative and sum to total rent. Budgets are reported separately. This is a bounded discrete approximation, not an exact equilibrium guarantee.",
    )
