"""
Vidi — pipeline/checkpoint.py
Day 7 Task: Pipeline Checkpoint

Runs end-to-end verification:
1. Confirms ChromaDB has all 4 collections (gst, rbi, sebi, mca)
2. Runs 10 test queries per corpus, prints top result + similarity
3. Reports chunking/OCR failure stats from each corpus
4. Produces a summary report → data/checkpoint_report.json

Usage:
    python pipeline/checkpoint.py              # full checkpoint
    python pipeline/checkpoint.py --corpus gst # single corpus only
"""

import json
import argparse
from pathlib import Path
from datetime import datetime

from loguru import logger
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

BASE_DIR     = Path(__file__).parent.parent
DATA_DIR     = BASE_DIR / "data"
VECTORDB_DIR = BASE_DIR / "vectordb"

CORPORA = ["gst", "rbi", "sebi", "mca"]

# 10 test queries per corpus — covers common SME compliance questions
TEST_QUERIES = {
    "gst": [
        "What is the GST registration threshold for turnover?",
        "How to claim input tax credit under GST?",
        "What is the GST rate for restaurant services?",
        "What is the due date for filing GSTR-3B?",
        "What is the composition scheme under GST?",
        "How to register for GST as a new business?",
        "What are e-invoicing requirements under GST?",
        "What is reverse charge mechanism in GST?",
        "What are the penalties for late GST filing?",
        "How is GST applicable on export of services?",
    ],
    "rbi": [
        "What are KYC requirements for opening a bank account?",
        "What is the Liberalised Remittance Scheme limit?",
        "What are the rules for NBFC registration?",
        "What is the interest rate on savings bank accounts?",
        "What are the guidelines for digital lending?",
        "What is the priority sector lending requirement?",
        "What are UPI transaction limits?",
        "What is the master direction for prepaid payment instruments?",
        "What are the FEMA rules for foreign investment?",
        "What is the Kisan Credit Card scheme?",
    ],
    "sebi": [
        "What are the listing requirements for SME IPO?",
        "What is insider trading regulation under SEBI?",
        "What are mutual fund disclosure requirements?",
        "What is the SEBI takeover code?",
        "What are the ESG disclosure norms for listed companies?",
        "What are SEBI registration requirements for investment advisers?",
        "What is T+0 settlement cycle?",
        "What are SEBI cybersecurity framework requirements?",
        "What are SEBI regulations for alternative investment funds?",
        "What is the SEBI portfolio manager registration process?",
    ],
    "mca": [
        "What are the director KYC requirements under Companies Act?",
        "What is the procedure for company incorporation?",
        "What are annual filing requirements for private companies?",
        "What is the minimum number of directors required?",
        "What are LLP compliance requirements?",
        "What is the procedure for striking off a company?",
        "What are the rules for related party transactions?",
        "What is the requirement for board meetings frequency?",
        "What are the penalties for non-compliance under Companies Act?",
        "What is the process for changing registered office address?",
    ],
}


# ─────────────────────────────────────────────────────────────
#  Logger
# ─────────────────────────────────────────────────────────────

def setup_logger():
    log_file = DATA_DIR / "checkpoint.log"
    logger.remove()
    logger.add(lambda msg: print(msg, end=""), level="INFO",
               format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}")
    logger.add(str(log_file), level="DEBUG", rotation="5 MB",
               format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}")


# ─────────────────────────────────────────────────────────────
#  ChromaDB Connection
# ─────────────────────────────────────────────────────────────

def get_client():
    return chromadb.PersistentClient(
        path=str(VECTORDB_DIR),
        settings=Settings(anonymized_telemetry=False),
    )


# ─────────────────────────────────────────────────────────────
#  Step 1: Verify Collections Exist
# ─────────────────────────────────────────────────────────────

