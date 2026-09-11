"""
Vidi — pipeline/indexer.py
Day 4 Task: Upsert embeddings into ChromaDB

Reads embeddings from data/{corpus}/embeddings.json
Upserts into ChromaDB collection with full metadata
Collection names: gst, rbi, sebi, mca, user_docs

Usage:
    python pipeline/indexer.py                    # index GST (default)
    python pipeline/indexer.py --corpus gst       # GST only
    python pipeline/indexer.py --corpus all       # all 4 corpora
    python pipeline/indexer.py --corpus gst --reset  # wipe + re-index
    python pipeline/indexer.py --corpus gst --verify # test a search query
"""

import json
import re
import argparse
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Any

from tqdm import tqdm
from loguru import logger
import chromadb
from chromadb.config import Settings

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

BASE_DIR    = Path(__file__).parent.parent
DATA_DIR    = BASE_DIR / "data"
VECTORDB_DIR = BASE_DIR / "vectordb"

# ChromaDB upsert batch size
# ChromaDB has a 5461-item limit per batch — 500 is safe
BATCH_SIZE = 500

CORPORA = ["gst", "rbi", "sebi", "mca", "fema"]

# ─────────────────────────────────────────────────────────────
#  Logger
# ─────────────────────────────────────────────────────────────

def setup_logger(corpus: str):
    log_file = DATA_DIR / corpus / "indexer.log"
    logger.remove()
    logger.add(
        lambda msg: print(msg, end=""),
        level="INFO",
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}",
    )
    logger.add(str(log_file), level="DEBUG", rotation="10 MB",
               format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}")


# ─────────────────────────────────────────────────────────────
#  ChromaDB Client
# ─────────────────────────────────────────────────────────────

