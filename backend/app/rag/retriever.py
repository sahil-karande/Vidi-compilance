"""
RegIQ — backend/app/rag/retriever.py
ChromaDB Retriever with LangFuse Observability
"""

from pathlib import Path
from functools import lru_cache
from dataclasses import dataclass, field
from typing import List, Dict, Any

import chromadb
from chromadb.config import Settings
from loguru import logger
from sentence_transformers import SentenceTransformer

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

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

VECTORDB_DIR = Path(settings.vectordb_dir)
if not VECTORDB_DIR.is_absolute():
    project_root = Path(__file__).parent.parent.parent.parent
    VECTORDB_DIR = project_root / "vectordb"

DEFAULT_TOP_K = 5


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
#  Main Retrieval Function
# ─────────────────────────────────────────────────────────────

@observe(name="chroma_retriever")
def retrieve(
    query: str,
    corpus: Corpus | str,
    top_k: int = DEFAULT_TOP_K,
    min_similarity: float = 0.0,
) -> list[RetrievedChunk]:
    """Retrieve top-K most similar chunks for a query from a given corpus."""
    corpus_name = corpus.value if isinstance(corpus, Corpus) else str(corpus)

    if langfuse_context:
        try:
            langfuse_context.update_current_observation(
                input={"query": query, "corpus": corpus_name, "top_k": top_k, "min_similarity": min_similarity}
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

    if collection.count() == 0:
        logger.warning(f"[retriever] Collection '{corpus_name}' is empty")
        return []

    model = get_embedding_model()
    query_embedding = model.encode(query, normalize_embeddings=True).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    chunks: list[RetrievedChunk] = []
    docs = results["documents"][0] if results.get("documents") else []
    metas = results["metadatas"][0] if results.get("metadatas") else []
    distances = results["distances"][0] if results.get("distances") else []
    ids = results["ids"][0] if results.get("ids") else [None] * len(docs)

    for chunk_id, doc, meta, distance in zip(ids, docs, metas, distances):
        similarity = 1 - distance
        if similarity < min_similarity:
            continue

        chunks.append(RetrievedChunk(
            chunk_id=chunk_id or meta.get("chunk_id", ""),
            text=doc,
            similarity=similarity,
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

    if langfuse_context:
        try:
            langfuse_context.update_current_observation(
                output={
                    "chunks_retrieved": len(chunks),
                    "top_similarity": round(chunks[0].similarity, 4) if chunks else 0.0,
                    "circular_nos": [c.circular_no for c in chunks]
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