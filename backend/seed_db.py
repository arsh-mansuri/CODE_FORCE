"""Idempotent, explicit demo seed. Never runs automatically on API startup."""
import argparse
from sqlalchemy import select

from app.config import Settings
from app.database import Base, make_engine, session_factory
from app.demo_media import add_demo_gallery
from app.examples import signup_example
from app.matching import compatibility
from app.media_storage import remove_files
from app.media_views import gallery_assets
from app.models import Match, Swipe, User
from app.routes import apply_onboarding
from app.schemas import Intent, SignupRequest
from app.security import hash_password


def seed(fill_missing_media=False):
    settings = Settings.from_env()
    settings.media_root.mkdir(parents=True, exist_ok=True)
    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)
    names = ["Aarav Shah", "Meera Patel", "Zoya Khan", "Dev Joshi", "Nisha Shah", "Kabir Desai", "Anaya Mehta", "Rohan Shah"]
    intents = [Intent.seek_roommate] * 4 + [Intent.seek_room, Intent.offer_shared_home, Intent.seek_entire_home, Intent.offer_entire_home]
    with session_factory(engine)() as db:
        created = []
        media_accounts = []
        for index, (name, intent) in enumerate(zip(names, intents), start=1):
            data = signup_example(intent, name, index)
            existing = db.scalar(select(User).where(User.email == data["email"]))
            if existing is not None:
                print(f"Already exists (left unchanged): {existing.email}")
                if fill_missing_media:
                    media_accounts.append((index, existing))
                continue
            if "lifestyle" in data["profile"]:
                data["profile"]["lifestyle"]["social_energy"] = 2 + index % 3
                data["profile"]["lifestyle"]["work_style"] = "remote" if index % 2 else "hybrid"
            body = SignupRequest.model_validate(data)
            user = User(email=str(body.email), password_hash=hash_password(body.password.get_secret_value()))
            apply_onboarding(user, body)
            db.add(user)
            db.flush()
            created.append(user)
            media_accounts.append((index, user))
            print(f"Created {user.email}: {intent.value} ({user.id})")
        # Only connect freshly created roommate demo accounts; reruns preserve user choices.
        cohort = [u for u in created if u.profile.data["intent"] == Intent.seek_roommate.value]
        for i, user in enumerate(cohort):
            for other in cohort[i + 1:]:
                db.add_all([Swipe(swiper_id=user.id, target_id=other.id, direction="like"), Swipe(swiper_id=other.id, target_id=user.id, direction="like")])
                a, b = sorted((user.id, other.id))
                score = (compatibility(user, other).score + compatibility(other, user).score) / 2
                db.add(Match(user1_id=a, user2_id=b, compatibility_score=round(score, 2)))
        created_files = []
        try:
            for palette, user in media_accounts:
                for target in (["profile", "property"] if user.listing else ["profile"]):
                    if not gallery_assets(user, target):
                        add_demo_gallery(db, user, target, settings, palette, created_files)
                        print(f"Added three labelled demo illustrations: {user.email} / {target}")
            db.commit()
        except Exception:
            db.rollback()
            remove_files(settings.media_root, created_files)
            raise
    engine.dispose()
    print("Demo-only password for NEW demo1@example.com through demo8@example.com accounts: PropVibe-demo-2026")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fill-missing-media", action="store_true", help="Also add labelled demo illustrations to entirely empty galleries of existing demo accounts. Existing uploads are preserved.")
    seed(fill_missing_media=parser.parse_args().fill_missing_media)
