import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

# Import Core RAG Pipeline Pillars
from app.rag.classifier import QueryClassifier
from app.rag.retriever import ChromaRetriever
from app.rag.reranker import CrossEncoderReranker
from app.rag.generator import RAGGenerator

# Import Security Guard
from app.api.auth import get_current_user

logger = logging.getLogger("regiq.query")
router = APIRouter()

# Instantiate singletons for runtime efficiency
classifier = QueryClassifier()
retriever = ChromaRetriever()
reranker = CrossEncoderReranker()
generator = RAGGenerator()

@router.post("/query")
async def handle_compliance_query(
    payload: Dict[str, Any], 
    current_user: Dict = Depends(get_current_user)
):
    """
    Production RAG Pipeline Execution Loop:
    Extracts query -> Classifies namespace -> Retrieves -> Reranks -> Generates via LLM.
    """
    user_query = payload.get("query")
    ui_mode = payload.get("mode", "plain")

    if not user_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="The request body must contain a non-empty 'query' string parameter."
        )

    try:
        # Phase 1: Topic Classification (rbi, sebi, gst, mca, etc.)
        corpus_used = classifier.classify(user_query)
        logger.info(f"User [{current_user['id']}] query routed to corpus: '{corpus_used}'")

        # Phase 2: Vector Search Retrieval
        raw_chunks = retriever.retrieve(query=user_query, namespace=corpus_used)

        # Phase 3: Cross-Encoder Reranking for context compression
        refined_chunks = reranker.rerank(query=user_query, chunks=raw_chunks)

        # Phase 4: Context-Grounded LLM Answer Generation
        generation_payload = await generator.generate_answer(
            query=user_query, 
            chunks=refined_chunks, 
            mode=ui_mode
        )

        # Build production response wrapper
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