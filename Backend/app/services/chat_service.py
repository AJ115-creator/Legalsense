"""RAG-enabled chat service with anti-hallucination safeguards.

Replaces context-stuffing (10k chars) with dual retrieval:
  1. User document chunks from Pinecone (filtered by doc_id)
  2. Indian legal KB chunks from Pinecone (filtered by source=legal-kb)

Anti-hallucination layers:
  - Score threshold filtering (discard noise)
  - Constrained system prompt (ICE method)
  - Source attribution directives
  - Low-confidence warnings
  - Temperature 0.1 for strict generation
"""

import uuid
import logging
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langfuse.langchain import CallbackHandler as LangfuseCallbackHandler
from app.core.config import settings
from app.core.semantic_cache import check_cache, store_cache
from app.core.eval_storage import store_eval_data
from app.db.supabase_client import get_user_client
from app.services import pinecone_service
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

llm = ChatGroq(
    model=settings.GROQ_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0.1,  # Low temp for strict, factual generation
)

DISCLAIMER = (
    "\n\n---\n"
    "This is AI-assisted analysis, not legal advice. "
    "Please consult a qualified lawyer for critical decisions."
)


def _retrieve_context(
    document_id: str, user_message: str
) -> tuple[list[dict], list[dict]]:
    """Retrieve relevant chunks from user-docs and legal-kb.

    Returns (user_chunks, legal_chunks) — each filtered by score threshold.
    """
    user_results = pinecone_service.search(
        query_text=user_message,
        top_k=5,
        filter={"source": {"$eq": "user-doc"}, "doc_id": {"$eq": document_id}},
        rerank=True,
    )

    legal_results = pinecone_service.search(
        query_text=user_message,
        top_k=5,
        filter={"source": {"$eq": "legal-kb"}},
        rerank=True,
    )

    return user_results, legal_results


def _hit_field(hit, *keys, default=""):
    """Extract a metadata field from a Pinecone hit dict.

    v8 SDK returns dicts: {'_id': ..., '_score': ..., 'fields': {'text': ..., 'act_name': ...}}
    """
    fields = hit.get("fields", {}) if isinstance(hit, dict) else {}
    for key in keys:
        val = fields.get(key)
        if val is not None:
            return val
    return default


def _hit_score(hit) -> float:
    return hit.get("_score", 0.0) if isinstance(hit, dict) else 0.0


def _format_user_chunks(chunks: list) -> str:
    """Format user document chunks for system prompt."""
    if not chunks:
        return "(No relevant sections found in your document for this query)"

    parts = []
    for i, chunk in enumerate(chunks, 1):
        score = _hit_score(chunk)
        text = _hit_field(chunk, "text")
        parts.append(f"[Excerpt {i}, relevance: {score:.2f}]\n{text}")
    return "\n\n---\n\n".join(parts)


def _format_legal_chunks(chunks: list) -> str:
    """Format legal KB chunks with act + section metadata for citation."""
    if not chunks:
        return "(No relevant legal provisions found for this query)"

    parts = []
    for i, chunk in enumerate(chunks, 1):
        score = _hit_score(chunk)
        act = _hit_field(chunk, "act_name") or "Unknown Act"
        section = _hit_field(chunk, "section")
        text = _hit_field(chunk, "text")
        label = f"{act}, {section}" if section else act
        parts.append(f"[{label} | relevance: {score:.2f}]\n{text}")
    return "\n\n---\n\n".join(parts)


def _build_system_context(
    doc: dict,
    user_chunks: list[dict],
    legal_chunks: list[dict],
) -> str:
    """Build system prompt with RAG context and anti-hallucination rules."""
    user_context = _format_user_chunks(user_chunks)
    legal_context = _format_legal_chunks(legal_chunks)

    # Low-confidence warning
    avg_user = pinecone_service.avg_score(user_chunks)
    avg_legal = pinecone_service.avg_score(legal_chunks)
    confidence_note = ""
    if avg_user < pinecone_service.LOW_CONFIDENCE_THRESHOLD and avg_legal < pinecone_service.LOW_CONFIDENCE_THRESHOLD:
        confidence_note = (
            "\n**NOTE: The retrieved context has low relevance to the query. "
            "Be extra cautious — only state what is explicitly supported by the context. "
            "Prefer saying you don't have enough information over guessing.**\n"
        )

    return (
        "You are a legal document assistant analyzing a specific document for the user.\n"
        "You are NOT a licensed lawyer. This is AI-assisted analysis, not legal advice.\n\n"
        "STRICT RULES:\n"
        "- For questions directly answered by the provided context, answer ONLY from that context.\n"
        "- If a legal act or concept is mentioned in the document but its details are not in the "
        "context, provide a brief factual overview (4-6 sentences) from your general legal knowledge. "
        "Clearly state it is general background, not document-specific analysis.\n"
        "- Never fabricate specific section numbers, case names, or provisions not in the context.\n"
        "- For each law you cite from context, include [Source: Act Name, Section X] inline.\n"
        "- Always end responses with a recommendation to consult a qualified lawyer for specific advice.\n"
        "- Do NOT speculate about facts specific to the user's case.\n"
        f"{confidence_note}\n"
        f"Document: {doc.get('title', 'Untitled')}\n"
        f"Type: {doc.get('type', 'Unknown')}\n"
        f"Summary: {doc.get('summary', 'No summary available')}\n\n"
        "=== RELEVANT SECTIONS FROM YOUR DOCUMENT ===\n"
        f"{user_context}\n\n"
        "=== RELEVANT INDIAN LEGAL PROVISIONS ===\n"
        f"{legal_context}\n\n"
        "---\n"
        "Respond helpfully. Prioritize context above; use general knowledge only for brief background on referenced acts/concepts."
    )


