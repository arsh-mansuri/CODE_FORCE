# 🏠 PropVibe — Tinder for PropTech & Harmonious Co-Living

> **CodeCraft 2026 @ Nirma University**  
> **Track 4**: PropTech: Next-Gen Real Estate & Living Space Management  
> **Repository**: [github.com/arsh-mansuri/CODE_FORCE](https://github.com/arsh-mansuri/CODE_FORCE) (Public Repository)  
> **Live Demo**: [propvibe.vercel.app](https://propvibe.vercel.app) *(or local preview)*

---

## 📖 1. Problem Statement

Finding and living with roommates is one of the most frustrating experiences for young adults, university students, and first-time renters:

1. **Roommate Personality Mismatch**: Traditional listing portals (Craigslist, fragmented WhatsApp/Facebook groups, broker sites) match people by square footage and price alone. They ignore deep lifestyle frictions: sleep schedules, cleanliness standards, noise tolerance, and social habits, leading to toxic living situations and premature lease terminations.
2. **The "Who Pays What?" Rent Dispute**: In almost every shared apartment, bedrooms are unequal (e.g., one has an attached balcony and private washroom, while another is small with shared bath). Arbitrary 50/50 splits create chronic resentment.
3. **Opaque & Predatory Rental Contracts**: Young renters routinely sign 15-to-30-page legal leases without understanding hidden forfeiture clauses, sudden lock-in fines, and unreasonable maintenance fees.

---

## 💡 2. Proposed Solution: PropVibe

**PropVibe** bridges the gap between technology and everyday urban living by reimagining roommate discovery as a modern, mutual-consent, game-theoretic experience:

* **Double-Opt-In "Vibe Deck"**: A fluid, touch/drag card discovery deck where users swipe left to pass and right to connect based on habit vectors and personality badges. Messaging unlocks only upon mutual approval.
* **Game-Theoretic Stability Matcher**: Implements **Irving's Algorithm for the Stable Roommate Problem** and weighted cosine similarity over normalized habit vectors, guaranteeing stable pairings.
* **"Rent Harmony" Calculator (Sperner’s Lemma)**: An interactive fair-division tool where roommates input their subjective valuations of room amenities (balcony, private bath, natural light); the mathematical engine calculates the exact envy-free price equilibrium where nobody desires another's room at that price.
* **AI Roommate Constitution & Lease Demystifier**: Scans legal lease text using LLM APIs to surface high-risk clauses in plain English (green/amber/red risk flags) and automatically generates a downloadable house agreement.

---

## ✨ 3. Key Features

| Feature Module | User Experience & Technical Mechanism |
| :--- | :--- |
| **🎴 The Vibe Deck** | Responsive swipeable card stack with touch gesture physics, mouse drag, and keyboard controls (Arrow keys). Displays sleep chronotype, cleanliness gauge (1-5), social battery, diet, pet rules, and work rhythm. |
| **🎉 Mutual Match Celebration** | Double-opt-in state machine. When a mutual right-swipe occurs, a celebratory modal with canvas confetti triggers, immediately unlocking real-time direct chat. |
| **⚖️ Rent Harmony Engine** | Mathematical room-rent allocator powered by Sperner's Lemma. Live interactive sliders let users test room trade-offs with sub-millisecond price rebalancing. |
| **📜 AI Lease Jargon Buster** | Contract scanner that translates opaque legal clauses into simple English, flagging arbitrary deposit deductions or unfair termination clauses. |
| **🛡️ Verified Safety Badges** | Student and professional email verification tags, dealbreaker filters (e.g., non-smoker only, female-only flatshares). |

---

## 🏗️ 4. System Architecture

```
                                  PROPVIBE CLIENT (REACT + VITE)
    ┌───────────────────────────────────────────┴───────────────────────────────────────────┐
    ▼                                           ▼                                           ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐   ┌───────────────────────────────┐
│       The Vibe Deck UI        │   │     Rent Harmony Sliders      │   │    Lease Demystifier Portal   │
│  • Touch/Mouse Swipe Physics  │   │  • Sperner Envy-Free Engine   │   │  • Clause Risk Highlighter    │
│  • Mutual Match & Chat Modal  │   │  • Sub-millisecond Equilibrium│   │  • House Constitution Gen     │
└───────────────┬───────────────┘   └───────────────┬───────────────┘   └───────────────┬───────────────┘
                │                                   │                                   │
                └─────────────────────────────┬─────┴───────────────────────────────────┘
                                              ▼
                                 REST API & WEBSOCKET CLIENT
                                              │
                         HTTP / JSON          │       WebSockets / Polling
                                              ▼
                               FASTAPI APPLICATION BACKEND
    ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
    ▼                                         ▼                                         ▼
┌───────────────────────┐         ┌───────────────────────┐         ┌───────────────────────┐
│   FastAPI Endpoints   │         │  Game Theory Solvers  │         │  AI Analysis Pipeline │
│  • /api/users         │         │  • Irving Stable Pair │         │  • Gemini 1.5 Flash   │
│  • /api/swipe         │         │  • Cosine Similarity  │         │  • Clause Extraction  │
│  • /api/matches       │         │  • Sperner Iteration  │         │  • Plain-English Gen  │
│  • /api/rent-harmony  │         │                       │         │                       │
└───────────┬───────────┘         └───────────────────────┘         └───────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                   DATABASE LAYER                                      │
│  • SQLite (Local / Offline Demo) / PostgreSQL (Supabase)                              │
│  • Relational Tables: Users, HabitVectors, Swipes, Matches, Messages, RentSessions   │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ 5. Database Schema & Data Models

The system is backed by a normalized relational database (SQLAlchemy ORM + SQLite/Postgres):

```sql
-- Users and Lifestyle Vectors
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    occupation VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    budget_min INT NOT NULL,
    budget_max INT NOT NULL,
    target_city VARCHAR(100) NOT NULL,
    cleanliness INT DEFAULT 3,         -- 1 (relaxed) to 5 (meticulous)
    sleep_schedule VARCHAR(20),        -- 'early_bird' | 'night_owl'
    social_battery INT DEFAULT 3,       -- 1 (private) to 5 (host)
    dietary_pref VARCHAR(50),          -- 'veg' | 'non_veg' | 'vegan'
    pet_friendly BOOLEAN DEFAULT TRUE,
    smoker BOOLEAN DEFAULT FALSE,
    wfh_status VARCHAR(20)            -- 'remote' | 'hybrid' | 'office'
);

-- Tinder-Style Swiping Ledger
CREATE TABLE swipes (
    id VARCHAR(36) PRIMARY KEY,
    swiper_id VARCHAR(36) REFERENCES users(id),
    target_id VARCHAR(36) REFERENCES users(id),
    direction VARCHAR(10) NOT NULL,     -- 'like' | 'pass' | 'superlike'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(swiper_id, target_id)
);

-- Mutual Matches
CREATE TABLE matches (
    id VARCHAR(36) PRIMARY KEY,
    user1_id VARCHAR(36) REFERENCES users(id),
    user2_id VARCHAR(36) REFERENCES users(id),
    compatibility_score FLOAT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envy-Free Rent Harmony Sessions
CREATE TABLE rent_sessions (
    id VARCHAR(36) PRIMARY KEY,
    apartment_name VARCHAR(100),
    total_rent INT NOT NULL,
    rooms_json JSON NOT NULL,
    equilibrium_split JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 6. API Specifications (REST)

FastAPI provides full interactive OpenAPI documentation at `/docs`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck and runtime status |
| `GET` | `/api/users/feed?user_id={id}` | Returns swipeable candidate profiles filtered by dealbreakers and ranked by compatibility score |
| `POST` | `/api/swipe` | Records a swipe (`like`/`pass`). Returns `{ matched: true/false, match_id }` |
| `GET` | `/api/matches?user_id={id}` | Returns all mutual matches and message threads |
| `POST` | `/api/rent-harmony/calculate` | Calculates Sperner envy-free room rent distribution given total rent and subjective room valuations |
| `POST` | `/api/lease/analyze` | Ingests rental clause text and returns structured risk analysis (high/medium/safe) |

---

## 💻 7. Technology Stack

* **Frontend**: React 18, Vite, TypeScript
* **Styling**: Handcrafted Vanilla CSS Design System (Sleek Dark Mode, Glassmorphism, CSS Custom Properties, Accessible High-Contrast tokens)
* **Icons & Animation**: Lucide React, Canvas Confetti
* **Backend**: Python 3.9+, FastAPI, Uvicorn, Pydantic v2
* **Database & ORM**: SQLite (default local) / PostgreSQL via SQLAlchemy
* **AI & LLM Services**: Google Gemini 1.5 Flash API / Groq API (low-latency inference)
* **Algorithms**: Irving's Stable Roommate Algorithm, Sperner's Lemma Discrete Fixed-Point Approximator, Vector Cosine Similarity

---

## 🚀 8. Setup & How to Run

### Prerequisites
- Node.js >= 18.0.0
- Python >= 3.9
- `uv` (recommended) or `pip`

### Step 1: Clone Repository
```bash
git clone https://github.com/your-team/propvibe.git
cd propvibe
```

### Step 2: Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env

# Seed initial database with realistic roommate profiles
python seed_db.py

# Start FastAPI backend server
uvicorn main:app --reload --port 8000
```
*Backend runs on `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.*

### Step 3: Frontend Setup
```bash
# In a separate terminal tab:
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 👥 9. Team & Git Contribution Log

| Member Name | Role & Core Responsibilities | Commits & Areas |
| :--- | :--- | :--- |
| **Member 1** | Frontend Lead & UX Architecture | Swipe card physics, gesture engine, dark glassmorphic CSS, mutual match celebration modal. |
| **Member 2** | Backend & Game Theory Algorithms | FastAPI endpoints, Irving's stable matching implementation, Sperner's lemma rent splitter. |
| **Member 3** | AI Integration & Database Architect | Database schemas, seed scripts, Gemini lease analyzer, contract jargon buster. |
| **Member 4** | DevOps, Testing & Pitch Lead | CI/CD, README documentation, video demo recording, slide deck, edge-case testing. |

---

## 🛡️ 10. Disclosures & Compliance

* **No Secrets Committed**: All API keys and environment variables are strictly managed via `.env` files. The repository contains only `.env.example`.
* **Third-Party Libraries**: All third-party libraries (FastAPI, React, Lucide, SQLAlchemy) are open-source and listed in `requirements.txt` and `package.json`.
* **AI Tool Disclosure**: AI-assisted development tools were utilized for boilerplate generation, test case brainstorming, and speed of iteration, with 100% of the core architecture, design system, and business logic integrated and defended by the team.
