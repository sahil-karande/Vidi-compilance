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
import argparse
from pathlib import Path
from datetime import datetime

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
        description="Vidi — ChromaDB Indexer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pipeline/indexer.py                         # index GST (default)
  python pipeline/indexer.py --corpus gst            # GST only
  python pipeline/indexer.py --corpus all            # all 4 corpora
  python pipeline/indexer.py --corpus gst --reset    # wipe + re-index
  python pipeline/indexer.py --corpus gst --verify   # test search after index
  python pipeline/indexer.py --collections           # show all collections
        """
    )
    parser.add_argument("--corpus", choices=["gst", "rbi", "sebi", "mca", "fema", "all"], default="all")
    
    parser.add_argument("--reset", action="store_true",
                        help="Delete existing collection before indexing")
    parser.add_argument("--verify", action="store_true",
                        help="Run test search after indexing")
    parser.add_argument("--collections", action="store_true",
                        help="Show all ChromaDB collections and exit")
    args = parser.parse_args()

    if args.collections:
        show_collections()
        return

    if args.corpus == "all":
        for corpus in CORPORA:
            index_corpus(corpus, args.reset, args.verify)
    else:
        index_corpus(args.corpus, args.reset, args.verify)


if __name__ == "__main__":
    main()
