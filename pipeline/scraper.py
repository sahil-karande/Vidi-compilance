"""
Vidi — pipeline/scraper.py
Day 2 Task: GST Portal Scraper

Scrapes GST notifications + circulars from cbic-gst.gov.in
Downloads PDFs to data/gst/
Logs metadata (url, date, circular_no, title) to data/gst/index.csv

Usage:
    python pipeline/scraper.py               # scrape all (GST only, Day 2)
    python pipeline/scraper.py --corpus gst  # explicit
    python pipeline/scraper.py --limit 10    # test run with 10 PDFs only
    python pipeline/scraper.py --corpus rbi  # Day 5 (RBI)
    python pipeline/scraper.py --corpus sebi # Day 6 (SEBI)
    python pipeline/scraper.py --corpus mca  # Day 6 (MCA)
"""

import os
import re
import csv
import time
import argparse
import random
import requests
from pathlib import Path
from datetime import datetime
from urllib.parse import urljoin, urlparse, quote, urlunparse

from bs4 import BeautifulSoup
from tqdm import tqdm
from loguru import logger

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent.parent  # vidi/ root
DATA_DIR = BASE_DIR / "data"

# Request settings
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive"
}
TIMEOUT = 20  # seconds per request
MAX_RETRIES = 3

# ─────────────────────────────────────────────────────────────
#  Portal Configs
#  Each corpus has: seed URLs to scrape + output folder
# ─────────────────────────────────────────────────────────────

CORPUS_CONFIG = {
  "gst": {
        "output_dir": DATA_DIR / "gst",
        "seed_urls": [
            # Comment these out so your scraper skips the broken server:
             "https://cbic-gst.gov.in/gst-goods-services-rates.html",
             "https://cbic-gst.gov.in/index.html",
             "https://cbic-gst.gov.in/central-excise-702.html",
            
            # Keep ONLY the working GST Council links:
            "https://gstcouncil.gov.in/cgst-tax-notification",
            "https://gstcouncil.gov.in/cgst-circulars",
        ],
        # Fallback: direct PDF listing pages
        "fallback_urls": [
            "https://www.cbic.gov.in/resources/htdocs-cbec/gst/notfctn-01-central-tax-english-2017.pdf",
        ],
        "description": "GST notifications, circulars, and rate schedules",
    },
    "rbi": {
        "output_dir": DATA_DIR / "rbi",
        "seed_urls": [
            "https://www.rbi.org.in/Scripts/NotificationUser.aspx",
            "https://www.rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx",
            "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx",
        ],
        "description": "RBI Master Directions, circulars, and notifications",
    },
    "sebi": {
        "output_dir": DATA_DIR / "sebi",
        "seed_urls": [
            "https://www.sebi.gov.in/legal/circulars.html",
            "https://www.sebi.gov.in/legal/master-circulars.html",
        ],
        "description": "SEBI circulars and master circulars",
    },
    "mca": {
        "output_dir": DATA_DIR / "mca",
        "seed_urls": [
            "https://www.mca.gov.in/content/mca/global/en/acts-rules/ebooks.html",
            "https://www.mca.gov.in/content/mca/global/en/acts-rules/acts.html",
        ],
        "description": "MCA Companies Act, rules, and circulars",
    },
}

# ─────────────────────────────────────────────────────────────
#  Logger Setup
# ─────────────────────────────────────────────────────────────

def setup_logger(output_dir: Path):
    log_file = output_dir / "scraper.log"
    logger.remove()  # remove default handler
    logger.add(lambda msg: print(msg, end=""), level="INFO",
               format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}")
    logger.add(str(log_file), level="DEBUG", rotation="10 MB",
               format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}")
    logger.info(f"Logs → {log_file}")


# ─────────────────────────────────────────────────────────────
#  HTTP Helpers
# ─────────────────────────────────────────────────────────────

