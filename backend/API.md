# PropVibe API integration guide

Base URL: `http://localhost:8000/api`.
The generated `/openapi.json` is the complete typed contract; `/docs` includes
interactive examples and `/redoc` provides a read-oriented version.

## Conventions

- JSON request bodies and typed response objects, except media uploads which use
  `multipart/form-data` with actual binary files.
- Money is INR; amounts have at most two decimal places and must be finite.
- Search budget is **whole tenancy rent** for `seek_entire_home`, and **individual
  rent/share** for `seek_room` / `seek_roommate`. Listing rent is whole tenancy for
  `entire_home`, otherwise per incoming person. Deposit and utilities are separate.
- Dates are `YYYY-MM-DD`. Response timestamps are UTC ISO-8601.
- Account/listing/match IDs are server-generated UUID strings. Rent participants
  and rooms use unique session-local IDs supplied by the caller.
- Extra body fields are rejected to catch misspelled onboarding answers.
- The authenticated account is derived from the bearer token, never a supplied
  `user_id`. Protected routes need `Authorization: Bearer <access_token>`.

### Errors

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please check the highlighted answers and try again.",
    "fields": [
      {
        "field": "body.profile.search.location.pincodes.0",
        "message": "String should match pattern '^[1-9][0-9]{5}$'",
        "type": "string_pattern_mismatch"
      }
    ]
  }
}
```

`401`: authenticate again. `404`: unavailable resource (also used for another
account's private resource). `409`: duplicate account, incompatible state, or a
concurrent write conflict. Concurrent-write conflicts can be retried; duplicate
emails require login. `413`: oversized upload. `415`: unsupported/invalid media.
`422`: correct the listed answers. `503`: database or media storage unavailable.
Field errors never include raw input/passwords.

## 1. Build a signup form

**GET `/onboarding/questions`** — public.

Returns a versioned questionnaire split into account, search, lifestyle,
preferences, offering, and media sections. Each question includes:

- `field`: dot-path into the signup payload, or a logical `media.*` field uploaded
  separately through its `upload_endpoint` after signup.
- `prompt` / `help_text`: nonjudgmental text suitable for a form.
- `input_type`, `options`, and `required`.
- `applies_to`: the intents that should see it. Requiredness applies only then.
- `show_when`: conditional form visibility. Every referenced field path must match
  one of its listed values before showing the question or enforcing its `required`
  flag. For example, ask for an electricity unit rate only after `per_kwh` is selected.
- `used_for`: routing, preference ranking, cosine, Irving rankings, or rent preparation.
- Media prompts also provide `upload_endpoint`, `minimum_files`, `maximum_files`,
  `accepted_types`, `max_file_bytes`, and `max_duration_seconds` where applicable.

Defaults, bounds, nested shapes, and cross-field rules are enforced by the signup
schema, linked by `validation_schema`. `nearby` accepts objects with `kind`,
optional `name`, `max_distance_km`, and `importance` (`preferred` or `required`).
The legacy value `required` now means higher priority, not exclusion. Both nearby
question fields provide all landmark kinds in `options`.

The frontend asks ten signup questions: email, password, display name, age and
goals, then five housing questions. Seekers provide city, budget, layouts and two
move-in dates; providers give layout, owner/tenant relationship, location, rent
and availability. The separate **Edit / complete profile** screen presents the
remaining applicable questions, including conditional electricity/AC billing.
Lifestyle can be null or a partial object; unanswered values remain unknown.

The five signup intents are described in [README.md](README.md#five-signup-paths).
Never send an empty `search` or `offering` object for an inapplicable intent;
omit it or send `null`.

## 2. Register, log in, or log out

**POST `/auth/signup`** — public, returns **201**.

Submit `{ "email", "password", "profile", "offering"? }`. The Swagger example
selector has five complete, executable payloads with current move-in dates.
This sample completes the JSON stage of roommate signup; photo onboarding follows:

```json
{
  "email": "new.roommate@example.com",
  "password": "Example-only-password-2026",
  "profile": {
    "full_name": "Meera",
    "age": 24,
    "gender": "prefer_not_to_say",
    "intent": "seek_roommate",
    "search": {
      "location": {
        "city": "Ahmedabad",
        "areas": ["Navrangpura"],
        "pincodes": ["380009"],
        "nearby": [
          {"kind": "mosque", "max_distance_km": 2, "importance": "preferred"}
        ]
      },
      "budget": {"minimum": 5000, "maximum": 15000},
      "property_types": ["1bhk", "2bhk"],
      "move_in_from": "2027-01-01",
      "move_in_by": "2027-02-01",
      "stay_months": 12
    },
    "lifestyle": {
      "cleanliness": 4,
      "social_energy": 3,
      "guests": 2,
      "noise_tolerance": 2,
      "sleep_schedule": "early_bird",
      "work_style": "hybrid",
      "diet": "vegetarian",
      "smokes": false,
      "has_pets": false
    },
    "roommate_preferences": {
      "genders": [], "smoking_ok": false, "pets_ok": null, "diets": []
    }
  }
}
```

Response: `{ "access_token", "token_type": "bearer", "expires_at", "user" }`.
The private `user` includes `id`, `email`, `profile`, `offering`, `created_at`,
`media` (personal gallery), and `onboarding` (remaining photo requirements).
Profile/listing/session creation is one transaction; a failed signup creates none.
Email uniqueness is case-insensitive. Passwords are 10–128 characters.
Initially `onboarding.complete` is false. Use the token to upload 3–6 profile photos
and, for providers, 3–6 property photos before connecting and appearing in others'
feeds. Browsing `/list` is available immediately. See section 9.

**POST `/auth/login`** — public.

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo5@example.com","password":"PropVibe-demo-2026"}'
```

