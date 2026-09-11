"""
RegIQ — backend/app/rag/agent.py
Day 49: Agentic Multi-Corpus Routing

A ReAct-style (Reason + Act) agent that replaces single-corpus classifier
routing with multi-corpus reasoning.

Architecture:
─────────────
  REASON  →  Analyse query intent and detect ALL regulatory domains present
  ACT     →  Dispatch parallel retrieval against each detected corpus
  OBSERVE →  Inspect returned chunks and confidence scores per corpus
  REASON  →  Decide if synthesis is sufficient or retry with fallback corpus
  ACT     →  Merge, rerank, and return unified chunk list to generator.py

Key Properties:
  • Zero changes to retriever.py / generator.py (Day 49 spec requirement)
  • Works with existing langchain-core (no langchain-groq needed)
  • Full LangFuse @observe tracing on every action step
  • Falls back gracefully to single-corpus when query is unambiguous
  • Returns structured AgentResult for IEEE paper metrics logging
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from loguru import logger

# Safe LangFuse import with full no-op fallback when langfuse not installed
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
        # LangFuse not installed — define no-op stubs so module loads cleanly
        import functools
        def observe(name=None, **kwargs):
            def decorator(fn):
                @functools.wraps(fn)
                def wrapper(*args, **kw):
                    return fn(*args, **kw)
                return wrapper
            return decorator if callable(name) is False else decorator(name)
        langfuse_context = None

from app.models.user import Corpus
from app.rag.classifier import (
    classify_by_keywords,
    classify_by_embedding,
    classify_query,
    MIN_EMBEDDING_CONFIDENCE,
)
from app.rag.retriever import retrieve, retrieve_multi_corpus, RetrievedChunk
from app.rag.reranker import rerank


# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

# Minimum number of keyword-matched corpora to trigger multi-corpus mode
MULTI_CORPUS_THRESHOLD: int = 2

# Minimum embedding score delta to add a secondary corpus during REASON step
SECONDARY_CORPUS_DELTA: float = 0.05

# Confidence threshold below which a corpus' chunks are discarded as noise
CHUNK_CONFIDENCE_FLOOR: float = 0.20

# Top-K per corpus during multi-corpus retrieval
TOP_K_PER_CORPUS: int = 4

# Final top-N after merge + rerank
FINAL_TOP_N: int = 5

# ReAct retry: if best chunk similarity < this, retry with embedding-top corpus
RETRY_THRESHOLD: float = 0.30


# ─────────────────────────────────────────────────────────────
#  Agent Result Dataclass
# ─────────────────────────────────────────────────────────────

@dataclass
class AgentResult:
    """
    Structured output from the multi-corpus agent.
    Consumed by query.py instead of the raw retrieve() output.
    """
    chunks: list[RetrievedChunk]
    corpora_queried: list[str]
    routing_mode: str          # "single" | "multi" | "multi_retry"
    reasoning_trace: list[str] = field(default_factory=list)
    latency_ms: float = 0.0
    top_similarity: float = 0.0
    retry_triggered: bool = False


# ─────────────────────────────────────────────────────────────
#  Step 1 — REASON: Analyse query and decide routing strategy
# ─────────────────────────────────────────────────────────────

def _reason(query: str) -> tuple[list[Corpus], str, list[str]]:
    """
    Analyse the query and return:
        (target_corpora, mode, reasoning_trace)

    Returns mode = "single" if only one corpus is relevant,
    "multi" if cross-domain signals detected.
    """
    trace: list[str] = []

    # Stage A: Keyword scan (fast, high precision)
    keyword_primary, keyword_all = classify_by_keywords(query)
    trace.append(
        f"[REASON][keyword] primary={keyword_primary}, "
        f"all_matches={[c.value for c in keyword_all]}"
    )

    # Stage B: Embedding similarity scores
    embed_primary, embed_score, all_embed_scores = classify_by_embedding(query)
    ranked_embed = sorted(all_embed_scores.items(), key=lambda x: -x[1])
    trace.append(
        f"[REASON][embedding] primary={embed_primary.value} "
        f"score={embed_score:.3f} | "
        + ", ".join(f"{c.value}={s:.3f}" for c, s in ranked_embed)
    )

    # Decision Logic:
    # Multi-corpus triggered when:
    # 1. >= 2 keyword-matched corpora  (e.g. "GST + FEMA on export software")
    # OR
    # 2. Top-2 embedding scores are close (delta < SECONDARY_CORPUS_DELTA)
    #    AND second corpus score clears MIN_EMBEDDING_CONFIDENCE

    target_corpora: list[Corpus] = []

    if len(keyword_all) >= MULTI_CORPUS_THRESHOLD:
        # Multi-corpus from keyword overlap
        target_corpora = keyword_all
        mode = "multi"
        trace.append(
            f"[REASON] MULTI-CORPUS triggered by keyword overlap "
            f"({len(keyword_all)} corpora): {[c.value for c in target_corpora]}"
        )

    elif len(ranked_embed) >= 2:
        top_corpus, top_score = ranked_embed[0]
        second_corpus, second_score = ranked_embed[1]
        delta = top_score - second_score

        if (
            top_score >= MIN_EMBEDDING_CONFIDENCE
            and second_score >= MIN_EMBEDDING_CONFIDENCE
            and delta <= SECONDARY_CORPUS_DELTA
        ):
            # Two corpora are semantically close — query both
            target_corpora = [top_corpus, second_corpus]
            mode = "multi"
            trace.append(
                f"[REASON] MULTI-CORPUS triggered by embedding proximity "
                f"(delta={delta:.3f} <= {SECONDARY_CORPUS_DELTA}): "
                f"{top_corpus.value} + {second_corpus.value}"
            )
        else:
            primary = keyword_primary if keyword_primary else embed_primary
            target_corpora = [primary]
            mode = "single"
            trace.append(
                f"[REASON] SINGLE-CORPUS: {primary.value} "
                f"(keyword={keyword_primary}, embed={embed_primary.value})"
            )
    else:
        primary = keyword_primary if keyword_primary else embed_primary
        target_corpora = [primary]
        mode = "single"
        trace.append(f"[REASON] SINGLE-CORPUS fallback: {primary.value}")

    return target_corpora, mode, trace


# ─────────────────────────────────────────────────────────────
#  Step 2 — ACT: Dispatch retrieval to target corpora
# ─────────────────────────────────────────────────────────────

def _act_retrieve(
    query: str,
    corpora: list[Corpus],
    mode: str,
) -> list[RetrievedChunk]:
    """
    Execute retrieval against the target corpus list.
    Single-corpus: calls retrieve() directly.
    Multi-corpus: calls retrieve_multi_corpus() which is already @observe'd.
    """
    if mode == "single" or len(corpora) == 1:
        return retrieve(query, corpora[0], top_k=FINAL_TOP_N + 2)
    else:
        return retrieve_multi_corpus(
            query=query,
            corpora=corpora,
            top_k_per_corpus=TOP_K_PER_CORPUS,
            final_top_k=FINAL_TOP_N + 2,
        )


# ─────────────────────────────────────────────────────────────
#  Step 3 — OBSERVE: Inspect chunk quality
# ─────────────────────────────────────────────────────────────

def _observe_chunks(
    chunks: list[RetrievedChunk],
    trace: list[str],
) -> tuple[list[RetrievedChunk], bool]:
    """
    Filter out low-confidence chunks and decide if a retry is needed.
    Returns (filtered_chunks, should_retry).
    """
    confident = [c for c in chunks if c.similarity >= CHUNK_CONFIDENCE_FLOOR]
    trace.append(
        f"[OBSERVE] {len(chunks)} chunks retrieved -> "
        f"{len(confident)} above confidence floor ({CHUNK_CONFIDENCE_FLOOR})"
    )

    if not confident:
        trace.append("[OBSERVE] All chunks below confidence floor -> RETRY needed")
        return [], True

    top_sim = confident[0].similarity
    if top_sim < RETRY_THRESHOLD:
        trace.append(
            f"[OBSERVE] Best similarity {top_sim:.3f} < "
            f"retry threshold {RETRY_THRESHOLD} -> RETRY triggered"
        )
        return confident, True

    trace.append(f"[OBSERVE] Confidence OK -- top similarity: {top_sim:.3f}")
    return confident, False


# ─────────────────────────────────────────────────────────────
#  Step 4 — RETRY: Fallback to embedding-top corpus
# ─────────────────────────────────────────────────────────────

def _act_retry(
    query: str,
    already_tried: list[Corpus],
    trace: list[str],
) -> list[RetrievedChunk]:
    """
    Fallback retrieval: use embedding similarity to pick an alternative corpus
    not already tried, then retrieve again.
    """
    _, _, all_scores = classify_by_embedding(query)
    ranked = sorted(all_scores.items(), key=lambda x: -x[1])

    fallback_corpus: Corpus | None = None
    for corpus, score in ranked:
        if corpus not in already_tried and score >= MIN_EMBEDDING_CONFIDENCE:
            fallback_corpus = corpus
            break

    if fallback_corpus is None:
        fallback_corpus = ranked[0][0]

    trace.append(
        f"[RETRY][ACT] Retrying with fallback corpus: {fallback_corpus.value}"
    )
    return retrieve(query, fallback_corpus, top_k=FINAL_TOP_N + 2)


# ─────────────────────────────────────────────────────────────
#  Main Agent Entry Point
# ─────────────────────────────────────────────────────────────

@observe(name="regiq_multi_corpus_agent")
def run_agent(query: str) -> AgentResult:
    """
    Entry point for the ReAct multi-corpus agent.

    Pipeline:
        REASON -> ACT -> OBSERVE -> [RETRY?] -> RERANK -> AgentResult

    Called by query.py in place of the raw classify_query() + retrieve() chain.
    Zero changes required to retriever.py or generator.py.

    Args:
        query: Raw user question string.

    Returns:
        AgentResult with merged chunks, routing metadata, and trace log.
    """
    t_start = time.perf_counter()
    trace: list[str] = []

    # REASON
    target_corpora, mode, reason_trace = _reason(query)
    trace.extend(reason_trace)

    # ACT
    trace.append(f"[ACT] Retrieving from: {[c.value for c in target_corpora]}")
    chunks = _act_retrieve(query, target_corpora, mode)

    # OBSERVE
    chunks, should_retry = _observe_chunks(chunks, trace)

    # RETRY (conditional)
    retry_triggered = False
    if should_retry:
        retry_triggered = True
        mode = "multi_retry"
        retry_chunks = _act_retry(query, target_corpora, trace)
        # Merge + deduplicate by chunk_id
        seen_ids: set[str] = {c.chunk_id for c in chunks}
        for rc in retry_chunks:
            if rc.chunk_id not in seen_ids:
                chunks.append(rc)
                seen_ids.add(rc.chunk_id)
        trace.append(
            f"[RETRY][OBSERVE] Merged chunk pool: {len(chunks)} chunks total"
        )

    # RERANK
    if chunks:
        final_chunks = rerank(query, chunks, top_n=FINAL_TOP_N)
        trace.append(
            f"[RERANK] {len(chunks)} -> {len(final_chunks)} chunks after cross-encoder rerank"
        )
    else:
        final_chunks = []
        trace.append("[RERANK] Skipped -- no chunks to rerank")

    # Build Result
    latency_ms = round((time.perf_counter() - t_start) * 1000, 2)
    top_sim = final_chunks[0].similarity if final_chunks else 0.0

    # Log to LangFuse
    if langfuse_context:
        try:
            langfuse_context.update_current_observation(
                input={"query": query},
                output={
                    "corpora_queried": [c.value for c in target_corpora],
                    "routing_mode": mode,
                    "chunks_returned": len(final_chunks),
                    "top_similarity": top_sim,
                    "retry_triggered": retry_triggered,
                    "reasoning_trace": trace,
                },
                metadata={
                    "latency_ms": latency_ms,
                    "mode": mode,
                    "retry": retry_triggered,
                }
            )
        except Exception:
            pass

    logger.info(
        f"[agent] query='{query[:60]}' | mode={mode} | "
        f"corpora={[c.value for c in target_corpora]} | "
        f"chunks={len(final_chunks)} | top_sim={top_sim:.3f} | "
        f"retry={retry_triggered} | latency={latency_ms}ms"
    )

    return AgentResult(
        chunks=final_chunks,
        corpora_queried=[c.value for c in target_corpora],
        routing_mode=mode,
        reasoning_trace=trace,
        latency_ms=latency_ms,
        top_similarity=top_sim,
        retry_triggered=retry_triggered,
    )
