"""Ragas wrapper for offline RAG evaluation.

Reference-free metrics (no ground-truth labels needed):
  - Faithfulness:        are answer claims grounded in retrieved context?
  - AnswerRelevancy:    does the answer address the question?
  - ContextPrecision:    is the BGE reranker ordering chunks well?

Judge model: Groq llama-3.3-70b-versatile (free tier).
Embeddings:  fastembed BAAI/bge-small-en-v1.5 (already on disk for sem cache).

Migrated to Ragas v0.4 imports:
  - Metrics from ragas.metrics.collections (new API)
  - LLM wrapper stays as LangchainLLMWrapper (deprecated but functional in v0.4)
    since llm_factory() does not support ChatGroq client natively.
"""

import logging

from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_groq import ChatGroq
from ragas import EvaluationDataset, evaluate
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import LangchainLLMWrapper
from ragas.metrics.collections import (
    AnswerRelevancy,
    ContextPrecisionWithoutReference,
    Faithfulness,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

_judge_llm = None
_judge_embeddings = None


def _get_judge():
    global _judge_llm, _judge_embeddings
    if _judge_llm is None:
        _judge_llm = LangchainLLMWrapper(
            ChatGroq(
                model=settings.GROQ_MODEL,
                api_key=settings.GROQ_API_KEY,
                temperature=0,
            )
        )
    if _judge_embeddings is None:
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

    dataset = EvaluationDataset.from_list(
        [
            {
                "user_input": t["query"],
                "response": t["response"],
                "retrieved_contexts": t["contexts"],
            }
            for t in samples
        ]
    )

    metrics = [
        Faithfulness(),
        AnswerRelevancy(),
        ContextPrecisionWithoutReference(),
    ]

    logger.info(f"Running Ragas on {len(samples)} traces with {len(metrics)} metrics")
    result = evaluate(
        dataset=dataset,
        metrics=metrics,
        llm=judge_llm,
        embeddings=judge_embeddings,
        show_progress=False,
        raise_exceptions=False,
    )

    df = result.to_pandas()
    metric_names = [m.name for m in metrics]
    logger.info(f"Ragas metric columns: {metric_names}")

    out = []
    for i, sample in enumerate(samples):
        row = {"trace_id": sample["trace_id"]}
        for metric_name in metric_names:
            val = df.iloc[i].get(metric_name)
            row[metric_name] = float(val) if val is not None and val == val else None
        out.append(row)

    return out