def check_collections(client) -> dict:
    """Verify all 4 collections exist and report doc counts."""
    logger.info("\n" + "=" * 60)
    logger.info("STEP 1 — Verify ChromaDB Collections")
    logger.info("=" * 60)

    existing = {c.name: client.get_collection(c.name).count()
                for c in client.list_collections()}

    results = {}
    for corpus in CORPORA:
        count = existing.get(corpus, 0)
        status = "✓ OK" if count > 0 else "✗ MISSING/EMPTY"
        logger.info(f"  {corpus.upper():<6} {count:>6} docs   {status}")
        results[corpus] = {"exists": corpus in existing, "doc_count": count}

    total = sum(r["doc_count"] for r in results.values())
    logger.info(f"\n  TOTAL: {total} chunks across {len(existing)} collections")

    return results


# ─────────────────────────────────────────────────────────────
#  Step 2: Run Test Queries
# ─────────────────────────────────────────────────────────────

def run_test_queries(client, model, corpus: str) -> dict:
    """Run 10 test queries against a corpus collection."""
    logger.info(f"\n--- Testing {corpus.upper()} ({len(TEST_QUERIES[corpus])} queries) ---")

    try:
        collection = client.get_collection(corpus)
    except Exception:
        logger.error(f"  Collection '{corpus}' does not exist — skipping")
        return {"corpus": corpus, "queries": [], "avg_similarity": 0, "pass_rate": 0}

    if collection.count() == 0:
        logger.error(f"  Collection '{corpus}' is empty — skipping")
        return {"corpus": corpus, "queries": [], "avg_similarity": 0, "pass_rate": 0}

    query_results = []
    similarities   = []

    for i, query in enumerate(TEST_QUERIES[corpus], 1):
        query_emb = model.encode(query, normalize_embeddings=True).tolist()

        results = collection.query(
            query_embeddings=[query_emb],
            n_results=1,
            include=["documents", "metadatas", "distances"],
        )

        if results["documents"][0]:
            doc      = results["documents"][0][0]
            meta     = results["metadatas"][0][0]
            distance = results["distances"][0][0]
            similarity = round(1 - distance, 3)
            similarities.append(similarity)

            passed = similarity >= 0.4  # reasonable relevance threshold
            status = "✓" if passed else "⚠"

            logger.info(f"  [{i:2d}] {status} sim={similarity:.3f} | {query[:55]}")
            logger.debug(f"       → {meta.get('circular_no','?')} | {doc[:100]}...")

            query_results.append({
                "query": query,
                "similarity": similarity,
                "passed": passed,
                "top_result_circular": meta.get("circular_no", "unknown"),
                "top_result_file": meta.get("filename", "unknown"),
                "preview": doc[:200],
            })
        else:
            logger.warning(f"  [{i:2d}] ✗ No results | {query[:55]}")
            query_results.append({"query": query, "similarity": 0, "passed": False})

    avg_sim   = round(sum(similarities) / len(similarities), 3) if similarities else 0
    pass_rate = round(sum(1 for q in query_results if q.get("passed")) / len(query_results) * 100, 1)

    logger.info(f"  → Avg similarity: {avg_sim} | Pass rate: {pass_rate}%")

    return {
        "corpus": corpus,
        "queries": query_results,
        "avg_similarity": avg_sim,
        "pass_rate": pass_rate,
    }


# ─────────────────────────────────────────────────────────────
#  Step 3: Chunking/OCR Stats
# ─────────────────────────────────────────────────────────────

def check_chunking_stats() -> dict:
    """Read chunks_stats.json from each corpus to report OCR/failure rates."""
    logger.info("\n" + "=" * 60)
    logger.info("STEP 3 — Chunking & OCR Stats")
    logger.info("=" * 60)

    results = {}
    for corpus in CORPORA:
        stats_path = DATA_DIR / corpus / "chunks_stats.json"
        if not stats_path.exists():
            logger.warning(f"  {corpus.upper():<6} — no chunks_stats.json found")
            results[corpus] = None
            continue

        with open(stats_path) as f:
            stats = json.load(f)

        total = stats.get("total_pdfs", 0)
        success = stats.get("success", 0)
        failed = stats.get("failed", 0)
        ocr = stats.get("ocr_used", 0)
        chunks = stats.get("total_chunks", 0)

        success_rate = round(success / total * 100, 1) if total else 0

        logger.info(
            f"  {corpus.upper():<6} {success}/{total} PDFs ({success_rate}%) | "
            f"OCR: {ocr} | Failed: {failed} | Chunks: {chunks}"
        )
        results[corpus] = stats

    return results


