"""Seed three properties from backend/uploads and Rishi as the demo seeker."""
import argparse

from app.config import Settings
from seed_more_listings import seed_more


def seed(fill_missing_media=False, *, settings: Settings | None = None):
    # Keep the old flag callable; missing seed media is now always repaired.
    return seed_more(settings)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fill-missing-media", action="store_true", help="Accepted for compatibility; seed galleries are always repaired.")
    seed(fill_missing_media=parser.parse_args().fill_missing_media)
