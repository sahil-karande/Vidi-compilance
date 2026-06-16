from fastapi import APIRouter, Depends, HTTPException
from app.rag.classifier import QueryClassifier
from app.rag.retriever import ChromaRetriever
from app.rag.reranker import CrossEncoderReranker
from app.rag.generator import RAGGenerator
from app.api.auth import get_current_user # custom JWT dependency

router = APIRouter()

# Instantiate core architectural nodes
classifier = QueryClassifier()
retriever = ChromaRetriever()
reranker = CrossEncoderReranker()
generator = RAGGenerator()

@router.post("/query")
async def handle_compliance_query(payload: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    user_query = payload.get("query")
    ui_mode = payload.get("mode", "plain") # default to 'plain'
    
    # 1. Routing classification
    target_corpus = classifier.classify(user_query)
    
    # 2. Vector database retrieval
    raw_chunks = retriever.retrieve(query=user_query, namespace=target_corpus)
    
    # 3. Cross-Encoder reranking
    refined_chunks = reranker.rerank(query=user_query, chunks=raw_chunks)
    
    # 4. LLM Generation
    generation_payload = await generator.generate_answer(
        query=user_query, 
        chunks=refined_chunks, 
        mode=ui_mode
    )
    
    # This exactly matches your frontend's dynamic expectations
    return generation_payload