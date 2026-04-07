"""Semantic cache for LLM responses using fastembed + vanilla Redis.

Embeds queries with BAAI/bge-small-en-v1.5 (384 dims, ONNX) and stores
responses in Redis keyed by document_id. Cache hits use cosine similarity
against stored embeddings — no Redis Stack/RediSearch needed.
"""

import json
import uuid
import logging
import numpy as np
from fastembed import TextEmbedding
from app.core.redis_client import get_redis
from app.core.config import settings

logger = logging.getLogger(__name__)

_embed_model = None


def _get_model():
    global _embed_model
    if _embed_model is None:
        _embed_model = TextEmbedding("BAAI/bge-small-en-v1.5")
    return _embed_model


def _embed(text: str) -> list[float]:
    return list(_get_model().embed([text]))[0].tolist()


def _cosine_sim(a: list[float], b: list[float]) -> float:
    a_arr, b_arr = np.array(a), np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))


async def check_cache(document_id: str, query: str) -> str | None:
    """Check for a semantically similar cached response. Returns response or None."""
    redis = await get_redis()
    if not redis:
        return None

    query_emb = _embed(query)

    keys = [k async for k in redis.scan_iter(f"sem_cache:{document_id}:*", count=100)]
    if not keys:
        return None

    best_score, best_response = 0.0, None
    for key in keys:
        raw = await redis.get(key)
        if not raw:
            continue
        entry = json.loads(raw)
        sim = _cosine_sim(query_emb, entry["embedding"])
        if sim > best_score:
            best_score = sim
            best_response = entry["response"]

    if best_score >= settings.CACHE_SIMILARITY_THRESHOLD:
        logger.info(f"Cache HIT (sim={best_score:.4f}) for doc {document_id}")
        return best_response

    logger.info(f"Cache MISS (best_sim={best_score:.4f}) for doc {document_id}")
    return None


async def store_cache(document_id: str, query: str, response: str):
    """Store a query-response pair in the semantic cache."""
    redis = await get_redis()
    if not redis:
        return

    embedding = _embed(query)
    key = f"sem_cache:{document_id}:{uuid.uuid4().hex[:8]}"
    data = json.dumps({"embedding": embedding, "response": response, "query": query})
    await redis.setex(key, settings.CACHE_TTL, data)
    logger.info(f"Cached response for doc {document_id} (TTL={settings.CACHE_TTL}s)")


async def invalidate_document_cache(document_id: str):
    """Delete all cache entries for a document."""
    redis = await get_redis()
    if not redis:
        return
    keys = [k async for k in redis.scan_iter(f"sem_cache:{document_id}:*")]
    if keys:
        await redis.delete(*keys)
        logger.info(f"Invalidated {len(keys)} cache entries for doc {document_id}")
