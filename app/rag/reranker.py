"""
Vidi — backend/app/rag/reranker.py
Day 13 Task: Cross-Encoder Reranker

ChromaDB's vector similarity (retriever.py) is fast but approximate —
it compares the query embedding to each chunk embedding independently.

Cross-encoders are slower but more precise: they take the (query, chunk)
pair TOGETHER as input and directly score relevance. This catches cases
where two chunks have similar embeddings but very different actual
relevance to the specific query.

Pipeline:
    retriever.py  → top-K chunks by embedding similarity (fast, recall)
    reranker.py   → re-scores those K chunks with cross-encoder (slow, precision)
                  → returns reordered + filtered chunks

Model: cross-encoder/ms-marco-MiniLM-L-6-v2
       (lightweight, trained on MS MARCO passage ranking — good general fit)
"""

from functools import lru_cache

from loguru import logger
from sentence_transformers import CrossEncoder

from app.rag.retriever import RetrievedChunk, retrieve
from app.models.user import Corpus

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

# Cross-encoder scores are unbounded logits, not 0-1 similarities.
# We normalize via sigmoid for interpretability, but ranking order
# (not absolute value) is what matters for reranking.


# ─────────────────────────────────────────────────────────────
#  Model Loading (cached per process)
# ─────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_reranker_model() -> CrossEncoder:
    logger.info(f"[reranker] Loading cross-encoder: {RERANKER_MODEL}")
    return CrossEncoder(RERANKER_MODEL)


# ─────────────────────────────────────────────────────────────
#  Reranking
# ─────────────────────────────────────────────────────────────

def rerank(
    query: str,
    chunks: list[RetrievedChunk],
    top_n: int | None = None,
) -> list[RetrievedChunk]:
    """
    Re-score and reorder chunks using a cross-encoder.

    Args:
        query: Original user query
        chunks: List of RetrievedChunk from retriever.py
        top_n: If set, return only the top N after reranking
               (default: return all, reordered)

    Returns:
        Chunks reordered by rerank_score descending, with
        rerank_score populated on each chunk.
        If chunks is empty, returns [] immediately (no model load).
    """
    if not chunks:
        return []

    if len(chunks) == 1:
        # Nothing to rerank — but still score it for confidence info
        chunks[0].rerank_score = _sigmoid(
            get_reranker_model().predict([(query, chunks[0].text)])[0]
        )
        return chunks

    model = get_reranker_model()

    # Cross-encoder expects list of (query, passage) pairs
    pairs = [(query, chunk.text) for chunk in chunks]

    raw_scores = model.predict(pairs)

    for chunk, raw_score in zip(chunks, raw_scores):
        chunk.rerank_score = _sigmoid(float(raw_score))

    # Sort by rerank_score descending
    reranked = sorted(chunks, key=lambda c: c.rerank_score, reverse=True)

    if top_n is not None:
        reranked = reranked[:top_n]

    logger.debug(
        f"[reranker] Reranked {len(chunks)} chunks for '{query[:50]}' — "
        f"top score: {reranked[0].rerank_score:.3f}"
    )

    return reranked


def _sigmoid(x: float) -> float:
    """Convert cross-encoder logit to 0-1 range for interpretability."""
    import math
    return 1 / (1 + math.exp(-x))


# ─────────────────────────────────────────────────────────────
#  Combined Retrieve + Rerank Pipeline
# ─────────────────────────────────────────────────────────────

def retrieve_and_rerank(
    query: str,
    corpus: Corpus | str,
    retrieve_top_k: int = 10,
    rerank_top_n: int = 5,
) -> list[RetrievedChunk]:
    """
    Full pipeline: retrieve a larger candidate pool from ChromaDB,
    then rerank with cross-encoder to get the final top_n.

    Retrieving more candidates (retrieve_top_k > rerank_top_n) gives
    the cross-encoder a better pool to pick the truly best chunks from.

    Args:
        query: Natural language question
        corpus: Target ChromaDB collection
        retrieve_top_k: How many candidates to fetch from ChromaDB (recall stage)
        rerank_top_n: How many to return after reranking (precision stage)

    Returns:
        Final list of RetrievedChunk, ordered by rerank_score.
    """
    candidates = retrieve(query, corpus, top_k=retrieve_top_k)

    if not candidates:
        return []

    return rerank(query, candidates, top_n=rerank_top_n)


# ─────────────────────────────────────────────────────────────
#  Test Harness
#  Run: python -m app.rag.reranker
# ─────────────────────────────────────────────────────────────

TEST_CASES: list[tuple[str, Corpus]] = [
    ("What is the GST registration threshold for turnover?", Corpus.GST),
    ("What are KYC requirements for opening a bank account?", Corpus.RBI),
    ("What are the listing requirements for SME IPO?", Corpus.SEBI),
]


def run_reranker_tests():
    print("=" * 70)
    print("Vidi Reranker — Test Suite")
    print("=" * 70)

    for query, corpus in TEST_CASES:
        print(f"\nQuery [{corpus.value.upper()}]: {query}")

        # Retrieve a larger pool (10 candidates)
        candidates = retrieve(query, corpus, top_k=10)
        if not candidates:
            print("  ⚠ No candidates retrieved")
            continue

        print(f"\n  Before rerank (ChromaDB similarity order, top 5 of {len(candidates)}):")
        for i, c in enumerate(candidates[:5], 1):
            print(f"    [{i}] sim={c.similarity:.3f} | {c.circular_no} | {c.preview(80)}")

        reranked = rerank(query, candidates, top_n=5)

        print(f"\n  After rerank (cross-encoder order, top 5):")
        for i, c in enumerate(reranked, 1):
            print(f"    [{i}] rerank={c.rerank_score:.3f} (orig_sim={c.similarity:.3f}) | "
                  f"{c.circular_no} | {c.preview(80)}")

        # Check if order changed
        before_order = [c.chunk_id for c in candidates[:5]]
        after_order  = [c.chunk_id for c in reranked]
        if before_order != after_order:
            print(f"\n  ✓ Reranking changed result order (improved precision)")
        else:
            print(f"\n  = Order unchanged (ChromaDB ranking was already optimal)")

    print("\n" + "=" * 70)
    print("Reranker test complete.")
    print("=" * 70)


if __name__ == "__main__":
    run_reranker_tests()