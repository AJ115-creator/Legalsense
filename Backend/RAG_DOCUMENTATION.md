# LegalSense RAG Pipeline — Technical Documentation

## Overview

LegalSense uses Retrieval-Augmented Generation (RAG) to provide legally grounded AI chat over user-uploaded documents. The system performs dual retrieval — searching both the user's document and an Indian legal knowledge base — before generating responses.

**Before RAG:** Chat context-stuffed the first 10,000 characters of extracted text into the system prompt. This broke on long documents and had zero legal knowledge.

**After RAG:** Chat retrieves the 5 most relevant chunks from the user's document + 5 most relevant Indian law sections, with reranking and anti-hallucination safeguards.

---

## Architecture

```
User uploads PDF
       |
       v
[Supabase Storage] ---- file stored
       |
       v
[pdf_extractor.py] ---- pypdf text extraction
       |
       v
[chunking_service.py] -- RecursiveCharacterTextSplitter (2000 chars, 400 overlap)
       |
       v
[pinecone_service.py] -- upsert_records() to Pinecone (auto-embedded via llama-text-embed-v2)
       |
       v
[ai_analysis.py] ------- Groq LLM analysis (title, type, summary, law refs)
       |
       v
[Supabase DB] ---------- document metadata stored


User sends chat message
       |
       v
[chat_service.py]
       |
       +-- search(filter={source: "user-doc", doc_id}) --> user document chunks
       +-- search(filter={source: "legal-kb"}) ----------> Indian law sections
       |
       v
[System prompt with retrieved context + anti-hallucination rules]
       |
       v
[Groq LLM (llama-3.3-70b-versatile, temp=0.1)] --> streamed response via WebSocket
```

---

## Libraries & Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `pinecone[grpc]` | >=8.1.0 | Vector database with integrated embedding (llama-text-embed-v2, NVIDIA-hosted) |
| `datasets` | >=4.8.4 | HuggingFace datasets library for downloading Indian legal datasets |
| `langchain` | 1.2.13 | LLM orchestration framework |
| `langchain-groq` | 1.1.2 | Groq LLM integration for chat and analysis |
| `langchain-text-splitters` | (bundled) | RecursiveCharacterTextSplitter for document chunking |
| `pypdf` | 6.9.2 | PDF text extraction |
| `fastapi` | 0.135.2 | Web framework (REST + WebSocket) |
| `supabase` | 2.28.3 | Database (Postgres) + file storage |

**Package manager:** UV (`uv sync` from `Backend/`)

### Key: Pinecone Integrated Embedding

Unlike traditional RAG setups that require a separate embedding service (OpenAI, HuggingFace Inference API), Pinecone's integrated embedding handles everything:

1. **Upsert:** Send raw text in the `text` field → Pinecone embeds it via `llama-text-embed-v2` (NVIDIA-hosted) and stores the vector
2. **Search:** Send raw query text → Pinecone embeds, searches, and returns results
3. **Rerank:** Built-in `bge-reranker-v2-m3` reranking for better relevance

This eliminates the need for `embedding_service.py`, HuggingFace API keys for embeddings, and `langchain-huggingface`.

---

## Files Created / Modified

### New Files

#### `app/services/pinecone_service.py`
Core vector store wrapper. Handles all Pinecone operations.

**Key functions:**
- `upsert_records(records)` — Batch upsert (100 per batch) to default namespace. Each record must have `_id` and `text` fields.
- `search(query_text, top_k, filter, rerank)` — Search with integrated embedding. Filters results below `SCORE_THRESHOLD` (0.5). Includes `bge-reranker-v2-m3` reranking by default.
- `delete_by_prefix(id_prefix)` — Serverless workaround: uses `list_paginated(prefix=...)` to find IDs, then `delete(ids=...)`. Serverless indexes cannot delete by metadata filter.
- `avg_score(results)` — Helper for confidence scoring.

**Constants:**
- `BATCH_SIZE = 100` — Pinecone upsert limit per request
- `SCORE_THRESHOLD = 0.5` — Minimum similarity score to include in results
- `LOW_CONFIDENCE_THRESHOLD = 0.6` — Below this, system prompt adds caution warning

**Architecture decision — Single namespace:**
Pinecone Starter plan (free) supports only one namespace. We use the default namespace (`""`) with metadata field `source` (`"legal-kb"` or `"user-doc"`) for filtering. ID convention enables prefix-based deletion:
- Legal KB: `legal_{act_key}_{index}` (e.g., `legal_bns_42`)
- User docs: `{doc_id}_{chunk_index}` (e.g., `abc123_0`)

#### `app/services/chunking_service.py`
Document text splitting for user uploads.

