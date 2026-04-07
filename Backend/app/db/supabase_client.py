import time
import jwt
from supabase import create_client, Client
from supabase.lib.client_options import SyncClientOptions
from app.core.config import settings

def get_supabase_admin() -> Client:
    """Lazy-load the admin client (bypasses RLS). ONLY for background tasks."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def get_user_client(user_id: str) -> Client:
    """Create a Supabase client scoped to a user via custom JWT.

    RLS policies use auth.uid() which reads the 'sub' claim from this JWT.
    """
    payload = {
        "sub": user_id,
        "role": "authenticated",
        "iss": "supabase",
        "aud": "authenticated",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_KEY,
        options=SyncClientOptions(
            headers={"Authorization": f"Bearer {token}"},
        ),
    )
    return client
