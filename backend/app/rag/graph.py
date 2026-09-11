"""
RegIQ — backend/app/rag/graph.py
Day 53: LangGraph Stateful Query Pipeline

Replaces the linear classify → retrieve → rerank → generate pipeline with a
LangGraph StateGraph that adds conditional retry logic for low-confidence
retrievals and full per-step observability via LangFuse.

Graph Topology
──────────────
                    ┌──────────────┐
         START ───► │   classify   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   retrieve   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   evaluate   │ ◄── checks top-chunk similarity
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
         "low"             │           "high"
            │              │              │
     ┌──────▼──────┐       │       ┌──────▼──────┐
     │    retry    │       │       │   generate  │
     └──────┬──────┘       │       └──────┬──────┘
            │              │              │
            └──────────────┘              │
                                   ┌──────▼──────┐
                                   │     END     │
                                   └─────────────┘

Key Properties
──────────────
  • TypedDict state — every field is typed and inspectable
  • Conditional edge — "low" confidence triggers automatic corpus fallback
  • Max 1 retry — prevents infinite loops
  • Full LangFuse @observe on every node
  • GraphResult dataclass consumed by query.py (drop-in for AgentResult)
  • Async-safe: generate node is async, rest are sync
"""

from __future__ import annotations

import time
import asyncio
from dataclasses import dataclass, field
from typing import Literal, Any

from loguru import logger

# ─────────────────────────────────────────────────────────────
#  Safe LangFuse import
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
            return decorator if not callable(name) else decorator(name)
        langfuse_context = None

# ─────────────────────────────────────────────────────────────
#  LangGraph import (with graceful fallback)
# ─────────────────────────────────────────────────────────────

try:
    from langgraph.graph import StateGraph, START, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    logger.warning(
        "[graph] langgraph not installed — GraphPipeline will fall back to "
        "AgentResult mode. Install with: pip install langgraph"
    )

from typing import TypedDict

# ─────────────────────────────────────────────────────────────
#  Internal RAG imports
# ─────────────────────────────────────────────────────────────

from app.models.user import Corpus
from app.rag.classifier import (
    classify_by_keywords,
    classify_by_embedding,
    MIN_EMBEDDING_CONFIDENCE,
)
from app.rag.retriever import retrieve, retrieve_multi_corpus, RetrievedChunk
from app.rag.reranker import rerank
from app.rag.generator import RAGGenerator

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

CONFIDENCE_THRESHOLD: float = 0.30    # below this → conditional retry edge fires
MULTI_CORPUS_DELTA: float = 0.05      # embedding gap to trigger multi-corpus
MIN_EMBED_SCORE: float = MIN_EMBEDDING_CONFIDENCE
TOP_K_RETRIEVE: int = 7               # chunks per corpus in initial retrieval
TOP_K_RETRY: int = 5                  # chunks in retry retrieval
FINAL_TOP_N: int = 5                  # after rerank
MAX_RETRIES: int = 1                  # hard cap on retry loops

# Shared generator instance (loaded once at import time)
_generator = RAGGenerator()


# ─────────────────────────────────────────────────────────────
#  State Schema (TypedDict — LangGraph requirement)
# ─────────────────────────────────────────────────────────────

class QueryState(TypedDict, total=False):
    """
    Typed state dict passed between every LangGraph node.

    All fields are optional (total=False) so nodes can update
    only the fields they own without touching others.
    """
    # Input
    query: str
    mode: str                             # "plain" | "legal"

    # Classification
    primary_corpus: str
    all_corpora: list[str]
    routing_mode: str                     # "single" | "multi" | "multi_retry"

    # Retrieval
    chunks: list[Any]                     # list[RetrievedChunk]
    top_similarity: float
    retry_count: int

    # Evaluation
    confidence: str                       # "high" | "low"

    # Generation output
    answer: str
    citations: list[dict]

    # Observability
    trace: list[str]
    latency_ms: float


# ─────────────────────────────────────────────────────────────
#  GraphResult — returned to query.py
# ─────────────────────────────────────────────────────────────

@dataclass
class GraphResult:
    """
    Structured output from the LangGraph pipeline.
    Drop-in replacement for AgentResult in query.py.
    """
    chunks: list[Any]
    answer: str
    citations: list[dict]
    corpora_queried: list[str]
    routing_mode: str
    confidence: str
    retry_triggered: bool
    top_similarity: float
    latency_ms: float
    reasoning_trace: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────
#  Node 1: classify
# ─────────────────────────────────────────────────────────────

