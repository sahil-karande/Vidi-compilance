"""
RegIQ — backend/app/rag/retriever.py
ChromaDB Retriever with LangFuse Observability
"""

import re
from pathlib import Path
from functools import lru_cache
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings
from loguru import logger
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

# Safe LangFuse import for v4+
try:
    from langfuse.decorators import observe, langfuse_context
except ImportError:
    try:
        from langfuse import observe
        from langfuse._context import langfuse_context
    except ImportError:
        from langfuse import observe
        langfuse_context = None

from app.models.user import Corpus
from app.config import settings
from app.rag.rewriter import expand_query

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

def _resolve_vectordb_dir() -> Path:
    cfg_val = getattr(settings, "vectordb_dir", "./vectordb")
    cfg_path = Path(cfg_val)
    if cfg_path.is_absolute() and cfg_path.exists():
        return cfg_path

    # Check parent directories for existing vectordb folder
    here = Path(__file__).resolve()
    for parent in here.parents:
        if parent == Path("/"):
            continue
        candidate = parent / "vectordb"
        if candidate.exists() and candidate.is_dir():
            return candidate

    # In Docker container (WORKDIR /app)
    app_candidate = Path("/app/vectordb")
    try:
        app_candidate.mkdir(parents=True, exist_ok=True)
        return app_candidate
    except Exception:
        pass

    # Current working directory
    cwd_candidate = Path.cwd() / "vectordb"
    try:
        cwd_candidate.mkdir(parents=True, exist_ok=True)
        return cwd_candidate
    except Exception:
        pass

    import tempfile
    tmp = Path(tempfile.gettempdir()) / "vidi_vectordb"
    tmp.mkdir(parents=True, exist_ok=True)
    return tmp

VECTORDB_DIR = _resolve_vectordb_dir()

DEFAULT_TOP_K = 5
RRF_K = 60  # Reciprocal Rank Fusion constant


# ─────────────────────────────────────────────────────────────
#  Result Dataclass
# ─────────────────────────────────────────────────────────────

@dataclass
class RetrievedChunk:
    """A single retrieved chunk with text + metadata + similarity score."""
    chunk_id: str
    text: str
    similarity: float
    corpus: str
    circular_no: str = "unknown"
    date: str = "unknown"
    title: str = ""
    filename: str = ""
    url: str = ""
    chunk_index: int = 0
    total_chunks: int = 1
    extraction_method: str = "unknown"
    rerank_score: float | None = field(default=None)

    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "text": self.text,
            "similarity": round(self.similarity, 4),
            "rerank_score": round(self.rerank_score, 4) if self.rerank_score is not None else None,
            "corpus": self.corpus,
            "circular_no": self.circular_no,
            "date": self.date,
            "title": self.title,
            "filename": self.filename,
            "url": self.url,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "extraction_method": self.extraction_method,
        }

    def preview(self, length: int = 200) -> str:
        text = self.text.strip()
        return text[:length] + ("..." if len(text) > length else "")


# ─────────────────────────────────────────────────────────────
#  BM25 Lexical Index
# ─────────────────────────────────────────────────────────────

@dataclass
class BM25Index:
    bm25: BM25Okapi
    chunk_ids: list[str]
    documents: list[str]
    metadatas: list[dict]


_bm25_cache: dict[str, BM25Index] = {}


def tokenize_for_bm25(text: str) -> list[str]:
    """Tokenize text preserving legal and section references (e.g. 17(5), aoc-4)."""
    return [t.lower() for t in re.findall(r"\b[a-zA-Z0-9_\-\(\)\.]+\b", text) if len(t) > 1]


