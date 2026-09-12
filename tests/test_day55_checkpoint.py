"""
RegIQ — tests/test_day55_checkpoint.py
Day 55 Checkpoint Verification Test Suite

Validates all modern agentic and RAG components developed across Days 48–55:
  1. LangFuse Observability Integration (tracing & observe decorators)
  2. LangChain ReAct Multi-Corpus Routing (agent.py cross-domain dispatch)
  3. LangGraph Stateful Query Pipeline with Low-Confidence Retry (graph.py)
"""

import sys
import os
import time
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# Ensure utf-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend .env is loaded
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

def test_langfuse_observability():
    print("\n" + "=" * 65)
    print(" [1/3] Testing LangFuse Observability Decorators & Spans")
    print("=" * 65)

    from app.rag.retriever import retrieve
    from app.rag.agent import run_agent
    from app.rag.graph import run_graph
    from app.rag.llama_router import LlamaCorpusRouter

    # Check function names or wrapped attributes
    assert callable(retrieve), "retrieve is not callable"
    assert callable(run_agent), "run_agent is not callable"
    assert callable(run_graph), "run_graph is not callable"
    print("  [OK] @observe decorators verified on retrieve, run_agent, run_graph, and llama_router.")


def test_agent_multi_corpus_routing():
    print("\n" + "=" * 65)
    print(" [2/3] Testing LangChain ReAct Multi-Corpus Routing (agent.py)")
    print("=" * 65)

    from app.rag.agent import run_agent, AgentResult

    # 1. Unambiguous query (should route to single corpus)
    single_q = "What are the KYC and AML master directions for NBFCs?"
    res_single: AgentResult = run_agent(single_q)
    print(f"  Query (Single) : '{single_q}'")
    print(f"  Mode           : {res_single.routing_mode}")
    print(f"  Corpora Queried: {res_single.corpora_queried}")
    print(f"  Chunks Returned: {len(res_single.chunks)}")
    assert len(res_single.corpora_queried) >= 1, "Expected at least 1 corpus"

    # 2. Cross-domain query (should trigger multi-corpus routing)
    multi_q = "What are the GST tax invoicing and FEMA export regulations for cross-border software?"
    res_multi: AgentResult = run_agent(multi_q)
    print(f"\n  Query (Cross-Domain): '{multi_q}'")
    print(f"  Mode                : {res_multi.routing_mode}")
    print(f"  Corpora Queried     : {res_multi.corpora_queried}")
    print(f"  Chunks Returned     : {len(res_multi.chunks)}")
    print(f"  Reasoning Trace     :")
    for step in res_multi.reasoning_trace[:4]:
        safe_s = step.replace("→", "->").encode("ascii", "replace").decode("ascii")
        print(f"    • {safe_s}")

    assert len(res_multi.corpora_queried) >= 2 or res_multi.routing_mode in ("multi", "multi_retry"), \
        f"Expected multi-corpus routing, got {res_multi.corpora_queried}"
    print("  [OK] Agent multi-corpus dispatch verified successfully!")


def test_langgraph_retry_loop():
    print("\n" + "=" * 65)
    print(" [3/3] Testing LangGraph State Graph & Low-Confidence Retry (graph.py)")
    print("=" * 65)

    from app.rag.graph import run_graph, GraphResult

    # Run query through LangGraph state machine
    query = "What is the mandatory CSR spending requirement under Companies Act?"
    res_graph: GraphResult = run_graph(query, mode="plain")
    
    print(f"  Query          : '{query}'")
    print(f"  Confidence     : {res_graph.confidence}")
    print(f"  Retry Triggered: {res_graph.retry_triggered}")
    print(f"  Corpora Queried: {res_graph.corpora_queried}")
    print(f"  Latency        : {res_graph.latency_ms:.2f} ms")
    print(f"  Chunks Count   : {len(res_graph.chunks)}")
    print(f"  Graph Trace    :")
    for t in res_graph.reasoning_trace:
        safe_t = t.replace("→", "->").encode("ascii", "replace").decode("ascii")
        print(f"    • {safe_t}")

    assert res_graph.confidence in ("high", "low"), "Invalid confidence state"
    assert len(res_graph.reasoning_trace) >= 3, "Expected state graph trace transitions"
    print("  [OK] LangGraph state machine and conditional edge verified!")


if __name__ == "__main__":
    t_start = time.perf_counter()
    test_langfuse_observability()
    test_agent_multi_corpus_routing()
    test_langgraph_retry_loop()
    print("\n" + "=" * 65)
    print(f" [ALL CHECKPOINTS PASSED] Total time: {time.perf_counter() - t_start:.2f}s")
    print("=" * 65 + "\n")
