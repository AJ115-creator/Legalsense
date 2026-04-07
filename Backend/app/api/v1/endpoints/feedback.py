from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from langfuse import Langfuse
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.rate_limiter import limiter

router = APIRouter()

# Lazy singleton — instantiating Langfuse at import time with empty creds
# (CI mocks, local dev without observability) hangs uvicorn boot.
_langfuse: Langfuse | None = None


def get_langfuse() -> Langfuse:
    global _langfuse
    if _langfuse is None:
        _langfuse = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_BASE_URL,
        )
    return _langfuse


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
    get_langfuse().create_score(
        trace_id=body.trace_id,
        name="user-feedback",
        value=body.score,
        data_type="NUMERIC",
        comment=f"user:{user_id}",
    )
    return {"status": "recorded"}
