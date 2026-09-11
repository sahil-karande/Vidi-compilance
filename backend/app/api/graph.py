"""
RegIQ — backend/app/api/graph.py
Day 52: D3 Regulation Citation Explorer Graph API
IEEE Contribution: Indian Regulatory Citation Network Graph Service

Provides D3-compatible {nodes, links} JSON for force-directed graph visualization
of regulatory circular citations across RBI, SEBI, MCA, GST, FEMA corpora.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/graph", tags=["Regulation Graph"])

# Cached graph memory
_CACHED_GRAPH: Optional[Dict[str, Any]] = None


def _find_citation_graph_path() -> Optional[Path]:
    """Locates data/citation_graph.json across potential working directories."""
    candidates = [
        Path("data/citation_graph.json"),
        Path("../data/citation_graph.json"),
        Path("../../data/citation_graph.json"),
        Path(__file__).resolve().parent.parent.parent.parent / "data" / "citation_graph.json",
        Path(__file__).resolve().parent.parent.parent / "data" / "citation_graph.json",
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            return p
    return None


def _load_graph_data() -> Dict[str, Any]:
    """Loads and caches citation graph data with defensive fallback."""
    global _CACHED_GRAPH
    if _CACHED_GRAPH is not None:
        return _CACHED_GRAPH

    file_path = _find_citation_graph_path()
    if file_path:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                logger.info(f"[graph_api] Loaded citation graph from {file_path} with {len(data.get('nodes', []))} nodes and {len(data.get('edges', []))} edges.")
                _CACHED_GRAPH = data
                return _CACHED_GRAPH
        except Exception as e:
            logger.error(f"[graph_api] Failed to read {file_path}: {e}")

    # Fallback minimal graph structure if data file isn't generated yet
    logger.warning("[graph_api] Falling back to default seed citation graph.")
    return {
        "generated_at": None,
        "corpora_scanned": ["rbi", "sebi", "mca", "gst", "fema"],
        "total_nodes": 0,
        "total_edges": 0,
        "nodes": [],
        "edges": [],
    }


@router.get("")
def get_graph(
    corpus: Optional[str] = Query(None, description="Filter by regulatory corpus: rbi, sebi, mca, gst, fema, all"),
    min_citations: int = Query(0, ge=0, description="Minimum incoming citations to include"),
    search: Optional[str] = Query(None, description="Search term to match node id, label, or title"),
    limit: int = Query(350, ge=1, le=2000, description="Maximum number of nodes to return for optimal D3 performance"),
):
    """
    Returns D3-compatible {nodes, links} JSON for force-directed graph rendering.
    Ensures every link connects two nodes present in the returned nodes array.
    """
    data = _load_graph_data()
    all_nodes: List[Dict[str, Any]] = data.get("nodes", [])
    raw_edges: List[Dict[str, Any]] = data.get("edges", [])

    # Filter nodes
    filtered_nodes = all_nodes

    # 1. Corpus filter
    if corpus and corpus.lower() not in ("all", "*"):
        target_corpus = corpus.lower().strip()
        filtered_nodes = [
            n for n in filtered_nodes
            if n.get("corpus", "").lower() == target_corpus
            or n.get("authority", "").lower() == target_corpus
        ]

    # 2. Min citations filter
    if min_citations > 0:
        filtered_nodes = [
            n for n in filtered_nodes
            if (n.get("citation_count") or 0) >= min_citations
        ]

    # 3. Search query filter
    if search and search.strip():
        term = search.strip().lower()
        filtered_nodes = [
            n for n in filtered_nodes
            if term in (n.get("id") or "").lower()
            or term in (n.get("label") or "").lower()
            or term in (n.get("title") or "").lower()
        ]

    # Sort nodes by centrality / citation_count desc so highest value nodes are retained within limit
    filtered_nodes = sorted(
        filtered_nodes,
        key=lambda n: (n.get("citation_count") or 0) + (n.get("outbound_count") or 0) * 0.5,
        reverse=True
    )

    # Slice to limit
    if limit and len(filtered_nodes) > limit:
        filtered_nodes = filtered_nodes[:limit]

    node_id_set = {n["id"] for n in filtered_nodes}

    # Filter links to ONLY those where both source and target are in returned nodes
    # D3 forceSimulation will throw an error if a link references a nonexistent node
    d3_links: List[Dict[str, Any]] = []
    for edge in raw_edges:
        src = edge.get("source")
        tgt = edge.get("target")
        if src in node_id_set and tgt in node_id_set:
            d3_links.append({
                "source": src,
                "target": tgt,
                "weight": edge.get("weight", 1),
                "corpus_src": edge.get("corpus_src", "unknown"),
                "corpus_tgt": edge.get("corpus_tgt", "unknown"),
            })

    # Corpus distribution in the filtered slice
    corpus_counts: Dict[str, int] = {}
    for n in filtered_nodes:
        c = n.get("corpus") or "unknown"
        corpus_counts[c] = corpus_counts.get(c, 0) + 1

    return {
        "nodes": filtered_nodes,
        "links": d3_links,
        "edges": d3_links,  # backwards compatibility alias
        "meta": {
            "returned_nodes": len(filtered_nodes),
            "returned_links": len(d3_links),
            "total_nodes_available": len(all_nodes),
            "total_edges_available": len(raw_edges),
            "corpus_filter": corpus or "all",
            "corpus_breakdown": corpus_counts,
        }
    }


@router.get("/stats")
def get_graph_stats():
    """Returns macro-level topological statistics of the citation network for UI scorecards."""
    data = _load_graph_data()
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    corpus_distribution: Dict[str, int] = {}
    total_citations = 0
    for n in nodes:
        c = n.get("corpus") or "unknown"
        corpus_distribution[c] = corpus_distribution.get(c, 0) + 1
        total_citations += (n.get("citation_count") or 0)

    # Cross-corpus citations count
    cross_corpus_edges = sum(
        1 for e in edges
        if e.get("corpus_src") and e.get("corpus_tgt") and e.get("corpus_src") != e.get("corpus_tgt")
    )

    # Top cited circulars / acts
    top_cited = sorted(nodes, key=lambda n: n.get("citation_count", 0), reverse=True)[:10]

    return {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "total_citations": total_citations,
        "cross_corpus_citations": cross_corpus_edges,
        "corpus_distribution": corpus_distribution,
        "top_cited": [
            {
                "id": n.get("id"),
                "label": n.get("label"),
                "corpus": n.get("corpus"),
                "citations": n.get("citation_count", 0),
            }
            for n in top_cited
        ],
    }


@router.get("/node/{node_id:path}")
def get_node_details(node_id: str):
    """Retrieves deep citation metadata, incoming citations, and outgoing citations for a single circular."""
    data = _load_graph_data()
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    matched = next((n for n in nodes if n["id"] == node_id), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Circular '{node_id}' not found in citation network")

    # Inbound edges (who cites this circular)
    incoming = [
        {"source": e["source"], "weight": e.get("weight", 1), "corpus": e.get("corpus_src")}
        for e in edges if e.get("target") == node_id
    ]

    # Outbound edges (who this circular cites)
    outgoing = [
        {"target": e["target"], "weight": e.get("weight", 1), "corpus": e.get("corpus_tgt")}
        for e in edges if e.get("source") == node_id
    ]

    return {
        "node": matched,
        "incoming_citations": incoming,
        "outgoing_citations": outgoing,
        "total_incoming": len(incoming),
        "total_outgoing": len(outgoing),
    }