def get_chroma_client() -> chromadb.Client:
    """
    Returns a persistent ChromaDB client.
    Data is saved to vectordb/ folder — survives restarts.
    NOTE: When Docker is running, this still writes locally
          (backend container uses the Docker ChromaDB via HTTP).
          The pipeline scripts use local persistence directly.
    """
    VECTORDB_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(
        path=str(VECTORDB_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    return client


def get_or_create_collection(client: chromadb.Client, corpus: str) -> chromadb.Collection:
    """
    Get existing ChromaDB collection or create new one.
    Each corpus gets its own collection (namespace).
    """
    collection = client.get_or_create_collection(
        name=corpus,
        metadata={
            "description": f"Vidi regulatory corpus: {corpus.upper()}",
            "created_at": datetime.now().isoformat(),
            "hnsw:space": "cosine",   # cosine similarity for semantic search
        },
    )
    return collection


# ─────────────────────────────────────────────────────────────
#  Main Indexer
# ─────────────────────────────────────────────────────────────

def index_corpus(corpus: str, reset: bool = False, verify: bool = False):
    """
    Load embeddings → upsert into ChromaDB collection.
    """
    corpus_dir       = DATA_DIR / corpus
    embeddings_path  = corpus_dir / "embeddings.json"

    if not embeddings_path.exists():
        logger.error(f"embeddings.json not found at {embeddings_path}")
        logger.error(f"Run embedder first: python pipeline/embedder.py --corpus {corpus}")
        return

    setup_logger(corpus)

    # ── Load embedded chunks ──────────────────────────────────
    logger.info(f"Loading embeddings from {embeddings_path} ...")
    with open(embeddings_path, encoding="utf-8") as f:
        embedded_chunks = json.load(f)

    logger.info("=" * 60)
    logger.info(f"Vidi Indexer — Corpus: {corpus.upper()}")
    logger.info(f"Chunks to index:  {len(embedded_chunks)}")
    logger.info(f"VectorDB path:    {VECTORDB_DIR}")
    logger.info(f"Reset collection: {reset}")
    logger.info("=" * 60)

    # ── Connect to ChromaDB ───────────────────────────────────
    logger.info("Connecting to ChromaDB (local persistent)...")
    client = get_chroma_client()

    # ── Reset collection if requested ────────────────────────
    if reset:
        try:
            client.delete_collection(corpus)
            logger.info(f"Deleted existing '{corpus}' collection")
        except Exception:
            pass  # collection didn't exist yet

    collection = get_or_create_collection(client, corpus)
    existing_count = collection.count()
    logger.info(f"Collection '{corpus}': {existing_count} existing docs")

    # ── Prepare data for ChromaDB ─────────────────────────────
    # ChromaDB needs 4 lists: ids, embeddings, documents, metadatas

    ids         = []
    embeddings  = []
    documents   = []
    metadatas   = []

    for chunk in embedded_chunks:
        chunk_id = chunk.get("chunk_id", "")
        if not chunk_id:
            continue

        # Metadata stored alongside each chunk in ChromaDB
        # Only include scalar types (str, int, float, bool)
        meta = {
            "corpus":             str(chunk.get("corpus", corpus)),
            "source":             str(chunk.get("source", corpus.upper())),
            "filename":           str(chunk.get("filename", "")),
            "circular_no":        str(chunk.get("circular_no", "unknown")),
            "date":               str(chunk.get("date", "unknown")),
            "title":              str(chunk.get("title", ""))[:200],
            "url":                str(chunk.get("url", "")),
            "chunk_index":        int(chunk.get("chunk_index", 0)),
            "total_chunks":       int(chunk.get("total_chunks", 1)),
            "char_count":         int(chunk.get("char_count", 0)),
            "extraction_method":  str(chunk.get("extraction_method", "unknown")),
        }

        ids.append(chunk_id)
        embeddings.append(chunk["embedding"])
        documents.append(chunk["text"])
        metadatas.append(meta)

    if not ids:
        logger.error("No valid chunks to index!")
        return

    # ── Upsert in batches ─────────────────────────────────────
    logger.info(f"Upserting {len(ids)} chunks into ChromaDB collection '{corpus}'...")
    success_count = 0

    for i in tqdm(range(0, len(ids), BATCH_SIZE), desc=f"Indexing {corpus.upper()}"):
        batch_ids       = ids[i : i + BATCH_SIZE]
        batch_embeddings = embeddings[i : i + BATCH_SIZE]
        batch_documents = documents[i : i + BATCH_SIZE]
        batch_metadatas = metadatas[i : i + BATCH_SIZE]

        try:
            collection.upsert(
                ids=batch_ids,
                embeddings=batch_embeddings,
                documents=batch_documents,
                metadatas=batch_metadatas,
            )
            success_count += len(batch_ids)
        except Exception as e:
            logger.error(f"Batch {i//BATCH_SIZE + 1} failed: {e}")

    # ── Verify final count ────────────────────────────────────
    final_count = collection.count()

    # ── Summary ───────────────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info(f"INDEXING COMPLETE — {corpus.upper()}")
    logger.info(f"  ✓ Chunks upserted:   {success_count}")
    logger.info(f"  📚 Collection total: {final_count} docs")
    logger.info(f"  💾 VectorDB path:    {VECTORDB_DIR}")
    logger.info("=" * 60)

    # ── Optional verification ─────────────────────────────────
    if verify:
        verify_search(collection, corpus)

    return final_count


# ─────────────────────────────────────────────────────────────
#  Verification — Test Search
# ─────────────────────────────────────────────────────────────

def verify_search(collection, corpus: str):
    """
    Run a test semantic search to verify ChromaDB is working.
    Uses a pre-computed query embedding for the test query.
    """
    from sentence_transformers import SentenceTransformer

    test_queries = {
        "gst":  "GST registration threshold turnover limit",
        "rbi":  "RBI interest rate monetary policy",
        "sebi": "SEBI listing requirements stock exchange",
        "mca":  "Companies Act director compliance",
        "fema": "FEMA foreign exchange regulation or Income Tax Act",
    }

    query = test_queries.get(corpus, "compliance regulation India")

    logger.info(f"\nVerification — test query: '{query}'")
    logger.info("Loading model for query embedding...")

    model = SentenceTransformer("all-MiniLM-L6-v2")
    query_embedding = model.encode(
        query,
        normalize_embeddings=True,
    ).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3,
        include=["documents", "metadatas", "distances"],
    )

    print(f"\n{'='*60}")
    print(f"TEST SEARCH RESULTS — '{query}'")
    print(f"{'='*60}")

    docs      = results["documents"][0]
    metas     = results["metadatas"][0]
    distances = results["distances"][0]

    for i, (doc, meta, dist) in enumerate(zip(docs, metas, distances), 1):
        similarity = round(1 - dist, 3)
        print(f"\n--- Result {i} (similarity: {similarity}) ---")
        print(f"Source:   {meta.get('source')} | {meta.get('circular_no')} | {meta.get('date')}")
        print(f"File:     {meta.get('filename')}")
        print(f"Preview:  {doc[:250]}...")

    print(f"\n✓ ChromaDB is working correctly!\n")


# ─────────────────────────────────────────────────────────────
#  Show All Collections
# ─────────────────────────────────────────────────────────────

# =============================================================================
#  Day 50 — Citation Graph Extraction Engine
# =============================================================================
#
#  Goal: Extract regulatory cross-references from ChromaDB chunk text,
#  build an adjacency list {source_circular -> [cited_circulars]}, and
#  serialize to data/citation_graph.json for D3.js visualisation.
#
#  IEEE Contribution: First empirical mapping of the Indian regulatory
#  citation network across GST, RBI, SEBI, MCA, and FEMA corpora.
# =============================================================================


# ─────────────────────────────────────────────────────────────
#  Regex Patterns — Authority-Specific Citation Formats
# ─────────────────────────────────────────────────────────────
#
#  Each pattern captures a distinct citation format found in Indian
#  financial regulatory documents. All patterns are case-insensitive.
#  Order matters: more specific patterns come first to avoid overlap.

CITATION_PATTERNS: list[re.Pattern] = [
    # ── RBI: Master Directions & Master Circulars ─────────────────────────
    # e.g. "RBI/2023-24/101", "DBR.No.BP.BC.1/21.06.201/2015-16"
    re.compile(
        r"\bRBI[/.]\d{4}[-]\d{2,4}[/.]\d+\b",
        re.IGNORECASE,
    ),
    # Master Direction / Master Circular with sequence number
    re.compile(
        r"\b(?:Master\s+Direction|Master\s+Circular)[^,;\n]{0,40}?\d{1,3}/\d{4}[-]\d{2,4}\b",
        re.IGNORECASE,
    ),
    # RBI Department codes: DBR, DNBR, DCBR, DoR, FMRD, etc.
    re.compile(
        r"\b(?:DBR|DNBR|DCBR|DoR|FMRD|DPSS|CO\.DGBA|DOR|DBS|RBI)[. /](?:No\.)?[A-Z0-9./]{5,40}\b",
        re.IGNORECASE,
    ),

    # ── SEBI: Circular and Letter reference formats ───────────────────────
    # e.g. "SEBI/HO/IMD/DF2/CIR/P/2021/570", "CIR/CFD/CMD/12/2015"
    re.compile(
        r"\bSEBI[/](?:HO|CIR|IMD|CFD|MRD|OIAE|ISD|LAD|GID|DAFN|SMD)[/][A-Z0-9_/]{3,50}\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bCIR[/][A-Z]{2,6}[/][A-Z0-9]{1,10}[/]\d+[/]\d{4}\b",
        re.IGNORECASE,
    ),

    # ── GST: Circulars, Notifications, Orders ────────────────────────────
    # e.g. "Circular No. 105/24/2019-GST", "Notification No. 49/2019-Central Tax"
    re.compile(
        r"(?:Circular|Notification|Order)\s+No\.?\s*\d+[/]\d+[/-]\d{4}[-][A-Z ]{2,20}",
        re.IGNORECASE,
    ),
    # GST council decisions: "GST Council's 45th meeting"
    re.compile(
        r"\bGST\s+Council(?:'s|s)?\s+\d+(?:st|nd|rd|th)\s+(?:Meeting|Recommendation)\b",
        re.IGNORECASE,
    ),

    # ── FEMA: Notifications, Regulations, Amendments ─────────────────────
    # e.g. "FEMA 20(R)/2017-RB", "A.P.(DIR Series) Circular No. 15"
    re.compile(
        r"\bFEMA\s+\d+(?:\(R\))?[/]\d{4}[-]RB\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bA\.P\.\(DIR\s+Series\)\s+Circular\s+No\.?\s*\d+\b",
        re.IGNORECASE,
    ),

    # ── MCA: Companies Act sections, LLP rules ───────────────────────────
    # e.g. "Section 135 of the Companies Act, 2013", "Rule 12 of Companies Rules, 2014"
    re.compile(
        r"\bSection\s+\d+[A-Z]?(?:\(\d+\))?\s+of\s+(?:the\s+)?Companies\s+Act,?\s*(?:1956|2013)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bRule\s+\d+[A-Z]?\s+of\s+(?:the\s+)?(?:Companies|LLP)\s+(?:Accounts\s+)?Rules,?\s*\d{4}\b",
        re.IGNORECASE,
    ),

    # ── Cross-authority references ────────────────────────────────────────
    # e.g. "Income Tax Act, 1961", "Prevention of Money Laundering Act"
    re.compile(
        r"\b(?:Income\s+Tax\s+Act|PMLA|Prevention\s+of\s+Money\s+Laundering\s+Act|SEBI\s+Act|RBI\s+Act|Banking\s+Regulation\s+Act|Foreign\s+Trade\s+Policy),?\s*(?:\d{4})?\b",
        re.IGNORECASE,
    ),
]

# Authority → corpus label mapping for cross-reference enrichment
AUTHORITY_CORPUS_MAP: dict[str, str] = {
    "RBI": "rbi",
    "Master Direction": "rbi",
    "Master Circular": "rbi",
    "DBR": "rbi",
    "DNBR": "rbi",
    "SEBI": "sebi",
    "CIR/CFD": "sebi",
    "CIR/IMD": "sebi",
    "GST": "gst",
    "Central Tax": "gst",
    "FEMA": "fema",
    "A.P.(DIR": "fema",
    "Companies Act": "mca",
    "LLP": "mca",
    "Income Tax Act": "income_tax",
    "PMLA": "pmla",
}


def _infer_authority(ref: str) -> str:
    """Map a raw citation string to its issuing authority/corpus label."""
    ref_upper = ref.upper()
    for keyword, corpus in AUTHORITY_CORPUS_MAP.items():
        if keyword.upper() in ref_upper:
            return corpus
    return "unknown"


def _normalize_circular(raw: str) -> str:
    """Clean and normalise a raw extracted citation string."""
    # Collapse whitespace
    norm = re.sub(r"\s+", " ", raw).strip()
    # Remove trailing punctuation
    norm = norm.rstrip(".,;: ")
    return norm


def extract_citations_from_text(text: str) -> list[str]:
    """
    Apply all CITATION_PATTERNS to a chunk of text and return a
    deduplicated, normalised list of citation strings found.

    Args:
        text: Raw chunk text from ChromaDB.

    Returns:
        List of unique citation strings (may be empty).
    """
    found: set[str] = set()
    for pattern in CITATION_PATTERNS:
        for match in pattern.finditer(text):
            norm = _normalize_circular(match.group(0))
            if len(norm) >= 6:  # discard noise fragments shorter than 6 chars
                found.add(norm)
    return sorted(found)


# ─────────────────────────────────────────────────────────────
#  Graph Builder — ChromaDB → Adjacency List
# ─────────────────────────────────────────────────────────────

def build_citation_graph(
    output_path: Path | None = None,
    corpora: list[str] | None = None,
) -> dict:
    """
    Scan every chunk across all corpora in ChromaDB, extract cross-citations
    from text, and build the full citation graph.

    Graph schema
    ─────────────
    {
      "generated_at": "<ISO timestamp>",
      "total_nodes": <int>,
      "total_edges": <int>,
      "nodes": [
        {
          "id": "<canonical circular/doc id>",
          "label": "<short display label>",
          "corpus": "<gst|rbi|sebi|mca|fema>",
          "authority": "<issuing authority string>",
          "chunk_count": <int>,        # number of chunks with this circular_no
          "citation_count": <int>,     # how often this node is cited by others
          "outbound_count": <int>,     # how many citations this node makes
          "url": "<url or empty>"
        }, ...
      ],
      "edges": [
        {
          "source": "<source_id>",
          "target": "<target_id>",
          "weight": <int>,             # number of co-occurrence instances
          "corpus_src": "<corpus>",
          "corpus_tgt": "<corpus>"
        }, ...
      ],
      "adjacency": {
        "<source_circular_no>": ["<cited_circular_no>", ...],
        ...
      }
    }

    Args:
        output_path: Where to write citation_graph.json. Defaults to data/.
        corpora: Subset of corpora to process. Defaults to all.

    Returns:
        The graph dict (also written to disk).
    """
    if corpora is None:
        corpora = CORPORA

    if output_path is None:
        output_path = BASE_DIR / "data" / "citation_graph.json"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    client = get_chroma_client()
    available = {c.name for c in client.list_collections()}

    # ── Pass 1: Collect node registry and raw citations ───────
    # node_registry: {circular_no -> node_meta}
    node_registry: dict[str, dict[str, Any]] = {}
    # adjacency: {source_id -> Counter of cited_ids}
    adjacency: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for corpus in corpora:
        if corpus not in available:
            logger.warning(f"[citation] Corpus '{corpus}' not in ChromaDB — skipping")
            continue

        collection = client.get_collection(corpus)
        total = collection.count()
        logger.info(f"[citation] Scanning {total} chunks in '{corpus}'...")

        # Fetch all docs in batches to avoid memory issues
        batch_size = 500
        offset = 0

        while offset < total:
            try:
                results = collection.get(
                    limit=batch_size,
                    offset=offset,
                    include=["documents", "metadatas"],
                )
            except Exception as e:
                logger.error(f"[citation] Fetch error at offset {offset}: {e}")
                break

            docs = results.get("documents") or []
            metas = results.get("metadatas") or []

            for doc, meta in zip(docs, metas):
                source_id = meta.get("circular_no", "unknown")
                url = meta.get("url", "")
                title = meta.get("title", "")

                # Skip fully unknown sources — they carry no citation value
                if source_id in ("unknown", "", "N/A", None):
                    source_id = f"{corpus.upper()}-UNLINKED"

                # Register / update node
                if source_id not in node_registry:
                    node_registry[source_id] = {
                        "id": source_id,
                        "label": source_id[:60],
                        "corpus": corpus,
                        "authority": _infer_authority(source_id),
                        "chunk_count": 0,
                        "citation_count": 0,
                        "outbound_count": 0,
                        "url": url,
                        "title": title[:120] if title else "",
                    }
                node_registry[source_id]["chunk_count"] += 1

                # Extract citations from chunk text
                if doc:
                    cited_refs = extract_citations_from_text(doc)
                    for ref in cited_refs:
                        # Don't self-cite
                        if ref == source_id:
                            continue
                        adjacency[source_id][ref] += 1

            offset += batch_size

    # ── Pass 2: Register cited nodes that are not yet in registry ─
    for source_id, targets in adjacency.items():
        for target_id, weight in targets.items():
            if target_id not in node_registry:
                # Inferred node — exists only as a citation target
                node_registry[target_id] = {
                    "id": target_id,
                    "label": target_id[:60],
                    "corpus": _infer_authority(target_id),
                    "authority": _infer_authority(target_id),
                    "chunk_count": 0,      # not directly indexed
                    "citation_count": 0,
                    "outbound_count": 0,
                    "url": "",
                    "title": "",
                }
            # Increment inbound citation count on target
            node_registry[target_id]["citation_count"] += weight
            # Increment outbound count on source
            node_registry[source_id]["outbound_count"] += weight

    # ── Pass 3: Build edges list + plain adjacency dict ───────
    edges: list[dict] = []
    plain_adjacency: dict[str, list[str]] = {}

    for source_id, targets in adjacency.items():
        plain_adjacency[source_id] = sorted(targets.keys())
        src_corpus = node_registry.get(source_id, {}).get("corpus", "unknown")
        for target_id, weight in targets.items():
            tgt_corpus = node_registry.get(target_id, {}).get("corpus", "unknown")
            edges.append({
                "source": source_id,
                "target": target_id,
                "weight": weight,
                "corpus_src": src_corpus,
                "corpus_tgt": tgt_corpus,
            })

    # Sort edges by weight descending for D3 visual priority
    edges.sort(key=lambda e: -e["weight"])

    # ── Compile final graph ────────────────────────────────────
    nodes = list(node_registry.values())

    # Sort nodes: by citation_count desc (most-cited hubs first)
    nodes.sort(key=lambda n: -n["citation_count"])

    graph = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "corpora_scanned": corpora,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "nodes": nodes,
        "edges": edges,
        "adjacency": plain_adjacency,
    }

    # ── Write to disk ──────────────────────────────────────────
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)

    logger.success(
        f"[citation] Graph written to {output_path}\n"
        f"  Nodes: {len(nodes)} | Edges: {len(edges)}"
    )

    # Print summary table
    print(f"\n{'='*60}")
    print(f"RegIQ Citation Graph — Extraction Complete")
    print(f"{'='*60}")
    print(f"  Output:       {output_path}")
    print(f"  Nodes:        {len(nodes)}")
    print(f"  Edges:        {len(edges)}")
    print(f"  Corpora:      {', '.join(corpora)}")
    print(f"  Generated at: {graph['generated_at']}")

    # Top-10 most cited nodes (hubs)
    top_cited = sorted(nodes, key=lambda n: -n["citation_count"])[:10]
    if any(n["citation_count"] > 0 for n in top_cited):
        print(f"\n  Top cited nodes (hubs):")
        for n in top_cited:
            if n["citation_count"] > 0:
                print(f"    [{n['corpus']:>5}] {n['id'][:55]:<55} cited {n['citation_count']}x")
    print(f"{'='*60}\n")

    return graph


