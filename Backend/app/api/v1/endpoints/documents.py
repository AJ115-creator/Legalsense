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
from app.services.ai_analysis import analyze_document
from app.services.chunking_service import chunk_document, build_records
from app.services import pinecone_service

router = APIRouter()


def _run_analysis_sync(doc_id: str, user_id: str, file_bytes: bytes, upload_date: str):
    """Background task wrapper — runs async analysis in a new event loop."""
    asyncio.run(_run_analysis(doc_id, user_id, file_bytes, upload_date))


async def _run_analysis(doc_id: str, user_id: str, file_bytes: bytes, upload_date: str):
    """Extract PDF text, chunk + upsert to Pinecone, run AI analysis, update DB.

    Uses supabase_admin (service key) because background tasks have no user context.
    """
    try:
        text, pages = extract_text(file_bytes)
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

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(400, "File size exceeds 10MB limit")

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
                "pages": 0,
                "file_path": file_path,
            }
        ).execute()

    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

    # Background analysis uses admin client (no user context in thread)
    background_tasks.add_task(_run_analysis_sync, doc_id, user_id, file_bytes, upload_date)

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
