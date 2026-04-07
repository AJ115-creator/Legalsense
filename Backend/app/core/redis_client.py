import redis.asyncio as aioredis
from app.core.config import settings

_redis_client = None


async def get_redis():
    """Return async Redis client, or None if REDIS_URL not configured."""
    global _redis_client
    if _redis_client is None and settings.REDIS_URL:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL, decode_responses=True
        )
    return _redis_client