def show_collections():
    """Print all ChromaDB collections and their sizes."""
    client = get_chroma_client()
    collections = client.list_collections()

    print(f"\n{'='*60}")
    print(f"ChromaDB Collections ({len(collections)} total)")
    print(f"{'='*60}")
    for col in collections:
        count = client.get_collection(col.name).count()
        print(f"  {col.name:<15} {count:>6} documents")
    print()


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="RegIQ — ChromaDB Indexer + Citation Graph Builder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pipeline/indexer.py                         # index all corpora (default)
  python pipeline/indexer.py --corpus gst            # GST only
  python pipeline/indexer.py --corpus all            # all corpora
  python pipeline/indexer.py --corpus gst --reset    # wipe + re-index
  python pipeline/indexer.py --corpus gst --verify   # test search after index
  python pipeline/indexer.py --collections           # show all collections
  python pipeline/indexer.py --graph                 # build citation_graph.json (Day 50)
  python pipeline/indexer.py --graph --corpus rbi    # citation graph for RBI only
        """
    )
    parser.add_argument(
        "--corpus",
        choices=["gst", "rbi", "sebi", "mca", "fema", "all"],
        default="all",
    )
    parser.add_argument("--reset", action="store_true",
                        help="Delete existing collection before indexing")
    parser.add_argument("--verify", action="store_true",
                        help="Run test search after indexing")
    parser.add_argument("--collections", action="store_true",
                        help="Show all ChromaDB collections and exit")
    parser.add_argument(
        "--graph",
        action="store_true",
        help="(Day 50) Extract citation relationships and build data/citation_graph.json",
    )
    args = parser.parse_args()

    if args.collections:
        show_collections()
        return

    # Day 50: Citation graph generation mode
    if args.graph:
        target_corpora = CORPORA if args.corpus == "all" else [args.corpus]
        build_citation_graph(corpora=target_corpora)
        return

    if args.corpus == "all":
        for corpus in CORPORA:
            index_corpus(corpus, args.reset, args.verify)
    else:
        index_corpus(args.corpus, args.reset, args.verify)


if __name__ == "__main__":
    main()
