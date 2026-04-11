"""Batch RAG evaluation runner.

Fetches recent traces from Langfuse, looks up the stored eval data in Redis
(query / response / retrieved contexts), runs Ragas with Groq as judge LLM,
and pushes the resulting scores back to Langfuse via create_score().

Idempotent: re-running the script upserts scores via deterministic score_id,
so it's safe to invoke from a cron without locking.

Usage (from Backend/):
    uv run python -m scripts.run_eval_batch
    uv run python -m scripts.run_eval_batch --limit 50  # custom batch size
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langfuse import Langfuse
from app.core.config import settings
from app.core.eval_storage import fetch_eval_data
from app.services.rag_eval import evaluate_traces

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rag_eval_batch")

# Score names → must match metric.name from Ragas (verified at runtime)
METRIC_NAMES = [
    "faithfulness",
    "answer_relevancy",
    "context_precision_without_reference",
]


async def collect_eval_inputs(trace_ids: list[str]) -> list[dict]:
    """For each trace_id, look up Redis-stored eval data."""
    out = []
    for tid in trace_ids:
        data = await fetch_eval_data(tid)
        if not data:
            logger.debug(
                f"No eval data in Redis for trace {tid} (cached/fallback/expired)"
            )
            continue
        out.append(
            {
                "trace_id": tid,
                "query": data["query"],
                "response": data["response"],
                "contexts": data["contexts"],
            }
        )
    return out


def push_scores(langfuse: Langfuse, results: list[dict]) -> int:
    """Push Ragas scores to Langfuse. Returns number of scores written."""
    written = 0
    for row in results:
        tid = row["trace_id"]
        for metric_name in METRIC_NAMES:
            value = row.get(metric_name)
            if value is None:
                logger.warning(f"Skipping null score: trace={tid} metric={metric_name}")
                continue
            try:
                langfuse.create_score(
                    trace_id=tid,
                    name=metric_name,
                    value=value,
                    data_type="NUMERIC",
                    # Idempotency: same id → upsert on re-run
                    score_id=f"ragas-{metric_name}-{tid}",
                    comment="ragas-batch-eval",
                )
                written += 1
            except Exception as e:
                logger.error(
                    f"Failed to push score trace={tid} metric={metric_name}: {e}"
                )
    return written


def summarize(results: list[dict]) -> None:
    if not results:
        logger.info("Summary: 0 traces evaluated")
        return
    n = len(results)
    means = {}
    for metric_name in METRIC_NAMES:
        vals = [r[metric_name] for r in results if r.get(metric_name) is not None]
        means[metric_name] = sum(vals) / len(vals) if vals else None
    logger.info(f"Summary: evaluated {n} traces")
    for k, v in means.items():
        logger.info(f"  mean {k}: {v:.4f}" if v is not None else f"  mean {k}: N/A")


async def main(limit: int) -> int:
    if not (settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY):
        logger.error("LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set")
        return 1
    if not settings.REDIS_URL:
        logger.error("REDIS_URL not set — eval data lives in Redis")
        return 1

    langfuse = Langfuse(
        public_key=settings.LANGFUSE_PUBLIC_KEY,
        secret_key=settings.LANGFUSE_SECRET_KEY,
        host=settings.LANGFUSE_BASE_URL,
    )

    logger.info(f"Fetching {limit} most-recent traces from Langfuse")
    traces_resp = langfuse.api.trace.list(
        limit=limit,
        order_by="timestamp.desc",
    )
    trace_ids = [t.id for t in (traces_resp.data or [])]
    logger.info(f"Got {len(trace_ids)} trace IDs")

    if not trace_ids:
        logger.info("No traces to evaluate")
        return 0

    inputs = await collect_eval_inputs(trace_ids)
    logger.info(f"{len(inputs)}/{len(trace_ids)} traces have eval data in Redis")

    if not inputs:
        logger.info("Nothing to evaluate (no eval data found)")
        return 0

    # Run Ragas (sync — blocks on Groq judge calls)
    results = evaluate_traces(inputs)
    logger.info(f"Ragas returned {len(results)} score rows")

    written = push_scores(langfuse, results)
    logger.info(f"Pushed {written} scores to Langfuse")

    langfuse.flush()
    summarize(results)
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--limit", type=int, default=20, help="Number of traces to fetch"
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.limit)))
