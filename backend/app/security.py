from datetime import timedelta, timezone
import hashlib
import hmac
import secrets

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuthSession, User, utcnow


bearer = HTTPBearer(auto_error=False, description="Paste the access_token returned by signup or login. Sessions expire and can be revoked with logout.")
ITERATIONS = 600_000


def problem(status: int, code: str, message: str):
    headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
    return HTTPException(status, detail={"code": code, "message": message, "fields": []}, headers=headers)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), ITERATIONS).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    _, rounds, salt, expected = encoded.split("$")
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds)).hex()
    return hmac.compare_digest(actual, expected)


# Equal-cost verification when an email is unknown, without storing a real password.
DUMMY_HASH = f"pbkdf2_sha256${ITERATIONS}${'00' * 16}${'00' * 32}"


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_session(db: Session, user_id: str, days: int):
    token = secrets.token_urlsafe(32)
    expires = utcnow() + timedelta(days=days)
    db.add(AuthSession(token_hash=token_digest(token), user_id=user_id, expires_at=expires))
    return token, expires.replace(tzinfo=timezone.utc)


def current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> AuthSession:
    if credentials is None:
        raise problem(401, "authentication_required", "Use the bearer access token from signup or login.")
    session = db.get(AuthSession, token_digest(credentials.credentials))
    if session is None or session.expires_at <= utcnow():
        raise problem(401, "invalid_session", "This session is invalid or expired. Please log in again.")
    return session


def current_user(session: AuthSession = Depends(current_session), db: Session = Depends(get_db)) -> User:
    user = db.get(User, session.user_id)
    if user is None:
        raise problem(401, "invalid_session", "The account for this session no longer exists.")
    return user