Returns the same shape as signup with a new session token.

**POST `/auth/logout`** — protected. Revokes the current token only.

## 3. Read or edit your profile

- **GET `/users/me`**: complete private account/profile/offering.
- **PUT `/users/me`**: replace with `{ "profile", "offering"? }`, using the same
  conditional requirements as signup. Credentials are not accepted here. Include
  the offering when keeping an offering intent. Switching to a seeker removes
   the former listing and its associated media files. Newly incompatible matches are deactivated and related
  swipes removed, so later reconnection requires fresh mutual approval.

There is no public endpoint exposing another person's full private profile.

### Account deletion requests

- **POST `/users/me/deletion-request`** (bearer token required, no body): flags
  the signed-in account for deletion processing seven days from the server's UTC
  request time. Returns the updated `UserProfile` with
  `deletion_request: { requested_at, scheduled_for }`. Repeating the request
  returns the original timestamps, without extending the deadline.
- **DELETE `/users/me/deletion-request`** (bearer token required, no body): cancels
  the pending request and returns `deletion_request: null`. Safe to repeat.
- The flag appears only in private account responses (including login and
  `GET /users/me`), survives profile edits and restarts, and is never included in
  discovery cards. Accounts remain available while their request is pending.

Requests are stored in `account_deletion_requests`, keyed by `user_id` with an
indexed `scheduled_for` timestamp. Startup creates this new table for existing
databases. This is a persistent request queue for deletion processing; these
endpoints do not run an automatic purge job or immediately delete account data.

## 4. Discover people or listings

**GET `/list?limit=20&offset=0&include_seen=false&min_match_score=0`**

`/users/feed` is an alias with exactly the same parameters and response.

Response: `{ "items": [Candidate], "total", "limit", "offset", "has_more", "next_offset", "passed_count" }`.
`limit` is 1–100; `offset` is 0–10,000. The default hides anyone you have already
swiped on. `include_seen=true` shows them again. `min_match_score` accepts 0–100.
Cards sort by descending computed score, then ascending user UUID. Incomplete
photo galleries are hidden; callers can browse before completing their own gallery.
`passed_count` counts distinct accounts currently passed on. The frontend offers a
dismissible preference-refinement prompt after two passes. After swiping, the unseen set changes: fetch offset
0 to refill the deck rather than reusing an offset from that older result set.

A candidate includes display ID/name/age/gender/bio/occupation, intent, public
lifestyle answers, an optional offering, and these card-friendly fields:

- `match_score`: direct 0–100 badge value, equal to `compatibility.score`.
- `card_type`: `person` or `property`; `title` is the person's name or property's title.
- `location`: city, areas, PIN codes, ready-to-display `label`, and `kind`.
  `search_preference` means where a seeker wants to live, not their current address.