def get_bm25_index(corpus_name: str) -> Optional[BM25Index]:
    """Get or lazily build in-memory BM25Okapi index for a given corpus collection."""
    if corpus_name in _bm25_cache:
        return _bm25_cache[corpus_name]

    collection = get_collection(corpus_name)
    if collection is None or collection.count() == 0:
        return None

    try:
        data = collection.get(include=["documents", "metadatas"])
        docs = data.get("documents") or []
        ids = data.get("ids") or []
        metas = data.get("metadatas") or []

        if not docs:
            return None

        tokenized_corpus = []
        for doc, meta in zip(docs, metas):
            meta_str = f"{meta.get('circular_no', '')} {meta.get('title', '')} {meta.get('section', '')} {meta.get('filename', '')}"
            full_text = f"{doc} {meta_str}"
            tokenized_corpus.append(tokenize_for_bm25(full_text))

        bm25 = BM25Okapi(tokenized_corpus)
        index = BM25Index(bm25=bm25, chunk_ids=ids, documents=docs, metadatas=metas)
        _bm25_cache[corpus_name] = index
        logger.info(f"[retriever] Built BM25 lexical index for '{corpus_name}' ({len(docs)} documents)")
        return index

    except Exception as e:
        logger.warning(f"[retriever] Could not build BM25 index for '{corpus_name}': {e}")
        return None


# ─────────────────────────────────────────────────────────────
#  Model + Client Loading
# ─────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    logger.info(f"[retriever] Loading embedding model: {EMBEDDING_MODEL}")
    return SentenceTransformer(EMBEDDING_MODEL)


@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.ClientAPI:
    logger.info(f"[retriever] Connecting to ChromaDB at: {VECTORDB_DIR}")
    return chromadb.PersistentClient(
        path=str(VECTORDB_DIR),
        settings=Settings(anonymized_telemetry=False),
    )


@lru_cache(maxsize=8)
def get_collection(corpus: str) -> chromadb.Collection | None:
    client = get_chroma_client()
    try:
        return client.get_collection(corpus)
    except Exception as e:
        logger.warning(f"[retriever] Collection '{corpus}' not found: {e}")
        return None


# ─────────────────────────────────────────────────────────────
#  Main Retrieval Function (Hybrid: Dense + BM25 with RRF)
# ─────────────────────────────────────────────────────────────

