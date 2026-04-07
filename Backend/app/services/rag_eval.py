"""Ragas wrapper for offline RAG evaluation.

Reference-free metrics (no ground-truth labels needed):
  - Faithfulness:        are answer claims grounded in retrieved context?
  - ResponseRelevancy:   does the answer address the question?
  - LLMContextPrecision: is the BGE reranker ordering chunks well?

Judge model: Groq llama-3.3-70b-versatile (free tier).
Embeddings:  fastembed BAAI/bge-small-en-v1.5 (already on disk for sem cache).

Notes:
  - Uses ragas.metrics legacy API (LangchainLLMWrapper). Will be removed in
    ragas v1.0 — migrate to ragas.metrics.collections + InstructorLLM then.
  - Deprecation warnings suppressed inline since this is a known migration.
"""

import warnings

# Must run before ragas import — ragas.metrics legacy API emits a
# DeprecationWarning at import time. noqa: E402 on the imports below.
warnings.filterwarnings("ignore", category=DeprecationWarning, module="ragas")

import logging  # noqa: E402

from langchain_community.embeddings import FastEmbedEmbeddings  # noqa: E402
from langchain_groq import ChatGroq  # noqa: E402
from ragas import EvaluationDataset, evaluate  # noqa: E402
from ragas.embeddings import LangchainEmbeddingsWrapper  # noqa: E402
from ragas.llms import LangchainLLMWrapper  # noqa: E402
from ragas.metrics import (  # noqa: E402
    Faithfulness,
    LLMContextPrecisionWithoutReference,
    ResponseRelevancy,
)

from app.core.config import settings  # noqa: E402

logger = logging.getLogger(__name__)

# Lazy-built singletons (judge LLM + embeddings load once per process)
_judge_llm = None
_judge_embeddings = None


def _get_judge():
    global _judge_llm, _judge_embeddings
    if _judge_llm is None:
        _judge_llm = LangchainLLMWrapper(
            ChatGroq(
                model=settings.GROQ_MODEL,
                api_key=settings.GROQ_API_KEY,
                temperature=0,  # deterministic for eval
            )
        )
    if _judge_embeddings is None:
        # Reuses the same model fastembed already cached for semantic_cache
        _judge_embeddings = LangchainEmbeddingsWrapper(
            FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        )
    return _judge_llm, _judge_embeddings


def evaluate_traces(traces: list[dict]) -> list[dict]:
    """Run Ragas on a batch of traces.

    Args:
        traces: list of {"trace_id", "query", "response", "contexts"} dicts.
                Empty contexts are skipped (cache hits / no-context fallbacks).

    Returns:
        list of {"trace_id", "faithfulness", "answer_relevancy",
                 "llm_context_precision_without_reference"} dicts.
        Empty list if input is empty after filtering.
    """
    samples = [t for t in traces if t.get("contexts")]
    if not samples:
        logger.info("No traces with contexts to evaluate")
        return []

    judge_llm, judge_embeddings = _get_judge()

    dataset = EvaluationDataset.from_list([
        {
            "user_input": t["query"],
            "response": t["response"],
            "retrieved_contexts": t["contexts"],
        }
        for t in samples
    ])

    metrics = [
        Faithfulness(),
        ResponseRelevancy(),
        LLMContextPrecisionWithoutReference(),
    ]

    logger.info(f"Running Ragas on {len(samples)} traces with {len(metrics)} metrics")
    result = evaluate(
        dataset=dataset,
        metrics=metrics,
        llm=judge_llm,
        embeddings=judge_embeddings,
        show_progress=False,
        raise_exceptions=False,  # one bad trace shouldn't kill the batch
    )

    df = result.to_pandas()
    metric_names = [m.name for m in metrics]
    logger.info(f"Ragas metric columns: {metric_names}")

    out = []
    for i, sample in enumerate(samples):
        row = {"trace_id": sample["trace_id"]}
        for metric_name in metric_names:
            val = df.iloc[i].get(metric_name)
            # Ragas returns NaN for failures — coerce to None
            row[metric_name] = float(val) if val is not None and val == val else None
        out.append(row)

    return out
