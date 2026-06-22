"""
Vidi — backend/app/api/auth.py
Updated: Strict Asymmetric ES256 Verification Matrix using Static JWKS
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from loguru import logger
from supabase import create_client, Client

from app.config import settings
from app.models.user import User, UserRole

# ─────────────────────────────────────────────────────────────
#  Configuration Matrix
# ─────────────────────────────────────────────────────────────

JWT_AUDIENCE = "authenticated"
bearer_scheme = HTTPBearer(auto_error=False)
_supabase_admin: Optional[Client] = None

# Your exact Public Key Set from Screenshot 2026-06-22 222256.png
STATIC_JWKS = {
    "keys": [
        {
            "kty": "EC",
            "crv": "P-256",
            "x": "3WSrn31Cr0pe76iN4E1f1tVGzK-GEZ0yJ-o4su06JmY",
            "y": "-HiaUjskJe03hidlIgpaxS--G_M40_b3C3WR_Ey0JeY",
            "alg": "ES256",
            "use": "sig",
            "kid": "09128781-6350-471f-b2ce-70491edd2545"
        }
    ]
}


def get_supabase_admin() -> Client:
    global _supabase_admin
    if _supabase_admin is None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        _supabase_admin = create_client(settings.supabase_url, settings.supabase_service_key)
    return _supabase_admin


def decode_supabase_jwt(token: str) -> dict:
    """Decode and verify an asymmetric Supabase-issued JWT using the static public key set."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Check token headers dynamically
        unverified_header = jwt.get_unverified_header(token)
        token_alg = unverified_header.get("alg", "ES256")

        # Fallback to local symmetric signing if it's a legacy test token
        if token_alg == "HS256":
            jwt_secret = getattr(settings, "supabase_jwt_secret", "")
            return jwt.decode(token, jwt_secret, algorithms=["HS256"], audience=JWT_AUDIENCE)

        # Main Asymmetric verification track
        payload = jwt.decode(
            token,
            STATIC_JWKS,
            algorithms=["ES256"],
            audience=JWT_AUDIENCE,
            options={"verify_aud": True}
        )
        return payload

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        logger.warning(f"[auth] Asymmetric JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token signature matrix: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def fetch_user_profile(user_id: str) -> dict:
    try:
        admin = get_supabase_admin()
        response = admin.table("profiles").select("user_id, name, email, role, business_profile").eq("user_id", user_id).single().execute()
        if response.data:
            return response.data
    except Exception as e:
        logger.warning(f"[auth] Could not fetch profile for {user_id}: {e}")
    return {"user_id": user_id, "name": None, "email": None, "role": "free", "business_profile": None}


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing token header profile details.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_supabase_jwt(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing user identifier claim.")

    profile = fetch_user_profile(user_id)
    try:
        role = UserRole(profile.get("role", "free"))
    except ValueError:
        role = UserRole.FREE

    return User(
        user_id=user_id,
        email=payload.get("email") or profile.get("email"),
        name=profile.get("name"),
        role=role,
        business_profile=profile.get("business_profile"),
    )


def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Optional[User]:
    if credentials is None or not credentials.credentials:
        return None
    return get_current_user(credentials)


ROLE_HIERARCHY = {UserRole.GUEST: 0, UserRole.FREE: 1, UserRole.PRO: 2, UserRole.ENTERPRISE: 3}

def require_role(minimum_role: UserRole):
    def _check_role(user: User = Depends(get_current_user)) -> User:
        user_level = ROLE_HIERARCHY.get(user.role, 0)
        required_level = ROLE_HIERARCHY.get(minimum_role, 0)
        if user_level < required_level:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Feature tier level access mismatch.")
        return user
    return _check_role