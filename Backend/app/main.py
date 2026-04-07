import os
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.api.v1.endpoints import documents, chat, feedback

# Sentry init (before app creation)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        release=settings.SENTRY_RELEASE or os.getenv("RAILWAY_GIT_COMMIT_SHA", "dev"),
        traces_sample_rate=0.2,
        profiles_sample_rate=0.2,
        send_default_pii=True,
    )

app = FastAPI(title="LegalSense API", version="1.0.0", redirect_slashes=False)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(
    documents.router, prefix="/api/v1/documents", tags=["documents"]
)
app.include_router(
    chat.router, prefix="/api/v1/chat", tags=["chat"]
)
app.include_router(
    feedback.router, prefix="/api/v1/feedback", tags=["feedback"]
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("shutdown")
async def shutdown_event():
    try:
        feedback.langfuse.flush()
    except Exception:
        pass
