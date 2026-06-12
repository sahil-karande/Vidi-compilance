"""
Vidi — pipeline/chunker.py
Day 3 Task: PDF Text Extraction + Chunking

Reads PDFs from data/{corpus}/
Extracts text using PyMuPDF (primary) → pytesseract OCR (fallback)
Splits into 512-token chunks using LangChain RecursiveCharacterTextSplitter
Saves chunks to data/{corpus}/chunks.json

Usage:
    python pipeline/chunker.py                    # chunk GST (default)
    python pipeline/chunker.py --corpus gst       # GST only
    python pipeline/chunker.py --corpus rbi       # RBI only
    python pipeline/chunker.py --corpus all       # all 4 corpora
    python pipeline/chunker.py --corpus gst --limit 5   # test: 5 PDFs only
"""

import os
import re
import json
import argparse
from pathlib import Path
from datetime import datetime
import fitz  # PyMuPDF
from tqdm import tqdm
from loguru import logger
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

BASE_DIR   = Path(__file__).parent.parent   # vidi/ root
DATA_DIR   = BASE_DIR / "data"

# Chunking settings (matches master prompt spec)
CHUNK_SIZE    = 512    # tokens (approx characters / 4)
CHUNK_OVERLAP = 50     # token overlap between chunks

# OCR fallback threshold
# If PyMuPDF extracts fewer than this many characters → use OCR
MIN_TEXT_LENGTH = 5

# Supported corpora
CORPORA = ["gst", "rbi", "sebi", "mca"]

# ─────────────────────────────────────────────────────────────
#  Logger Setup
# ─────────────────────────────────────────────────────────────

def setup_logger(corpus: str):
    log_file = DATA_DIR / corpus / "chunker.log"
    logger.remove()
    logger.add(
        lambda msg: print(msg, end=""),
        level="INFO",
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}",
    )
    logger.add(
        str(log_file),
        level="DEBUG",
        rotation="10 MB",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}",
    )

# ─────────────────────────────────────────────────────────────
#  PDF Text Extraction
# ─────────────────────────────────────────────────────────────

def extract_text_pymupdf(pdf_path: Path) -> tuple[str, str]:
    """
    Primary extraction using PyMuPDF (fitz).
    Returns (extracted_text, method_used).
    method_used is 'pymupdf' or 'pymupdf_partial'.
    """
    try:
        import pytesseract
        from PIL import Image
        import io

        # ─── ADD THIS LINE HERE ─────────────────────────────────
        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        
        doc = fitz.open(str(pdf_path))
        full_text = []

        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                full_text.append(f"[Page {page_num + 1}]\n{text.strip()}")

        doc.close()
        combined = "\n\n".join(full_text)
        return combined, "pymupdf"

    except Exception as e:
        logger.warning(f"PyMuPDF failed on {pdf_path.name}: {e}")
        return "", "pymupdf_failed"


def extract_text_ocr(pdf_path: Path) -> tuple[str, str]:
    """
    OCR fallback using pytesseract for scanned/image PDFs.
    Renders each page as image → pytesseract reads text.
    Returns (extracted_text, 'ocr').
    """
    try:
        import pytesseract
        from PIL import Image
        import io

        doc = fitz.open(str(pdf_path))
        full_text = []

        for page_num, page in enumerate(doc):
            # Render page as image (300 DPI for good OCR accuracy)
            mat = fitz.Matrix(300 / 72, 300 / 72)
            pix = page.get_pixmap(matrix=mat)

            # Convert to PIL Image
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))

            # Run OCR
            text = pytesseract.image_to_string(img, lang="eng")
            if text.strip():
                full_text.append(f"[Page {page_num + 1}]\n{text.strip()}")

        doc.close()
        combined = "\n\n".join(full_text)
        return combined, "ocr"

    except ImportError:
        logger.warning("pytesseract not installed. Install: pip install pytesseract Pillow")
        return "", "ocr_unavailable"
    except Exception as e:
        logger.warning(f"OCR failed on {pdf_path.name}: {e}")
        return "", "ocr_failed"