# ─────────────────────────────────────────────────────────────
#  Step 4: Generate Pipeline README
# ─────────────────────────────────────────────────────────────

def generate_readme(collection_results, query_results, chunking_results):
    """Generate pipeline/README.md documenting the data pipeline."""

    total_chunks = sum(r["doc_count"] for r in collection_results.values())

    lines = []
    lines.append("# Vidi — Data Pipeline\n")
    lines.append("> Generated by `pipeline/checkpoint.py` on "
                  f"{datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

    lines.append("## Pipeline Overview\n")
    lines.append("```")
    lines.append("scraper.py / rbi_scraper.py / sebi_scraper.py")
    lines.append("    ↓  downloads PDFs → data/{corpus}/*.pdf + index.csv")
    lines.append("chunker.py")
    lines.append("    ↓  PyMuPDF + pytesseract OCR → data/{corpus}/chunks.json")
    lines.append("embedder.py")
    lines.append("    ↓  all-MiniLM-L6-v2 → data/{corpus}/embeddings.json")
    lines.append("indexer.py")
    lines.append("    ↓  upserts into ChromaDB → vectordb/")
    lines.append("```\n")

    lines.append("## ChromaDB Collections\n")
    lines.append("| Corpus | Documents (chunks) | Status |")
    lines.append("|---|---|---|")
    for corpus, r in collection_results.items():
        status = "✅ Indexed" if r["doc_count"] > 0 else "❌ Empty/Missing"
        lines.append(f"| {corpus.upper()} | {r['doc_count']:,} | {status} |")
    lines.append(f"\n**Total chunks across all corpora: {total_chunks:,}**\n")

    lines.append("## Chunking & OCR Stats\n")
    lines.append("| Corpus | PDFs Processed | Success Rate | OCR Used | Total Chunks |")
    lines.append("|---|---|---|---|---|")
    for corpus, stats in chunking_results.items():
        if stats is None:
            lines.append(f"| {corpus.upper()} | — | — | — | — |")
            continue
        total = stats.get("total_pdfs", 0)
        success = stats.get("success", 0)
        rate = round(success/total*100,1) if total else 0
        ocr = stats.get("ocr_used", 0)
        chunks = stats.get("total_chunks", 0)
        lines.append(f"| {corpus.upper()} | {success}/{total} | {rate}% | {ocr} | {chunks:,} |")

    lines.append("\n## Test Query Results\n")
    lines.append("10 manually-curated SME compliance questions per corpus, "
                  "tested against ChromaDB semantic search.\n")
    lines.append("| Corpus | Avg Similarity | Pass Rate (≥0.4) |")
    lines.append("|---|---|---|")
    for corpus, r in query_results.items():
        lines.append(f"| {corpus.upper()} | {r['avg_similarity']} | {r['pass_rate']}% |")

    lines.append("\n## Known Issues / Notes\n")
    for corpus, stats in chunking_results.items():
        if stats is None:
            continue
        failed = stats.get("failed", 0)
        if failed > 0:
            lines.append(f"- **{corpus.upper()}**: {failed} PDF(s) failed extraction "
                          f"(empty/corrupted/scanned beyond OCR readability)")

    for corpus, r in query_results.items():
        weak = [q for q in r["queries"] if not q.get("passed")]
        if weak:
            lines.append(f"- **{corpus.upper()}**: {len(weak)} test query(ies) "
                          f"returned low similarity (<0.4) — may need more targeted scraping")

    lines.append("\n## Re-running the Pipeline\n")
    lines.append("```bash")
    lines.append("# Single corpus, full pipeline")
    lines.append("python pipeline/scraper.py --corpus gst")
    lines.append("python pipeline/chunker.py --corpus gst")
    lines.append("python pipeline/embedder.py --corpus gst")
    lines.append("python pipeline/indexer.py --corpus gst --verify")
    lines.append("")
    lines.append("# RBI / SEBI use dedicated scrapers")
    lines.append("python pipeline/rbi_scraper.py")
    lines.append("python pipeline/sebi_scraper.py")
    lines.append("")
    lines.append("# Re-run checkpoint anytime")
    lines.append("python pipeline/checkpoint.py")
    lines.append("```\n")

    lines.append("---")
    lines.append("*Phase 1 (Data Pipeline) — Vidi Project*")

    readme_path = BASE_DIR / "pipeline" / "README.md"
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    logger.info(f"\n📄 Pipeline README written to: {readme_path}")
    return readme_path


# ─────────────────────────────────────────────────────────────
#  Main Checkpoint
# ─────────────────────────────────────────────────────────────

def run_checkpoint(corpus_filter: str = None):
    setup_logger()
    DATA_DIR.mkdir(exist_ok=True)

    logger.info("=" * 60)
    logger.info("Vidi — Pipeline Checkpoint (Day 7)")
    logger.info("=" * 60)

    client = get_client()

    # Step 1: Collections
    collection_results = check_collections(client)

    # Step 2: Test queries
    logger.info("\n" + "=" * 60)
    logger.info("STEP 2 — Test Queries (10 per corpus)")
    logger.info("=" * 60)

    logger.info("Loading embedding model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    corpora_to_test = [corpus_filter] if corpus_filter else CORPORA
    query_results = {}
    for corpus in corpora_to_test:
        query_results[corpus] = run_test_queries(client, model, corpus)

    # Step 3: Chunking stats
    chunking_results = check_chunking_stats()

    # Step 4: Generate README
    readme_path = generate_readme(collection_results, query_results, chunking_results)

    # Save full report as JSON
    report = {
        "generated_at": datetime.now().isoformat(),
        "collections": collection_results,
        "query_tests": query_results,
        "chunking_stats": chunking_results,
    }
    report_path = DATA_DIR / "checkpoint_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)

    # ── Final Summary ─────────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info("CHECKPOINT COMPLETE")
    logger.info("=" * 60)

    total_chunks = sum(r["doc_count"] for r in collection_results.values())
    collections_ok = sum(1 for r in collection_results.values() if r["doc_count"] > 0)
    overall_avg_sim = round(
        sum(r["avg_similarity"] for r in query_results.values()) / len(query_results), 3
    ) if query_results else 0

    logger.info(f"  Collections live:   {collections_ok}/4")
    logger.info(f"  Total chunks:       {total_chunks:,}")
    logger.info(f"  Overall avg sim:    {overall_avg_sim}")
    logger.info(f"  Report saved:       {report_path}")
    logger.info(f"  README saved:       {readme_path}")

    if collections_ok == 4:
        logger.info("\n  🎉 ALL 4 CORPORA INDEXED — Phase 1 data pipeline COMPLETE!")
    else:
        missing = [c for c, r in collection_results.items() if r["doc_count"] == 0]
        logger.warning(f"\n  ⚠ Missing/empty corpora: {', '.join(missing)}")
        logger.warning(f"  Run their scrapers before declaring Phase 1 complete.")

    logger.info("=" * 60)


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Vidi — Pipeline Checkpoint")
    parser.add_argument("--corpus", choices=CORPORA, default=None,
                        help="Test only a single corpus (default: all)")
    args = parser.parse_args()
    run_checkpoint(args.corpus)


if __name__ == "__main__":
    main()
    