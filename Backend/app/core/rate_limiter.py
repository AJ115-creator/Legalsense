from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings


def _get_key(request):
    """Extract user_id from JWT for per-user rate limiting, fallback to IP."""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        try:
            import jwt
            payload = jwt.decode(
                auth.split(" ", 1)[1], options={"verify_signature": False}
            )
            uid = payload.get("sub")
            if uid:
                return f"user:{uid}"
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(
    key_func=_get_key,
    storage_uri=settings.REDIS_URL or "memory://",
)
