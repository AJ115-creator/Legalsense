from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    GROQ_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str
    CLERK_ALLOWED_ISSUERS: str  # comma-separated Clerk issuer URLs
    SUPABASE_JWT_SECRET: str

    PINECONE_API_KEY: str
    PINECONE_INDEX: str = "legalsense"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    # Separate model for the legal-doc classifier — independent rate-limit pool on Groq
    # (per-model pools, not per-key), 12x cheaper input/output, deterministic temp=0.0.
    GROQ_CLASSIFIER_MODEL: str = "llama-3.1-8b-instant"
    STORAGE_BUCKET: str = "legal-documents"
    CHAT_HISTORY_LIMIT: int = 50

    # Sentry
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_RELEASE: str = ""

    # Frontend URL (for CORS)
    FRONTEND_URL: str = "http://localhost:5173"

    # Redis (rate limiting)
    REDIS_URL: str = ""

    # LangFuse
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"

    # Guardrails
    GUARDRAILS_ENABLED: bool = True

    # Semantic cache
    CACHE_SIMILARITY_THRESHOLD: float = 0.95
    CACHE_TTL: int = 3600  # seconds

    @property
    def allowed_issuers(self) -> list[str]:
        return [
            s.strip().rstrip("/")
            for s in self.CLERK_ALLOWED_ISSUERS.split(",")
            if s.strip()
        ]

    @property
    def allowed_origins(self) -> list[str]:
        """Parse FRONTEND_URL as comma-separated CORS origin allowlist.

        A single value (e.g. "https://legalsense.dev") still works — split returns
        a one-element list, so the env var is backwards compatible.
        """
        return [
            s.strip().rstrip("/") for s in self.FRONTEND_URL.split(",") if s.strip()
        ]

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
