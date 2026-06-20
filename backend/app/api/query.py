"""
Vidi — backend/app/api/query.py
Updated Day 21: Integrated Query Limit Enforcement Middleware
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Dict, Any

# Import Core RAG Pipeline Elements
from app.rag.classifier import classify_query  
from app.rag.retriever import retrieve          
from app.rag.reranker import rerank            
from app.rag.generator import RAGGenerator

# Day 21 Updates: Grab optional user schema and the guard dependency
from app.api.auth import get_optional_user
from app.api.limits import check_query_limits
from app.models.user import User

logger = logging.getLogger("regiq.query")
router = APIRouter()

# Instantiate the active generator class
generator = RAGGenerator()

# Attach check_query_limits as a route-level dependency guard
@router.post("/query", dependencies=[Depends(check_query_limits)])
async def handle_compliance_query(
    request: Request,  # Added to allow underlying context tracking access
    payload: Dict[str, Any], 
    current_user: Optional[User] = Depends(get_optional_user) # Swapped to optional mode
):
    """
    Production RAG Pipeline Execution Loop with Rate Limiting:
    Extracts query -> Checks Limits -> Runs Classifier -> Retrieves -> Reranks -> Generates.
    """
    user_query = payload.get("query")
    ui_mode = payload.get("mode", "plain")

    if not user_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="The request body must contain a non-empty 'query' string parameter."
        )

    try:
        # Phase 1: Topic Classification (rbi, sebi, gst, mca, fema)
        corpus_enum = classify_query(user_query, verbose=True)
        corpus_used = corpus_enum.value  # Extracts string name ("gst", "rbi", etc.)
        
        # Log intelligently based on authentication state
        user_log_id = current_user.user_id if current_user else "Anonymous Guest"
        logger.info(f"User [{user_log_id}] query routed to corpus namespace: '{corpus_used}'")

        # Phase 2: Vector Search Retrieval
        raw_chunks = retrieve(query=user_query, corpus=corpus_used)

        # Phase 3: Cross-Encoder Reranking
        reranked_chunks = rerank(query=user_query, chunks=raw_chunks, top_n=5)

        # Transform processed chunks into layout expected by RAGGenerator
        generator_input_chunks = []
        for chunk in reranked_chunks:
            generator_input_chunks.append({
                "text": chunk.text,
                "metadata": {
                    "source": chunk.filename or "Official Portal Documents",
                    "circular_no": chunk.circular_no,
                    "date": chunk.date,
                    "section": chunk.title or "N/A",
                    "url": chunk.url or "#"
                }
            })

        # Phase 4: Context-Grounded LLM Answer Generation (Gemini)
        generation_payload = await generator.generate_answer(
            query=user_query, 
            chunks=generator_input_chunks, 
            mode=ui_mode
        )

        return {
            "answer": generation_payload["answer"],
            "citations": generation_payload["citations"],
            "mode": generation_payload["mode"],
            "corpus_used": corpus_used
        }

    except Exception as e:
        logger.error(f"Critical execution error during RAG query pipeline loop: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A technical interruption occurred inside the regulatory analysis pipeline."
        )