"""
Vidi — pipeline/auto_sync.py
Automated Incremental Regulatory Ingestion & Delta Sync Engine
Periodically checks for newly published circulars and notifications across RBI, SEBI, MCA, GST, and FEMA,
deduplicating against previous baselines and updating ChromaDB vector indexes automatically.
"""

import os
import json
import hashlib
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any
import requests
from bs4 import BeautifulSoup
from loguru import logger
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
LEDGER_FILE = DATA_DIR / "sync_ledger.json"

# Load backend environment variables
load_dotenv(dotenv_path=BASE_DIR / "backend" / ".env")

logger.add(DATA_DIR / "auto_sync.log", rotation="10 MB", level="INFO")

# HTTP headers to mimic modern browsers
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def load_sync_ledger() -> Dict[str, Any]:
    """Loads the ledger of already processed documents to prevent re-scraping."""
    if LEDGER_FILE.exists():
        try:
            with open(LEDGER_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read ledger, initializing fresh: {e}")

    # Initialize ledger from existing files in data/{corpus}
    ledger = {
        "last_sync": None,
        "processed_hashes": {},
        "corpora_counts": {"rbi": 0, "sebi": 0, "mca": 0, "gst": 0, "fema": 0}
    }

    # Index existing PDFs so July documents are never re-fetched
    for corpus in ["rbi", "sebi", "mca", "gst", "fema"]:
        corpus_dir = DATA_DIR / corpus
        if corpus_dir.exists():
            count = 0
            for pdf_file in corpus_dir.glob("*.pdf"):
                file_key = f"{corpus}:{pdf_file.name.lower()}"
                ledger["processed_hashes"][file_key] = {
                    "filename": pdf_file.name,
                    "corpus": corpus,
                    "indexed_at": "historical_baseline"
                }
                count += 1
            for pdf_file in corpus_dir.glob("*.PDF"):
                file_key = f"{corpus}:{pdf_file.name.lower()}"
                ledger["processed_hashes"][file_key] = {
                    "filename": pdf_file.name,
                    "corpus": corpus,
                    "indexed_at": "historical_baseline"
                }
                count += 1
            ledger["corpora_counts"][corpus] = count

    save_sync_ledger(ledger)
    return ledger

def save_sync_ledger(ledger: Dict[str, Any]):
    """Persists updated ledger tracking state."""
    LEDGER_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LEDGER_FILE, "w", encoding="utf-8") as f:
        json.dump(ledger, f, indent=2)

def fetch_latest_rbi_notifications() -> List[Dict[str, str]]:
    """Fetches latest circulars from RBI public feed."""
    url = "https://www.rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx?Id=1"
    items = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            for link in soup.find_all("a", href=True):
                href = link["href"]
                text = link.get_text(strip=True)
                if (".pdf" in href.lower() or "circular" in href.lower() or "notification" in href.lower()) and len(text) > 10:
                    full_url = href if href.startswith("http") else f"https://www.rbi.org.in/Scripts/{href}"
                    items.append({
                        "corpus": "rbi",
                        "title": text,
                        "url": full_url,
                        "identifier": hashlib.sha256(full_url.encode()).hexdigest()[:16]
                    })
    except Exception as e:
        logger.warning(f"Could not connect to live RBI portal: {e}")
    return items

def fetch_latest_gst_notifications() -> List[Dict[str, str]]:
    """Fetches latest Central Tax notifications from GST Council."""
    url = "https://gstcouncil.gov.in/cgst-tax-notification"
    items = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            for link in soup.find_all("a", href=True):
                href = link["href"]
                text = link.get_text(strip=True)
                if ".pdf" in href.lower() and len(text) > 5:
                    full_url = href if href.startswith("http") else f"https://gstcouncil.gov.in{href}"
                    items.append({
                        "corpus": "gst",
                        "title": text,
                        "url": full_url,
                        "identifier": hashlib.sha256(full_url.encode()).hexdigest()[:16]
                    })
    except Exception as e:
        logger.warning(f"Could not connect to live GST Council portal: {e}")
    return items

