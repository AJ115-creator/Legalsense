from app.core.redis_client import get_redis

WS_RATE_LIMIT = 10   # max messages
WS_RATE_WINDOW = 60  # per seconds


async def check_ws_rate_limit(user_id: str, document_id: str) -> bool:
    """Return True if within limit, False if exceeded."""
    redis = await get_redis()
    if redis is None:
        return True  # no Redis = allow all (local dev without Redis)
    key = f"ws_rate:{user_id}:{document_id}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, WS_RATE_WINDOW)
    return count <= WS_RATE_LIMIT