- `media`: ordered primary carousel, cover, thumbnails, and optional video.
  Property offers show property media here; seekers show their personal media.
- `profile_media`: the person's gallery, also available on property cards.
- `budget`: the seeker's rent range, or null for providers. Offered rent, deposit,
  layout, amenities, `electricity`, and `air_conditioning` live in `offering`.
- `badges`: short lifestyle/property labels suitable for overlays.

Scores remain entirely requirements-based; photos and videos are presentation
inputs, not appearance-based ranking features. The explanation object remains:

```json
{
  "compatibility": {
    "score": 94.2,
    "cosine_similarity": 0.942,
    "method": "weighted_cosine",
    "reasons": [
      "Shared search area, budget, property types, and move-in window.",
      "Similar cleanliness preferences."
    ]
  }
}
```

This illustrates the response shape, not a promise of a particular computed score.
Whole-home candidates use `housing_fit` and `cosine_similarity: null`.
Housing fit is the weighted fraction of preferences satisfied: budget (4), timing
(3), area (2), layout (1), minimum stay (1), requested AC (2), and each landmark
(1 for preferred, 2 for high priority). Shared-living scores combine 55% housing fit
and 45% lifestyle cosine, minus 8 points per distinct household preference difference,
clamped to 0–100. Lifestyle compares only mutually answered fields; with no comparable
answers the cosine is null and a neutral 50% lifestyle contribution is used.

**GET `/listings?limit=20&offset=0`**

For home/room seekers: returns `{ "items": [{ "listing", "compatibility",
"match_score", "provider_name" }], "total", "limit", "offset", "has_more",
"next_offset" }`. `listing.media` contains the property gallery; `min_match_score`
is supported here too. A listing's `owner_id` is the profile ID to swipe
on; it identifies the account offering the space, including a provider who is a
tenant. Swipes are on people/providers, not listing IDs. Listings remain visible
after a pass; the people feed hides previous swipes by default.

**GET `/listings/{listing_id}`**: your own listing or an eligible active listing.

### Eligibility and preference ranking

- City and landmark/area names use case-insensitive, whitespace-normalised exact
  text. City is always required. Within it, listed areas **or** PIN codes are
  acceptable alternatives. An empty locality list means any part of the city.
- Property landmarks compare kind, optional exact name, and maximum declared
  distance. A difference lowers rank and is explained, rather than hiding the home.
- Roommates searching together rank overlapping budgets, dates, layouts and localities
  more highly. There is no automatic mapping from an area name to a PIN code.
- For searching-together pairs, preferred landmark distances await a chosen
  property; the reason text explicitly says so. No imaginary distance is scored.
- Offered rent, layout, availability and minimum stay are priorities. Alternatives
  remain available when preferences differ, with their differences explained.
- `profile.search.ac_required` defaults to false. True prioritizes confirmed AC;
  unknown or unavailable AC lowers rank. For searching-together pairs it is a
  priority to discuss for the future home.
- Smoking/pet and gender/diet preferences affect shared-living ranking in both
  directions. Unanswered habits are not invented. Whole-home landlords' personal
  lifestyle and roommate preferences are not used for tenant selection.
- Complementary intent, same city and active listings remain eligibility rules.
  Self cards, incomplete candidate galleries and previously swiped profiles remain hidden.

### Manage an offering

- **GET `/listings/me`**: your active or paused listing.
- **PUT `/listings/me`**: replace the complete `ListingInput` object. Set
  `is_active=false` to pause or `true` to reopen it. Incompatible existing
  connections are deactivated, including when a listing is paused.
- First-time offering creation or changing whole/shared intent is done with
  `PUT /users/me`, so profile intent and listing kind change together.

### Electricity split, rates, and AC

Supply these structured fields in `offering` during signup/profile replacement,
or in the listing body for **PUT `/listings/me`**. They persist with the listing
and appear in `/list` → `items[].offering`, `/listings` → `items[].listing`,
`/listings/{id}`, `/listings/me`, and `/users/me` → `offering`.

Example: electricity at ₹8.50 per unit shared by three payers, with an installed
bedroom AC charged separately at ₹20 per operating hour to its user:

