"""
Vidi — backend/app/rag/usage.py
Query Usage / Limit Enforcement (helper module)

Checks and increments daily query counts per user against the
query_usage Supabase table. Used by api/query.py before answering.

Limits:
    Guest:       3 queries/day  (no Supabase user_id — tracked in memory/session)
    Free:        20 queries/day
    Pro:         unlimited
    Enterprise:  unlimited
"""

from datetime import date
import uuid
from loguru import logger
from fastapi import HTTPException, status

from app.api.auth import get_supabase_admin
from app.models.user import UserRole

# ─────────────────────────────────────────────────────────────
#  Limits per role
# ─────────────────────────────────────────────────────────────

DAILY_LIMITS: dict[UserRole, int] = {
    UserRole.GUEST: 3,
    UserRole.FREE: 20,
    UserRole.PRO: -1,           # -1 = unlimited
    UserRole.ENTERPRISE: -1,
}


def get_limit_for_role(role: UserRole) -> int:
    """Returns the daily query limit for a role. -1 means unlimited."""
    return DAILY_LIMITS.get(role, 3)


def is_unlimited(role: UserRole) -> bool:
    return get_limit_for_role(role) == -1


def is_guest_user(user_id: str | None) -> bool:
    """Checks if a user_id represents an anonymous/guest session."""
    if not user_id:
        return True
    user_str = str(user_id).lower()
    if user_str.startswith("guest") or "anonymous" in user_str:
        return True
    try:
        uuid.UUID(str(user_id))
        return False
    except (ValueError, AttributeError):
        return True


# ─────────────────────────────────────────────────────────────
#  Get today's usage count
# ─────────────────────────────────────────────────────────────

def get_today_usage(user_id: str) -> int:
    """
    Returns the current query count for this user today.
    Returns 0 if guest or no row exists yet.
    """
    if is_guest_user(user_id):
        return 0

    try:
        admin = get_supabase_admin()
        today = date.today().isoformat()

        response = (
            admin.table("query_usage")
            .select("count")
            .eq("user_id", user_id)
            .eq("date", today)
            .execute()
        )

        if response.data and len(response.data) > 0:
            return response.data[0]["count"]
        return 0

    except Exception as e:
        logger.warning(f"[usage] Could not query usage table for {user_id}: {e}")
        return 0


# ─────────────────────────────────────────────────────────────
#  Check quota BEFORE answering
# ─────────────────────────────────────────────────────────────

def check_quota(user_id: str, role: UserRole) -> dict:
    """
    Checks if the user has remaining quota for today.
    Raises HTTPException(429) if quota is exceeded.
    """
    limit = get_limit_for_role(role)

    if limit == -1:
        return {
            "allowed": True,
            "current_count": get_today_usage(user_id),
            "limit": -1,
            "remaining": -1,
        }

    current_count = get_today_usage(user_id)
    remaining = max(0, limit - current_count)
    allowed = current_count < limit

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Daily query limit reached",
                "message": (
                    f"You've used all {limit} queries for today on the "
                    f"{role.value.upper()} plan. "
                    + ("Upgrade to Pro for unlimited queries."
                       if role != UserRole.PRO else "")
                ),
                "limit": limit,
                "current_count": current_count,
                "resets_at": "midnight IST",
            },
        )

    return {
        "allowed": True,
        "current_count": current_count,
        "limit": limit,
        "remaining": remaining,
    }


# ─────────────────────────────────────────────────────────────
#  Increment usage AFTER successful answer
# ─────────────────────────────────────────────────────────────

def increment_usage(user_id: str) -> int:
    """
    Increments today's query count by 1 for this user in Supabase.
    Bypasses write operations for guest sessions.
    """
    if is_guest_user(user_id):
        return 0

    try:
        admin = get_supabase_admin()
        today = date.today().isoformat()

        current = get_today_usage(user_id)
        new_count = current + 1

        admin.table("query_usage").upsert({
            "user_id": user_id,
            "date": today,
            "count": new_count,
        }, on_conflict="user_id,date").execute()

        logger.debug(f"[usage] {user_id} -> {new_count} queries today")
        return new_count

    except Exception as e:
        logger.warning(f"[usage] Skipped increment for {user_id}: {e}")
        return -1


# ─────────────────────────────────────────────────────────────
#  Combined helper for /query endpoint
# ─────────────────────────────────────────────────────────────

def get_usage_summary(user_id: str, role: UserRole) -> dict:
    """
    Returns a full usage summary for UI dashboards and limit bars.
    """
    limit = get_limit_for_role(role)
    current = get_today_usage(user_id)

    if limit == -1:
        return {
            "role": role.value,
            "limit": -1,
            "used": current,
            "remaining": -1,
            "unlimited": True,
            "percent_used": 0,
        }

    remaining = max(0, limit - current)
    percent_used = min(100, round((current / limit) * 100)) if limit > 0 else 0

    return {
        "role": role.value,
        "limit": limit,
        "used": current,
        "remaining": remaining,
        "unlimited": False,
        "percent_used": percent_used,
    }