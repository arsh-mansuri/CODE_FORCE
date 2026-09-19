# 🧭 PROPVIBE PROJECT SOUL & ENGINEERING MANIFESTO

> **Single Source of Truth for Project Identity, Jury Alignment, and 24-Hour Hackathon Execution.**
> **Event**: CodeCraft 2026 @ Nirma University (24-Hour Non-Stop Hackathon)  
> **Track**: Track 4 — PropTech: Next-Gen Real Estate & Living Space Management  
> **Team Target**: Top 3 Podium & Winner's Circle (₹15,000 Prize Pool)

---

## 1. Project Identity & The North Star

**PropVibe** is **Tinder for PropTech** — an intelligent, accessible co-living and roommate discovery platform that replaces stressful Craigslist roommate roulette and opaque rental leases with **double-opt-in swipe discovery**, **game-theoretic stable matching**, and **mathematical rent harmony**.

### The Core Tension We Resolve:
* **The Emotional Friction**: Young adults and first-time renters endure toxic housemate dynamics because traditional portals match by raw square footage, not by lifestyle compatibility (sleep chronotypes, cleanliness standards, social battery, guest rules).
* **The Economic Friction**: Unequal bedroom sizes lead to bitter rent-split arguments ("Why am I paying half when you have the balcony and private bath?").
* **The Legal Friction**: First-time tenants sign 20-page rental agreements without understanding hidden forfeiture clauses, lock-ins, and arbitrary deductions.

### The Winning Solution:
1. **The Vibe Deck**: Tactile, fluid gesture swiping (left = pass, right = connect) with clear lifestyle badges.
2. **The Stability Matcher**: Multi-dimensional cosine compatibility + Irving's Stable Roommate Algorithm.
3. **Rent Harmony (Sperner’s Lemma)**: Interactive envy-free rent division where roommates adjust subjective amenity sliders to find an equilibrium where nobody envies another's room.
4. **AI Roommate Constitution & Lease Demystifier**: Plain-English translation of complex rental clauses into visual green/amber/red risk chips.

---

## 2. Jury Alignment: Decoding the Evaluators

Our codebase, presentation, and live demo are engineered to directly address the priorities of the CodeCraft 2026 jury:

| Jury Member | Background / Lens | What We Deliver in Code & UI |
| :--- | :--- | :--- |
| **Palak Gandhi** | Educator, C-Tag Trainer, **Microsoft Solutions Specialist** | • **Structured, Typed REST APIs**: Clean FastAPI OpenAPI/Swagger documentation (`/docs`).<br>• **Enterprise-Grade Accessibility**: High-contrast dark mode, keyboard navigation (Arrow keys swipe cards), clear visual hierarchies.<br>• **Relational Integrity**: Normalized PostgreSQL/SQLite schemas, clean separation of concerns, explicit error handling. |
| **Dr. Leela Patel** | CEO & Founder, **GES (Global Education / Enterprise Solutions)** | • **Social Impact & Scalability**: Solving real student & young-professional housing crises.<br>• **Practical Utility**: Immediate operational viability for university campuses and co-living operators.<br>• **Quantifiable Outcomes**: Mathematical proof of fairness (Sperner's Lemma) rather than arbitrary guessing. |

---

## 3. The 5 Evaluation Commandments (Judging Rubric)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             JUDGING RUBRIC ALLOCATION                            │
├───────────────────────────────────────┬───────┬──────────────────────────────────┤
│ Criteria                              │ Weight│ Engineering Implementation       │
├───────────────────────────────────────┼───────┼──────────────────────────────────┤
│ 1. Technical Complexity & Live Demo   │  30%  │ Resilient full-stack: FastAPI +  │
│                                       │       │ React, client-side math solvers, │
│                                       │       │ zero-latency live demo.          │
│ 2. Uniqueness & Novel Angle           │  25%  │ Rejecting basic listing boards;  │
│                                       │       │ bringing game theory to housing. │
│ 3. Real-World Problem & Impact        │  20%  │ Student & migrant urban housing; │
│                                       │       │ verified dispute prevention.     │
│ 4. UI/UX Accessibility & Visual WOW   │  15%  │ Glassmorphism, smooth gesture    │
│                                       │       │ physics, haptics, confetti modal.│
│ 5. Git Discipline & Video Defense     │  10%  │ 1-2 hr commit cadences, pristine │
│                                       │       │ README, .env.example, demo video.│
└───────────────────────────────────────┴───────┴──────────────────────────────────┘
```

---

## 4. Git & Team Execution Directives (Hackathon Compliance)

To strictly comply with the CodeCraft 2026 rules and avoid penalties:

1. **Regular Commits (Every 1–2 Hours)**:
   - Never perform a single end-of-hackathon dump. Commits must show chronological progress from scaffolding $\to$ core features $\to$ integration $\to$ polish.
2. **Individual Contributions**:
   - Every team member must make at least **2 meaningful, descriptive commits**.
   - Valid areas: UI/UX components, mathematical algorithms, backend API endpoints, database models, seed scripts, documentation, and automated tests.
3. **Branching Strategy**:
   - Feature branches for major modules: `feat/vibe-deck-ui`, `feat/match-algorithm`, `feat/rent-harmony`, `feat/api-backend`.
   - Merged cleanly into `main` with tested stability.
4. **Zero Secrets in Git**:
   - No API keys, passwords, or live database credentials in repository history.
   - Always commit `.env.example` with sanitized placeholders.
5. **Freeze & Submission**:
   - Repository freeze strictly at deadline.
   - 5-minute focused demonstration video submitted to Google Drive by 12:00 PM.

---

## 5. Architectural Quality Standards

* **Zero Mock Screens**: Every button, slider, and swipe card must be functional. If a user swipes right on a profile, a match state must register in the database/session.
* **Offline-Resilient Demo Mode**: Network in hackathon venues can be volatile. The application must feature realistic, rich seed datasets and client-side fallback persistence (IndexedDB / LocalStorage) so the live demo never fails before the judges.
* **Explainable AI & Math**: The UI must show *why* two users matched (e.g., "94% Match: Night Owl overlap + Vegetarian kitchen compatibility") and *why* rent was split that way.
