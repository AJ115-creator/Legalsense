import time
import jwt
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

security = HTTPBearer()

# Cache JWKS per issuer: {issuer: (jwks_dict, fetched_at_timestamp)}
_jwks_cache: dict[str, tuple[dict, float]] = {}
JWKS_TTL = 3600  # 1 hour


def _extract_issuer(token: str) -> str:
    """Decode token WITHOUT verification to read the iss claim."""
    payload = jwt.decode(token, options={"verify_signature": False})
    issuer = payload.get("iss", "").rstrip("/")
    if not issuer:
        raise ValueError("Token missing iss claim")
    if issuer not in settings.allowed_issuers:
        raise ValueError(f"Issuer {issuer} not in allowed list")
    return issuer


async def _fetch_jwks(jwks_url: str) -> dict:
    """Fetch JWKS from a Clerk instance."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        return resp.json()


async def _get_jwks(issuer: str, force_refresh: bool = False) -> dict:
    """Get cached JWKS for issuer with TTL, or fetch fresh."""
    if issuer in _jwks_cache and not force_refresh:
        jwks, fetched_at = _jwks_cache[issuer]
        if time.time() - fetched_at < JWKS_TTL:
            return jwks
    jwks_url = f"{issuer}/.well-known/jwks.json"
    jwks = await _fetch_jwks(jwks_url)
    _jwks_cache[issuer] = (jwks, time.time())
    return jwks


def _decode_token(token: str, jwks: dict, issuer: str) -> str:
    """Decode Clerk JWT and return user_id (sub claim)."""
    header = jwt.get_unverified_header(token)
    key = next((k for k in jwks["keys"] if k["kid"] == header.get("kid")), None)
    if not key:
        raise KeyError(f"kid={header.get('kid')} not in JWKS")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
    payload = jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        issuer=issuer,
        options={"verify_aud": False},
    )
    return payload["sub"]


async def _verify_token(token: str) -> str:
    """Full verification flow: extract issuer -> fetch JWKS -> decode."""
    issuer = _extract_issuer(token)
    jwks = await _get_jwks(issuer)
    try:
        return _decode_token(token, jwks, issuer)
    except KeyError:
        # kid not found — Clerk may have rotated keys. Refetch once.
        jwks = await _get_jwks(issuer, force_refresh=True)
        return _decode_token(token, jwks, issuer)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """FastAPI dependency — returns Clerk user_id from Bearer token."""
    try:
        return await _verify_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
