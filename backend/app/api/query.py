"""
RegIQ — backend/app/api/query.py
Day 23 Task: Thread Persistence Integration

Full RAG pipeline + query limit enforcement + database message saving:
    1. Check quota (Guest ≤3/day, Free ≤20/day, Pro unlimited)
    2. Manage Thread ID (auto-create thread if request.thread_id is absent)
    3. Save user message to database
    4. classifier → retriever → reranker → generator
    5. Save assistant reply + citations to database on success
    6. Touch thread 'updated_at' timestamp
    7. Increment usage count and return final schema
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from app.api.auth import get_optional_user
from app.models.user import User, UserRole, QueryRequest, QueryResponse
from app.rag.usage import check_quota, increment_usage, get_usage_summary
from app.rag.classifier import classify_query
from app.rag.retriever import retrieve
from app.rag.reranker import rerank
from app.rag.generator import generate_answer

# Import your configured live Supabase client wrapper
from lib.supabaseClient import supabase 

router = APIRouter()


# ─────────────────────────────────────────────────────────────
#  Helper: resolve a user_id even for Guests
# ─────────────────────────────────────────────────────────────
def resolve_user_identity(user: User | None, guest_session_id: str | None) -> tuple[str, UserRole]:
    if user is not None:
        return user.user_id, user.role

    if guest_session_id:
        return f"guest_{guest_session_id}", UserRole.GUEST

    return "guest_anonymous", UserRole.GUEST


# ─────────────────────────────────────────────────────────────
#  POST /api/query — Main RAG endpoint with persistence
# ─────────────────────────────────────────────────────────────
@router.post("/query", response_model=QueryResponse)
def query(
    request: QueryRequest,
    guest_session_id: str | None = None,
    user: User | None = Depends(get_optional_user),
):
    user_id, role = resolve_user_identity(user, guest_session_id)

    # ── Step 1: Check quota BEFORE doing any expensive work ───
    quota_info = check_quota(user_id, role)
    logger.debug(
        f"[query] {user_id} ({role.value}) — "
        f"{quota_info['current_count']}/{quota_info['limit'] if quota_info['limit'] != -1 else '∞'} used"
    )

    # ── Step 2: Thread Setup (Create thread row if thread_id is missing) ───
    thread_id = request.thread_id
    if not thread_id:
        # Generate a short default name based on the query text
        thread_title = request.query[:40] + "..." if len(request.query) > 40 else request.query
        try:
            # Note: For guests, user_id might be 'guest_sessionid' string. 
            # If your Supabase profile user_id column has a strict foreign key UUID constraint, 
            # ensure your database structure handles guest threads or leave user_id as NULL for guests.
            db_user_id = user_id if role != UserRole.GUEST else None
            
            thread_data = supabase.table("threads").insert({
                "user_id": db_user_id,
                "title": thread_title,
                "corpus_tags": []
            }).execute()
            
            if thread_data.data:
                thread_id = thread_data.data[0]["id"]
            else:
                raise HTTPException(status_code=500, detail="Failed to create a persistent thread row.")
        except Exception as e:
            logger.error(f"[Database Error] Thread instantiation failure: {str(e)}")
            raise HTTPException(status_code=500, detail="Database write failure on thread context.")

    # ── Step 3: Log incoming User Message to database ───
    try:
        supabase.table("messages").insert({
            "thread_id": thread_id,
            "role": "user",
            "content": request.query,
            "mode": request.mode,
            "citations": []
        }).execute()
    except Exception as e:
        logger.error(f"[Database Error] Failed to write user message row: {str(e)}")
        # We don't crash the whole pipeline if just logging the user message trace hits an error, 
        # but tracking is preferred.

    # ── Step 4: Classify corpus (unless user forced one) ──────
    corpus = request.corpus if request.corpus else classify_query(request.query)

    # ── Step 5: Retrieve + Rerank ──────────────────────────────
    candidates = retrieve(request.query, corpus, top_k=10)
    chunks = rerank(request.query, candidates, top_n=5) if candidates else []

    # ── Step 6: Generate answer ────────────────────────────────
    result = generate_answer(request.query, chunks, request.mode, corpus)

    # ── Step 7: Commit Assistant Response to database ───
    try:
        supabase.table("messages").insert({
            "thread_id": thread_id,
            "role": "assistant",
            "content": result["answer"],
            "mode": request.mode,
            "citations": result["citations"]
        }).execute()

        # Update the corpus tags on the thread so the graph explorer/sidebar knows what regulations were touched
        supabase.table("threads").update({
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", thread_id).execute()
        
    except Exception as e:
        logger.error(f"[Database Error] Failed to save system answer row: {str(e)}")

    # ── Step 8: Increment usage ────────────────────────────────
    new_count = increment_usage(user_id)

    # ── Step 9: Build response ─────────────────────────────────
    remaining = (
        -1 if quota_info["limit"] == -1
        else max(0, quota_info["limit"] - new_count)
    )

    return QueryResponse(
        answer=result["answer"],
        citations=result["citations"],
        mode=request.mode,
        corpus_used=corpus,
        thread_id=thread_id,  # Returning the real validated or new thread_id back to UI
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
    user_id, role = resolve_user_identity(user, guest_session_id)
    return get_usage_summary(user_id, role)