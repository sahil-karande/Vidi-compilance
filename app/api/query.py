import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

# Import Core RAG Pipeline Elements — Clean procedural matching
from app.rag.classifier import classify_query  
from app.rag.retriever import retrieve          
from app.rag.reranker import rerank            # <-- Directly importing your plain function!
from app.rag.generator import RAGGenerator

# Import Security Guard Bypass Node
from app.api.auth import get_current_user

logger = logging.getLogger("regiq.query")
router = APIRouter()

# Instantiate only the active generator class
generator = RAGGenerator()

@router.post("/query")
async def handle_compliance_query(
    payload: Dict[str, Any], 
    current_user: Dict = Depends(get_current_user)
):
    """
    Production RAG Pipeline Execution Loop:
    Extracts query -> Runs keyword/embedding classifier -> Retrieves -> Reranks -> Generates via LLM.
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
        
        logger.info(f"User [{current_user['id']}] query routed to corpus namespace: '{corpus_used}'")

        # Phase 2: Vector Search Retrieval
        # This calls your native retrieve function and hands back a list of RetrievedChunk dataclasses!
        raw_chunks = retrieve(query=user_query, corpus=corpus_used)

        # Phase 3: Cross-Encoder Reranking
        # Your rerank function naturally handles the list of RetrievedChunk objects and filters them
        reranked_chunks = rerank(query=user_query, chunks=raw_chunks, top_n=5)

        # Transform your processed RetrievedChunk instances into the exact dictionary layout 
        # that your modern RAGGenerator expects to construct system contexts
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

        # Phase 4: Context-Grounded LLM Answer Generation (Gemini 2.5 Flash)
        generation_payload = await generator.generate_answer(
            query=user_query, 
            chunks=generator_input_chunks, 
            mode=ui_mode
        )

        # Return comprehensive production payload wrapper back to the frontend drawer
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