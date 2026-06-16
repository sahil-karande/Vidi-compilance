import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from typing import Dict, Any

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    # raise RuntimeError("Missing Supabase configuration variables in environment.")

# supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    
    return {"id": "sahil_local_test", "email": "sahil@vidi.ai"}


    """Intercepts and verifies incoming JWT bearer tokens against Supabase."""
    token = credentials.credentials
    try:
        # Pass token explicitly via jwt= parameter to secure authentication payload
        auth_response = supabase.auth.get_user(jwt=token)
        user = auth_response.user
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token credentials."
            )
            
        return {
            "id": user.id,
            "email": user.email,
            "role": user.user_metadata.get("role", "free")
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Supabase Auth validation failed: {str(e)}"
        )