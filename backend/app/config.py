from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    database_url: str
    allowed_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    session_days: int = 7
    media_root: Path = BACKEND_DIR / "uploads"
    max_photo_bytes: int = 10 * 1024 * 1024
    max_video_bytes: int = 50 * 1024 * 1024
    max_video_seconds: int = 60

    @classmethod
    def from_env(cls) -> "Settings":
        # Shell values win, then backend/.env, then the repository .env.
        load_dotenv(BACKEND_DIR / ".env")
        load_dotenv(BACKEND_DIR.parent / ".env")
        days = int(os.getenv("SESSION_DAYS", "7"))
        if not 1 <= days <= 30:
            raise ValueError("SESSION_DAYS must be between 1 and 30")
        origins = tuple(
            value.strip() for value in os.getenv(
                "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",") if value.strip()
        )
        return cls(
            database_url=os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'propvibe.db'}"),
            allowed_origins=origins,
            session_days=days,
            media_root=Path(os.getenv("MEDIA_ROOT", str(BACKEND_DIR / "uploads"))).expanduser().resolve(),
        )