def make_request(url: str, session: requests.Session, retries: int = MAX_RETRIES):
    """GET request mimicking human patterns with dynamic delays and robust backoffs."""
    
    # Add this line right here to make sure spaces never hit the internet unencoded
    url = _encode_url(url) 
    
    # 1. FIXED SPEED: Introduce a dynamic sleep block before execution
    delay = random.uniform(4, 9)
    
    logger.info(f"Waiting {delay:.2f} seconds before requesting link...")
    time.sleep(delay)

    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, headers=HEADERS, timeout=TIMEOUT)
            
            # If server indicates rate limits
            if response.status_code in [403, 429]:
                wait_time = 20 * attempt
                logger.warning(f"Rate limited (HTTP {response.status_code}) on {url}. Backing off for {wait_time}s...")
                time.sleep(wait_time)
                continue
                
            response.raise_for_status()
            return response

        except requests.exceptions.HTTPError as e:
            logger.warning(f"HTTP {e.response.status_code} on {url} (attempt {attempt}/{retries})")
            if attempt < retries:
                time.sleep(5 * attempt)
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            wait_time = 30 * attempt
            logger.warning(f"Connection dropped/Timed out on {url}. Cooling down for {wait_time}s... (Attempt {attempt}/{retries})")
            if attempt < retries:
                time.sleep(wait_time)
        except Exception as e:
            logger.warning(f"Unexpected error on {url}: {e} (attempt {attempt}/{retries})")
            if attempt < retries:
                time.sleep(5 * attempt)

    logger.error(f"Failed after {retries} attempts: {url}")
    return None


# ─────────────────────────────────────────────────────────────
#  PDF Link Extraction
# ─────────────────────────────────────────────────────────────

def _encode_url(url: str) -> str:
    """
    Safely encode a URL so that spaces and special characters in the path
    are percent-encoded (e.g. spaces → %20), while preserving already-encoded
    sequences and the scheme/host/query/fragment parts.
    """
    parsed = urlparse(url)
    encoded_path = quote(parsed.path, safe="/:%@!$&'()*+,;=")
    return urlunparse(parsed._replace(path=encoded_path))


def extract_pdf_links(html: str, base_url: str) -> list[dict]:
    """
    Parse HTML and extract all PDF links with metadata.
    Returns list of {url, title, raw_text} dicts.
    """
    soup = BeautifulSoup(html, "lxml")
    pdf_links = []
    seen_urls = set()

    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()

        # Only PDF links
        if not href.lower().endswith(".pdf"):
            continue

        # Build absolute URL and encode spaces/special chars
        absolute_url = _encode_url(urljoin(base_url, href))

        # Skip duplicates
        if absolute_url in seen_urls:
            continue
        seen_urls.add(absolute_url)

        # Extract link text as title
        title = tag.get_text(strip=True) or "Untitled"
        title = " ".join(title.split())  # clean whitespace

        # Try to get surrounding context (table row, list item)
        parent_text = ""
        for parent in tag.parents:
            if parent.name in ["tr", "li", "div", "td"]:
                parent_text = parent.get_text(strip=True)[:200]
                break

        pdf_links.append({
            "url": absolute_url,
            "title": title[:200],
            "context": parent_text,
        })

    return pdf_links


def extract_circular_metadata(url: str, title: str, context: str) -> dict:
    """
    Extract circular_no and date from URL or title using regex.
    """
    circular_no = "unknown"
    date_str = "unknown"

    url_patterns = [
        r"notfctn-(\d+)-.*?-(\d{4})",   # notfctn-01-central-tax-2017
        r"circular[_-](\d+)[_-](\d{4})", # circular_45_2018
        r"(\d{2})[_-](\d{4})",           # 01_2017
    ]
    for pattern in url_patterns:
        match = re.search(pattern, url.lower())
        if match:
            circular_no = f"{match.group(1)}/{match.group(2)}"
            break

    title_patterns = [
        r"(?:circular|notification)\s*no\.?\s*(\d+[/\-]\d+[/\-]?\d*)",
        r"no\.?\s*(\d+/\d+)",
        r"(\d{2}/\d{2}/\d{4})",  # date format
    ]
    for pattern in title_patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            if circular_no == "unknown":
                circular_no = match.group(1)
            break

    date_patterns = [
        r"(\d{1,2}[./-]\d{1,2}[./-]\d{4})",      # DD/MM/YYYY
        r"(\d{4}[./-]\d{1,2}[./-]\d{1,2})",      # YYYY-MM-DD
        r"(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})",
    ]
    combined_text = f"{title} {context} {url}"
    for pattern in date_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            date_str = match.group(1)
            break

    return {"circular_no": circular_no, "date": date_str}


# ─────────────────────────────────────────────────────────────
#  PDF Downloader
# ─────────────────────────────────────────────────────────────