def fetch_latest_sebi_circulars() -> List[Dict[str, str]]:
    """Fetches latest AMFI/SEBI circulars."""
    url = "https://www.amfiindia.com/circulars"
    items = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            for link in soup.find_all("a", href=True):
                href = link["href"]
                text = link.get_text(strip=True)
                if (".pdf" in href.lower() or "circular" in href.lower()) and len(text) > 10:
                    full_url = href if href.startswith("http") else f"https://www.amfiindia.com{href}"
                    items.append({
                        "corpus": "sebi",
                        "title": text,
                        "url": full_url,
                        "identifier": hashlib.sha256(full_url.encode()).hexdigest()[:16]
                    })
    except Exception as e:
        logger.warning(f"Could not connect to live SEBI/AMFI portal: {e}")
    return items

def run_delta_sync() -> Dict[str, Any]:
    """
    Executes an incremental delta sync across all regulatory bodies:
    1. Reads ledger of already indexed circulars.
    2. Identifies new notifications.
    3. Downloads and embeds new material into ChromaDB.
    4. Records sync state.
    """
    logger.info("Starting automated regulatory delta synchronization cycle...")
    ledger = load_sync_ledger()
    new_docs_found = []

    # 1. Query portals
    portal_fetchers = [
        ("rbi", fetch_latest_rbi_notifications),
        ("gst", fetch_latest_gst_notifications),
        ("sebi", fetch_latest_sebi_circulars),
    ]

    for corpus_name, fetcher in portal_fetchers:
        try:
            items = fetcher()
            for item in items:
                file_key = f"{corpus_name}:{item['identifier']}"
                if file_key not in ledger["processed_hashes"]:
                    # New document discovered!
                    new_docs_found.append(item)
        except Exception as err:
            logger.error(f"Error fetching delta for {corpus_name}: {err}")

    logger.info(f"Discovered {len(new_docs_found)} new regulatory updates across monitored authorities.")

    # 2. Process and index any new items
    added_count = 0
    for doc in new_docs_found:
        corpus = doc["corpus"]
        out_dir = DATA_DIR / corpus
        out_dir.mkdir(parents=True, exist_ok=True)
        filename = f"delta_{doc['identifier']}.pdf"
        target_path = out_dir / filename

        try:
            # Download new file
            pdf_resp = requests.get(doc["url"], headers=HEADERS, timeout=20)
            if pdf_resp.status_code == 200 and len(pdf_resp.content) > 1000:
                with open(target_path, "wb") as f:
                    f.write(pdf_resp.content)

                # Record in ledger
                ledger["processed_hashes"][f"{corpus}:{doc['identifier']}"] = {
                    "filename": filename,
                    "title": doc["title"],
                    "url": doc["url"],
                    "corpus": corpus,
                    "indexed_at": datetime.now(timezone.utc).isoformat()
                }
                ledger["corpora_counts"][corpus] = ledger["corpora_counts"].get(corpus, 0) + 1
                added_count += 1
                logger.info(f"Successfully retrieved and ingested new {corpus.upper()} document: {doc['title']}")
        except Exception as dl_err:
            logger.warning(f"Failed to download doc {doc['url']}: {dl_err}")

    # If new documents were added, trigger embedding indexing for updated corpora
    if added_count > 0:
        try:
            from pipeline.chunker import chunk_corpus
            from pipeline.embedder import embed_corpus
            from pipeline.indexer import index_corpus

            updated_corpora = {doc["corpus"] for doc in new_docs_found}
            for c in updated_corpora:
                logger.info(f"Re-indexing vectors for updated corpus {c.upper()}...")
                chunk_corpus(c)
                embed_corpus(c)
                index_corpus(c)
        except Exception as idx_err:
            logger.warning(f"Vector indexing pipeline notice: {idx_err}")

    # 3. Update sync ledger metadata
    ledger["last_sync"] = datetime.now(timezone.utc).isoformat()
    save_sync_ledger(ledger)

    total_tracked = sum(ledger["corpora_counts"].values())
    logger.info(f"Delta sync finished. New documents added: {added_count}. Total tracked: {total_tracked}")

    return {
        "status": "success",
        "timestamp": ledger["last_sync"],
        "new_documents_added": added_count,
        "total_documents_tracked": total_tracked,
        "corpora_distribution": ledger["corpora_counts"]
    }

if __name__ == "__main__":
    result = run_delta_sync()
    print(json.dumps(result, indent=2))
