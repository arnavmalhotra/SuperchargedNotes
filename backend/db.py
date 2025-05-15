from fastapi import HTTPException, Header
from supabase import create_client, Client
import os
from typing import Optional

# Supabase setup
SUPABASE_URL = os.environ.get("SUPABASE_URL", "YOUR_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "YOUR_SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Authentication helper
async def get_current_user_id(x_user_id: Optional[str] = Header(None)):
    # Expects user_id to be passed in the 'X-User-Id' header
    # by the gateway/authentication layer (e.g., Vercel with Clerk)
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Unauthorized - User ID missing in X-User-Id header")
    return x_user_id 