@observe(name="chroma_retriever")
def retrieve(
    query: str,
    corpus: Corpus | str,
    top_k: int = DEFAULT_TOP_K,
    min_similarity: float = 0.0,
    enable_hybrid: bool = True,
) -> list[RetrievedChunk]:
    """
    Retrieve top-K chunks using Hybrid Search:
      - Dense Semantic Search (SentenceTransformer all-MiniLM-L6-v2)
      - Lexical BM25 Search (rank-bm25 Okapi over regulatory text)
      - Fused via Reciprocal Rank Fusion (RRF, k=60)
    """
    corpus_name = corpus.value if isinstance(corpus, Corpus) else str(corpus)

    if langfuse_context:
        try:
            langfuse_context.update_current_observation(
                input={"query": query, "corpus": corpus_name, "top_k": top_k, "min_similarity": min_similarity, "hybrid": enable_hybrid}
            )
        except Exception:
            pass

    if not query or not query.strip():
        logger.warning("[retriever] Empty query received")
        return []

    collection = get_collection(corpus_name)
    if collection is None:
        logger.error(f"[retriever] No collection for corpus '{corpus_name}'")
        return []

    coll_count = collection.count()
    if coll_count == 0:
        logger.warning(f"[retriever] Collection '{corpus_name}' is empty")
        return []

    # Step 1: Agentic query expansion for enriched statutory recall
    expanded_query = expand_query(query, corpus=corpus_name)

    # Step 2: Dense Semantic Search (top 3x candidates)
    model = get_embedding_model()
    query_embedding = model.encode(expanded_query, normalize_embeddings=True).tolist()

    dense_candidates_count = min(top_k * 4, coll_count)
    dense_results = collection.query(
        query_embeddings=[query_embedding],
        n_results=dense_candidates_count,
        include=["documents", "metadatas", "distances"],
    )

    dense_docs = dense_results["documents"][0] if dense_results.get("documents") else []
    dense_metas = dense_results["metadatas"][0] if dense_results.get("metadatas") else []
    dense_distances = dense_results["distances"][0] if dense_results.get("distances") else []
    dense_ids = dense_results["ids"][0] if dense_results.get("ids") else []

    # Map dense rank and cosine similarities
    dense_ranks: dict[str, int] = {}
    dense_sims: dict[str, float] = {}
    doc_lookup: dict[str, tuple[str, dict]] = {}

    for rank, (c_id, doc, meta, dist) in enumerate(zip(dense_ids, dense_docs, dense_metas, dense_distances), 1):
        dense_ranks[c_id] = rank
        dense_sims[c_id] = max(0.0, 1.0 - dist)
        doc_lookup[c_id] = (doc, meta)

    # Step 3: Lexical BM25 Search
    bm25_ranks: dict[str, int] = {}
    if enable_hybrid:
        bm25_index = get_bm25_index(corpus_name)
        if bm25_index is not None:
            query_tokens = tokenize_for_bm25(expanded_query)
            scores = bm25_index.bm25.get_scores(query_tokens)
            # Get top indices sorted by score descending
            top_bm25_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:dense_candidates_count]

            for rank, idx in enumerate(top_bm25_indices, 1):
                if scores[idx] > 0.0:
                    c_id = bm25_index.chunk_ids[idx]
                    bm25_ranks[c_id] = rank
                    if c_id not in doc_lookup:
                        doc_lookup[c_id] = (bm25_index.documents[idx], bm25_index.metadatas[idx])

    # Step 4: Reciprocal Rank Fusion (RRF)
    all_candidate_ids = set(dense_ranks.keys()).union(set(bm25_ranks.keys()))
    rrf_scores: dict[str, float] = {}

    for c_id in all_candidate_ids:
        r_dense = dense_ranks.get(c_id, 1000)
        r_bm25 = bm25_ranks.get(c_id, 1000)

        # RRF formula: 0.5/(60 + r_dense) + 0.5/(60 + r_bm25)
        rrf = (0.5 / (RRF_K + r_dense)) + (0.5 / (RRF_K + r_bm25))
        rrf_scores[c_id] = rrf

    # Sort candidates by RRF score descending
    sorted_candidates = sorted(all_candidate_ids, key=lambda cid: rrf_scores[cid], reverse=True)

    chunks: list[RetrievedChunk] = []
    for c_id in sorted_candidates:
        if c_id not in doc_lookup:
            continue
        doc, meta = doc_lookup[c_id]

        # Effective similarity: scale RRF score into [0.5, 0.99] or blend with dense similarity
        dense_sim = dense_sims.get(c_id, 0.5)
        # Bonus for items ranked high in both
        if c_id in dense_ranks and c_id in bm25_ranks:
            effective_sim = round(min(0.98, max(dense_sim, 0.70) + 0.05), 4)
        else:
            effective_sim = round(dense_sim, 4)

        if effective_sim < min_similarity:
            continue

        chunks.append(RetrievedChunk(
            chunk_id=c_id,
            text=doc,
            similarity=effective_sim,
            corpus=meta.get("corpus", corpus_name),
            circular_no=meta.get("circular_no", "unknown"),
            date=meta.get("date", "unknown"),
            title=meta.get("title", ""),
            filename=meta.get("filename", ""),
            url=meta.get("url", ""),
            chunk_index=int(meta.get("chunk_index", 0)),
            total_chunks=int(meta.get("total_chunks", 1)),
            extraction_method=meta.get("extraction_method", "unknown"),
        ))

        if len(chunks) >= top_k:
            break

    if langfuse_context:
        try:
            langfuse_context.update_current_observation(
                output={
                    "chunks_retrieved": len(chunks),
                    "top_similarity": round(chunks[0].similarity, 4) if chunks else 0.0,
                    "circular_nos": [c.circular_no for c in chunks],
                    "hybrid_fused": enable_hybrid and len(bm25_ranks) > 0,
                }
            )
        except Exception:
            pass

    return chunks


@observe(name="multi_corpus_retriever")
def retrieve_multi_corpus(
    query: str,
    corpora: list[Corpus | str],
    top_k_per_corpus: int = 3,
    final_top_k: int = 5,
) -> list[RetrievedChunk]:
    """Retrieve from multiple corpora and merge results by similarity."""
    all_chunks: list[RetrievedChunk] = []

    for corpus in corpora:
        chunks = retrieve(query, corpus, top_k=top_k_per_corpus)
        all_chunks.extend(chunks)

    all_chunks.sort(key=lambda c: c.similarity, reverse=True)
    return all_chunks[:final_top_k]


def show_collections() -> dict[str, int]:
    """Returns {corpus_name: doc_count} for all ChromaDB collections."""
    client = get_chroma_client()
    result = {}
    for col in client.list_collections():
        result[col.name] = client.get_collection(col.name).count()
    return result