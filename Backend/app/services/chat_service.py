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
    """Build system prompt with RAG context and strict document-only guardrails."""
    user_context = _format_user_chunks(user_chunks)
    legal_context = _format_legal_chunks(legal_chunks)

    # Low-confidence warning
    avg_user = pinecone_service.avg_score(user_chunks)
    avg_legal = pinecone_service.avg_score(legal_chunks)
    confidence_note = ""
    if avg_user < pinecone_service.LOW_CONFIDENCE_THRESHOLD and avg_legal < pinecone_service.LOW_CONFIDENCE_THRESHOLD:
        confidence_note = (
            "\n**CRITICAL: The retrieved context has LOW relevance to the user's query. "
            "This very likely means the question is OFF-TOPIC. "
            "Refuse the question using the refusal template below.**\n"
        )

    return (
        "You are a STRICT legal document assistant. Your ONLY purpose is to help the user "
        "understand the specific document they uploaded and the laws/legal provisions referenced in it.\n\n"

        "═══════════════════════════════════════\n"
        "ABSOLUTE RULES — NEVER VIOLATE THESE:\n"
        "═══════════════════════════════════════\n"
        "1. ONLY answer questions that are DIRECTLY about the uploaded document content, "
        "its legal provisions, the parties involved, clauses, sections, or terms within it.\n"
        "2. NEVER answer general knowledge questions, trivia, or anything unrelated to this document. "
        "This includes questions about technology, companies, people, history, science, current events, "
        "or ANY topic not explicitly covered in the document context below.\n"
        "3. If the user's question is NOT answerable from the document context provided below, "
        "you MUST refuse. Use this exact template:\n"
        '   "I can only help with questions about your uploaded document and the legal provisions '
        'it references. Your question doesn\'t appear to relate to this document. '
        'Please ask something about your document\'s content, clauses, or legal implications."\n'
        "4. Do NOT try to connect unrelated topics to the document. If someone asks about Facebook, "
        "cooking, sports, or anything outside the document scope — refuse, even if you could loosely "
        "relate it to a legal concept.\n"
        "5. NEVER use external knowledge to answer questions. You may ONLY use the CONTEXT sections below.\n"
        "6. For each legal provision you cite from context, include [Source: Act Name, Section X] inline.\n"
        "7. Never fabricate section numbers, case names, or provisions not present in the context.\n"
        "8. You are NOT a licensed lawyer. Always end substantive legal answers with a recommendation "
        "to consult a qualified lawyer.\n"
        "9. Do NOT speculate about facts specific to the user's case beyond what the document states.\n\n"

        "RELEVANCE TEST — Apply this BEFORE answering:\n"
        "  → Is the question about the document's content, parties, terms, or legal provisions? → ANSWER\n"
        "  → Is the question about a general topic, even if vaguely law-related? → REFUSE\n"
        "  → Is the question about something not mentioned in the CONTEXT below? → REFUSE\n\n"

        f"{confidence_note}"
        f"Document: {doc.get('title', 'Untitled')}\n"
        f"Type: {doc.get('type', 'Unknown')}\n"
        f"Summary: {doc.get('summary', 'No summary available')}\n\n"
        "=== RELEVANT SECTIONS FROM YOUR DOCUMENT ===\n"
        f"{user_context}\n\n"
        "=== RELEVANT INDIAN LEGAL PROVISIONS ===\n"
        f"{legal_context}\n\n"
        "---\n"
        "REMEMBER: If the question is not about this document or its legal provisions, REFUSE. "
        "Do not attempt to answer. Do not provide general information."
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
                "I can only help with questions about your uploaded document and "
                "the legal provisions it references. Your question doesn't appear "
                "to relate to this document. Please ask something about your "
                "document's content, clauses, or legal implications."
                f"{DISCLAIMER}"
            )
            save_message(document_id, user_id, "user", user_message)
            save_message(document_id, user_id, "assistant", fallback)
            yield fallback
            return

        # Pre-generation relevance gate — bypass LLM if context is irrelevant
        avg_user = pinecone_service.avg_score(user_chunks)
        avg_legal = pinecone_service.avg_score(legal_chunks)
        if avg_user < pinecone_service.LOW_CONFIDENCE_THRESHOLD and avg_legal < pinecone_service.LOW_CONFIDENCE_THRESHOLD:
            logger.info(
                f"Off-topic gate triggered: avg_user={avg_user:.4f}, avg_legal={avg_legal:.4f}"
            )
            refusal = (
                "I can only help with questions about your uploaded document and "
                "the legal provisions it references. Your question doesn't appear "
                "to relate to this document. Please ask something about your "
                "document's content, clauses, or legal implications."
                f"{DISCLAIMER}"
            )
            save_message(document_id, user_id, "user", user_message)
            save_message(document_id, user_id, "assistant", refusal)
            yield refusal
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
                # Langfuse v3: CallbackHandler() takes no credential args.
                # It auto-discovers the global Langfuse() client warmed at app
                # startup in main.py (via feedback.get_langfuse()).
                "callbacks": [LangfuseCallbackHandler()],
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
