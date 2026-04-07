"""Backend API route + auth tests."""
import jwt as pyjwt
from starlette.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.auth import _extract_issuer

client = TestClient(app)


# --- Route matching tests ---

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_documents_list_requires_auth():
    r = client.get("/api/v1/documents/")
    assert r.status_code in (401, 403)


def test_documents_get_requires_auth():
    r = client.get("/api/v1/documents/some-id")
    assert r.status_code in (401, 403)


def test_documents_upload_requires_auth():
    r = client.post("/api/v1/documents/upload")
    assert r.status_code in (401, 403, 422)


def test_documents_delete_requires_auth():
    r = client.delete("/api/v1/documents/some-id")
    assert r.status_code in (401, 403)


# --- Trailing slash = 404 (redirect_slashes=False) ---

def test_trailing_slash_get_doc_404():
    r = client.get("/api/v1/documents/some-id/")
    assert r.status_code == 404


def test_trailing_slash_upload_404():
    r = client.post("/api/v1/documents/upload/")
    assert r.status_code == 404


def test_no_trailing_slash_list_404():
    """GET /api/v1/documents (no slash) should NOT match the / route."""
    r = client.get("/api/v1/documents")
    assert r.status_code == 404


# --- Auth / issuer tests ---

def test_config_allowed_issuers():
    issuers = settings.allowed_issuers
    assert len(issuers) >= 1
    assert all(i.startswith("https://") for i in issuers)


def test_extract_issuer_valid():
    token = pyjwt.encode(
        {"sub": "user_x", "iss": settings.allowed_issuers[0]},
        "fake",
        algorithm="HS256",
    )
    assert _extract_issuer(token) == settings.allowed_issuers[0]


def test_extract_issuer_rejects_unknown():
    token = pyjwt.encode(
        {"sub": "user_x", "iss": "https://evil.com"},
        "fake",
        algorithm="HS256",
    )
    try:
        _extract_issuer(token)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass


def test_extract_issuer_strips_trailing_slash():
    token = pyjwt.encode(
        {"sub": "user_x", "iss": settings.allowed_issuers[0] + "/"},
        "fake",
        algorithm="HS256",
    )
    assert _extract_issuer(token) == settings.allowed_issuers[0]


# --- CORS tests ---

def test_cors_allows_localhost_5173():
    r = client.options(
        "/api/v1/documents/",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_blocks_unknown_origin():
    r = client.options(
        "/api/v1/documents/",
        headers={"Origin": "http://evil.com", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") != "http://evil.com"


# --- JWKS cache TTL ---

def test_jwks_cache_has_ttl():
    from app.core.auth import JWKS_TTL
    assert JWKS_TTL > 0
    assert JWKS_TTL <= 7200  # no more than 2 hours