def download_pdf(url: str, output_dir: Path, filename: str,
                 session: requests.Session) -> bool:
    """Download a single PDF via make_request pipeline."""
    output_path = output_dir / filename

    # Skip if already downloaded
    if output_path.exists() and output_path.stat().st_size > 1000:
        logger.debug(f"Already exists, skipping: {filename}")
        return True

    # safe_url conversion handled inside make_request naturally
    response = make_request(url, session)
    if response is None:
        return False

    # Verify it's actually a PDF
    content_type = response.headers.get("content-type", "")
    if "pdf" not in content_type.lower() and not url.lower().endswith(".pdf"):
        logger.warning(f"Not a PDF ({content_type}): {url}")
        return False

    # Check minimum size (skip empty/error pages)
    if len(response.content) < 1000:
        logger.warning(f"File too small ({len(response.content)} bytes), skipping: {url}")
        return False

    # Save PDF
    with open(output_path, "wb") as f:
        f.write(response.content)

    size_kb = len(response.content) / 1024
    logger.debug(f"Downloaded ({size_kb:.1f} KB): {filename}")
    return True


def sanitize_filename(url: str, title: str, index: int) -> str:
    """Generate a clean, unique filename from URL or title."""
    url_filename = Path(urlparse(url).path).name
    if url_filename.lower().endswith(".pdf") and len(url_filename) > 5:
        name = re.sub(r"[^\w\-.]", "_", url_filename)
        return name[:100]

    clean_title = re.sub(r"[^\w\s-]", "", title)
    clean_title = re.sub(r"\s+", "_", clean_title.strip())[:60]
    return f"{index:04d}_{clean_title}.pdf" if clean_title else f"doc_{index:04d}.pdf"


# ─────────────────────────────────────────────────────────────
#  CSV Index Logger
# ─────────────────────────────────────────────────────────────

class IndexLogger:
    """Logs downloaded PDF metadata to a CSV file."""

    def __init__(self, output_dir: Path, corpus: str):
        self.csv_path = output_dir / "index.csv"
        self.corpus = corpus
        self.fieldnames = [
            "corpus", "filename", "circular_no", "date",
            "title", "url", "downloaded_at", "file_size_kb"
        ]
        self._init_csv()

    def _init_csv(self):
        if not self.csv_path.exists():
            with open(self.csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=self.fieldnames)
                writer.writeheader()
            logger.info(f"Created index: {self.csv_path}")

    def log(self, filename: str, circular_no: str, date: str,
            title: str, url: str, file_size_kb: float):
        with open(self.csv_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.fieldnames)
            writer.writerow({
                "corpus": self.corpus,
                "filename": filename,
                "circular_no": circular_no,
                "date": date,
                "title": title[:200],
                "url": url,
                "downloaded_at": datetime.now().isoformat(),
                "file_size_kb": round(file_size_kb, 1),
            })


# ─────────────────────────────────────────────────────────────
#  Main Scraper
# ─────────────────────────────────────────────────────────────

