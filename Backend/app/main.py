import os
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.api.v1.endpoints import documents, chat, feedback, translate

# Sentry init (before app creation)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        release=settings.SENTRY_RELEASE or os.getenv("RAILWAY_GIT_COMMIT_SHA", "dev"),
        # Performance traces off — background flushes prevented Railway serverless auto-sleep
        traces_sample_rate=0.0,
        profiles_sample_rate=0.0,
        # Privacy-first default for legal-domain docs — drops user IPs, headers, JWT contents
        send_default_pii=False,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- startup ----
    # CORS sanity log — surfaces stale env vars / hidden whitespace without
    # needing to shell into the container.
    print(f"[CORS] allowed_origins loaded as: {settings.allowed_origins!r}", flush=True)

    # Warm the Langfuse singleton (gated on real creds so CI mocks with empty
    # keys skip init and don't hang uvicorn boot). The Langchain CallbackHandler
    # auto-discovers this global client — without this warm-up, the first chat
    # request before any feedback submission would crash.
    if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
        feedback.get_langfuse()

    yield

    # ---- shutdown ----
    # Only flush if the lazy singleton was actually built during this process's lifetime
    if feedback._langfuse is not None:
        try:
            feedback._langfuse.flush()
        except Exception:
            pass


app = FastAPI(
    title="LegalSense API",
    version="1.0.0",
    redirect_slashes=False,
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
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
app.include_router(
    translate.router, prefix="/api/v1/translate", tags=["translate"]
)


@app.get("/health")
async def health():
    return {"status": "ok"}
