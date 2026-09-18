import re

from .schemas import LeaseAnalysis, LeaseClause


RULES = [
    (r"forfeit|non[- ]?refundable|no refund", "high", "The clause may let the provider keep money after you leave.", "Which deductions are allowed, and when must the remaining deposit be returned?"),
    (r"without (?:any )?notice|sole discretion|at any time|immediate(?:ly)? terminat", "high", "This wording may allow unilateral action or termination with little notice.", "Can we specify written notice and equal termination rights for both parties?"),
    (r"lock[- ]?in|penalt|early termination", "medium", "A minimum commitment or early-exit charge may apply.", "What is the lock-in period, and exactly how is an early-exit charge calculated?"),
    (r"maintenance|repair|deduct", "medium", "This clause may allocate repair costs or allow deductions.", "Who pays for ordinary wear, major repairs, and itemised deductions?"),
    (r"increase|escalat|renewal", "medium", "Rent or renewal terms may change during your stay.", "Can we cap increases and state when they can happen?"),
]


def analyze_lease(text: str) -> LeaseAnalysis:
    clauses = []
    for clause in re.split(r"(?<=[.!?])\s+|\n+", text):
        clause = clause.strip()
        if not clause:
            continue
        for pattern, risk, explanation, question in RULES:
            if re.search(pattern, clause, re.IGNORECASE):
                clauses.append(LeaseClause(clause=clause, risk=risk, explanation=explanation, question_to_ask=question))
                break
        else:
            clauses.append(LeaseClause(
                clause=clause, risk="info", explanation="No configured keyword rule matched this clause. Its legal effect has not been assessed.",
                question_to_ask="Are all charges, responsibilities, and notice periods written clearly?",
            ))
    return LeaseAnalysis(
        clauses=clauses,
        summary="Offline keyword-based review aid, not an LLM or legal opinion. Flags identify questions to discuss, not findings of illegality; unflagged text is not certified safe.",
    )
