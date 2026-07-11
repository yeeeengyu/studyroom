import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import Settings, get_settings


SESSION_COOKIE = "studyroom_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14
SESSION_SUBJECT = "admin"


def hash_password(password: str, iterations: int = 260_000) -> str:
    salt = secrets.token_urlsafe(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
    encoded = base64.urlsafe_b64encode(digest).decode()
    return f"pbkdf2_sha256${iterations}${salt}${encoded}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
        actual = base64.urlsafe_b64encode(digest).decode()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="studyroom-admin")


def issue_session(response: Response, settings: Settings) -> None:
    token = _serializer(settings).dumps({"sub": SESSION_SUBJECT, "iat": datetime.now(timezone.utc).isoformat()})
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite=settings.cookie_samesite,
        secure=settings.cookie_secure,
    )


def clear_session(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        httponly=True,
        samesite=settings.cookie_samesite,
        secure=settings.cookie_secure,
    )


def require_admin(request: Request, settings: Settings = Depends(get_settings)) -> str:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다.")
    try:
        payload = _serializer(settings).loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="세션이 만료되었습니다.") from None
    subject = payload.get("sub")
    if subject != SESSION_SUBJECT:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="세션이 올바르지 않습니다.")
    return subject
