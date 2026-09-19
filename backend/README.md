# PropVibe FastAPI backend

A working, local-first MVP for intent-based housing and roommate discovery.
This guide describes the implemented backend contract. The project vision in
`SOUL.md` and the [root README](../README.md) also includes longer-term frontend and AI features.

## Run the complete app

Follow the [root quick start](../README.md#quick-start-run-the-entire-app-on-one-server)
to install dependencies, then from `frontend/` run:

```bash
npm run build
npm run server
```

Vite writes the React build into `backend/public/`; FastAPI serves it at
**http://localhost:8000**, with the API at `/api` on the same origin. Client-side
page routes fall back to `index.html`; missing API endpoints and assets retain
their error responses. Build before starting the server. The frontend defaults to
`VITE_API_URL=/api`; update any old tunnel URL in frontend environment settings
and rebuild. The generated `public/` directory is replaced on each build.

## Start locally

Use **Python 3.10+**; this implementation is tested with Python **3.12**.
Python 3.9's annotation support is insufficient for this backend.

From the repository root:

```bash
cd backend
uv venv --python 3.12
uv pip install -r requirements.txt
uv run --no-project python seed_db.py
uv run --no-project uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Or with an installed Python 3.12 and pip:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python seed_db.py
uvicorn main:app --reload --port 8000
```

On Windows, activate with `.venv\Scripts\activate`.

- Swagger / Try it out: **http://localhost:8000/docs**
- ReDoc: **http://localhost:8000/redoc**
- OpenAPI JSON: **http://localhost:8000/openapi.json**
- Database-aware health check: **http://localhost:8000/api/health**

The default database is `backend/propvibe.db`, created on startup. No external
database, geocoder, LLM, or API key is needed. Seeding is optional and explicit.
Application startup never inserts demo accounts automatically.
Uploaded images/videos and generated thumbnails live in `backend/uploads/` by
default. Pillow processes images and PyAV validates videos using packaged FFmpeg
libraries; no separate FFmpeg executable is required with the standard wheels.

### Configuration

The optional root `.env.example` can be copied to `backend/.env` and edited.
Precedence is shell environment, then `backend/.env`, then the repository `.env`.

- `DATABASE_URL`: default is an absolute SQLite URL under `backend/`. An explicit
  relative SQLite URL is relative to the command's working directory.
- `ALLOWED_ORIGINS`: comma-separated browser origins. Defaults to `localhost` and
  `127.0.0.1` on ports `5173` and `5174` over HTTP. Restart the backend after changing
  this setting so CORS preflight requests use the updated allowlist.
- `SESSION_DAYS`: bearer session lifetime, 1–30 days; defaults to 7.
- `MEDIA_ROOT`: persistent directory for media bytes; defaults to `backend/uploads/`.
  Keep this directory together with the SQLite database across server restarts.
- `FRONTEND_URL`: browser app origin for password-reset links (default `http://localhost:8000`).
  Use `http://localhost:5174` for Vite development or the public origin for deployment.
- `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
  `SMTP_STARTTLS` (true): email transport for password recovery. Without SMTP,
  recovery returns an actionable 503 instead of claiming an email was sent.
- `HOST` / `PORT` in the template are hints; use Uvicorn's `--host` / `--port` flags.
- The reserved Gemini/Groq variables are unused in this MVP. Lease review is
  explicitly labelled `local_heuristic`.

SQLAlchemy also accepts `postgresql+psycopg://...` when `psycopg[binary]` is
installed. Automated verification here uses SQLite, not a live PostgreSQL server.
Tables are created with `create_all`; schema migrations are not included yet.

## Guided authentication and recovery

The frontend starts signed-out visitors on a welcome screen, then asks one question
per page. `POST /api/auth/check-email` accepts `{ "email": "you@example.com" }`
and returns `{ "exists": true }` to route an existing account straight to password
sign-in. Email lookup and signup normalize whitespace and case.

`POST /api/auth/forgot-password` accepts an email and sends a 30-minute reset link.
`POST /api/auth/reset-password` accepts `{ "token": "...", "password": "..." }`.
Tokens are stored as hashes, consumed atomically once, and invalidate all existing
sessions after a successful password change. Resends have a one-minute cooldown;
a new link supersedes previous links. The frontend reads the token from the URL
fragment, asks for password confirmation, then returns to sign-in.

Move-in and listing availability dates must be today or later on signup/profile/
listing writes; the latest move-in date must also follow the earliest date. Stored
historical dates remain readable. Browser calendars use local calendar dates and
the API independently enforces its current calendar date.

Media onboarding resumes after signing into an incomplete account. Profile photos,
optional intro video, property photos, and optional walkthrough appear on separate
pages. Photos/videos are previewed before authenticated multipart upload, and each
successful upload is saved immediately. Camera capture uses `getUserMedia` over
HTTPS or localhost, stops camera tracks on exit, and offers a device-camera/file
picker fallback. Discovery opens after the required galleries are complete.

## Five signup paths

`GET /api/onboarding/questions` gives neutral prompts, field paths, applicability,
answer choices, and links to the authoritative validation schema.

- **`seek_entire_home`**: an empty home/whole tenancy, including studio, 1RK,
  1BHK, 2BHK, 3BHK, and 4BHK+. Requires housing search answers.
- **`seek_room`**: join someone who already has a home and an available room or
  shared space. Requires housing search and lifestyle answers.
- **`seek_roommate`**: find a person to search for a home together. Requires
  housing search and lifestyle answers. This is the Irving cohort persona.
- **`offer_entire_home`**: offer one whole home as its owner or current tenant.
  Requires an offering; personal lifestyle answers are optional and not ranked.
- **`offer_shared_home`**: a resident owner/tenant offering a private room or
  shared space. Requires an offering and lifestyle answers for living together.

Users can choose multiple goals within **Looking for a place** (all three seeking
goals) or **Offering a place** (both offering goals). `profile.intents` persists
these choices; mixing categories and duplicate/empty selections are rejected.
Legacy clients may omit `intents` and continue using `profile.intent` alone.
Questions apply when any selected goal needs them, including lifestyle questions
when shared living is one of several choices. Discovery considers every selected
seeking goal; roommate cohorts accept anyone who selected `seek_roommate`.

There is one current offering per account. Providers selecting both goals choose
which space to list first; its actual `kind` determines the primary `intent`, rent
unit, and matches. Both goals remain saved, and a listing update may switch between
their selected offering types without presenting whole-home rent as room rent.
`PUT /api/users/me` can change intent and replace the complete onboarding data
atomically. Account creation validates all conditional housing/lifestyle answers;
media is the authenticated second step of onboarding. New and existing accounts
need complete photo galleries before appearing in discovery or sending new likes.

### What the questions capture

- Location: city, alternative neighbourhoods/PIN codes, optional named landmarks,
  maximum proximity distances, and preferred versus required proximity.
- Practical fit: INR rent range, flat layout, move-in window, stay duration,
  owner/tenant relationship, offered rent, deposit, furnishing, and availability.
- Utility costs: electricity billing method, INR unit/monthly rate, and the agreed
  split; whether accessible AC is installed, its location, and whether AC is
  included or separately charged per unit, hour, or month.
- AC requirement: seekers can require installed AC access before a property is
  eligible for their deck. Unspecified availability does not satisfy this requirement.
- Shared living: tidiness, social energy, guests, noise, sleep, work/study routine,
  food routine, smoking, and pets; explicit mutual household requirements.
- Room preferences: initial importance of size, private bath, balcony, natural
  light, and quiet, to prepare users for room-specific rent valuations later.
- Media: **3–6 photos of the person**, plus **3–6 photos of the home** for providers;
  an optional introduction video and an optional property walkthrough.

Prompts describe preferences without calling one lifestyle better. Gender can
be undisclosed; an empty acceptable-gender list means open to anyone. Proximity to
a Jain derasar, mosque, temple, or other landmark never becomes an inferred
religion or a lifestyle-vector dimension. Food routines are self-reported and
independent of landmark preferences.

### Electricity and AC cost transparency

Listings now contain `electricity` and `air_conditioning` objects. These are saved
through the existing signup and listing/profile update APIs and returned in the
listing responses and swipe cards. Electricity supports inclusion in rent, a fixed
monthly charge, a per-kWh rate, or the actual utility bill. A separate split policy
supports equal sharing, individually metered use, an incoming-tenant percentage,
full payment by the tenant, or a described custom agreement.

AC availability is explicit. Installed AC can be included in rent/main electricity
or charged separately with its own rate and payer/split rule. Contradictory or
incomplete terms are rejected. The questionnaire uses `show_when` to ask only the
applicable follow-up questions, such as the hourly rate when hourly AC charging
is selected. Existing listings with no disclosure return null for these objects.

`profile.search.ac_required=true` filters out properties without confirmed
accessible AC. The rent budget remains rent-only; electricity terms are displayed
separately because consumption is not known at discovery time. See the
[billing contract and example](API.md#electricity-split-rates-and-ac).

## Photo-first onboarding and swipe cards

1. Submit signup JSON and keep the bearer token. The response's
   `user.onboarding` lists the remaining photo steps.
2. Upload 3–6 distinct photos to `POST /api/media/profile/photos` using multipart
   field `files`. Providers also upload 3–6 photos to `/api/media/property/photos`.
   You can upload one photo at a time or send an entire gallery in one batch.
3. Optionally upload one video per gallery to `/api/media/profile/video` or
   `/api/media/property/video` using field `file`.
4. Browse **GET `/api/list`** and **GET `/api/listings`** immediately; complete
   personal and applicable property galleries before connecting.

### Automatic property entries and photo screening

Choosing an offering intent at signup (or when editing a profile) creates one
property entry from the supplied offering details. Subsequent profile/listing
edits update that same entry and retain its property photos. No separate create
or publish request is needed. Providers start with property-photo upload in the UI.

An active offering appears in **Curated Flats** after **3–6 property photos**,
even if the provider has not finished their personal-profile gallery. Its first
property photo is the cover. Personal portraits are never copied into this gallery.
`user.onboarding.listing_status` (also in media responses) is `needs_photos`,
`published`, `paused`, or null for a seeker. Removing property photos below the
minimum hides the property again; removing personal photos does not unpublish it.
People discovery and new connections still require full photo onboarding.

New property uploads are checked using bundled OpenCV frontal/profile face
detectors, locally on the server without API keys or runtime model downloads.
Detected faces return **422 `property_photo_contains_face`** and reject the whole
batch atomically, with guidance to use the profile gallery. A detector failure
returns **503 `photo_screening_unavailable`** for retry, without saving unchecked
photos. The check covers rotated images and uses decoded pixels, not filenames.
It detects faces rather than identities or property authenticity; false positives
and missed faces are possible. Existing stored media and videos are not rescanned.
Install the updated `requirements.txt` when deploying this feature.

Each card includes `match_score` (0–100), name, property title where relevant,
display location, budget/rent details, lifestyle badges, ordered photos, a cover,
thumbnails, and optional video/poster metadata. A property provider's main gallery
shows the home; `profile_media` also shows the person. A seeker's location is
explicitly labelled as their preferred search location, not their current address.
`/api/users/feed` is an alias, and `/api/listings` also exposes a direct match score.

Homes with preference differences remain available as alternatives, including when
there are no exact matches. Results are ordered by descending `match_score` (use it
directly as the match percentage). The `compatibility` object also includes:

- `match_type`: `exact` when all evaluated preferences fit with a full score,
  otherwise `alternative`. This describes evaluated fit, not a guarantee.
- `matched_preferences`: the positive reasons to show under “What fits”.
- `compromises`: unmet preferences and unconfirmed fit to show under “Trade-offs”.
  Housing differences explain the requested area, rent, layout, move-in timing,
  stay length, AC or landmark distance alongside what the property offers.

The existing `reasons` array remains available. City, complementary intent, active
listing and completed property photos determine Curated Flats eligibility. An explicit
`min_match_score` filter is respected even if it leaves no results. Shared homes
also account for lifestyle and household preferences; unknown lifestyle fit is
disclosed rather than treated as perfect compatibility.

Scores come from housing requirements and lifestyle compatibility. Photo count,
video presence, and physical appearance are not scoring inputs. The API filters
out incomplete galleries before ranking and supports `min_match_score`, `limit`,
`offset`, `has_more`, and `next_offset` for the client to load more cards.

- Photos: JPEG/PNG/WebP, **10 MiB each**, minimum 160×160 px, at most 20 megapixels.
  Normalised JPEG output is oriented, resized to at most 2048 px, and stripped of
  EXIF metadata. A separate 480 px thumbnail is created.
- Video: MP4/H.264 or WebM/VP8/VP9, **50 MiB**, **60 seconds**, at most 1080p/60 fps,
  standard 8-bit 4:2:0 pixels. Audio supports AAC/MP3 in MP4 and Opus/Vorbis in WebM.
  Container/codec/metadata and a decoded first frame are checked; no transcoding
  service is needed. A poster is generated and playback supports HTTP byte ranges.
- Gallery controls: choose the cover by ordering photo IDs, edit accessible
  captions, delete media, or replace the optional video. Writes are owner-only.
- Uploaded media has public opaque-ID URLs suitable for image/video tags. Resolve
  returned `/api/media/files/...` paths against the backend origin.
- Dropping below three photos hides the account from discovery and blocks new
  positive swipes until fixed. Existing mutually approved conversations continue.

The complete multipart flow and frontend request examples are in [API.md](API.md#9-photo-and-video-upload-api).

## Reset the four team accounts

From `backend/`, run:

```bash
uv run --no-project python seed_team.py
```

Or use `python seed_team.py` with the backend virtual environment activated.
The script uses the same `DATABASE_URL` and `MEDIA_ROOT` configuration as the API.

Every run recreates these four accounts with the demo password **`1234567890`**:

- `kofworld85@gmail.com`
- `rc.rishi.pc@gmail.com`
- `rctest1@gmail.com`
- `arsh2.mansuri2@gmail.com`

All four search for roommates, rooms, and whole homes in Ahmedabad with overlapping budgets, areas,
property types, and freshly generated future move-in dates. Their shared lifestyle
answers give each pair a 100% compatibility score, while room priorities differ.
Three labelled demo illustrations per person complete photo onboarding.

**This is a full reset of those four accounts:** IDs change, profile edits and
uploads are replaced, and their sessions, swipes, matches/chats, listings, password
reset requests, deletion requests, and saved rent sessions are removed. Other
accounts remain; connections involving a reset account are removed. Replacement
is transactional, and old uploads are removed only after a successful commit.

Sign out and back in after running it. Each account starts with the other three
eligible for its discovery deck (use the default discovery filters). Like each
other to create matches and unlock chat. Running the script again clears those
choices so you can repeat the demo.

### Populate Curated Flats for the four existing accounts

From `backend/`, with the backend environment activated, run:

```bash
python seed_more_listings.py --for-team
```

This upserts the three-property Ahmedabad demo catalog and adds `seek_room` and
`seek_entire_home` goals alongside the four accounts' existing roommate goals.
It preserves their IDs, passwords, active sessions, search preferences, photos,
swipes, matches and messages. Use this command for existing team accounts rather
than the full-reset command above. Missing team accounts cause a clear error.

Provider records are validated through the signup schema. Both their provider
and property galleries use the supplied JPEGs from `backend/uploads/`: `p1.jpeg`,
`p1i1.jpeg`, `p1i2.jpeg` for the whole flat; the corresponding `p2` files for the
private room; and `p3` files for the shared room. The base photo is the cover.
Shared-home demo hosts have explicit
lifestyle answers so normal ranking produces strong matches. The command checks
that all four accounts receive catalog results and at least one 85%+ result,
then prints their counts. Exact matches and alternatives with compromises both
remain available. Reruns retain provider/listing IDs and matching photo IDs,
replace old generated provider illustrations with the selected photos, repair
partial galleries, and preserve connection activity. Extra offerings from the
previous seed catalog are paused. Any failure rolls back
database changes and removes new upload files.

Refresh Curated Flats after seeding (or reload the app to refresh saved profile
goals). Existing sessions continue to work. `python seed_more_listings.py` without
the flag seeds the property catalog and ensures Rishi is a seeker.

## Five-minute demo

Run from `backend/` with the backend environment activated:

```bash
python seed_db.py
```

This creates or updates three offerings and the seeker:

- `rc.rishi.pc@gmail.com` — Rishi, seeking roommates, rooms and whole homes.
  New account demo password: `1234567890`; an existing password is preserved.
- `aarav.shah@example.com` — whole flat, photo set `p1`.
- `rohan.parekh@example.com` — private room, photo set `p2`.
- `kabir.mehta@example.com` — shared room, photo set `p3`.

New provider demo password: `PropVibe-demo-2026`. Existing passwords, sessions,
and connection activity are preserved. Only three seed offerings remain active;
extra offerings from older seed runs are paused. Other users' listings are untouched.

The nine source JPEGs must be present in `backend/uploads/`, even when `MEDIA_ROOT`
points elsewhere. Seeding validates and copies them into managed media with
thumbnails, leaving the originals intact. Provider and property cards use the
same selected photo set. Rishi's missing profile photos use labelled demo
illustrations. Reruns repair galleries; `--fill-missing-media` remains accepted.

1. Open `/docs`, inspect `/api/onboarding/questions`, and try a signup example.
   All five JSON payloads are in Swagger's example dropdown. For a new account,
   authorize with its token and complete the required photo uploads next.
2. Log in as `rc.rishi.pc@gmail.com`. Copy `access_token`, click **Authorize**, and
   paste it without adding the word `Bearer`.
3. Get `/api/list` and `/api/listings`. The offered room appears with photos,
   name/location, a match score, and compatibility explanations. Like the
   offering's `owner_id` via `/api/swipe`.
4. Log in and authorize as the chosen provider, then like Rishi's ID. A match ID
   is returned. Post/read `/api/matches/{match_id}/messages`.
5. For a four-person roommate demo, run `seed_team.py`, then
   `seed_more_listings.py --for-team`, and use the team IDs with `/api/matching/stable`.
6. Try the `/api/rent-harmony/calculate` example. Inspect total rent, room
   allocation, max envy, tolerance, method, and affordability.
7. Try `/api/lease/analyze` to see the offline risk-discussion fallback.

No likes are pre-seeded. Use `/api/users/feed?include_seen=true` to redisplay cards
after swiping during a demo.

## How the algorithms are used

### Weighted vector cosine

Eligibility is evaluated **before** numerical ranking:

1. Complementary intent (`seek_room` ↔ `offer_shared_home`, whole-home seeker ↔
   provider, or two `seek_roommate` profiles).
2. City/locality, budget, property types, move-in compatibility, lease duration
   where applicable, and required property landmark proximity.
3. Bilateral shared-household requirements, including explicitly selected gender,
   smoking, pets, and food routines.

Eligible shared-living profiles are encoded into feature blocks. A 1–5 scalar
becomes a unit-normalised `[x, 1-x]` block, where `x=(answer-1)/4`; categorical
answers become one-hot blocks. Both vectors' blocks are multiplied by the square
root of the viewing person's importance weight, then cosine is calculated.
This avoids falsely treating all-1 and all-5 scalar profiles as identical merely
because their unexpanded vectors are proportional. All-zero weights are rejected.

Scores are rankings, not probabilities of a successful relationship. Each viewer
can rank the same pair differently because their weights can differ. Whole-home
rentals use a separate housing-fit score, never landlord personality similarity.

### Irving stable roommates

`app/algorithms.py` implements proposal reduction and rotation elimination,
followed by a blocking-pair certificate check. It accepts strict, symmetric,
possibly incomplete preference lists. The API derives rankings from cosine scores
and mutual approved edges, breaking equal scores by ascending user UUID.

The API accepts an even cohort of 2–20 people searching together. The requester
must be included and actively connected to every other participant. Each actual
pair also needs its own mutual likes and bilateral eligibility. The result is
either a stable **perfect** pairing or `no_stable_matching`; no partial fallback
is falsely labelled stable. The calculation proposes arrangements and does not
create connections or messages.

### Sperner-style discrete rent approximation

Signup's room priorities prepare the conversation. Once actual rooms are known,
each person supplies a value for **every room in INR/month**. These final
valuations, not identity, determine utility: `value(person, room) - room_price`.
Room amenity labels and signup priorities are not automatically converted to
rupee values; the people involved decide those trade-offs.

The solver supports **2 or 3 rooms and an equal number of people**. It builds a
balanced-owner triangulation of the nonnegative price simplex, labels vertices
with owners' favourite rooms, and evaluates fully labelled cells at their
barycentres. It also evaluates all grid-vertex assignments, including boundaries,
as a fallback. Work is bounded by a resolution of 4–100.

Arbitrary quasilinear valuations need not satisfy Sperner's boundary assumptions;
nonnegative envy-free prices are not guaranteed. Responses expose the selected
method, fully labelled cell count, resolution, actual max envy, and requested
tolerance. `envy_free_within_tolerance` means precisely that measured test passed;
otherwise the result is `approximate`. Budgets are a separate reported check.
Prices are rounded to paise while preserving the total exactly.

## Persistence and authentication

SQLAlchemy tables: `users`, `profiles`, `listings`, `media_assets`, `auth_sessions`,
`swipes`, `matches`, `messages`, and `rent_sessions`. Identity and transactional entities
use foreign keys and unique constraints; nested onboarding/listing value objects
are validated Pydantic JSON documents in their own one-to-one tables.

Passwords use salted PBKDF2-SHA256 with 600,000 iterations. Sessions use random
opaque bearer tokens; only SHA-256 token hashes and UTC expiry timestamps are
stored. Logout revokes the current session. Public discovery DTOs exclude email,
credentials, detailed search constraints, and preference weights. Cards explicitly
share preferred locality and budget to help selection. Messaging requires
an active mutual match; rent sessions are private to their creator.

The default run survives server restarts without a session signing key. Input
errors omit raw request bodies so passwords are not echoed by validation errors.

## Verify

From `backend/`:

```bash
uv run --no-project python -m pytest -q
```

Tests cover all signup personas, invalid-request rollback, privacy/authentication,
bilateral eligibility, landmark constraints, mutual/repeated/concurrent swipes,
chat access, paused listings, intent changes, rent ownership, Swagger, and restart
persistence. Algorithm checks compare Irving against exhaustive pairing search
for all 1,296 complete four-person rankings plus 600 deterministic random complete
and incomplete cohorts of size 4/6/8. Rent tests independently recompute envy and
the paise-total certificate, including impossible nonnegative fair splits.
Media tests exercise real image/video decoding, metadata removal, size/duration
limits, atomic batches, ownership, concurrent gallery limits, ordering/deletion,
byte-range playback, readiness gating, match-score ordering, and restart persistence.

## MVP boundaries

- Matching/filtering loads a bounded demo-sized population in memory; pagination
  limits response size, not database computation.
- One offering per provider; no payment, booking, or
  ownership/email verification service. Provider relationship is self-reported.
- Landmark distances are provider-declared; city/area/name matching is
  case-insensitive text matching, without a map radius or PIN-to-area lookup.
- Shared-home listings represent resident hosts. Multi-property/nonresident
  shared-home management is outside this initial account model.
- Chat uses persistent REST polling. Lease review is a labelled heuristic.
- Media storage is local disk plus relational metadata; cloud object storage and
  video transcoding are not required by this single-server demo.
- No guaranteed exact envy-free rent equilibrium or unconditional stable pairing.

For frontend request/response details, see [API.md](API.md).
Per project guidance, commit functional team chunks every 1–2 hours with meaningful
messages; no commit is created by the setup commands.