@observe(name="graph_node_classify")
def node_classify(state: QueryState) -> QueryState:
    """
    Determine which regulatory corpus/corpora to query.

    Strategy:
    - Keyword scan first (fast, high precision)
    - If ≥2 keyword matches → multi-corpus
    - Else compare top-2 embedding scores:
        • If gap ≤ MULTI_CORPUS_DELTA → multi-corpus
        • Else → single corpus (winner)
    """
    query = state["query"]
    trace = list(state.get("trace", []))

    # Stage A — keyword
    kw_primary, kw_all = classify_by_keywords(query)
    trace.append(
        f"[classify][keyword] primary={kw_primary} "
        f"all={[c.value for c in kw_all]}"
    )

    # Stage B — embedding
    emb_primary, emb_score, all_scores = classify_by_embedding(query)
    ranked = sorted(all_scores.items(), key=lambda x: -x[1])
    trace.append(
        f"[classify][embedding] primary={emb_primary.value} score={emb_score:.3f} | "
        + ", ".join(f"{c.value}={s:.3f}" for c, s in ranked)
    )

    corpora: list[Corpus] = []
    routing_mode: str

    if len(kw_all) >= 2:
        corpora = kw_all
        routing_mode = "multi"
        trace.append(f"[classify] MULTI-CORPUS (keyword overlap): {[c.value for c in corpora]}")
    elif len(ranked) >= 2:
        top_c, top_s = ranked[0]
        sec_c, sec_s = ranked[1]
        delta = top_s - sec_s
        if (
            top_s >= MIN_EMBED_SCORE
            and sec_s >= MIN_EMBED_SCORE
            and delta <= MULTI_CORPUS_DELTA
        ):
            corpora = [top_c, sec_c]
            routing_mode = "multi"
            trace.append(
                f"[classify] MULTI-CORPUS (embedding proximity delta={delta:.3f}): "
                f"{top_c.value} + {sec_c.value}"
            )
        else:
            primary = kw_primary if kw_primary else emb_primary
            corpora = [primary]
            routing_mode = "single"
            trace.append(f"[classify] SINGLE-CORPUS: {primary.value}")
    else:
        primary = kw_primary if kw_primary else emb_primary
        corpora = [primary]
        routing_mode = "single"
        trace.append(f"[classify] SINGLE-CORPUS (fallback): {primary.value}")

    return {
        **state,
        "primary_corpus": corpora[0].value,
        "all_corpora": [c.value for c in corpora],
        "routing_mode": routing_mode,
        "retry_count": state.get("retry_count", 0),
        "trace": trace,
    }


# ─────────────────────────────────────────────────────────────
#  Node 2: retrieve
# ─────────────────────────────────────────────────────────────

@observe(name="graph_node_retrieve")
def node_retrieve(state: QueryState) -> QueryState:
    """
    Retrieve chunks from the classified corpus/corpora.
    Uses existing @observe'd retrieve() / retrieve_multi_corpus() functions.
    """
    query = state["query"]
    all_corpora = state.get("all_corpora", [state.get("primary_corpus", "gst")])
    routing_mode = state.get("routing_mode", "single")
    trace = list(state.get("trace", []))

    trace.append(f"[retrieve] corpora={all_corpora} routing_mode={routing_mode}")

    if routing_mode == "single" or len(all_corpora) == 1:
        chunks = retrieve(query, all_corpora[0], top_k=TOP_K_RETRIEVE)
    else:
        chunks = retrieve_multi_corpus(
            query=query,
            corpora=all_corpora,
            top_k_per_corpus=4,
            final_top_k=TOP_K_RETRIEVE,
        )

    trace.append(f"[retrieve] {len(chunks)} raw chunks retrieved")

    return {
        **state,
        "chunks": chunks,
        "trace": trace,
    }


# ─────────────────────────────────────────────────────────────
#  Node 3: evaluate (determines the conditional edge)
# ─────────────────────────────────────────────────────────────

@observe(name="graph_node_evaluate")
def node_evaluate(state: QueryState) -> QueryState:
    """
    Rerank retrieved chunks, then measure confidence.
    Sets state["confidence"] = "high" | "low" for the conditional edge.
    """
    query = state["query"]
    raw_chunks = state.get("chunks", [])
    trace = list(state.get("trace", []))

    # Rerank
    ranked = rerank(query, raw_chunks, top_n=FINAL_TOP_N) if raw_chunks else []
    top_sim = ranked[0].similarity if ranked else 0.0
    confidence = "high" if top_sim >= CONFIDENCE_THRESHOLD else "low"

    trace.append(
        f"[evaluate] top_similarity={top_sim:.3f} threshold={CONFIDENCE_THRESHOLD} "
        f"→ confidence={confidence}"
    )

    if langfuse_context:
        try:
            langfuse_context.update_current_observation(
                output={
                    "top_similarity": top_sim,
                    "confidence": confidence,
                    "chunks_after_rerank": len(ranked),
                }
            )
        except Exception:
            pass

    return {
        **state,
        "chunks": ranked,
        "top_similarity": top_sim,
        "confidence": confidence,
        "trace": trace,
    }


