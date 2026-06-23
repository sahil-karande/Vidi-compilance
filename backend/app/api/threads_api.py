"""
Vidi — backend/app/api/threads.py
Day 16 Task: /threads endpoint stub

Returns empty responses for now.
Wired to Supabase in Week 4 (Day 23).
"""

from fastapi import APIRouter
from app.models.thread import Thread, ThreadCreate, ThreadSummary

router = APIRouter()


@router.get("/threads", response_model=list[ThreadSummary])
def list_threads():
    """List all chat threads for the current user. (Stub — wired to Supabase Day 23)"""
    return []


@router.post("/threads", response_model=Thread)
def create_thread(payload: ThreadCreate):
    """Create a new chat thread. (Stub — wired to Supabase Day 23)"""
    return Thread(
        id="stub-thread-id",
        user_id="stub-user-id",
        title=payload.title,
        corpus_tags=payload.corpus_tags,
    )


@router.get("/threads/{thread_id}", response_model=Thread)
def get_thread(thread_id: str):
    """Get a thread with all its messages. (Stub — wired to Supabase Day 23)"""
    return Thread(
        id=thread_id,
        user_id="stub-user-id",
        title="Stub Thread",
    )


@router.delete("/threads/{thread_id}")
def delete_thread(thread_id: str):
    """Delete a thread. (Stub — wired to Supabase Day 23)"""
    return {"deleted": True, "thread_id": thread_id}