```json
{
  "electricity": {
    "billing_method": "per_kwh",
    "rate_per_kwh": 8.5,
    "split": {
      "method": "equal",
      "split_between": 3
    },
    "notes": "The shared electricity reading excludes separately charged AC use."
  },
  "air_conditioning": {
    "available": true,
    "locations": ["Offered bedroom"],
    "billing_method": "separate_per_hour",
    "rate_per_hour": 20,
    "split": {
      "method": "tenant_pays_full"
    }
  }
}
```

These are fields to include in the complete existing listing payload, not a new
partial-update endpoint. All quoted rates/amounts are **INR before applying their
split policy**. An electricity unit is **1 kWh**.

**Main electricity billing:**

- `included_in_rent`: no extra electricity charge; omit rates, amount, and split.
- `fixed_monthly`: supply `fixed_monthly_amount` and `split`.
- `per_kwh`: supply `rate_per_kwh` and `split`.
- `actual_bill`: follow the actual utility bill (including its slab tariffs and
  fees), with an explicit `split`; no invented flat unit rate is needed.

**How the charge is split** (`BillSplitPolicy`, reused for separate AC charges):

- `equal`: supply `split_between`, the total number of payers including the incoming
  tenant, at least two. This is not the number of vacant beds/rooms.
- `metered_usage`: each payer pays for their individually measured usage.
- `fixed_percentage`: supply `tenant_share_percentage`, greater than 0 and up to 100.
- `tenant_pays_full`: the incoming tenant pays the entire applicable charge.
- `custom`: supply a nonblank `custom_details` explanation.

For room listings, **tenant** means the incoming person; for whole-home listings it
means the renting household. When a fixed monthly amount already represents the
tenant's individual charge, use `tenant_pays_full` so it is not divided again.
Fields belonging to a different split method are rejected rather than ignored.

**AC availability and billing:**

- `air_conditioning: null` means not disclosed. It must not display as “No AC.”
- `{ "available": false }` explicitly means no installed AC accessible to the
  incoming tenant. Billing, location, and rate fields must be omitted or empty/null.
- When `available=true`, specify `billing_method` and optionally `locations`.
- `included_in_rent`: no additional AC charge.
- `included_in_electricity`: AC follows the main electricity policy, without a
  separate AC rate or split.
- `separate_per_kwh`: supply `rate_per_kwh` and an AC `split`.
- `separate_per_hour`: supply `rate_per_hour` and an AC `split`.
- `separate_fixed_monthly`: supply `fixed_monthly_amount` and an AC `split`.

The main electricity charge describes the portion **excluding separately charged
AC consumption**; do not bill the same usage twice. Non-AC electricity can be
included in rent while AC is separately charged. Optional `notes` explain either
policy. Contradictory states (such as no AC plus an hourly AC charge), missing
applicable rates, negative amounts, and ambiguous split fields return 422.

Both new listing fields are optional for backward compatibility. Omitted fields
on older listings return null, meaning **not disclosed**, never “free” or “no AC.”
Cards expose badges such as `AC available`, `AC billed separately`, `No AC`,
`AC not specified`, and `Electricity included`, based on the disclosed terms.

These are billing agreements, not a meter-reading ledger or a computed invoice.
Usage-dependent charges cannot be converted into a total monthly cost until usage
is known. Existing rent budgets and Rent Harmony remain rent-only.

## 5. Double-opt-in connections and chat

**POST `/swipe`**

```json
{"target_id": "PROFILE-UUID-FROM-FEED", "direction": "like"}
```

Directions: `like`, `pass`, `superlike`. A superlike is a positive swipe with the
same consent semantics; it does not bypass eligibility or guarantee placement.

Response: `{ "matched": false, "match_id": null, "message": "..." }`, or a true
match and its ID when both users have liked. Repeating a swipe updates the same
ledger row; there is at most one match for a canonical user pair. Incompatible
positive swipes return 409. Passing deactivates the match and locks its chat.
Positive swipes also require both accounts to have completed photo onboarding.

- **GET `/matches?limit=20&offset=0`**: your active matches, newest first. Each
  contains `id`, `other_user` (candidate DTO), `compatibility_score`, `created_at`.
- **POST `/matches/{match_id}/messages`**: `{ "content": "Hello!" }`, returns 201
  with message ID, match ID, sender ID, content, and UTC creation time. Content is
  1–2,000 nonblank characters after trimming.
