"""
Vidi — backend/app/api/limits.py
Day 21 Task: Query Limit Enforcement Middleware
"""

from fastapi import Depends, HTTPException, Request, status
from datetime import datetime, date, timezone
from typing import Dict, Tuple

from app.api.auth import get_optional_user
from app.models.user import User, UserRole

# In-memory tracking storage structure: { identifier: (date, current_count) }
usage_cache: Dict[str, Tuple[date, int]] = {}

# Tier thresholds definition
LIMITS = {
    "guest": 3,      # Unauthenticated guests tracked by client IP
    "free": 10,      # Logged-in free tier users tracked by user_id
}

def check_query_limits(request: Request, user: User = Depends(get_optional_user)):
    """
    FastAPI dependency checking query balance capacity before allowing execution.
    Raises HTTP 429 if daily tier balances are depleted.
    """
    today = datetime.now(timezone.utc).date()
    
    # 1. Bypass limit validation completely for PRO or ENTERPRISE tiers
    if user and user.role in [UserRole.PRO, UserRole.ENTERPRISE]:
        return
        
    # 2. Determine tracking identification context and tier limits
    if user:
        identifier = f"user_{user.user_id}"
        tier = "free"
        max_allowed = LIMITS["free"]
    else:
        # Fallback to incoming client IP address tracking for unregistered guests
        identifier = f"ip_{request.client.host if request.client else 'unknown'}"
        tier = "guest"
        max_allowed = LIMITS["guest"]

    # 3. Fetch or initialize active window tracking record
    record_date, current_count = usage_cache.get(identifier, (today, 0))

    # Reset counter if the calendar day has turned over
    if record_date < today:
        record_date = today
        current_count = 0

    # 4. Check if the user has hit their ceiling
    if current_count >= max_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Daily limit reached",
                "tier": tier,
                "allowed": max_allowed,
                "message": f"You have exhausted your {max_allowed} daily queries for the {tier} tier."
            }
        )

    # 5. Increment usage count and update storage state
    usage_cache[identifier] = (record_date, current_count + 1)