def extract_text(pdf_path: Path) -> tuple[str, str]:
    """
    Smart extraction:
    1. Try PyMuPDF first
    2. If extracted text < MIN_TEXT_LENGTH chars → fall back to OCR
    Returns (text, method_used)
    """
    # Step 1: Try PyMuPDF
    text, method = extract_text_pymupdf(pdf_path)

    # Step 2: Check if extraction was meaningful
    clean_text = text.strip()
    char_count = len(clean_text)

    if char_count >= MIN_TEXT_LENGTH:
        logger.debug(f"  PyMuPDF: {char_count} chars extracted from {pdf_path.name}")
        return clean_text, "pymupdf"

    # Step 3: Fall back to OCR
    logger.debug(
        f"  PyMuPDF only got {char_count} chars (<{MIN_TEXT_LENGTH}) "
        f"from {pdf_path.name} → trying OCR..."
    )
    ocr_text, ocr_method = extract_text_ocr(pdf_path)
    ocr_char_count = len(ocr_text.strip())

    if ocr_char_count >= MIN_TEXT_LENGTH:
        logger.debug(f"  OCR: {ocr_char_count} chars extracted from {pdf_path.name}")
        return ocr_text.strip(), "ocr"

    # Step 4: Both failed — return whatever we have
    logger.warning(
        f"  Both methods failed for {pdf_path.name} "
        f"(PyMuPDF: {char_count}, OCR: {ocr_char_count} chars)"
    )
    best_text = clean_text if char_count >= ocr_char_count else ocr_text.strip()
    return best_text, "failed"


