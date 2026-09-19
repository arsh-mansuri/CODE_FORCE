from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.exceptions import HTTPException

from .config import Settings
from .database import Base, make_engine, session_factory
from .media_routes import router as media_router
from .review_routes import router as review_router
from .routes import router, feed, swipe, listings
from .upload_limits import UploadLimitMiddleware


DESCRIPTION = """
## Intent-first housing and roommate discovery

1. **GET /api/onboarding/questions** for conditional, nonjudgmental signup prompts.
2. **POST /api/auth/signup** using the essentials for your intent. Lifestyle answers
   are optional and can be completed gradually via **PUT /api/users/me**.
3. Copy `access_token`, click **Authorize**, and paste the token (no `Bearer` prefix).
4. Browse **GET /api/list** immediately. Before connecting, upload **3–6 profile photos** via `/api/media/profile/photos`; providers also
   upload **3–6 property photos** via `/api/media/property/photos`. Each gallery
   supports one optional 60-second video. Check `user.onboarding.complete`.
5. **GET /api/list** for photo-first swipe cards with names, locations, and
   `match_score` (0–100). Swipe, then message after a mutual connection.

**Five intents:** find a whole home; join an existing flatshare; find a roommate to
search together; offer a whole home; offer a room/shared space as owner or tenant.

All money is **INR**. Dates use **YYYY-MM-DD** and timestamps are **UTC**.
Roommate gender/household preferences affect ranking rather than eligibility. Nearby derasar, mosque,
temple, transit, and other landmark preferences describe location convenience only.
Listings disclose electricity tariffs/split policies and AC availability, including
separate AC rates where applicable. Unknown billing details remain null. Seekers
can prioritize AC access through `profile.search.ac_required`. Alternative suggestions
include explanations of differences; compatible goals and the same city remain required.

**Math:** weighted cosine ranks eligible shared-living profiles; Irving can return
no stable perfect matching; Rent Harmony is a bounded 2–3 room discrete simplex
approximation and reports measured envy. Lease review uses labelled offline rules.

Errors use `{ "error": { "code", "message", "fields" } }`.
SQLite persistence and all core features work without external API keys.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = make_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        Base.metadata.create_all(engine)
        settings.media_root.mkdir(parents=True, exist_ok=True)
        yield
        engine.dispose()

    app = FastAPI(
        title="PropVibe API", version="0.3.0", description=DESCRIPTION, lifespan=lifespan,
        swagger_ui_parameters={"displayRequestDuration": True, "defaultModelsExpandDepth": 1},
        openapi_tags=[
            {"name": name, "description": description} for name, description in (
                ("Health", "Database-aware readiness check."),
                ("Onboarding", "Conditional questions mapped to typed signup fields."),
                ("Authentication", "Complete signup and revocable bearer sessions."),
                ("Profiles", "Private onboarding answers and intent changes."),
                ("Media", "Profile/property photos, intro videos, gallery ordering, and public display URLs."),
                ("Discovery", "Filtered, explainable profile discovery."),
                ("Listings", "One owned or rented offering per provider account."),
                ("Connections", "Persistent, double-opt-in swipes and mutual matches."),
                ("Messaging", "Conversation access restricted to active match participants."),
                ("Property Reviews", "Matched visitors' shared reviews, photographs, helpful votes, and property-wise history."),
                ("Algorithms", "Irving stable roommate pairing over mutual acceptable edges."),
                ("Rent Harmony", "Discrete fair-rent approximation with measured envy."),
                ("Lease Review", "Offline lease discussion aid."),
            )
        ],
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory(engine)
    app.add_middleware(UploadLimitMiddleware, maximum_bytes=max(settings.max_photo_bytes * 6, settings.max_video_bytes) + 1024 * 1024)
    app.add_middleware(
        CORSMiddleware, allow_origins=list(settings.allowed_origins),
        allow_credentials=False, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Range"],
        expose_headers=["Content-Length", "Content-Range", "Accept-Ranges"],
    )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, dict) else {
            "code": "http_error", "message": str(exc.detail), "fields": [],
        }
        return JSONResponse(status_code=exc.status_code, content={"error": detail}, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # Pydantic's default errors can echo the whole signup body, including passwords.
        fields = [{"field": ".".join(str(p) for p in error["loc"]), "message": error["msg"], "type": error["type"]} for error in exc.errors()]
        return JSONResponse(status_code=422, content={"error": {
            "code": "validation_error", "message": "Please check the highlighted answers and try again.", "fields": fields,
        }})

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError):
        return JSONResponse(status_code=409, content={"error": {
            "code": "state_conflict", "message": "This account or connection was changed by another request. Refresh and retry; duplicate emails cannot be registered.", "fields": [],
        }})

    @app.exception_handler(OperationalError)
    async def database_unavailable(request: Request, exc: OperationalError):
        logging.getLogger(__name__).error("Database operation unavailable (%s)", type(exc).__name__)
        return JSONResponse(status_code=503, content={"error": {
            "code": "database_unavailable", "message": "The database is temporarily unavailable. Please retry shortly.", "fields": [],
        }})

    app.include_router(router)
    app.include_router(media_router)
    app.include_router(review_router)
    app.add_api_route("/list", feed, methods=["GET"], include_in_schema=False)
    app.add_api_route("/users/feed", feed, methods=["GET"], include_in_schema=False)
    app.add_api_route("/swipe", swipe, methods=["POST"], include_in_schema=False)
    app.add_api_route("/listings", listings, methods=["GET"], include_in_schema=False)
    return app
