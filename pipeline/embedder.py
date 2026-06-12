"""
Vidi — pipeline/embedder.py
Day 4 Task: Generate embeddings for all chunks

Reads chunks from data/{corpus}/chunks.json
Generates embeddings using sentence-transformers all-MiniLM-L6-v2
Saves embeddings to data/{corpus}/embeddings.json

Usage:
    python pipeline/embedder.py                    # embed GST (default)
    python pipeline/embedder.py --corpus gst       # GST only
    python pipeline/embedder.py --corpus all       # all 4 corpora
    python pipeline/embedder.py --corpus gst --limit 50  # test: 50 chunks
"""

import json
import argparse
from pathlib import Path
from datetime import datetime

from tqdm import tqdm
from loguru import logger
from sentence_transformers import SentenceTransformer

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

BASE_DIR   = Path(__file__).parent.parent
DATA_DIR   = BASE_DIR / "data"

# Embedding model — matches master prompt spec
MODEL_NAME = "all-MiniLM-L6-v2"

# Batch size — how many chunks to embed at once
# Higher = faster but more RAM. 64 is safe for most machines.
BATCH_SIZE = 64

CORPORA = ["gst", "rbi", "sebi", "mca"]

# ─────────────────────────────────────────────────────────────
#  Logger
# ─────────────────────────────────────────────────────────────

def setup_logger(corpus: str):
    log_file = DATA_DIR / corpus / "embedder.log"
    logger.remove()
    logger.add(
        lambda msg: print(msg, end=""),
        level="INFO",
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}",
    )
    logger.add(str(log_file), level="DEBUG", rotation="10 MB",
               format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}")


# ─────────────────────────────────────────────────────────────
#  Main Embedder
# ─────────────────────────────────────────────────────────────

def embed_corpus(corpus: str, limit: int = None):
    """
    Load chunks → generate embeddings → save to embeddings.json
    """
    corpus_dir  = DATA_DIR / corpus
    chunks_path = corpus_dir / "chunks.json"

    if not chunks_path.exists():
        logger.error(f"chunks.json not found at {chunks_path}")
        logger.error(f"Run chunker first: python pipeline/chunker.py --corpus {corpus}")
        return None

    setup_logger(corpus)

    # ── Load chunks ───────────────────────────────────────────
    with open(chunks_path, encoding="utf-8") as f:
        chunks = json.load(f)

    if limit:
        chunks = chunks[:limit]
        logger.info(f"Limit mode: processing {limit} chunks only")

    logger.info("=" * 60)
    logger.info(f"Vidi Embedder — Corpus: {corpus.upper()}")
    logger.info(f"Model:        {MODEL_NAME}")
    logger.info(f"Chunks:       {len(chunks)}")
    logger.info(f"Batch size:   {BATCH_SIZE}")
    logger.info("=" * 60)

    # ── Load model ────────────────────────────────────────────
    logger.info(f"Loading model: {MODEL_NAME}  (downloads ~90MB on first run)...")
    model = SentenceTransformer(MODEL_NAME)
    logger.info(f"Model loaded ✓  (embedding dim: {model.get_sentence_embedding_dimension()})")

    # ── Extract texts ─────────────────────────────────────────
    texts = [chunk["text"] for chunk in chunks]

    # ── Generate embeddings in batches ────────────────────────
    logger.info(f"Generating embeddings for {len(texts)} chunks...")
    all_embeddings = []

    for i in tqdm(range(0, len(texts), BATCH_SIZE), desc=f"Embedding {corpus.upper()}"):
        batch = texts[i : i + BATCH_SIZE]
        batch_embeddings = model.encode(
            batch,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,   # L2 normalize for cosine similarity
        )
        all_embeddings.extend(batch_embeddings.tolist())

    # ── Attach embeddings to chunks ───────────────────────────
    embedded_chunks = []
    for chunk, embedding in zip(chunks, all_embeddings):
        embedded_chunk = {**chunk, "embedding": embedding}
        embedded_chunks.append(embedded_chunk)

    # ── Save embeddings.json ──────────────────────────────────
    output_path = corpus_dir / "embeddings.json"
    logger.info(f"Saving embeddings to {output_path} ...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(embedded_chunks, f, ensure_ascii=False)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)

    # ── Summary ───────────────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info(f"EMBEDDING COMPLETE — {corpus.upper()}")
    logger.info(f"  ✓ Chunks embedded:   {len(embedded_chunks)}")
    logger.info(f"  📐 Embedding dim:    {len(all_embeddings[0]) if all_embeddings else 0}")
    logger.info(f"  💾 Saved to:         {output_path}")
    logger.info(f"  📦 File size:        {file_size_mb:.1f} MB")
    logger.info("=" * 60)

    return embedded_chunks


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Vidi — Embedder")
    parser.add_argument("--corpus", choices=["gst", "rbi", "sebi", "mca", "fema", "all"], default="all")
    
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    if args.corpus == "all":
        for corpus in CORPORA:
            embed_corpus(corpus, args.limit)
    else:
        embed_corpus(args.corpus, args.limit)


if __name__ == "__main__":
    main()