**How it works:**
- Uses `RecursiveCharacterTextSplitter` from LangChain
- `chunk_size=2000` chars (~500 tokens, well within llama-text-embed-v2's 2048 token limit)
- `chunk_overlap=400` chars (20%) — preserves context at chunk boundaries
- Separator hierarchy: `\n\n\n` → `\n\n` → `\n` → `. ` → ` ` → `""` (tries paragraph breaks first, falls back to sentences, then words)

**Functions:**
- `chunk_document(text) -> list[str]` — Split text into overlapping chunks
- `build_records(doc_id, user_id, chunks) -> list[dict]` — Format chunks as Pinecone records with metadata

#### `app/services/legal_parser.py`
Section-aware parser for Indian legal documents (acts, constitution).

**How it works:**
1. Detects chapter boundaries via regex (`CHAPTER IV`, `CHAPTER 4`)
2. Splits by section/article patterns:
   - Sections: `103. Title text` (BNS, BNSS, BSA, ICA, CPC)
   - Articles: `Article 21.` or `Art. 21A.` (Constitution)
3. If a section exceeds `CHUNK_SIZE` (2000 chars), sub-chunks it with `RecursiveCharacterTextSplitter`
4. Falls back to generic recursive chunking if < 3 sections detected

**Output per chunk:**
```python
{
    "text": "section content...",
    "act_name": "Bharatiya Nyaya Sanhita 2023",
    "section": "Section 103",
    "section_title": "Murder",
    "chapter": "Chapter VI - OF OFFENCES AFFECTING THE HUMAN BODY",
    "sub_chunk": 0
}
```

#### `scripts/ingest_legal_kb.py`
One-time batch script to ingest 6 Indian law PDFs into Pinecone.

**Usage:**
```bash
cd Backend
uv run python -m scripts.ingest_legal_kb          # all acts
uv run python -m scripts.ingest_legal_kb --act BNS  # single act
```

**Pipeline:** Read PDF → `extract_text()` → `parse_act_sections()` → `upsert_records()`

**Source PDFs** (in `Backend/data/`):
| File | Act | Expected Chunks |
|------|-----|----------------|
| BNS_2023.pdf | Bharatiya Nyaya Sanhita 2023 | ~500-700 |
| BNSS_2023.pdf | Bharatiya Nagarik Suraksha Sanhita 2023 | ~800-1000 |
| BSA_2023.pdf | Bharatiya Sakshya Adhiniyam 2023 | ~300-400 |
| COI.pdf | Constitution of India | ~600-800 |
| ICA_1872.pdf | Indian Contract Act 1872 | ~300-400 |
| Code-of-civil-procedure.pdf | Code of Civil Procedure | ~400-600 |

#### `scripts/ingest_hf_datasets.py`
Ingests HuggingFace legal datasets into Pinecone.

**Usage:**
```bash
cd Backend
uv run python -m scripts.ingest_hf_datasets                   # all datasets
uv run python -m scripts.ingest_hf_datasets --dataset constitution  # single
```

**Datasets:**
- `nisaar/Constitution_of_India` — 933 Q&A pairs about the Constitution. Stored as `Q: ... \nA: ...` format.
- `harshitv804/Indian_Penal_Code` — IPC sections (generic ingestion, auto-detects text column)

### Modified Files

#### `app/api/v1/endpoints/documents.py`
**Changes:**
- `_run_analysis()` now accepts `user_id` parameter
- After text extraction, chunks document and upserts to Pinecone:
  ```python
  chunks = chunk_document(text)
  records = build_records(doc_id, user_id, chunks)
  pinecone_service.upsert_records(records)
  ```
- `delete_document()` now removes vectors from Pinecone before deleting from DB:
  ```python
  pinecone_service.delete_by_prefix(f"{doc_id}_")
  ```

#### `app/services/chat_service.py`
**Complete rewrite** — replaced context-stuffing with RAG retrieval.

**Old flow:** `doc.extracted_text[:10000]` in system prompt
**New flow:**
1. `_retrieve_context(document_id, user_message)` — dual search:
   - User doc: `filter={"source": "user-doc", "doc_id": doc_id}`, top_k=5
   - Legal KB: `filter={"source": "legal-kb"}`, top_k=5
2. Score threshold filtering (< 0.5 discarded)
3. Reranking via `bge-reranker-v2-m3`
4. `_build_system_context()` — constructs prompt with:
   - Anti-hallucination rules (ICE method)
   - Retrieved user doc chunks with relevance scores
   - Retrieved legal provisions with act name, section, scores
   - Low-confidence warning if avg score < 0.6
5. No-context fallback — if zero chunks pass threshold, returns explicit "I couldn't find relevant information" message
6. Disclaimer appended to every response

**Temperature:** Lowered from 0.3 to 0.1 for stricter factual generation.

---

## Anti-Hallucination Strategy

### Layer 1: Retrieval Quality
- **Reranking:** `bge-reranker-v2-m3` reorders results by relevance
- **Score threshold:** Chunks with similarity < 0.5 are discarded (noise filter)
- **Metadata-rich chunks:** Every chunk carries `act_name`, `section`, `chapter` for precise citation

### Layer 2: Prompt Engineering (ICE Method)
- **Instructions:** "Answer ONLY using the provided context"
- **Constraints:** "If not in context, say 'This information is not available.' Never fabricate section numbers."
- **Escalation:** "If unsure, recommend consulting a qualified lawyer"

### Layer 3: Output Grounding
- **Source attribution:** Prompt directs LLM to include `[Source: Act Name, Section X]` inline
- **Confidence warning:** If avg retrieval score < 0.6, system prompt adds explicit caution note
- **No-context fallback:** If zero chunks pass threshold, bypasses LLM entirely with canned response

### Layer 4: Structural Safeguards
- **Temperature 0.1** — minimizes creative generation
- **Disclaimer footer** — every response ends with legal advice warning
- **Separate retrieval streams** — user sees doc chunks vs legal KB chunks distinctly

### What This Does NOT Do (by design)
- **Knowledge graph alignment** — too complex for MVP
- **Fine-tuning** — no budget (Groq free tier)
- **Agentic verification loop** — adds latency; revisit if hallucination rate > 5%

---

## Pinecone Index Configuration

| Setting | Value |
|---------|-------|
| Index name | `legalsense` |
| Model | `llama-text-embed-v2` (NVIDIA-hosted) |
| Dimensions | 1024 |
| Metric | cosine |
| Type | Serverless (AWS us-east-1) |
| Field map | `text` → auto-embedded |
| Plan | Starter (free): 2GB storage, 5M embed tokens/mo |

### Metadata Schema

**Legal KB records:**
```json
{
    "_id": "legal_bns_42",
    "text": "Section content...",
    "source": "legal-kb",
    "act_name": "Bharatiya Nyaya Sanhita 2023",
    "section": "Section 103",
    "section_title": "Murder",
    "chapter": "Chapter VI"
}
```

**User document records:**
```json
{
    "_id": "abc123-def456_0",
    "text": "Document chunk content...",
    "source": "user-doc",
    "doc_id": "abc123-def456",
    "user_id": "clerk_user_123",
    "chunk_index": 0
}
```

---

## How to Run

### 1. Install dependencies
```bash
cd Backend
uv sync
```

### 2. Ingest legal knowledge base (one-time)
```bash
uv run python -m scripts.ingest_legal_kb
uv run python -m scripts.ingest_hf_datasets
```

### 3. Start the server
```bash
uv run uvicorn app.main:app --reload --port 8000
```

### 4. Verify
- Upload a PDF via `/api/v1/documents/upload`
- Check Pinecone dashboard for vector count
- Chat via WebSocket at `/api/v1/chat/{document_id}`
- Ask "what laws apply?" — should cite BNS/BNSS sections

---

## Future: OCR Fallback (Deferred)

### Problem
Many Indian legal documents are scanned PDFs (especially Hindi documents, court orders, FIRs). `pypdf` returns empty/garbled text for these.

### Planned Solution

**Library:** `marker-pdf` — state-of-the-art PDF OCR with layout preservation

**File:** `app/services/ocr_service.py` (to be created)

```python
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.output import text_from_rendered

models = create_model_dict()

def extract_with_ocr(file_bytes: bytes) -> str:
    converter = PdfConverter(artifact_dict=models)
    rendered = converter(tmp_path)
    return text_from_rendered(rendered)
```

**Detection heuristic** in `pdf_extractor.py`:
```python
def is_scanned(text: str, pages: int) -> bool:
    return len(text) / max(pages, 1) < 100  # < 100 chars/page = likely scanned
```

**Flow:**
1. `extract_text()` runs pypdf as usual
2. If `is_scanned()` returns True → trigger `extract_with_ocr()`
3. OCR text replaces pypdf text for chunking + analysis

**Dependencies:**
- `marker-pdf` (~1.5GB with PyTorch CPU)
- Supports Hindi via `--langs en,hi` flag

**Deployment concern:**
- PyTorch CPU adds significant memory (~1.5GB RAM)
- Railway Pro ($20/mo) has sufficient RAM
- OCR is 5-10x slower than pypdf (2-5s per page vs 0.5s)
- Consider running OCR as a separate worker/service if volume increases

**Why deferred:**
- Core RAG pipeline works without OCR (most uploaded docs are digital PDFs)
- marker-pdf adds deployment complexity
- Better to validate RAG quality first, then add OCR

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PINECONE_API_KEY` | Yes | Pinecone API key (Starter plan) |
| `PINECONE_INDEX` | No | Index name (default: `legalsense`) |
| `GROQ_API_KEY` | Yes | Groq LLM API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service key (for background tasks) |
| `SUPABASE_JWT_SECRET` | Yes | For custom JWT signing (RLS) |
| `CLERK_ALLOWED_ISSUERS` | Yes | Clerk JWT issuer URLs |
| `HUGGINGFACE_API_KEY` | No | Only needed for `datasets` download (not embeddings) |