- **GET `/matches/{match_id}/messages?limit=50&offset=0`**: chronological messages,
  oldest first. Poll this endpoint for updates in the MVP.

Both conversation routes require membership in an active, still-eligible match.
Another account receives 404. Message history is retained but inaccessible after
a pass; reconnecting the same pair makes that history available again.

## 6. Stable roommate arrangements

**POST `/matching/stable`**

```json
{"participant_ids": ["YOUR-UUID", "MUTUAL-MATCH-UUID"]}
```

Use 2–20 distinct IDs, an even count, all with `seek_roommate` intent. Include the
requester and only people actively mutually connected to them. Pair edges also
require their own reciprocal likes and current eligibility. These edges are
ranked using each participant's weights; exact score ties use ascending UUIDs.

Response includes `algorithm: "irving"`, `status`, `pairs`, `unpaired_ids`,
`message`, and `tie_break`. Each pair has both IDs and the average directional
compatibility score. Stable does not mean everyone got their first choice; it
means there is no acceptable pair who both prefer one another to their assignment.
`no_stable_matching` leaves the entire cohort unpaired in this response. It is not
an API error and does not mean that every possible smaller cohort is unstable.

## 7. Fair-rent calculations

**POST `/rent-harmony/calculate`** — returns **201** with a saved calculation.

Use Swagger's full two-room example. Supply:

- `apartment_name`, `total_rent`.
- `rooms`: 2 or 3 distinct `{ id, name, amenities? }` objects.
- `participants`: one per room, each with `id`, `name`, and `valuations` mapping
  **every** room ID to that person's monthly INR valuation. `max_budget` is optional.
- `resolution`: 4–100 price-grid divisions; default 60.
- `tolerance`: acceptable maximum envy in INR/month; default 50.

Result includes:

- `id`, `algorithm: "sperner_discrete_approximation"`.
- `method`: `fully_labelled_simplex` or `grid_fallback` (whichever produced the
  best measured envy, preferring a labelled simplex if equally good).
- `status`: `envy_free_within_tolerance` or `approximate`.
- `allocations`: person ID, room ID, rent, utility, envy, and optional budget check.
- `max_envy`, `tolerance`, `resolution`, `grid_step`, `fully_labelled_simplices`.
- A descriptive explanation of approximation and feasibility.

Envy is `max(0, best alternative utility - assigned utility)`; lower is better.
Rents are nonnegative and sum exactly to the requested total at paise precision.
The best grid result can still exceed tolerance, and fair allocations can exceed
one person's budget. No exact fixed-point guarantee is claimed.

**GET `/rent-harmony/sessions/{id}`** retrieves the saved result for its creator.

## 8. Offline lease discussion aid

**POST `/lease/analyze`** with `{ "text": "Your lease clauses..." }` (10–20,000
characters). Returns `engine: "local_heuristic"`, a summary, and structured
`LeaseClause` objects with the original clause, risk (`high`, `medium`, `info`),
plain-language explanation, and a question to discuss with the provider.

The endpoint is a deterministic offline fallback, not an LLM or legal opinion.
No-match clauses are `info`, not certified safe. Lease text is not saved.

## 9. Photo and video upload API

`target` is `profile` (the person) or `property` (their current offering).
Each gallery has **3–6 photos** and **zero or one video**. Account creation returns
the credentials needed to upload; onboarding completes automatically when both
required galleries are ready. No separate publish/approval request is needed.

### Upload 3–6 photos

**POST `/media/{target}/photos`** — bearer token required, returns **201**.

Use multipart field **`files`**, repeated once per file. Each request accepts 1–6
files and appends them in request order, without exceeding six in that gallery.
Accepted content: JPEG, PNG, WebP; maximum 10 MiB each, at least 160×160 pixels,
at most 20 megapixels. Actual bytes are decoded, not trusted by filename/MIME alone.
Animated images and duplicate normalised photos within a gallery are rejected.
A failed batch saves none of its files or database rows.

```bash
curl -X POST http://localhost:8000/api/media/profile/photos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@portrait.jpg" \
  -F "files=@weekend.jpg" \
  -F "files=@hobby.jpg"
```

