"""
Vidi — backend/app/api/me.py
Day 20 Task: Test endpoint for JWT middleware

Temporary endpoint to verify get_current_user works with REAL Supabase tokens.
Delete or keep — it's a useful debug endpoint either way.

Test with curl:
    curl -H "Authorization: Bearer <your-token>" http://localhost:8000/api/me
    → returns your user_id, email, role

    curl http://localhost:8000/api/me
    → 401 Unauthorized (missing token)

    curl -H "Authorization: Bearer invalid.token.here" http://localhost:8000/api/me
    → 401 Unauthorized (invalid token)
"""

from fastapi import APIRouter, Depends
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    """
    Returns the authenticated user's info.
    Requires a valid Supabase JWT in the Authorization header.
    """
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "business_profile": user.business_profile,
    }


@router.get("/me/pro-only")
def pro_only_route(user: User = Depends(require_role(UserRole.PRO))):
    """
    Test endpoint — only accessible to Pro/Enterprise users.
    Free/Guest users get 403 Forbidden.
    """
    return {
        "message": "You have Pro access!",
        "user_id": user.user_id,
        "role": user.role.value,
    }