# ─────────────────────────────────────────────────────────────
#  Node 4: retry  (only reached on "low" confidence edge)
# ─────────────────────────────────────────────────────────────

@observe(name="graph_node_retry")
def node_retry(state: QueryState) -> QueryState:
    """
    Fallback retrieval with an alternative corpus not yet tried.

    Picks the highest-scoring embedding corpus not in all_corpora,
    retrieves from it, merges with existing chunks, and re-evaluates.
    Sets routing_mode = "multi_retry".
    """
    query = state["query"]
    already_tried = set(state.get("all_corpora", []))
    existing_chunks = state.get("chunks", [])
    trace = list(state.get("trace", []))
    retry_count = state.get("retry_count", 0)

    trace.append(
        f"[retry] attempt={retry_count + 1} already_tried={list(already_tried)}"
    )

    # Find fallback corpus
    _, _, all_scores = classify_by_embedding(query)
    ranked_scores = sorted(all_scores.items(), key=lambda x: -x[1])

    fallback: Corpus | None = None
    for corpus, score in ranked_scores:
        if corpus.value not in already_tried and score >= MIN_EMBED_SCORE:
            fallback = corpus
            break

    if fallback is None:
        # All corpora tried or none confident — reuse best embedding match
        fallback = ranked_scores[0][0]

    trace.append(f"[retry] fallback corpus selected: {fallback.value}")

    retry_chunks = retrieve(query, fallback, top_k=TOP_K_RETRY)

    # Merge + deduplicate
    seen_ids: set[str] = {c.chunk_id for c in existing_chunks if hasattr(c, "chunk_id")}
    for rc in retry_chunks:
        if rc.chunk_id not in seen_ids:
            existing_chunks.append(rc)
            seen_ids.add(rc.chunk_id)

    # Re-rerank merged pool
    merged_ranked = rerank(query, existing_chunks, top_n=FINAL_TOP_N) if existing_chunks else []
    top_sim = merged_ranked[0].similarity if merged_ranked else 0.0
    new_confidence = "high" if top_sim >= CONFIDENCE_THRESHOLD else "low"

    new_corpora = list(already_tried) + [fallback.value]
    trace.append(
        f"[retry] merged_chunks={len(merged_ranked)} "
        f"new_top_sim={top_sim:.3f} confidence={new_confidence}"
    )

    return {
        **state,
        "chunks": merged_ranked,
        "all_corpora": new_corpora,
        "routing_mode": "multi_retry",
        "confidence": new_confidence,
        "top_similarity": top_sim,
        "retry_count": retry_count + 1,
        "trace": trace,
    }


# ─────────────────────────────────────────────────────────────
#  Node 5: generate  (async — awaited by run_graph_async)
# ─────────────────────────────────────────────────────────────

@observe(name="graph_node_generate")
def node_generate_sync(state: QueryState) -> QueryState:
    """
    Synchronous wrapper around the async generate_answer() call.
    LangGraph requires all nodes to be sync or all async.
    We run the coroutine inside a new event loop if needed.
    """
    query = state["query"]
    mode = state.get("mode", "plain")
    chunks = state.get("chunks", [])
    trace = list(state.get("trace", []))

    trace.append(f"[generate] chunks={len(chunks)} mode={mode}")

    try:
        # Run async generator in sync context
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(
            _generator.generate_answer(query=query, chunks=chunks, mode=mode)
        )
        loop.close()
    except Exception as e:
        logger.error(f"[graph][generate] Generation failed: {e}")
        result = {
            "answer": "I could not find this in the available regulatory documents.",
            "citations": [],
            "mode": mode,
        }

    answer = result.get("answer", "")
    citations = result.get("citations", [])

    trace.append(f"[generate] answer_len={len(answer)} citations={len(citations)}")

    return {
        **state,
        "answer": answer,
        "citations": citations,
        "trace": trace,
    }


# ─────────────────────────────────────────────────────────────
#  Conditional Edge Router
# ─────────────────────────────────────────────────────────────

def route_after_evaluate(state: QueryState) -> Literal["retry", "generate"]:
    """
    Conditional edge function called after the evaluate node.

    Returns:
      "retry"    — if confidence is low AND retry_count < MAX_RETRIES
      "generate" — otherwise (high confidence, or retry limit reached)
    """
    confidence = state.get("confidence", "high")
    retry_count = state.get("retry_count", 0)

    if confidence == "low" and retry_count < MAX_RETRIES:
        return "retry"
    return "generate"


# ─────────────────────────────────────────────────────────────
#  Graph Compilation
# ─────────────────────────────────────────────────────────────

