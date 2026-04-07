from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from langfuse import Langfuse
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.rate_limiter import limiter

router = APIRouter()
langfuse = Langfuse(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
    host=settings.LANGFUSE_BASE_URL,
)


class FeedbackRequest(BaseModel):
    trace_id: str
    score: int  # 1 = thumbs up, 0 = thumbs down


@router.post("/")
@limiter.limit("30/minute")
async def submit_feedback(
    request: Request,
    body: FeedbackRequest,
    user_id: str = Depends(get_current_user),
):
    langfuse.create_score(
        trace_id=body.trace_id,
        name="user-feedback",
        value=body.score,
        data_type="NUMERIC",
        comment=f"user:{user_id}",
    )
    return {"status": "recorded"}
