"""Ragas wrapper for offline RAG evaluation.

Reference-free metrics (no ground-truth labels needed):
  - Faithfulness:        are answer claims grounded in retrieved context?
  - AnswerRelevancy:    does the answer address the question?
  - ContextPrecision:    is the BGE reranker ordering chunks well?

Judge model: HuggingFace Mistral-Small-3.1-24B-Instruct via LiteLLM.
Embeddings:  fastembed BAAI/bge-small-en-v1.5 (already on disk for sem cache).
"""

import logging

import litellm
from langchain_community.embeddings import FastEmbedEmbeddings
from ragas import EvaluationDataset, evaluate
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import llm_factory
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
        litellm.api_key = settings.HUGGINGFACE_API_KEY
        _judge_llm = llm_factory(
            f"huggingface/{settings.HF_JUDGE_MODEL}",
            provider="litellm",
            client=litellm.completion,
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
        Faithfulness(llm=judge_llm),
        AnswerRelevancy(llm=judge_llm, embeddings=judge_embeddings),
        ContextPrecisionWithoutReference(llm=judge_llm),
    ]

    logger.info(f"Running Ragas on {len(samples)} traces with {len(metrics)} metrics")
    result = evaluate(
        dataset=dataset,
        metrics=metrics,
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
