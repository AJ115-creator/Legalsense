import uuid
import asyncio
from datetime import date
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks, Request
from app.core.auth import get_current_user
from app.core.rate_limiter import limiter
from app.core.semantic_cache import invalidate_document_cache
from app.core.config import settings
from app.db.supabase_client import get_supabase_admin, get_user_client
from app.models.document import DocumentListItem, DocumentAnalysis, UploadResponse
from app.services.pdf_extractor import extract_text
from app.services.ai_analysis import analyze_document, classify_legal_document
from app.services.chunking_service import chunk_document, build_records
from app.services import pinecone_service

router = APIRouter()

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
CHUNK_SIZE = 1024 * 1024            # 1 MB streaming read granularity


def _run_analysis_sync(doc_id: str, user_id: str, text: str, pages: int, upload_date: str):
    """Background task wrapper — runs async analysis in a new event loop."""
    asyncio.run(_run_analysis(doc_id, user_id, text, pages, upload_date))


async def _run_analysis(doc_id: str, user_id: str, text: str, pages: int, upload_date: str):
    """Chunk + upsert to Pinecone, run AI analysis, update DB.

    Text + pages are pre-extracted in the upload endpoint (so the classifier
    can read them sync). Uses supabase_admin (service key) because background
    tasks have no user context.
    """
    try:
        get_supabase_admin().table("documents").update(
            {"extracted_text": text, "pages": pages}
        ).eq("id", doc_id).execute()

        # Chunk and upsert to Pinecone for RAG retrieval
        chunks = chunk_document(text)
        if chunks:
            records = build_records(doc_id, user_id, chunks)
            pinecone_service.upsert_records(records)

        analysis = await analyze_document(text, pages, upload_date)

        get_supabase_admin().table("documents").update(
            {
                "title": analysis["title"],
                "type": analysis["type"],
                "summary": analysis["summary"],
                "law_references": analysis["lawReferences"],
                "suggestions": analysis["suggestions"],
                "status": "analyzed",
            }
        ).eq("id", doc_id).execute()
    except Exception as e:
        get_supabase_admin().table("documents").update(
            {"status": "error", "summary": f"Analysis failed: {str(e)}"}
        ).eq("id", doc_id).execute()


@router.post("/upload", response_model=UploadResponse)
@limiter.limit("5/minute")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files accepted")

    # Layer 1 — fast-fail on Content-Length header (cheap, catches honest clients)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            413,
            f"File size exceeds {MAX_UPLOAD_SIZE // (1024 * 1024)}MB limit",
        )

    # Layer 2 — stream the body in chunks, abort if accumulated size exceeds limit.
    # Defends against clients that lie about / omit Content-Length.
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(CHUNK_SIZE):
        total += len(chunk)
        if total > MAX_UPLOAD_SIZE:
            raise HTTPException(
                413,
                f"File size exceeds {MAX_UPLOAD_SIZE // (1024 * 1024)}MB limit",
            )
        chunks.append(chunk)
    file_bytes = b"".join(chunks)

    # Magic-byte gate — defends against renamed .exe/.zip with .pdf extension
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(400, "File is not a valid PDF")

    # Extract text on the sync path so the classifier has something to read.
    # pypdf is sync — wrap in threadpool to not block the event loop. The
    # PaddleOCR fallback inside extract_text inherits this wrap automatically.
    try:
        text, pages = await asyncio.to_thread(extract_text, file_bytes)
    except Exception:
        raise HTTPException(
            400,
            "Could not read PDF — file may be corrupted or password-protected",
        )

    # Legal-domain content gate — rejects non-legal PDFs before any storage write.
    is_legal, _reason = await classify_legal_document(text)
    if not is_legal:
        raise HTTPException(
            400,
            "Please upload a legal document. This does not seem like a legal document to me.",
        )

    doc_id = str(uuid.uuid4())
    file_path = f"{user_id}/{doc_id}.pdf"
    upload_date = date.today().isoformat()

    try:
        db = get_user_client(user_id)

        db.storage.from_(settings.STORAGE_BUCKET).upload(
            file_path, file_bytes, {"content-type": "application/pdf"}
        )

        db.table("documents").insert(
            {
                "id": doc_id,
                "user_id": user_id,
                "title": file.filename.replace(".pdf", "").replace(".PDF", ""),
                "type": "Unknown",
                "date": upload_date,
                "status": "pending",
                "pages": pages,
                "file_path": file_path,
            }
        ).execute()

    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

    # Background analysis uses admin client (no user context in thread).
    # Pass pre-extracted text + pages so the background task doesn't re-parse the PDF.
    background_tasks.add_task(_run_analysis_sync, doc_id, user_id, text, pages, upload_date)

    return UploadResponse(id=doc_id, status="pending", message="Upload successful, analysis started")


@router.get("/", response_model=list[DocumentListItem])
@limiter.limit("30/minute")
async def list_documents(request: Request, user_id: str = Depends(get_current_user)):
    db = get_user_client(user_id)
    resp = (
        db.table("documents")
        .select("id, title, type, date, status, pages")
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data


@router.get("/{doc_id}")
@limiter.limit("30/minute")
async def get_document(request: Request, doc_id: str, user_id: str = Depends(get_current_user)):
    db = get_user_client(user_id)
    resp = (
        db.table("documents")
        .select("*")
        .eq("id", doc_id)
        .single()
        .execute()
    )
    d = resp.data
    if not d:
        raise HTTPException(404, "Document not found")

    if d["status"] == "pending":
        return {"status": "pending", "message": "Analysis in progress"}

    if d["status"] == "error":
        raise HTTPException(500, d.get("summary", "Analysis failed"))

    return DocumentAnalysis(
        title=d["title"],
        type=d["type"],
        date=str(d["date"]),
        pages=d["pages"],
        summary=d["summary"],
        lawReferences=d["law_references"] or [],
        suggestions=d["suggestions"] or [],
    )


@router.delete("/{doc_id}")
@limiter.limit("10/minute")
async def delete_document(request: Request, doc_id: str, user_id: str = Depends(get_current_user)):
    db = get_user_client(user_id)
    doc = (
        db.table("documents")
        .select("file_path")
        .eq("id", doc_id)
        .single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(404, "Document not found")

    db.storage.from_(settings.STORAGE_BUCKET).remove([doc.data["file_path"]])
    pinecone_service.delete_by_prefix(f"{doc_id}_")
    await invalidate_document_cache(doc_id)
    db.table("documents").delete().eq("id", doc_id).execute()
    return {"status": "deleted"}
