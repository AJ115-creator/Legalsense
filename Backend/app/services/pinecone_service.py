"""Pinecone vector store service with integrated embedding (llama-text-embed-v2).

Uses single default namespace with metadata filtering (Starter plan = 1 namespace).
ID conventions: legal_{act}_{i} for KB, {doc_id}_{i} for user docs.
Field map: 'text' is the embedded field.
"""

import logging
import time
from pinecone import Pinecone
from pinecone.exceptions.exceptions import PineconeApiException
from app.core.config import settings

logger = logging.getLogger(__name__)

def _get_index():
    """Lazy-load the Pinecone index."""
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    return pc.Index(settings.PINECONE_INDEX)

BATCH_SIZE = 96  # Pinecone integrated embedding limit per batch
SCORE_THRESHOLD = 0.0  # Reranker scores are near-zero floats (e.g. 0.004); no hard cutoff
LOW_CONFIDENCE_THRESHOLD = 0.002  # Below this avg reranker score → add caution warning


def upsert_records(records: list[dict]) -> int:
    """Upsert records to default namespace in batches of 100.

    Each record must have '_id' and 'text' (auto-embedded) fields,
    plus any metadata fields (source, doc_id, user_id, act_name, section, etc).
    """
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        for attempt in range(5):
            try:
                _get_index().upsert_records(namespace="__default__", records=batch)
                break
            except PineconeApiException as e:
                if e.status == 429 and attempt < 4:
                    wait = 2 ** attempt * 15  # 15s, 30s, 60s, 120s
                    logger.warning(f"Rate limited, waiting {wait}s (attempt {attempt + 1}/5)")
                    time.sleep(wait)
                else:
                    raise
        total += len(batch)
        logger.info(f"Upserted batch {i // BATCH_SIZE + 1} ({len(batch)} records)")
        # Pace requests to stay under 250k tokens/min free tier limit
        if i + BATCH_SIZE < len(records):
            time.sleep(2)
    return total


def search(
    query_text: str,
    top_k: int = 5,
    filter: dict | None = None,
    rerank: bool = True,
) -> list[dict]:
    """Search with integrated embedding + optional reranking.

    Returns list of dicts with '_id', '_score', and all metadata fields.
    Filters out results below SCORE_THRESHOLD.
    """
    query = {
        "inputs": {"text": query_text},
        "top_k": top_k,
    }
    if filter:
        query["filter"] = filter

    kwargs = {"namespace": "__default__", "query": query}

    if rerank:
        kwargs["rerank"] = {
            "model": "bge-reranker-v2-m3",
            "top_n": top_k,
            "rank_fields": ["text"],
        }

    response = _get_index().search(**kwargs)

    # v8 SDK: SearchRecordsResponse is dict-like, hits are plain dicts
    hits = response.get("result", {}).get("hits", [])

    results = []
    for hit in hits:
        score = hit.get("_score", 0) if isinstance(hit, dict) else 0
        if score >= SCORE_THRESHOLD:
            results.append(hit)

    all_scores = [hit.get("_score", 0) for hit in hits if isinstance(hit, dict)]
    logger.info(f"Search returned {len(hits)} hits (scores: {[round(s,3) for s in all_scores]}), {len(results)} above threshold {SCORE_THRESHOLD}")
    return results


def delete_by_prefix(id_prefix: str) -> int:
    """Delete all records with IDs starting with prefix.

    Uses list_paginated (serverless-compatible) to find IDs, then batch delete.
    Serverless indexes can't delete by metadata filter.
    """
    deleted = 0
    pagination_token = None

    while True:
        kwargs = {"prefix": id_prefix, "namespace": "__default__", "limit": 100}
        if pagination_token:
            kwargs["pagination_token"] = pagination_token

        page = _get_index().list_paginated(**kwargs)
        ids = [v.id for v in (page.vectors or [])]

        if ids:
            _get_index().delete(ids=ids, namespace="__default__")
            deleted += len(ids)
            logger.info(f"Deleted {len(ids)} records with prefix '{id_prefix}'")

        if page.pagination and page.pagination.next:
            pagination_token = page.pagination.next
        else:
            break

    return deleted


def get_stats() -> dict:
    """Return index stats for verification."""
    return _get_index().describe_index_stats()


def avg_score(results: list) -> float:
    if not results:
        return 0.0
    return sum(r.get("_score", 0.0) for r in results if isinstance(r, dict)) / len(results)
