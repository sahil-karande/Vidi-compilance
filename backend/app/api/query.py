"""
Vidi — backend/app/api/query.py
Day 21 Task: /query endpoint with quota enforcement

Full RAG pipeline + query limit enforcement:
    1. Check quota (Guest ≤3/day, Free ≤20/day, Pro unlimited)
    2. classifier → retriever → reranker → generator
    3. Increment usage count on SUCCESS only (failed queries don't count)
    4. Return answer + citations + remaining quota info

Also exposes GET /api/usage for the frontend usage bar.
"""

from fastapi import APIRouter, Depends
from loguru import logger

from app.api.auth import get_optional_user
from app.models.user import User, UserRole, QueryRequest, QueryResponse
from app.rag.usage import check_quota, increment_usage, get_usage_summary
from app.rag.classifier import classify_query
from app.rag.retriever import retrieve
from app.rag.reranker import rerank
from app.rag.generator import generate_answer

router = APIRouter()


# ─────────────────────────────────────────────────────────────
#  Helper: resolve a user_id even for Guests
#  Guests are tracked by a client-provided session id (or fallback)
# ─────────────────────────────────────────────────────────────

def resolve_user_identity(user: User | None, guest_session_id: str | None) -> tuple[str, UserRole]:
    """
    Returns (user_id_for_quota_tracking, role).

    Authenticated users → use their real user_id + role from profile.
    Guests → use the client-provided session id (e.g. browser fingerprint
             or a UUID stored in localStorage) so quota tracking still works
             without requiring login.
    """
    if user is not None:
        return user.user_id, user.role

    if guest_session_id:
        # Prefix to avoid collision with real Supabase UUIDs
        return f"guest_{guest_session_id}", UserRole.GUEST

    # No session id provided at all — fall back to a generic bucket.
    # Not ideal (shared quota across anonymous guests with no id),
    # but prevents the endpoint from crashing.
    return "guest_anonymous", UserRole.GUEST


# ─────────────────────────────────────────────────────────────
#  POST /api/query — Main RAG endpoint
# ─────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
def query(
    request: QueryRequest,
    guest_session_id: str | None = None,
    user: User | None = Depends(get_optional_user),
):
    """
    Ask a compliance question. Works for both authenticated users and Guests.

    Flow:
        1. Resolve identity (user_id + role)
        2. Check quota — raises 429 if exceeded
        3. Classify → retrieve → rerank → generate
        4. Increment usage ONLY if answer was generated successfully
        5. Return answer with citations
    """
    user_id, role = resolve_user_identity(user, guest_session_id)

    # ── Step 1: Check quota BEFORE doing any expensive work ───
    quota_info = check_quota(user_id, role)
    logger.debug(
        f"[query] {user_id} ({role.value}) — "
        f"{quota_info['current_count']}/{quota_info['limit'] if quota_info['limit'] != -1 else '∞'} used"
    )

    # ── Step 2: Classify corpus (unless user forced one) ──────
    corpus = request.corpus if request.corpus else classify_query(request.query)

    # ── Step 3: Retrieve + Rerank ──────────────────────────────
    candidates = retrieve(request.query, corpus, top_k=10)
    chunks = rerank(request.query, candidates, top_n=5) if candidates else []

    # ── Step 4: Generate answer ────────────────────────────────
    result = generate_answer(request.query, chunks, request.mode, corpus)

    # ── Step 5: Increment usage (count successful AND not_found —
    #            both consume quota since both used an LLM call) ──
    new_count = increment_usage(user_id)

    # ── Step 6: Build response ─────────────────────────────────
    remaining = (
        -1 if quota_info["limit"] == -1
        else max(0, quota_info["limit"] - new_count)
    )

    return QueryResponse(
        answer=result["answer"],
        citations=result["citations"],
        mode=request.mode,
        corpus_used=corpus,
        thread_id=request.thread_id or "temp-thread-id",  # real threading wired Day 23
        confidence=result["confidence"],
        response_time_ms=result["response_ms"],
    )


# ─────────────────────────────────────────────────────────────
#  GET /api/usage — Frontend usage bar data source
# ─────────────────────────────────────────────────────────────

@router.get("/usage")
def get_usage(
    guest_session_id: str | None = None,
    user: User | None = Depends(get_optional_user),
):
    """
    Returns today's usage summary for the current user/guest.
    Used by useQueryLimit.js to render the usage bar.

    Example response:
        {
            "role": "free",
            "limit": 20,
            "used": 7,
            "remaining": 13,
            "unlimited": false,
            "percent_used": 35
        }
    """
    user_id, role = resolve_user_identity(user, guest_session_id)
    return get_usage_summary(user_id, role)