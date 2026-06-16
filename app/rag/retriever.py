"""
Vidi — backend/app/rag/retriever.py
Day 13 Task: ChromaDB Retriever

Given a query + target corpus, retrieves the top-K most similar
chunks from the corresponding ChromaDB collection along with
full source metadata (circular_no, date, title, url, etc.)

Used by:
- /query endpoint (Day 15) — after classifier.py picks the corpus
- reranker.py (this same Day 13) — reranks these top-K results
"""

from pathlib import Path
from functools import lru_cache
from dataclasses import dataclass, field

import chromadb
from chromadb.config import Settings
from loguru import logger
from sentence_transformers import SentenceTransformer

from app.models.user import Corpus
from app.config import settings

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Resolve vectordb path relative to backend/ — pipeline writes to
# <project_root>/vectordb, backend runs from <project_root>/backend
VECTORDB_DIR = Path(settings.vectordb_dir)
if not VECTORDB_DIR.is_absolute():
    # backend/app/rag/retriever.py → backend/ → project_root/
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

    # Populated by reranker.py (Day 13, second half)
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
#  Model + Client Loading (cached per process)
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
    """
    Returns a ChromaDB collection by name, or None if it doesn't exist.
    Cached per corpus name for the lifetime of the process.
    """
    client = get_chroma_client()
    try:
        return client.get_collection(corpus)
    except Exception as e:
        logger.warning(f"[retriever] Collection '{corpus}' not found: {e}")
        return None


# ─────────────────────────────────────────────────────────────
#  Main Retrieval Function
# ─────────────────────────────────────────────────────────────

def retrieve(
    query: str,
    corpus: Corpus | str,
    top_k: int = DEFAULT_TOP_K,
    min_similarity: float = 0.0,
) -> list[RetrievedChunk]:
    """
    Retrieve top-K most similar chunks for a query from a given corpus.

    Args:
        query: Natural language question
        corpus: Corpus enum or string (gst/rbi/sebi/mca/fema/user_docs)
        top_k: Number of results to return (default 5)
        min_similarity: Filter out results below this cosine similarity

    Returns:
        List of RetrievedChunk, sorted by similarity descending.
        Empty list if collection doesn't exist or has no matches.
    """
    corpus_name = corpus.value if isinstance(corpus, Corpus) else corpus

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

    # Embed the query (normalized — matches indexer.py's normalize_embeddings=True)
    model = get_embedding_model()
    query_embedding = model.encode(query, normalize_embeddings=True).tolist()

    # Query ChromaDB
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    chunks: list[RetrievedChunk] = []

    docs      = results["documents"][0] if results["documents"] else []
    metas     = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []
    ids       = results["ids"][0] if results.get("ids") else [None] * len(docs)

    for chunk_id, doc, meta, distance in zip(ids, docs, metas, distances):
        # ChromaDB with hnsw:space=cosine returns distance = 1 - similarity
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

    logger.debug(
        f"[retriever] '{query[:50]}' → corpus={corpus_name} → "
        f"{len(chunks)} chunks (top sim={chunks[0].similarity:.3f} if any)"
        if chunks else
        f"[retriever] '{query[:50]}' → corpus={corpus_name} → 0 chunks"
    )

    return chunks


def retrieve_multi_corpus(
    query: str,
    corpora: list[Corpus | str],
    top_k_per_corpus: int = 3,
    final_top_k: int = 5,
) -> list[RetrievedChunk]:
    """
    Retrieve from multiple corpora and merge results by similarity.
    Useful for queries spanning multiple regulatory domains
    (e.g. "GST implications of foreign remittance" → gst + fema).
    """
    all_chunks: list[RetrievedChunk] = []

    for corpus in corpora:
        chunks = retrieve(query, corpus, top_k=top_k_per_corpus)
        all_chunks.extend(chunks)

    # Sort merged results by similarity, take final_top_k
    all_chunks.sort(key=lambda c: c.similarity, reverse=True)
    return all_chunks[:final_top_k]


# ─────────────────────────────────────────────────────────────
#  Diagnostics — show all collections
# ─────────────────────────────────────────────────────────────

def show_collections() -> dict[str, int]:
    """Returns {corpus_name: doc_count} for all ChromaDB collections."""
    client = get_chroma_client()
    result = {}
    for col in client.list_collections():
        result[col.name] = client.get_collection(col.name).count()
    return result


# ─────────────────────────────────────────────────────────────
#  Test Harness
#  Run: python -m app.rag.retriever
# ─────────────────────────────────────────────────────────────

TEST_CASES: list[tuple[str, Corpus]] = [
    ("What is the GST registration threshold for turnover?", Corpus.GST),
    ("What are KYC requirements for opening a bank account?", Corpus.RBI),
    ("What are the listing requirements for SME IPO?", Corpus.SEBI),
    ("What is the procedure for company incorporation?", Corpus.MCA),
    ("What is the Liberalised Remittance Scheme limit?", Corpus.FEMA),
]


def run_retriever_tests():
    print("=" * 70)
    print("Vidi Retriever — Test Suite")
    print("=" * 70)

    # Show collection status
    print("\nCollections:")
    collections = show_collections()
    for corpus in ["gst", "rbi", "sebi", "mca", "fema"]:
        count = collections.get(corpus, 0)
        status = "✓" if count > 0 else "✗ MISSING"
        print(f"  {corpus.upper():<6} {count:>6} docs   {status}")

    print("\n" + "-" * 70)

    for query, corpus in TEST_CASES:
        print(f"\nQuery [{corpus.value.upper()}]: {query}")
        chunks = retrieve(query, corpus, top_k=DEFAULT_TOP_K)

        if not chunks:
            print("  ⚠ No results")
            continue

        for i, chunk in enumerate(chunks, 1):
            print(f"  [{i}] sim={chunk.similarity:.3f} | {chunk.circular_no} | {chunk.date} | {chunk.filename}")
            print(f"      {chunk.preview(120)}")

    print("\n" + "=" * 70)
    print("Retriever test complete.")
    print("=" * 70)


if __name__ == "__main__":
    run_retriever_tests()