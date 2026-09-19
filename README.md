# PropVibe — Tinder for PropTech & Harmonious Co-Living

**CodeCraft 2026 @ Nirma University · Track 4: PropTech — Next-Gen Real Estate & Living Space Management**

PropVibe helps students, young adults, and first-time renters discover homes and
compatible housemates through swipe-based discovery, mutual connections, and
transparent living costs.

## Quick start: run the entire app on one server

Prerequisites: **Node.js 22.12+** (or 20.19+), **Python 3.12** (recommended),
and [uv](https://docs.astral.sh/uv/getting-started/installation/).
The backend supports Python 3.10+.

Clone the repository, then install Python and frontend dependencies:

```bash
git clone https://github.com/arsh-mansuri/CODE_FORCE.git
cd CODE_FORCE

uv venv --python 3.12 backend/.venv
uv pip install --python backend/.venv -r backend/requirements.txt

cd frontend
npm i
npm run build
npm run server
```

Open **http://localhost:8000**. This one Python process serves the React app,
API, and uploaded media. Stop it with **Ctrl+C**.

`uv pip install` is the Python dependency install command; uv has no `uv i`
command. No virtual-environment activation is needed for the commands above.

After installation, the normal workflow from the repository root is simply:

```bash
cd frontend
npm run build
npm run server
```

Or, from the repository root without changing directories:

```bash
npm --prefix frontend run build
npm --prefix frontend run server
```

### What the build and server commands do

- `npm run build` type-checks TypeScript and writes the complete Vite production
  build into **`backend/public/`**. Each build replaces that generated directory.
- `npm run server` runs Uvicorn from `backend/`, using `backend/.venv`, on
  **`0.0.0.0:8000`**. No separate frontend process is needed.
- FastAPI serves `backend/public/index.html` at `/` and for extensionless
  client-side routes, so direct navigation and page refreshes load the SPA.
- Static assets are served at `/assets/...`; API requests go to `/api/...`.
  Missing API endpoints and assets retain their error responses.
- Build before starting the server. If you started the backend before its first
  frontend build, restart it after building to enable SPA serving.

Useful URLs:

- App: **http://localhost:8000**
- API health: **http://localhost:8000/api/health**
- Interactive API documentation: **http://localhost:8000/docs**
- ReDoc: **http://localhost:8000/redoc**
- OpenAPI schema: **http://localhost:8000/openapi.json**

### API URL and environment configuration

The React client defaults to **`/api`**, so it always calls the same server that
served the page. This also works when exposing the whole app through a domain or
tunnel: open that server's root URL and requests go to its `/api` path.

For an explicit frontend setting, copy `frontend/.env.example` to `frontend/.env`:

```dotenv
VITE_API_URL=/api
```

**Update any old `VITE_API_URL` in `frontend/.env`, `frontend/.env.local`,
mode-specific env files, your shell, or deployment build settings to `/api`.**
Vite embeds this value at build time, so run `npm run build` again after changes.
Backend `.env` files do not configure the frontend build.

For a separately hosted API, set `VITE_API_URL=https://your-server.example/api`
before building and add the frontend origin to the backend's `ALLOWED_ORIGINS`.
The standard single-server setup needs neither a separate API hostname nor a
CORS override.

Backend configuration is optional. To customize it, copy the root `.env.example`
to `backend/.env`. Set **`FRONTEND_URL` to the app's public origin**, such as
`http://localhost:8000` or `https://your-server.example`, for password-reset links.
SMTP configuration is required to send recovery emails. Never commit `.env` files.

SQLite is created automatically at `backend/propvibe.db`; uploads live in
`backend/uploads/`. Keep both for persistence. Building the frontend only clears
`backend/public/`. All core features work without external API keys.

### Optional: populate the demo

From the repository root, before starting the server:

```bash
uv run --directory backend --no-project python seed_db.py
```

This populates three Ahmedabad property offerings and a seeker. On a fresh
database, sign in as **`rc.rishi.pc@gmail.com`** with **`1234567890`**.
Existing account passwords and sessions are preserved. Startup does not seed
accounts automatically. The source property JPEGs are included in `backend/uploads/`.

See the [backend demo guide](backend/README.md#five-minute-demo) for provider
credentials, the four-person roommate demo, and seed behavior.

## Development with hot reload

After installing dependencies, run these in separate terminals from the root:

```bash
# Terminal 1: Python API with reload
uv run --directory backend --no-project uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: React with hot reload
npm --prefix frontend run dev
```

Open **http://localhost:5174**. Vite proxies `/api` (including media) to
`http://127.0.0.1:8000`; keep `VITE_API_URL=/api`. When testing password recovery
in this mode, set `FRONTEND_URL=http://localhost:5174` in `backend/.env` and restart
the backend.

## Problem and solution

Traditional property portals focus on price and square footage but miss daily
co-living friction: incompatible sleep schedules, cleanliness, guests, noise, and
food routines. Unequal bedrooms also make arbitrary equal rent splits frustrating,
while lengthy rental agreements obscure deposits, lock-ins, and maintenance costs.

PropVibe combines lifestyle-aware discovery with mutual consent, explainable
matching, room-specific rent valuations, and plain-English lease review.

### Features

- **Intent-based onboarding:** seek a whole home, join a flatshare, find a
  roommate, offer a whole home, or offer shared space; multiple compatible goals
  are supported.
- **Photo-first Vibe Deck:** scored swipe cards, profile/property galleries,
  optional video, and explanations of preferences met and trade-offs.
- **Mutual connections and chat:** double-opt-in likes unlock persistent messaging
  through REST polling.
- **Transparent listings:** rent, deposits, electricity split policies, AC costs,
  availability, reviews, and property-tour requests.
- **Stability matcher:** weighted cosine compatibility plus Irving's stable
  roommate algorithm. It reports when no stable perfect pairing exists.
- **Rent Harmony:** a bounded, Sperner-style discrete approximation for two or
  three rooms, reporting actual envy, tolerance, affordability, and exact rent
  totals. Exact envy-free prices are not guaranteed for arbitrary valuations.
- **Lease discussion aid:** plain-English risk flags through labelled offline
  heuristics. Live LLM analysis and automated roommate constitutions remain
  part of the broader project vision.

## Architecture and technology

```text
Browser: React 19 + TypeScript
    | same-origin requests to /api
    v
FastAPI + Uvicorn (:8000)
    ├── /              React SPA from backend/public
    ├── /assets/*      Vite production assets
    ├── /api/*         Authentication, discovery, swipes, chat, reviews, algorithms
    ├── /api/media/*   Uploads and image/video delivery
    └── /docs          Interactive OpenAPI documentation
          |
          ├── SQLAlchemy + SQLite (backend/propvibe.db)
          └── Local media storage (backend/uploads)
```

- **UI:** React 19, Vite 8, TypeScript, vanilla CSS tokens, responsive layouts,
  Lucide icons, and Canvas Confetti.
- **API:** FastAPI, Pydantic v2, SQLAlchemy, Uvicorn, opaque bearer sessions.
- **Media:** Pillow, OpenCV, and PyAV for image processing and video validation.
- **Persistence:** SQLite by default; PostgreSQL requires a separately installed
  `psycopg[binary]` driver and `DATABASE_URL` configuration.

Relational models cover users, profiles, listings, media, sessions, swipes,
matches, messages, reviews, and rent sessions. Nested onboarding answers are
validated with Pydantic. See the implementation contract in the
[backend guide](backend/README.md) and [API integration guide](backend/API.md).

### Main API entry points

- `GET /api/health` — database-aware health check.
- `GET /api/onboarding/questions` — conditional signup prompts.
- `POST /api/auth/signup`, `POST /api/auth/login` — accounts and sessions.
- `GET /api/list` (alias `/api/users/feed`) — scored discovery cards.
- `GET /api/listings` — property discovery.
- `POST /api/swipe` — like or pass; mutual likes create a connection.
- `GET /api/matches`, `/api/matches/{match_id}/messages` — connections and chat.
- `POST /api/matching/stable` — stable roommate pairing.
- `POST /api/rent-harmony/calculate` — approximate fair rent allocation.
- `POST /api/lease/analyze` — local heuristic lease review.

Use `/docs` for current schemas, authentication requirements, and examples.

## Checks and team workflow

Run from the repository root:

```bash
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
uv run --directory backend --no-project python -m pytest -q
```

Commit functional chunks every 1–2 hours with meaningful messages. Dependencies
are listed in `frontend/package.json` and `backend/requirements.txt`; environment
templates contain placeholders. AI-assisted development tools supported
implementation and iteration, with the team responsible for reviewing and
explaining the resulting code.

Project background and hackathon goals: [SOUL.md](SOUL.md).
