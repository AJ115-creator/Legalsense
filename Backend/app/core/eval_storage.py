"""Persist RAG eval data to Redis keyed by trace_id.

Stores {query, response, contexts} per LLM call so the offline eval batch
can reconstruct the input/output/context triple needed by Ragas without
re-running retrieval.

Why Redis (not Langfuse trace metadata): Langfuse v4 propagates metadata as
dict[str, str] with values capped at 200 chars. Retrieved chunks are multi-
thousand-char strings — they'd be silently dropped.
"""

import json
import logging
from app.core.redis_client import get_redis
from app.core.config import settings

logger = logging.getLogger(__name__)


def _key(trace_id: str) -> str:
    return f"eval_data:{trace_id}"


async def store_eval_data(
    trace_id: str,
    query: str,
    response: str,
    contexts: list[str],
) -> None:
    """Store eval inputs for a trace. No-op if Redis unavailable."""
    redis = await get_redis()
    if not redis:
        return
    payload = json.dumps({
        "query": query,
        "response": response,
        "contexts": contexts,
    })
    await redis.setex(_key(trace_id), settings.EVAL_DATA_TTL, payload)
    logger.debug(f"Stored eval data for trace {trace_id} ({len(contexts)} contexts)")


async def fetch_eval_data(trace_id: str) -> dict | None:
    """Fetch eval inputs for a trace. Returns None if missing or Redis unavailable."""
    redis = await get_redis()
    if not redis:
        return None
    raw = await redis.get(_key(trace_id))
    if not raw:
        return None
    return json.loads(raw)