def _build_graph() -> Any:
    """
    Compile and return the LangGraph StateGraph.
    Returns None if langgraph is not installed.
    """
    if not LANGGRAPH_AVAILABLE:
        return None

    g = StateGraph(QueryState)

    # Register nodes
    g.add_node("classify",  node_classify)
    g.add_node("retrieve",  node_retrieve)
    g.add_node("evaluate",  node_evaluate)
    g.add_node("retry",     node_retry)
    g.add_node("generate",  node_generate_sync)

    # Linear edges
    g.add_edge(START,       "classify")
    g.add_edge("classify",  "retrieve")
    g.add_edge("retrieve",  "evaluate")

    # Conditional edge: evaluate → retry | generate
    g.add_conditional_edges(
        "evaluate",
        route_after_evaluate,
        {"retry": "retry", "generate": "generate"},
    )

    # After retry, re-evaluate (loops back to evaluate node)
    # Since MAX_RETRIES=1, this terminates after one retry
    g.add_edge("retry",     "evaluate")

    # Terminal edge
    g.add_edge("generate",  END)

    return g.compile()


# Singleton compiled graph — built once at module import
_compiled_graph: Any = _build_graph()


# ─────────────────────────────────────────────────────────────
#  Public Entry Point
# ─────────────────────────────────────────────────────────────

@observe(name="regiq_langgraph_pipeline")
def run_graph(query: str, mode: str = "plain") -> GraphResult:
    """
    Execute the full LangGraph RAG pipeline synchronously.

    This is the main entry point called by query.py. It replaces
    the run_agent() call from Day 49 with a proper stateful graph.

    Pipeline:
        classify → retrieve → evaluate → [retry?] → generate

    Args:
        query: Raw user question.
        mode:  "plain" | "legal"

    Returns:
        GraphResult with chunks, answer, citations, and observability metadata.
    """
    t_start = time.perf_counter()

    initial_state: QueryState = {
        "query": query,
        "mode": mode,
        "retry_count": 0,
        "trace": [f"[START] query='{query[:60]}' mode={mode}"],
    }

    if _compiled_graph is not None:
        # ── LangGraph execution path ──────────────────────────
        try:
            final_state: QueryState = _compiled_graph.invoke(initial_state)
        except Exception as e:
            logger.error(f"[graph] LangGraph execution failed: {e} — falling back")
            final_state = _fallback_pipeline(initial_state)
    else:
        # ── Fallback path (langgraph not installed) ───────────
        logger.warning("[graph] Running fallback pipeline (no LangGraph)")
        final_state = _fallback_pipeline(initial_state)

    latency_ms = round((time.perf_counter() - t_start) * 1000, 2)
    trace = list(final_state.get("trace", []))
    trace.append(f"[END] latency={latency_ms}ms")

    result = GraphResult(
        chunks=final_state.get("chunks", []),
        answer=final_state.get("answer", "I could not find this in the available regulatory documents."),
        citations=final_state.get("citations", []),
        corpora_queried=final_state.get("all_corpora", [final_state.get("primary_corpus", "gst")]),
        routing_mode=final_state.get("routing_mode", "single"),
        confidence=final_state.get("confidence", "low"),
        retry_triggered=final_state.get("retry_count", 0) > 0,
        top_similarity=final_state.get("top_similarity", 0.0),
        latency_ms=latency_ms,
        reasoning_trace=trace,
    )

    # LangFuse span update
    if langfuse_context:
        try:
            langfuse_context.update_current_observation(
                input={"query": query, "mode": mode},
                output={
                    "routing_mode": result.routing_mode,
                    "corpora": result.corpora_queried,
                    "confidence": result.confidence,
                    "retry": result.retry_triggered,
                    "top_similarity": result.top_similarity,
                    "answer_len": len(result.answer),
                },
                metadata={"latency_ms": latency_ms}
            )
        except Exception:
            pass

    logger.info(
        f"[graph] query='{query[:55]}' | mode={mode} | "
        f"routing={result.routing_mode} | corpora={result.corpora_queried} | "
        f"confidence={result.confidence} | retry={result.retry_triggered} | "
        f"top_sim={result.top_similarity:.3f} | latency={latency_ms}ms"
    )

    return result


# ─────────────────────────────────────────────────────────────
#  Fallback pipeline (no LangGraph dependency)
# ─────────────────────────────────────────────────────────────

def _fallback_pipeline(state: QueryState) -> QueryState:
    """
    Minimal linear pipeline used when langgraph is unavailable.
    Ensures the module always works even without the package.
    """
    state = node_classify(state)
    state = node_retrieve(state)
    state = node_evaluate(state)
    if state.get("confidence") == "low" and state.get("retry_count", 0) < MAX_RETRIES:
        state = node_retry(state)
        state = node_evaluate(state)
    state = node_generate_sync(state)
    return state