async def get_chat_history(document_id: str, user_id: str) -> list[dict]:
    db = get_user_client(user_id)
    resp = (
        db.table("chat_messages")
        .select("role, content")
        .eq("document_id", document_id)
        .order("created_at")
        .limit(settings.CHAT_HISTORY_LIMIT)
        .execute()
    )
    return resp.data or []


def save_message(document_id: str, user_id: str, role: str, content: str):
    db = get_user_client(user_id)
    db.table("chat_messages").insert(
        {
            "document_id": document_id,
            "user_id": user_id,
            "role": role,
            "content": content,
        }
    ).execute()


async def stream_chat_response(
    document_id: str, user_id: str, user_message: str
) -> tuple[str, AsyncGenerator[str, None]]:
    """Returns (trace_id, token_generator) for RAG-augmented chat."""
    trace_id = str(uuid.uuid4())

    async def _generate() -> AsyncGenerator[str, None]:
        db = get_user_client(user_id)

        # Fetch document metadata (RLS ensures only owner can access)
        doc_resp = (
            db.table("documents")
            .select("title, type, summary")
            .eq("id", document_id)
            .single()
            .execute()
        )
        doc = doc_resp.data
        if not doc:
            yield "Error: Document not found."
            return

        # Semantic cache check — skip Pinecone + LLM on hit
        cached = await check_cache(document_id, user_message)
        if cached:
            save_message(document_id, user_id, "user", user_message)
            save_message(document_id, user_id, "assistant", cached)
            yield cached
            return

        # RAG retrieval — dual search (user-doc + legal-kb)
        user_chunks, legal_chunks = _retrieve_context(document_id, user_message)

        logger.info(
            f"RAG retrieval: {len(user_chunks)} user chunks, {len(legal_chunks)} legal chunks "
            f"(avg scores: {pinecone_service.avg_score(user_chunks):.2f}, {pinecone_service.avg_score(legal_chunks):.2f})"
        )

        # No-context fallback
        if not user_chunks and not legal_chunks:
            fallback = (
                "I couldn't find relevant information in your document or legal database "
                "for this question. Please try rephrasing, or consult a qualified lawyer."
                f"{DISCLAIMER}"
            )
            save_message(document_id, user_id, "user", user_message)
            save_message(document_id, user_id, "assistant", fallback)
            yield fallback
            return

        # Build message list
        history = await get_chat_history(document_id, user_id)
        system_context = _build_system_context(doc, user_chunks, legal_chunks)
        messages = [SystemMessage(content=system_context)]
        for msg in history:
            cls = HumanMessage if msg["role"] == "user" else AIMessage
            messages.append(cls(content=msg["content"]))
        messages.append(HumanMessage(content=user_message))

        # Save user message
        save_message(document_id, user_id, "user", user_message)

        # Stream response with LangFuse tracing
        full_response = ""
        async for chunk in llm.astream(
            messages,
            config={
                "run_id": trace_id,
                "callbacks": [LangfuseCallbackHandler(
                    public_key=settings.LANGFUSE_PUBLIC_KEY,
                    secret_key=settings.LANGFUSE_SECRET_KEY,
                    host=settings.LANGFUSE_BASE_URL,
                )],
                "metadata": {
                    "langfuse_user_id": user_id,
                    "langfuse_session_id": f"{user_id}:{document_id}",
                },
            },
        ):
            token = chunk.content
            if token:
                full_response += token
                yield token

        # Append disclaimer if not already present
        if "not legal advice" not in full_response.lower():
            yield DISCLAIMER
            full_response += DISCLAIMER

        # Save assistant response
        save_message(document_id, user_id, "assistant", full_response)

        # Persist eval data for offline RAG evaluation (Ragas batch via cron)
        eval_contexts = [_hit_field(c, "text") for c in user_chunks + legal_chunks]
        await store_eval_data(trace_id, user_message, full_response, eval_contexts)

        # Cache the response for future semantic matches
        await store_cache(document_id, user_message, full_response)

    return trace_id, _generate()
