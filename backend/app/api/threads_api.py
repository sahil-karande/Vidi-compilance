"""
RegIQ — backend/app/api/threads_api.py
Day 29 Task: Production Supabase Thread Persistence Router
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from postgrest.exceptions import APIError # type: ignore

from app.models.thread import Thread, ThreadCreate, ThreadSummary
from app.models.user import User
from app.api.auth import get_current_user, get_supabase_admin

router = APIRouter()


@router.get("/threads", response_model=List[ThreadSummary])
def list_threads(current_user: User = Depends(get_current_user)):
    """
    Fetches all active regulatory compliance session threads belonging to the authenticated user.
    Ordered by the most recently updated to keep current workspaces at the top.
    """
    admin_client = get_supabase_admin()
    try:
        response = (
            admin_client.table("threads")
            .select("id, user_id, title, corpus_tags, created_at, updated_at")
            .eq("user_id", current_user.user_id)
            .order("updated_at", descending=True)
            .execute()
        )
        return response.data or []
    except APIError as db_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch saved session lists from Supabase: {db_err.message}"
        )


@router.post("/threads", response_model=Thread)
def create_thread(payload: ThreadCreate, current_user: User = Depends(get_current_user)):
    """
    Creates a new regulatory chat thread context row inside Supabase profiles table.
    Title fallback initialization happens before dynamic first-query auto-naming runs.
    """
    admin_client = get_supabase_admin()
    
    initial_title = payload.title if payload.title and payload.title.strip() else "New Compliance Session"
    
    thread_data = {
        "user_id": current_user.user_id,
        "title": initial_title,
        "corpus_tags": payload.corpus_tags or []
    }
    
    try:
        response = admin_client.table("threads").insert(thread_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize workspace record in Supabase storage."
            )
        return response.data[0]
    except APIError as db_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database constraint error during session layout construction: {db_err.message}"
        )


@router.get("/threads/{thread_id}", response_model=Thread)
def get_thread(thread_id: str, current_user: User = Depends(get_current_user)):
    """
    Fetches details of a single distinct compliance session log.
    Validates ownership to strictly avoid cross-tenant information disclosure.
    """
    admin_client = get_supabase_admin()
    try:
        response = admin_client.table("threads").select("*").eq("id", thread_id).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested compliance thread context could not be located."
            )
            
        thread_record = response.data[0]
        if thread_record.get("user_id") != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: You do not have permissions to view this thread."
            )
            
        return thread_record
    except APIError as db_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backend retrieval layer error: {db_err.message}"
        )


@router.delete("/threads/{thread_id}")
def delete_thread(thread_id: str, current_user: User = Depends(get_current_user)):
    """
    Permanently purges a specific session thread and its downstream message cascades.
    Verifies tenant isolation requirements prior to executing transaction.
    """
    admin_client = get_supabase_admin()
    try:
        # Check ownership prior to mutation layers
        verify_res = admin_client.table("threads").select("user_id").eq("id", thread_id).execute()
        if not verify_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thread not found."
            )
            
        if verify_res.data[0].get("user_id") != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Cannot delete items belonging to another user space."
            )
        
        # Cascading drop execution via primary key mapping
        admin_client.table("threads").delete().eq("id", thread_id).execute()
        return {"deleted": True, "thread_id": thread_id}
        
    except APIError as db_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear database logs successfully: {db_err.message}"
        )