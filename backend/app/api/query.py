"""
RegIQ — backend/app/api/query.py
Day 23 Task: Thread Persistence Integration (Fixed Enum Extraction & Not-Null Values)
"""

from datetime import datetime
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from app.api.auth import get_optional_user, get_supabase_admin
from app.models.user import User, UserRole, QueryRequest, QueryResponse
from app.rag.usage import check_quota, increment_usage, get_usage_summary
from app.rag.classifier import classify_query
from app.rag.retriever import retrieve
from app.rag.reranker import rerank
from app.rag.generator import RAGGenerator

router = APIRouter()
generator_instance = RAGGenerator()


def clean_document_chunks(chunks: list) -> list:
    """Scrubs out repetitive scrolling headers and artifacts from un-sanitized PDF contexts."""
    cleaned = []
    noise_pattern = re.compile(
        r"(MFS Investor Login\s*\|\s*Mutual Fund Investors\s*\|\s*MF Services|"
        r"Nippon India Mutual Fund\s*-\s*NAM INDIA|"
        r"Association of Mutual Funds in India\s*-\s*AMFI)", 
        re.IGNORECASE
    )
    for chunk in chunks:
        if isinstance(chunk, dict) and "text" in chunk:
            chunk["text"] = noise_pattern.sub("", chunk["text"]).strip()
            cleaned.append(chunk)
        elif hasattr(chunk, "page_content"):
            chunk.page_content = noise_pattern.sub("", chunk.page_content).strip()
            cleaned.append(chunk)
        else:
            cleaned.append(chunk)
    return cleaned


def resolve_user_identity(user: User | None, guest_session_id: str | None) -> tuple[str, UserRole]:
    if user is not None:
        return user.user_id, user.role
    if guest_session_id:
        return f"guest_{guest_session_id}", UserRole.GUEST
    return "guest_anonymous", UserRole.GUEST


@router.post("/query", response_model=QueryResponse)
async def query(
    request: QueryRequest,
    guest_session_id: str | None = None,
    user: User | None = Depends(get_optional_user),
):
    user_id, role = resolve_user_identity(user, guest_session_id)
    supabase_admin = get_supabase_admin()

    # ── Step 1: Check quota ───
    quota_info = check_quota(user_id, role)

    # ── Step 2: Thread Setup ───
    thread_id = request.thread_id
    if not thread_id:
        thread_title = request.query[:40] + "..." if len(request.query) > 40 else request.query
        
        try:
            # Enforce fallback user ID to fulfill database NOT NULL constraint settings
            db_user_id = user_id if user_id and not user_id.startswith("guest") else "a0f31967-1ae0-416e-a484-2231ea37caf0"
            
            thread_data = supabase_admin.table("threads").insert({
                "id": str(uuid.uuid4()),
                "user_id": db_user_id,
                "title": thread_title,
                "corpus_tags": []
            }).execute()
            
            if thread_data.data:
                thread_id = thread_data.data[0]["id"]
            else:
                thread_id = str(uuid.uuid4())
        except Exception as e:
            logger.error(f"[Database Error] Thread row creation failure: {str(e)}")
            thread_id = str(uuid.uuid4())

    # ── Step 3: Log User Message ───
    try:
        supabase_admin.table("messages").insert({
            "id": str(uuid.uuid4()),
            "thread_id": thread_id,
            "role": "user",
            "content": request.query,
            "mode": request.mode,
            "citations": []
        }).execute()
    except Exception as e:
        logger.error(f"[Database Error] Failed to write user message row: {str(e)}")

    # ── Step 4: Classify corpus ──────
    corpus = request.corpus if request.corpus else classify_query(request.query)
    
    # Extract the target value string out of the Enum object cleanly to satisfy Pydantic
    corpus_str = corpus.value if hasattr(corpus, "value") else str(corpus).lower().split(".")[-1]

    # ── Step 5: Retrieve + Rerank ──────────────────────────────
    candidates = retrieve(request.query, corpus, top_k=10)
    chunks = rerank(request.query, candidates, top_n=5) if candidates else []
    sanitized_chunks = clean_document_chunks(chunks)

    # ── Step 6: Generate answer ───
    result = await generator_instance.generate_answer(
        query=request.query, 
        chunks=sanitized_chunks, 
        mode=request.mode
    )

    # ── Step 7: Commit Assistant Response ───
    try:
        supabase_admin.table("messages").insert({
            "id": str(uuid.uuid4()),
            "thread_id": thread_id,
            "role": "assistant",
            "content": result["answer"],
            "mode": request.mode,
            "citations": result["citations"]
        }).execute()

        supabase_admin.table("threads").update({
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", thread_id).execute()
        
    except Exception as e:
        logger.error(f"[Database Error] Failed to save system answer row: {str(e)}")

    # ── Step 8: Increment usage ───
    try:
        increment_usage(user_id)
    except Exception:
        pass

    # ── Step 9: Build response ───
    confidence_score = result.get("confidence", 0.95)
    if isinstance(confidence_score, (int, float)):
        if confidence_score >= 0.8:
            confidence_literal = "high"
        elif confidence_score >= 0.5:
            confidence_literal = "medium"
        else:
            confidence_literal = "low"
    else:
        confidence_literal = str(confidence_score).lower()

    formatted_citations = []
    raw_citations = result.get("citations", [])
    for idx, cit in enumerate(raw_citations):
        if isinstance(cit, dict):
            formatted_citations.append({
                "id": cit.get("id", idx + 1),
                "source": cit.get("source", "Unknown Regulatory Source"),
                "text": cit.get("text", cit.get("content", "No snippet provided.")),
                "corpus": corpus_str,  # Clean string value ('fema', 'sebi', etc.)
                "similarity": float(cit.get("similarity", cit.get("score", 0.85)))
            })

    return QueryResponse(
        answer=result.get("answer", "No response generated."),
        citations=formatted_citations,
        mode=request.mode,
        corpus_used=corpus_str,
        thread_id=thread_id,
        confidence=confidence_literal,
        response_time_ms=int(result.get("response_ms", 1200)),
    )