For the property, use `/api/media/property/photos` with room/kitchen/bathroom
photos. The property must exist first. Profile and property galleries are separate.

Images are EXIF-oriented, resized to a maximum 2048-pixel edge, and stored as JPEG
without EXIF metadata. Each receives a separate thumbnail of up to 480 pixels.

### Upload an optional video

**POST `/media/{target}/video`** — bearer token required, returns **201**.

Multipart field **`file`** accepts one MP4/H.264 or WebM/VP8/VP9 video: at most
50 MiB, 60 seconds, 1920×1080 total pixels (portrait allowed), and 60 fps. Use
standard 8-bit 4:2:0 colour; supported audio is AAC/MP3 in MP4 or Opus/Vorbis in
WebM. MOV/HEVC clips should be exported as compatible MP4 before uploading.

```bash
curl -X POST http://localhost:8000/api/media/property/video \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@walkthrough.mp4"
```

The container, video track, codec, duration/dimensions metadata, and first decoded
frame are validated. A JPEG poster is generated. The original supported video is
stored without transcoding. This endpoint atomically replaces the gallery's
previous video; invalid replacement attempts preserve the old one.

### Gallery response and progress

Upload, gallery read, reorder, and delete responses have:

```json
{
  "target": "profile",
  "gallery": {
    "photos": [],
    "video": null,
    "cover_photo_url": null,
    "photo_count": 0,
    "minimum_photos": 3,
    "maximum_photos": 6,
    "ready": false
  },
  "onboarding": {
    "complete": false,
    "profile_photos_needed": 3,
    "property_photos_needed": 0,
    "next_steps": ["Upload 3 more profile photo(s) via POST /api/media/profile/photos."]
  }
}
```

The example shows an empty seeker's gallery. Every uploaded asset includes `id`,
`kind`, `url`, `thumbnail_url`, `content_type`, `byte_size`, `width`, `height`,
`duration_seconds` (null for photos), `position`, `caption`, and UTC `created_at`.

### Read, reorder, describe, or delete

- **GET `/media/{target}`**: your gallery and onboarding progress.
- **PUT `/media/{target}/photos/order`** with `{ "photo_ids": ["id3", "id1", "id2"] }`:
  include every current photo ID exactly once. The first photo becomes the cover.
- **PATCH `/media/items/{media_id}`** with `{ "caption": "Bedroom with balcony" }`:
  update your photo/video description (up to 160 characters).
- **DELETE `/media/items/{media_id}`**: remove your media record, file, and
  thumbnail. If fewer than three photos remain, discovery hides the account and
  new likes are blocked until the gallery is completed. Existing match chats remain.
- Switching an offering account to a seeker also removes the former property's
  gallery and files. Personal photos remain attached to the account.

All management routes derive ownership from the bearer token. Another person's
media cannot be edited, deleted, attached, or reordered through these endpoints.

### Display media in a swipe UI

**GET `/media/files/{media_id}`** and **GET `/media/files/{media_id}/thumbnail`**
serve the bytes without authentication, using opaque server-generated IDs. Only
files with live database records are served. Media URLs are public display URLs;
editing and gallery management remain authenticated. Videos support standard
HTTP Range requests for seeking (`206 Partial Content`).

Returned paths begin `/api/media/files/...`. Resolve them against the backend
origin (not the frontend's Vite origin):

```typescript
const API_ORIGIN = "http://localhost:8000";
const imageUrl = new URL(card.media.cover_photo_url, API_ORIGIN).href;
const matchBadge = `${Math.round(card.match_score)}% match`;
const videoUrl = card.media.video
  ? new URL(card.media.video.url, API_ORIGIN).href
  : null;
```

Use `card.media.photos` in array order for the carousel, each photo's `caption`
for accessible text, `thumbnail_url` for compact cards/posters, `title` and
`location.label` for the overlay, and `match_score` for the match badge. Swipe on
`card.id`, which is always the person/provider's user ID.

For browser uploads, let `FormData` set the multipart boundary:

```typescript
const form = new FormData();
photos.forEach((photo: File) => form.append("files", photo));
const response = await fetch(`${API_ORIGIN}/api/media/profile/photos`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
```

Do not manually set `Content-Type` for that request. The server caps the whole
multipart request at 61 MiB, including requests sent using chunked transfer.