def scrape_corpus(corpus: str, limit: int = None):
    """
    Main scraping function for a given corpus.
    Scrapes all seed URLs, collects PDF links, downloads them.
    """
    if corpus not in CORPUS_CONFIG:
        logger.error(f"Unknown corpus: {corpus}. Choose from: {list(CORPUS_CONFIG.keys())}")
        return

    config = CORPUS_CONFIG[corpus]
    output_dir: Path = config["output_dir"]
    output_dir.mkdir(parents=True, exist_ok=True)

    setup_logger(output_dir)

    logger.info("=" * 60)
    logger.info(f"Vidi Scraper — Corpus: {corpus.upper()}")
    logger.info(f"Description: {config['description']}")
    logger.info(f"Output: {output_dir}")
    logger.info(f"Seed URLs: {len(config['seed_urls'])}")
    if limit:
        logger.info(f"Limit: {limit} PDFs (test mode)")
    logger.info("=" * 60)

    session = requests.Session()
    session.headers.update(HEADERS)
    index_logger = IndexLogger(output_dir, corpus)

    # ── Step 1: Collect all PDF links from seed URLs ──────────
    all_pdf_links = []
    seen_urls = set()

    logger.info(f"Step 1: Crawling {len(config['seed_urls'])} seed URLs...")

    for seed_url in config["seed_urls"]:
        logger.info(f"  Crawling: {seed_url}")
        response = make_request(seed_url, session)

        if response is None:
            logger.warning(f"  Failed to fetch: {seed_url}")
            continue

        pdf_links = extract_pdf_links(response.text, seed_url)
        new_links = [l for l in pdf_links if l["url"] not in seen_urls]
        seen_urls.update(l["url"] for l in new_links)
        all_pdf_links.extend(new_links)
        logger.info(f"  Found {len(new_links)} new PDF links ({len(all_pdf_links)} total)")

        # Also crawl one level deep — follow pagination / sub-pages
        soup = BeautifulSoup(response.text, "lxml")
        sub_links = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if any(kw in href.lower() for kw in
                   ["notification", "circular", "notification", "act", "rule",
                    "page=", "offset=", "year=", "2023", "2024", "2025", "2026"]):
                sub_url = urljoin(seed_url, href)
                if sub_url not in seen_urls and sub_url.startswith("http"):
                    sub_links.append(sub_url)

        # Crawl up to 5 sub-pages per seed
        for sub_url in sub_links[:5]:
            sub_response = make_request(sub_url, session)
            if sub_response is None:
                continue
            sub_pdfs = extract_pdf_links(sub_response.text, sub_url)
            new_sub = [l for l in sub_pdfs if l["url"] not in seen_urls]
            seen_urls.update(l["url"] for l in new_sub)
            all_pdf_links.extend(new_sub)
            if new_sub:
                logger.info(f"    Sub-page {sub_url[-50:]}: +{len(new_sub)} PDFs")

    logger.info(f"\nTotal PDF links collected: {len(all_pdf_links)}")

    # ── Step 2: Apply limit if set (for testing) ──────────────
    if limit:
        all_pdf_links = all_pdf_links[:limit]
        logger.info(f"Limiting to {limit} PDFs for test run")

    if not all_pdf_links:
        logger.warning("No PDF links found! The portal structure may have changed.")
        logger.warning("Try running with --debug to inspect the HTML.")
        return

    # ── Step 3: Download PDFs ─────────────────────────────────
    logger.info(f"\nStep 2: Downloading {len(all_pdf_links)} PDFs...")
    success_count = 0
    fail_count = 0

    for i, link_info in enumerate(tqdm(all_pdf_links, desc=f"Downloading {corpus.upper()} PDFs")):
        url = link_info["url"]
        title = link_info["title"]
        context = link_info["context"]

        # Generate filename
        filename = sanitize_filename(url, title, i + 1)

        # Extract metadata
        meta = extract_circular_metadata(url, title, context)

        # Download
        success = download_pdf(url, output_dir, filename, session)

        if success:
            # Get file size
            file_path = output_dir / filename
            size_kb = file_path.stat().st_size / 1024 if file_path.exists() else 0

            # Log to CSV
            index_logger.log(
                filename=filename,
                circular_no=meta["circular_no"],
                date=meta["date"],
                title=title,
                url=url,
                file_size_kb=size_kb,
            )
            success_count += 1
        else:
            fail_count += 1

    # ── Step 4: Summary ───────────────────────────────────────
    logger.info("\n" + "=" * 60)
    logger.info(f"SCRAPING COMPLETE — {corpus.upper()}")
    logger.info(f"   ✓ Downloaded: {success_count} PDFs")
    logger.info(f"   ✗ Failed:     {fail_count} PDFs")
    logger.info(f"   📁 Saved to:  {output_dir}")
    logger.info(f"   📋 Index:     {output_dir}/index.csv")

    # Check total data size
    total_size = sum(f.stat().st_size for f in output_dir.glob("*.pdf")) / (1024 * 1024)
    logger.info(f"   💾 Total size: {total_size:.1f} MB")
    logger.info("=" * 60)

    return success_count


# ─────────────────────────────────────────────────────────────
#  CLI Entry Point
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Vidi — Regulatory Document Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pipeline/scraper.py                    # scrape GST (Day 2 default)
  python pipeline/scraper.py --corpus gst       # GST only
  python pipeline/scraper.py --corpus rbi       # RBI only (Day 5)
  python pipeline/scraper.py --corpus all       # all 4 corpora
  python pipeline/scraper.py --limit 5          # test: download 5 PDFs only
        """
    )
    parser.add_argument(
        "--corpus",
        choices=["gst", "rbi", "sebi", "mca", "all"],
        default="gst",
        help="Which corpus to scrape (default: gst)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of PDFs to download (for testing)",
    )
    args = parser.parse_args()

    if args.corpus == "all":
        logger.info("Scraping ALL corpora...")
        for corpus in ["gst", "rbi", "sebi", "mca"]:
            scrape_corpus(corpus, args.limit)
    else:
        scrape_corpus(args.corpus, args.limit)


if __name__ == "__main__":
    main()