"""
RegIQ — backend/app/rag/llama_router.py
Day 54: LlamaIndex RouterQueryEngine Wrapper

Wraps existing persistent ChromaDB collections (RBI, SEBI, GST, MCA, FEMA, user_docs)
using LlamaIndex's RouterQueryEngine for intelligent, semantic corpus selection.

Key Architecture Properties:
  • Non-invasive wrapper: Zero modifications to pipeline/ or existing RAG files.
  • Connects to existing ChromaDB collections created by the RegIQ ingestion pipeline.
  • Uses identical 384-dimensional dense embeddings (sentence-transformers/all-MiniLM-L6-v2).
  • Configures rich domain-specific QueryEngineTools for each Indian regulatory authority.
  • Supports both single-corpus (LLMSingleSelector) and multi-corpus (LLMMultiSelector) routing.
  • Converts retrieved LlamaIndex nodes directly into RegIQ RetrievedChunk dataclasses
    for 100% interop with reranker.py and generator.py.
  • Full LangFuse @observe tracing on routing and retrieval steps.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, List, Optional, Dict

from loguru import logger

# ─────────────────────────────────────────────────────────────
#  Safe LangFuse import (v4+ compatible with no-op fallback)
# ─────────────────────────────────────────────────────────────
try:
    from langfuse.decorators import observe, langfuse_context
except ImportError:
    try:
        from langfuse import observe
        try:
            from langfuse._context import langfuse_context
        except ImportError:
            langfuse_context = None
    except ImportError:
        import functools
        def observe(name=None, **kwargs):
            def decorator(fn):
                @functools.wraps(fn)
                def wrapper(*args, **kw):
                    return fn(*args, **kw)
                return wrapper
            return decorator if callable(name) is False else decorator(name)
        langfuse_context = None

# RegIQ Internal Imports
from app.config import settings
from app.rag.retriever import (
    get_chroma_client,
    RetrievedChunk,
    DEFAULT_TOP_K,
    VECTORDB_DIR,
)

# ─────────────────────────────────────────────────────────────
#  LlamaIndex Imports (Defensive / Lazy)
# ─────────────────────────────────────────────────────────────
try:
    from llama_index.core import (
        VectorStoreIndex,
        StorageContext,
        Settings as LlamaSettings,
    )
    from llama_index.core.tools import QueryEngineTool, ToolMetadata
    from llama_index.core.query_engine import RouterQueryEngine
    from llama_index.core.selectors import (
        LLMSingleSelector,
        LLMMultiSelector,
        PydanticSingleSelector,
        PydanticMultiSelector,
    )
    from llama_index.core.schema import NodeWithScore
    from llama_index.core.base.embeddings.base import BaseEmbedding
    from llama_index.vector_stores.chroma import ChromaVectorStore
    LLAMA_INDEX_AVAILABLE = True
except ImportError as e:
    logger.warning(f"[llama_router] LlamaIndex packages not fully available: {e}")
    BaseEmbedding = object
    LLAMA_INDEX_AVAILABLE = False


# ─────────────────────────────────────────────────────────────
#  In-Memory Embedding Adapter (Reuses existing SentenceTransformer)
# ─────────────────────────────────────────────────────────────

class RegIQEmbeddingAdapter(BaseEmbedding if LLAMA_INDEX_AVAILABLE else object):
    """
    Adapter that integrates RegIQ's cached SentenceTransformer('all-MiniLM-L6-v2')
    into LlamaIndex's BaseEmbedding contract.
    Guarantees 100% vector dimension (384-dim) & normalization match without
    re-downloading model weights.
    """

    def _get_query_embedding(self, query: str) -> List[float]:
        from app.rag.retriever import get_embedding_model
        model = get_embedding_model()
        return model.encode(query, normalize_embeddings=True).tolist()

    def _get_text_embedding(self, text: str) -> List[float]:
        from app.rag.retriever import get_embedding_model
        model = get_embedding_model()
        return model.encode(text, normalize_embeddings=True).tolist()

    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        from app.rag.retriever import get_embedding_model
        model = get_embedding_model()
        return model.encode(texts, normalize_embeddings=True).tolist()

    async def _aget_query_embedding(self, query: str) -> List[float]:
        return self._get_query_embedding(query)

    async def _aget_text_embedding(self, text: str) -> List[float]:
        return self._get_text_embedding(text)



# ─────────────────────────────────────────────────────────────
#  Corpus Metadata & Tool Specifications
# ─────────────────────────────────────────────────────────────

CORPUS_SPECS: Dict[str, Dict[str, str]] = {
    "rbi": {
        "name": "rbi_regulatory_engine",
        "description": (
            "Use for queries regarding the Reserve Bank of India (RBI), banking regulations, "
            "Master Directions, notifications, NBFC compliance, KYC / AML norms, Priority Sector Lending (PSL), "
            "monetary policy, repo rates, digital lending, credit control, and banking prudential guidelines."
        ),
    },
    "sebi": {
        "name": "sebi_regulatory_engine",
        "description": (
            "Use for queries regarding the Securities and Exchange Board of India (SEBI), capital markets, "
            "stock exchanges, listed companies, LODR disclosures, ICDR issuances, Prohibition of Insider Trading (PIT), "
            "takeover norms (SAST), mutual funds, brokers, and securities compliance."
        ),
    },
    "gst": {
        "name": "gst_regulatory_engine",
        "description": (
            "Use for queries regarding Goods and Services Tax (GST), CGST, SGST, IGST statutory compliance, "
            "Input Tax Credit (ITC) rules, eligibility and reversal, Reverse Charge Mechanism (RCM), "
            "GST returns (GSTR-1, GSTR-3B), e-way bills, tax invoicing, and GST Council circulars."
        ),
    },
    "mca": {
        "name": "mca_regulatory_engine",
        "description": (
            "Use for queries regarding the Ministry of Corporate Affairs (MCA), Companies Act 2013, "
            "company incorporation, board of directors, DIN, ROC annual filings (AOC-4, MGT-7), "
            "Corporate Social Responsibility (CSR) spending, secretarial standards, and corporate governance."
        ),
    },
    "fema": {
        "name": "fema_regulatory_engine",
        "description": (
            "Use for queries regarding Foreign Exchange Management Act (FEMA), cross-border remittances, "
            "Foreign Direct Investment (FDI), Overseas Direct Investment (ODI), External Commercial Borrowings (ECB), "
            "Liberalised Remittance Scheme (LRS), and international trade foreign exchange rules."
        ),
    },
    "user_docs": {
        "name": "user_documents_engine",
        "description": (
            "Use ONLY for queries specifically asking about user-uploaded custom files, uploaded contracts, "
            "internal enterprise company agreements, proprietary NDAs, or user-uploaded policy documents."
        ),
    },
}


# ─────────────────────────────────────────────────────────────
#  Structured Router Output
# ─────────────────────────────────────────────────────────────

@dataclass
class LlamaRouterResult:
    """Structured result from LlamaIndex RouterQueryEngine execution."""
    answer: str
    selected_corpora: List[str]
    chunks: List[RetrievedChunk]
    source_nodes: List[Dict[str, Any]] = field(default_factory=list)
    latency_ms: float = 0.0
    router_mode: str = "llama_index_router"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "answer": self.answer,
            "selected_corpora": self.selected_corpora,
            "chunks_count": len(self.chunks),
            "chunks": [c.to_dict() for c in self.chunks],
            "latency_ms": round(self.latency_ms, 2),
            "router_mode": self.router_mode,
        }


# ─────────────────────────────────────────────────────────────
#  LLM Provider Factory for LlamaIndex
# ─────────────────────────────────────────────────────────────

def get_llama_llm():
    """
    Initializes a compatible LlamaIndex LLM instance based on available keys:
    1. Groq (llama-3.3-70b-versatile or llama3-70b-8192)
    2. Google Gemini (gemini-1.5-flash)
    3. Fallback / Mock
    """
    groq_key = getattr(settings, "groq_api_key", "") or os.getenv("GROQ_API_KEY", "")
    gemini_key = getattr(settings, "gemini_api_key", "") or os.getenv("GEMINI_API_KEY", "")

    if groq_key:
        try:
            from llama_index.llms.groq import Groq
            logger.info("[llama_router] Using Groq LLM for router selector (openai/gpt-oss-120b)")
            return Groq(model="openai/gpt-oss-120b", api_key=groq_key)
        except Exception as e:
            logger.warning(f"[llama_router] Failed to init Groq LLM: {e}")

    if gemini_key:
        try:
            from llama_index.llms.gemini import Gemini
            logger.info("[llama_router] Using Gemini LLM for router selector")
            return Gemini(model="models/gemini-1.5-flash", api_key=gemini_key)
        except Exception as e:
            logger.warning(f"[llama_router] Failed to init Gemini LLM: {e}")

    logger.warning("[llama_router] No dedicated LLM key configured for LlamaIndex; routing may use defaults.")
    return None


# ─────────────────────────────────────────────────────────────
#  LlamaCorpusRouter Class
# ─────────────────────────────────────────────────────────────

class LlamaCorpusRouter:
    """
    Wraps existing ChromaDB regulatory collections into LlamaIndex
    VectorStoreIndex tools and orchestrates routing via RouterQueryEngine.
    """

    def __init__(self, top_k: int = DEFAULT_TOP_K):
        if not LLAMA_INDEX_AVAILABLE:
            raise RuntimeError(
                "LlamaIndex packages are not installed. "
                "Run: pip install llama-index-core llama-index-vector-stores-chroma llama-index-embeddings-huggingface"
            )

        self.top_k = top_k
        self.chroma_client = get_chroma_client()
        self._init_embedding_model()
        self._init_llm()
        self._indices: Dict[str, VectorStoreIndex] = {}
        self._query_engines: Dict[str, Any] = {}
        self._tools: List[QueryEngineTool] = []
        self._tool_to_corpus: Dict[str, str] = {}
        self._build_tools()
        self._init_router_engine()

    def _init_embedding_model(self):
        """Configure RegIQEmbeddingAdapter matching all-MiniLM-L6-v2 (384-dim)."""
        logger.info("[llama_router] Connecting RegIQ in-memory embedding model (all-MiniLM-L6-v2)...")
        self.embed_model = RegIQEmbeddingAdapter()
        LlamaSettings.embed_model = self.embed_model


    def _init_llm(self):
        """Configure default LLM for router selectors."""
        self.llm = get_llama_llm()
        if self.llm:
            LlamaSettings.llm = self.llm

    def _build_tools(self):
        """Build VectorStoreIndex and QueryEngineTool for all existing collections."""
        try:
            all_collections = self.chroma_client.list_collections()
            existing_names = {c.name for c in all_collections}
        except Exception as e:
            logger.error(f"[llama_router] Error listing ChromaDB collections: {e}")
            existing_names = set()

        logger.info(f"[llama_router] Found existing collections in ChromaDB: {existing_names}")

        for corpus_key, spec in CORPUS_SPECS.items():
            # Check if this standard collection or a matching prefixed collection exists
            target_col_name = None
            if corpus_key in existing_names:
                target_col_name = corpus_key
            elif corpus_key == "user_docs":
                # Find any user_docs_* collection if available
                user_cols = [c for c in existing_names if c.startswith("user_docs")]
                if user_cols:
                    target_col_name = user_cols[0]

            if not target_col_name:
                logger.debug(f"[llama_router] Collection for '{corpus_key}' not present yet in ChromaDB, skipping.")
                continue

            try:
                chroma_col = self.chroma_client.get_collection(target_col_name)
                if chroma_col.count() == 0:
                    logger.debug(f"[llama_router] Collection '{target_col_name}' has 0 chunks, skipping tool creation.")
                    continue

                vector_store = ChromaVectorStore(chroma_collection=chroma_col)
                storage_context = StorageContext.from_defaults(vector_store=vector_store)
                index = VectorStoreIndex.from_vector_store(
                    vector_store=vector_store,
                    storage_context=storage_context,
                    embed_model=self.embed_model,
                )
                self._indices[corpus_key] = index

                # Create query engine with similarity_top_k
                query_engine = index.as_query_engine(similarity_top_k=self.top_k)
                self._query_engines[corpus_key] = query_engine

                tool = QueryEngineTool(
                    query_engine=query_engine,
                    metadata=ToolMetadata(
                        name=spec["name"],
                        description=spec["description"],
                    ),
                )
                self._tools.append(tool)
                self._tool_to_corpus[spec["name"]] = corpus_key
                logger.info(f"[llama_router] Registered QueryEngineTool: {spec['name']} ({chroma_col.count()} docs)")

            except Exception as e:
                logger.warning(f"[llama_router] Failed to create index for '{corpus_key}': {e}")

    def _init_router_engine(self):
        """Constructs the RouterQueryEngine with single and multi selectors."""
        if not self._tools:
            logger.warning("[llama_router] No valid tools found; RouterQueryEngine will be inactive.")
            self.router_single = None
            self.router_multi = None
            return

        try:
            # Single selector for specific single-domain questions
            selector_single = (
                PydanticSingleSelector.from_defaults(llm=self.llm)
                if self.llm
                else LLMSingleSelector.from_defaults()
            )
            self.router_single = RouterQueryEngine(
                selector=selector_single,
                query_engine_tools=self._tools,
                verbose=True,
            )

            # Multi selector for cross-domain queries (e.g. GST + FEMA)
            selector_multi = (
                PydanticMultiSelector.from_defaults(llm=self.llm)
                if self.llm
                else LLMMultiSelector.from_defaults()
            )
            self.router_multi = RouterQueryEngine(
                selector=selector_multi,
                query_engine_tools=self._tools,
                verbose=True,
            )
            logger.info(f"[llama_router] RouterQueryEngine initialized with {len(self._tools)} tools.")
        except Exception as e:
            logger.error(f"[llama_router] Error creating RouterQueryEngine: {e}")
            self.router_single = None
            self.router_multi = None

    # ─────────────────────────────────────────────────────────
    #  Routing & Retrieval APIs
    # ─────────────────────────────────────────────────────────

    @observe(name="llama_router_route_only")
    def route_only(self, query: str, multi: bool = False) -> List[str]:
        """
        Uses the selector to classify and pick the appropriate regulatory corpus
        names WITHOUT running full answer generation.
        """
        if not self._tools:
            logger.warning("[llama_router] No tools available for routing")
            return []

        router = self.router_multi if multi else self.router_single
        if not router:
            return []

        try:
            selector_result = router._selector.select(
                [t.metadata for t in self._tools],
                query=query,
            )
            selected_indices = getattr(selector_result, "selections", [])
            selected_corpora = []
            for sel in selected_indices:
                idx = getattr(sel, "index", None)
                if idx is not None and idx < len(self._tools):
                    tool_name = self._tools[idx].metadata.name
                    corpus_key = self._tool_to_corpus.get(tool_name, tool_name)
                    selected_corpora.append(corpus_key)
            return selected_corpora
        except Exception as e:
            logger.warning(f"[llama_router] route_only failed: {e}")
            return []

    def _node_to_chunk(self, node_with_score: Any, fallback_corpus: str = "general") -> RetrievedChunk:
        """Converts a LlamaIndex NodeWithScore to RegIQ RetrievedChunk."""
        node = node_with_score.node
        score = float(getattr(node_with_score, "score", 0.0) or 0.0)
        meta = getattr(node, "metadata", {}) or {}

        corpus = meta.get("corpus", fallback_corpus)
        chunk_id = getattr(node, "node_id", "") or meta.get("chunk_id", "")
        text = node.get_content() if hasattr(node, "get_content") else str(node)

        return RetrievedChunk(
            chunk_id=chunk_id,
            text=text,
            similarity=score,
            corpus=corpus,
            circular_no=meta.get("circular_no", "unknown"),
            date=meta.get("date", "unknown"),
            title=meta.get("title", ""),
            filename=meta.get("filename", ""),
            url=meta.get("url", ""),
            chunk_index=int(meta.get("chunk_index", 0)),
            total_chunks=int(meta.get("total_chunks", 1)),
            extraction_method=meta.get("extraction_method", "llama_index"),
        )

    @observe(name="llama_router_retrieve")
    def retrieve_chunks(
        self,
        query: str,
        corpus: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> List[RetrievedChunk]:
        """
        Retrieves top-K chunks from a specific corpus index or automatically
        routes using the selector, returning standardized RetrievedChunk objects.
        """
        k = top_k or self.top_k

        # If a specific corpus is requested, query its index directly
        if corpus and corpus in self._indices:
            retriever = self._indices[corpus].as_retriever(similarity_top_k=k)
            nodes = retriever.retrieve(query)
            return [self._node_to_chunk(n, fallback_corpus=corpus) for n in nodes]

        # Automatic routing across all tools
        selected = self.route_only(query)
        target_corpus = selected[0] if selected else "rbi"

        if target_corpus in self._indices:
            retriever = self._indices[target_corpus].as_retriever(similarity_top_k=k)
            nodes = retriever.retrieve(query)
            return [self._node_to_chunk(n, fallback_corpus=target_corpus) for n in nodes]

        return []

    @observe(name="llama_router_query")
    def query(self, query: str, multi: bool = False) -> LlamaRouterResult:
        """
        Full end-to-end execution of the RouterQueryEngine:
        Routes query -> Retrieves chunks -> Synthesizes response.
        """
        start_time = time.perf_counter()

        router = self.router_multi if multi else self.router_single
        if not router:
            return LlamaRouterResult(
                answer="RouterQueryEngine not available or no collections loaded.",
                selected_corpora=[],
                chunks=[],
                latency_ms=0.0,
            )

        try:
            response = router.query(query)
            latency_ms = (time.perf_counter() - start_time) * 1000

            # Extract source nodes and convert to RetrievedChunks
            source_nodes = getattr(response, "source_nodes", [])
            chunks = [self._node_to_chunk(n) for n in source_nodes]

            # Detect which corpora provided chunks
            corpora_used = list(dict.fromkeys(c.corpus for c in chunks))

            return LlamaRouterResult(
                answer=str(response),
                selected_corpora=corpora_used,
                chunks=chunks,
                source_nodes=[
                    {
                        "node_id": getattr(n.node, "node_id", ""),
                        "score": round(float(getattr(n, "score", 0.0) or 0.0), 4),
                        "corpus": getattr(n.node, "metadata", {}).get("corpus", "unknown"),
                    }
                    for n in source_nodes
                ],
                latency_ms=latency_ms,
            )

        except Exception as e:
            latency_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"[llama_router] Query execution failed: {e}")
            return LlamaRouterResult(
                answer=f"Router query failed: {e}",
                selected_corpora=[],
                chunks=[],
                latency_ms=latency_ms,
            )


# ─────────────────────────────────────────────────────────────
#  Singleton Instance Accessor
# ─────────────────────────────────────────────────────────────

_router_instance: Optional[LlamaCorpusRouter] = None

def get_llama_router(top_k: int = DEFAULT_TOP_K) -> Optional[LlamaCorpusRouter]:
    """Returns a cached singleton of LlamaCorpusRouter."""
    global _router_instance
    if _router_instance is None:
        if not LLAMA_INDEX_AVAILABLE:
            logger.warning("[llama_router] Cannot instantiate router: LlamaIndex unavailable.")
            return None
        try:
            _router_instance = LlamaCorpusRouter(top_k=top_k)
        except Exception as e:
            logger.error(f"[llama_router] Failed to create LlamaCorpusRouter singleton: {e}")
            return None
    return _router_instance


# ─────────────────────────────────────────────────────────────
#  Standalone Runner & Verification
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    print("\n" + "=" * 65)
    print(" RegIQ — Day 54: LlamaIndex RouterQueryEngine Verification")
    print("=" * 65)

    if not LLAMA_INDEX_AVAILABLE:
        print("[FAIL] LlamaIndex packages not installed.")
        sys.exit(1)

    print("\n[1/3] Initializing LlamaCorpusRouter...")
    router = get_llama_router(top_k=3)

    if not router:
        print("[FAIL] Could not initialize LlamaCorpusRouter.")
        sys.exit(1)

    print(f"[OK] Router initialized with {len(router._tools)} active tools:")
    for tool in router._tools:
        print(f"     • {tool.metadata.name}")

    print("\n[2/3] Testing Semantic Retrieval & Chunk Mapping...")
    test_queries = [
        ("What is the mandatory CSR spending under the Companies Act?", "mca"),
        ("What are the KYC and AML master directions for NBFCs?", "rbi"),
        ("What are the provisions of Prohibition of Insider Trading regulations?", "sebi"),
    ]

    for q, expected_corpus in test_queries:
        chunks = router.retrieve_chunks(q, corpus=expected_corpus, top_k=2)
        print(f"\nQuery: '{q}'")
        print(f"Target Corpus: {expected_corpus} | Chunks Retrieved: {len(chunks)}")
        for idx, chunk in enumerate(chunks, 1):
            print(f"   [{idx}] Score: {chunk.similarity:.4f} | Circular: {chunk.circular_no} | Text: {chunk.preview(90)}")

    print("\n[3/3] Testing End-to-End Query Routing...")
    sample_query = "What are the rules for corporate social responsibility under Companies Act?"
    print(f"Query: '{sample_query}'")
    result = router.query(sample_query)
    print(f"Selected Corpora : {result.selected_corpora}")
    print(f"Latency          : {result.latency_ms:.2f} ms")
    print(f"Chunks Count     : {len(result.chunks)}")
    print(f"Answer Preview   : {result.answer[:180]}...")

    print("\n" + "=" * 65)
    print(" [SUCCESS] Day 54 LlamaIndex RouterQueryEngine test complete!")
    print("=" * 65 + "\n")