# ─────────────────────────────────────────────────────────────
#  Text Cleaning
# ─────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """
    Clean extracted PDF text:
    - Remove excessive whitespace
    - Fix broken hyphenated words (common in PDFs)
    - Remove page headers/footers noise
    - Normalize unicode characters
    """
    if not text:
        return ""

    # Fix hyphenated line breaks: "regu-\nlation" → "regulation"
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

    # Normalize multiple newlines → max 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove lines that are just page numbers or dashes
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip lines that are only numbers, dashes, or very short noise
        if re.match(r"^[\d\s\-–—_|]{0,5}$", stripped):
            continue
        cleaned_lines.append(line)
    text = "\n".join(cleaned_lines)

    # Normalize whitespace within lines
    text = re.sub(r"[ \t]+", " ", text)

    # Remove non-printable characters (except newlines)
    text = re.sub(r"[^\x20-\x7E\n\u0900-\u097F]", " ", text)

    return text.strip()


# ─────────────────────────────────────────────────────────────
#  Chunking
# ─────────────────────────────────────────────────────────────

def create_splitter() -> RecursiveCharacterTextSplitter:
    """
    LangChain RecursiveCharacterTextSplitter.
    chunk_size=2048 chars ≈ 512 tokens (1 token ≈ 4 chars)
    chunk_overlap=200 chars ≈ 50 tokens
    Splits on: paragraphs → sentences → words → characters
    """
    return RecursiveCharacterTextSplitter(
        chunk_size=2048,        # ~512 tokens
        chunk_overlap=200,      # ~50 tokens
        length_function=len,
        separators=[
            "\n\n",             # paragraph break (highest priority)
            "\n",               # line break
            ". ",               # sentence end
            "! ",
            "? ",
            "; ",
            ", ",
            " ",                # word break
            "",                 # character break (last resort)
        ],
    )


def chunk_text(text: str, metadata: dict, splitter: RecursiveCharacterTextSplitter) -> list[dict]:
    """
    Split text into chunks and attach metadata to each chunk.
    Returns list of chunk dicts ready for ChromaDB.
    """
    if not text or len(text.strip()) < 50:
        return []

    raw_chunks = splitter.split_text(text)

    chunks = []
    for i, chunk_text in enumerate(raw_chunks):
        chunk_text = chunk_text.strip()
        if len(chunk_text) < 50:   # skip tiny chunks
            continue

        chunk = {
            # Content
            "text": chunk_text,
            "char_count": len(chunk_text),

            # Source metadata (used by ChromaDB + citation system)
            "corpus":      metadata.get("corpus", "unknown"),
            "source":      metadata.get("corpus", "unknown").upper(),
            "filename":    metadata.get("filename", ""),
            "circular_no": metadata.get("circular_no", "unknown"),
            "date":        metadata.get("date", "unknown"),
            "title":       metadata.get("title", ""),
            "url":         metadata.get("url", ""),

            # Chunk position info
            "chunk_index": i,
            "total_chunks": len(raw_chunks),

            # Extraction info
            "extraction_method": metadata.get("extraction_method", "unknown"),
            "chunked_at": datetime.now().isoformat(),

            # Unique ID for ChromaDB
            "chunk_id": f"{metadata.get('corpus','unk')}_{metadata.get('filename','').replace('.pdf','')}_{i:04d}",
        }
        chunks.append(chunk)

    return chunks


# ─────────────────────────────────────────────────────────────
#  Index CSV Reader (from scraper.py output)
# ─────────────────────────────────────────────────────────────

def load_index(corpus_dir: Path) -> dict[str, dict]:
    """
    Load index.csv created by scraper.py.
    Returns dict: {filename → metadata_dict}
    """
    index_path = corpus_dir / "index.csv"
    if not index_path.exists():
        logger.warning(f"No index.csv found at {index_path}. Metadata will be limited.")
        return {}

    import csv
    index = {}
    with open(index_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = row.get("filename", "").strip()
            if filename:
                index[filename] = row
    logger.info(f"Loaded {len(index)} entries from index.csv")
    return index


# ─────────────────────────────────────────────────────────────
#  Main Chunker
# ─────────────────────────────────────────────────────────────

def chunk_corpus(corpus: str, limit: int = None):
    """
    Main chunking function for a given corpus.
    Reads all PDFs → extracts text → chunks → saves to chunks.json
    """
    corpus_dir = DATA_DIR / corpus

    if not corpus_dir.exists():
        logger.error(f"Data directory not found: {corpus_dir}")
        logger.error(f"Run scraper first: python pipeline/scraper.py --corpus {corpus}")
        return

    setup_logger(corpus)

    # Find all PDFs
    pdf_files = sorted(list(corpus_dir.glob("*.pdf")) + list(corpus_dir.glob("*.txt")))
    if not pdf_files:
        logger.error(f"No PDFs found in {corpus_dir}")
        logger.error(f"Run scraper first: python pipeline/scraper.py --corpus {corpus}")
        return

    if limit:
        pdf_files = pdf_files[:limit]

    logger.info("=" * 60)
    logger.info(f"Vidi Chunker — Corpus: {corpus.upper()}")
    logger.info(f"PDFs found:   {len(pdf_files)}")
    logger.info(f"Chunk size:   ~512 tokens (2048 chars)")
    logger.info(f"Overlap:      ~50 tokens  (200 chars)")
    logger.info(f"OCR fallback: enabled (threshold: {MIN_TEXT_LENGTH} chars)")
    if limit:
        logger.info(f"Limit:        {limit} PDFs (test mode)")
    logger.info("=" * 60)

    # Load metadata index from scraper
    index = load_index(corpus_dir)

    # Create splitter (reused across all PDFs)
    splitter = create_splitter()

    # ── Process each PDF ──────────────────────────────────────
    all_chunks    = []
    stats = {
        "total_pdfs":     len(pdf_files),
        "success":        0,
        "failed":         0,
        "ocr_used":       0,
        "pymupdf_used":   0,
        "skipped_empty":  0,
        "total_chunks":   0,
    }

    for pdf_path in tqdm(pdf_files, desc=f"Chunking {corpus.upper()} PDFs"):
        filename = pdf_path.name
        logger.debug(f"Processing: {filename}")

        # Get metadata from index
        meta = index.get(filename, {})

        # ── Extract text ──────────────────────────────────────
        raw_text, method = extract_text(pdf_path)

        if not raw_text or len(raw_text.strip()) < MIN_TEXT_LENGTH:
            logger.warning(f"  Skipping (no usable text): {filename}")
            stats["skipped_empty"] += 1
            stats["failed"] += 1
            continue

        # Track extraction method
        if method == "ocr":
            stats["ocr_used"] += 1
            logger.debug(f"  OCR used for: {filename}")
        else:
            stats["pymupdf_used"] += 1

        # ── Clean text ────────────────────────────────────────
        cleaned = clean_text(raw_text)

        # ── Build metadata for this PDF ───────────────────────
        pdf_metadata = {
            "corpus":             corpus,
            "filename":           filename,
            "circular_no":        meta.get("circular_no", "unknown"),
            "date":               meta.get("date", "unknown"),
            "title":              meta.get("title", filename.replace(".pdf", "")),
            "url":                meta.get("url", ""),
            "extraction_method":  method,
        }

        # ── Chunk the text ────────────────────────────────────
        chunks = chunk_text(cleaned, pdf_metadata, splitter)

        if not chunks:
            logger.warning(f"  No chunks produced from: {filename}")
            stats["failed"] += 1
            continue

        all_chunks.extend(chunks)
        stats["success"]      += 1
        stats["total_chunks"] += len(chunks)
        logger.debug(f"  ✓ {len(chunks)} chunks from {filename} ({method})")

    # ── Save chunks.json ─────────────────────────────────────
    output_path = corpus_dir / "chunks.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    # ── Save stats summary ────────────────────────────────────
    stats_path = corpus_dir / "chunks_stats.json"
    stats_data = {
        **stats,
        "corpus":          corpus,
        "output_file":     str(output_path),
        "avg_chunk_size":  round(
            sum(c["char_count"] for c in all_chunks) / len(all_chunks), 1
        ) if all_chunks else 0,
        "chunked_at":      datetime.now().isoformat(),
    }
    with open(stats_path, "w") as f:
        json.dump(stats_data, f, indent=2)

    # ── Summary ───────────────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info(f"CHUNKING COMPLETE — {corpus.upper()}")
    logger.info(f"  ✓ PDFs processed:    {stats['success']}/{stats['total_pdfs']}")
    logger.info(f"  ✗ Failed/empty:      {stats['failed']}")
    logger.info(f"  📄 PyMuPDF used:     {stats['pymupdf_used']} PDFs")
    logger.info(f"  🔍 OCR used:         {stats['ocr_used']} PDFs")
    logger.info(f"  🧩 Total chunks:     {stats['total_chunks']}")
    logger.info(f"  📏 Avg chunk size:   {stats_data['avg_chunk_size']} chars")
    logger.info(f"  💾 Saved to:         {output_path}")
    logger.info("=" * 60)

    return all_chunks


# ─────────────────────────────────────────────────────────────
#  Quick Verification Helper
# ─────────────────────────────────────────────────────────────

def verify_chunks(corpus: str):
    """Print a sample of chunks to verify quality."""
    chunks_path = DATA_DIR / corpus / "chunks.json"
    if not chunks_path.exists():
        logger.error(f"No chunks.json found. Run chunker first.")
        return

    with open(chunks_path, encoding="utf-8") as f:
        chunks = json.load(f)

    print(f"\n{'='*60}")
    print(f"VERIFICATION — {corpus.upper()} chunks")
    print(f"Total chunks: {len(chunks)}")
    print(f"{'='*60}")

    # Show 3 sample chunks
    import random
    samples = random.sample(chunks, min(3, len(chunks)))
    for i, chunk in enumerate(samples, 1):
        print(f"\n--- Sample Chunk {i} ---")
        print(f"ID:          {chunk['chunk_id']}")
        print(f"Source:      {chunk['source']}")
        print(f"Circular:    {chunk['circular_no']}")
        print(f"Date:        {chunk['date']}")
        print(f"Filename:    {chunk['filename']}")
        print(f"Char count:  {chunk['char_count']}")
        print(f"Method:      {chunk['extraction_method']}")
        print(f"Text preview:\n{chunk['text'][:300]}...")
        print()


# ─────────────────────────────────────────────────────────────
#  CLI Entry Point
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Vidi — PDF Chunker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pipeline/chunker.py                       # chunk GST (default)
  python pipeline/chunker.py --corpus gst          # GST only
  python pipeline/chunker.py --corpus all          # all 4 corpora
  python pipeline/chunker.py --corpus gst --limit 5    # test: 5 PDFs
  python pipeline/chunker.py --corpus gst --verify     # verify output
        """
    )
    parser.add_argument(
        "--corpus",
        choices=["gst", "rbi", "sebi", "mca", "all"],
        default="gst",
        help="Which corpus to chunk (default: gst)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of PDFs to process (for testing)",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="After chunking, print sample chunks for quality check",
    )
    args = parser.parse_args()

    if args.corpus == "all":
        for corpus in CORPORA:
            chunk_corpus(corpus, args.limit)
            if args.verify:
                verify_chunks(corpus)
    else:
        chunk_corpus(args.corpus, args.limit)
        if args.verify:
            verify_chunks(args.corpus)


if __name__ == "__main__":
    main()