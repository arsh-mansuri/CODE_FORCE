"""Recreate the four team demo accounts with mutually compatible roommate profiles.

Run from backend/: python seed_team.py
Every run replaces these accounts, their uploads, and related activity.
"""
from sqlalchemy import delete, func, select

from app.config import Settings
from app.database import Base, make_engine, session_factory
from app.demo_media import add_demo_gallery
from app.examples import signup_example
from app.matching import compatibility
from app.media_storage import remove_files
from app.media_views import onboarding_status
from app.models import MediaAsset, User
from app.routes import apply_onboarding
from app.schemas import Intent, SignupRequest
from app.security import hash_password


# Public, demo-only credentials requested for this repeatable team setup.
DEFAULT_PASSWORD = "1234567890"
TEAM_ACCOUNTS = (
    ("kofworld85@gmail.com", "Kof World"),
    ("rc.rishi.pc@gmail.com", "Rishi"),
    ("rctest1@gmail.com", "RC Test"),
    ("arsh2.mansuri2@gmail.com", "Arsh Mansuri"),
)
TEAM_DISCOVERY_INTENTS = (Intent.seek_roommate, Intent.seek_room, Intent.seek_entire_home)


def seed(settings: Settings | None = None) -> None:
    settings = settings or Settings.from_env()
    settings.media_root.mkdir(parents=True, exist_ok=True)
    engine = make_engine(settings.database_url)
    created_files = []
    retired_files = []
    try:
        Base.metadata.create_all(engine)
        with session_factory(engine)() as db:
            try:
                emails = [email for email, _ in TEAM_ACCOUNTS]
                existing_ids = list(db.scalars(select(User.id).where(func.lower(User.email).in_(emails))))
                if existing_ids:
                    retired_files = list(db.scalars(select(MediaAsset).where(MediaAsset.owner_id.in_(existing_ids))))
                    # FK cascades reset sessions, swipes, matches/chat, listings,
                    # password resets, deletion requests, and rent sessions.
                    db.execute(delete(User).where(User.id.in_(existing_ids)))

                users = []
                for index, (email, name) in enumerate(TEAM_ACCOUNTS):
                    data = signup_example(Intent.seek_roommate, name, index + 1)
                    data.update(email=email, password=DEFAULT_PASSWORD)
                    data["profile"]["intents"] = [intent.value for intent in TEAM_DISCOVERY_INTENTS]
                    data["profile"]["bio"] = (
                        "Team demo profile: looking for a tidy, relaxed shared home "
                        "in Ahmedabad with clear expectations and friendly roommates."
                    )
                    data["profile"]["search"]["location"]["nearby"] = []
                    # Same lifestyle/search gives every pair a 100% score. Different
                    # room priorities let teammates favour different rooms later.
                    priority = ("size", "private_bathroom", "balcony", "quiet")[index]
                    data["profile"]["room_priorities"][priority] = 5
                    body = SignupRequest.model_validate(data)
                    user = User(email=str(body.email), password_hash=hash_password(DEFAULT_PASSWORD))
                    apply_onboarding(user, body)
                    db.add(user)
                    db.flush()
                    add_demo_gallery(db, user, "profile", settings, index, created_files)
                    users.append(user)

                db.flush()
                for user in users:
                    db.expire(user, ["media_assets"])
                    if not onboarding_status(user).complete:
                        raise RuntimeError(f"Incomplete media onboarding for {user.email}")
                    for other in users:
                        if user is not other and compatibility(user, other) is None:
                            raise RuntimeError(f"Incompatible team profiles: {user.email}, {other.email}")
                # No pre-seeded likes: those would hide teammates from discovery.
                db.commit()
            except Exception:
                db.rollback()
                remove_files(settings.media_root, created_files)
                raise
        # Keep old uploads until the replacement transaction has succeeded.
        remove_files(settings.media_root, retired_files)
    finally:
        engine.dispose()

    for email, _ in TEAM_ACCOUNTS:
        print(f"Reset: {email}")
    print("All four accounts are ready. Sign in again with the shared demo password.")
    print("Each account can discover the other three; mutual likes create matches and chat.")
    print("Room and whole-home discovery are enabled. Run seed_more_listings.py --for-team for the property catalog.")


if __name__ == "__main__":
    seed()
