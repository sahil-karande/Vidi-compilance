"""
Vidi — pipeline/fema_scraper.py
Day 8 Task: FEMA + Income Tax Act Scraper (Patched)
"""

import re
import csv
import time
import argparse
from pathlib import Path
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
from loguru import logger

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

BASE_DIR   = Path(__file__).parent.parent
DATA_DIR   = BASE_DIR / "data"
OUTPUT_DIR = DATA_DIR / "fema"

# Robust headers to bypass strict Indian Gov anti-bot firewalls
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Ch-Uua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Uua-Mobile": "?0",
    "Sec-Ch-Uua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

DELAY       = 2.0
TIMEOUT     = 30
MAX_RETRIES = 3

LISTING_PAGES = [
    "https://www.rbi.org.in/Scripts/Fema.aspx",
    "https://www.rbi.org.in/Scripts/BS_FemaNotifications.aspx",
    "https://incometaxindia.gov.in/Pages/acts/income-tax-act.aspx",
    "https://incometaxindia.gov.in/Pages/rules/income-tax-rules.aspx",
    "https://incometaxindia.gov.in/Pages/communications/circulars.aspx",
    "https://incometaxindia.gov.in/Pages/communications/notifications.aspx",
    "https://incometaxindia.gov.in/Pages/utilities/forms.aspx",
]

# Fallbacks used ONLY if live scraping fails completely
# Fallbacks used ONLY if live scraping fails completely
CURATED_PDFS = [
    {
        "url": "https://www.wipo.int/export/sites/www/directory/en/legal_texts/pdf/in019en.pdf",
        "title": "The Income-Tax Act, 1961 - Mirror Reference Text",
        "circular_no": "IT-Act/1961",
        "date": "1961",
    },
    {
        "url": "https://legislative.gov.in/sites/default/files/A2000-42_0.pdf",
        "title": "Foreign Exchange Management Act, 1999 - Core Act Text",
        "circular_no": "FEMA-Act/1999",
        "date": "2000",
    }
]

# ─────────────────────────────────────────────────────────────
#  Helpers & Infrastructure
# ─────────────────────────────────────────────────────────────

def setup_logger():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log_file = OUTPUT_DIR / "fema_scraper.log"
    logger.remove()
    logger.add(lambda msg: print(msg, end=""), level="INFO",
               format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}")
    logger.add(str(log_file), level="DEBUG", rotation="10 MB",
               format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}")


def make_request(url: str, session: requests.Session) -> requests.Response | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # Emulate browser completely by fetching root session data if needed
            response = session.get(url, headers=HEADERS, timeout=TIMEOUT)
            if response.status_code == 200:
                time.sleep(DELAY)
                return response
            logger.warning(f"HTTP {response.status_code} — {url[:50]} (attempt {attempt}/{MAX_RETRIES})")
        except Exception as e:
            logger.warning(f"{type(e).__name__} on {url[:50]} (attempt {attempt}/{MAX_RETRIES})")
        if attempt < MAX_RETRIES:
            time.sleep(attempt * 3)
    logger.error(f"Failed: {url[:50]}")
    return None


def crawl_listing_pages(session: requests.Session) -> list[dict]:
    found = []
    seen  = set()
    logger.info(f"Crawling {len(LISTING_PAGES)} FEMA/IncomeTax listing pages...")

    for page_url in LISTING_PAGES:
        logger.info(f"  Targeting: {page_url}")
        response = make_request(page_url, session)
        if not response:
            continue

        # Use native html.parser to safely work out-of-the-box everywhere
        soup = BeautifulSoup(response.text, "html.parser")

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            
            # Catch standard PDFs and typical dynamic ASPX stream attachments
            if not (href.lower().endswith(".pdf") or "openfile.aspx" in href.lower() or "download.aspx" in href.lower()):
                continue

            abs_url = href if href.startswith("http") else urljoin(page_url, href)
            if abs_url in seen:
                continue
            seen.add(abs_url)

            title   = a.get_text(strip=True) or "Regulatory Document"
            context = ""
            for parent in a.parents:
                if parent.name in ["tr", "li", "td", "div"]:
                    context = parent.get_text(" ", strip=True)[:300]
                    break

            found.append({"url": abs_url, "title": title[:200], "context": context, "source": "live_crawled"})

    logger.info(f"Crawled {len(found)} live document links successfully.")
    return found


def extract_metadata(url: str, title: str, context: str) -> dict:
    combined    = f"{title} {context} {url}"
    circular_no = "unknown"
    date_str    = "unknown"

    for pat in [
        r"FEMA[\s\-]?\d+\w*",
        r"CBDT[\-\s]?(?:Circular|Notif)[\-\s]?\d+/\d{4}",
        r"Section\s+\d+[A-Z]*",
        r"ITR[\-\s]?\d+",
        r"Form[\-\s]?\d+\w*",
    ]:
        m = re.search(pat, combined, re.IGNORECASE)
        if m:
            circular_no = m.group(0)[:40]
            break

    for pat in [r"(\d{1,2}[-/]\d{1,2}[-/]\d{4})", r"(20\d{2})"]:
        m = re.search(pat, combined)
        if m:
            date_str = m.group(1)
            break

    return {"circular_no": circular_no, "date": date_str}


class IndexLogger:
    def __init__(self):
        self.csv_path   = OUTPUT_DIR / "index.csv"
        self.fieldnames = ["corpus","filename","circular_no","date","title","url","downloaded_at","file_size_kb"]
        if not self.csv_path.exists():
            with open(self.csv_path, "w", newline="", encoding="utf-8") as f:
                csv.DictWriter(f, fieldnames=self.fieldnames).writeheader()

    def log(self, filename, circular_no, date, title, url, size_kb):
        with open(self.csv_path, "a", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=self.fieldnames).writerow({
                "corpus": "fema", "filename": filename,
                "circular_no": circular_no, "date": date,
                "title": title[:200], "url": url,
                "downloaded_at": datetime.now().isoformat(),
                "file_size_kb": round(size_kb, 1),
            })


def sanitize_filename(url: str, title: str, idx: int) -> str:
    name = Path(urlparse(url).path).name
    if name.lower().endswith(".pdf") and len(name) > 5:
        return re.sub(r"[^\w\-.]", "_", name)[:100]
    clean = re.sub(r"[^\w\s-]", "", title)
    clean = re.sub(r"\s+", "_", clean.strip())[:60]
    return f"fema_{idx:04d}_{clean}.pdf" if clean else f"fema_{idx:04d}.pdf"


def download_pdf(url: str, filename: str, session: requests.Session) -> tuple[bool, float]:
    out_path = OUTPUT_DIR / filename
    if out_path.exists() and out_path.stat().st_size > 1000:
        return True, out_path.stat().st_size / 1024
    
    response = make_request(url, session)
    if not response or len(response.content) < 500:
        return False, 0
    
    # Allow PDFs and standard octet data streams
    if b"%PDF" not in response.content[:1024] and not url.lower().endswith(".pdf"):
        return False, 0
        
    with open(out_path, "wb") as f:
        f.write(response.content)
    return True, len(response.content) / 1024

# ─────────────────────────────────────────────────────────────
#  Execution Pipeline
# ─────────────────────────────────────────────────────────────

def scrape_fema(limit: int = None):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    setup_logger()

    logger.info("=" * 60)
    logger.info("Vidi FEMA + Income Tax Scraper")
    logger.info(f"Target collection: 'fema'")
    if limit:
        logger.info(f"Running Test Limit Mode: {limit} PDFs")
    logger.info("=" * 60)

    session = requests.Session()
    index_logger = IndexLogger()

    all_links = []
    seen = set()

    # Step 1: Query the live sources first
    crawled_docs = crawl_listing_pages(session)
    for doc in crawled_docs:
        if doc["url"] not in seen:
            seen.add(doc["url"])
            all_links.append(doc)

    # Step 2: Use curated as fallbacks only if live links aren't filling requirements
    if len(all_links) == 0:
        logger.info("Live crawling returned zero records. Triggering fallback data structures...")
        for backup in CURATED_PDFS:
            if backup["url"] not in seen:
                seen.add(backup["url"])
                all_links.append({**backup, "source": "curated"})

    logger.info(f"Total actionable URLs compiled: {len(all_links)}")

    if limit:
        all_links = all_links[:limit]

    success = fail = 0
    for i, link in enumerate(tqdm(all_links, desc="Processing Pipeline Docs")):
        url      = link["url"]
        title    = link.get("title", "Regulatory Document")
        filename = sanitize_filename(url, title, i + 1)

        if link.get("source") == "curated":
            circular_no = link.get("circular_no", "unknown")
            date        = link.get("date", "unknown")
        else:
            meta        = extract_metadata(url, title, link.get("context", ""))
            circular_no = meta["circular_no"]
            date        = meta["date"]

        ok, size_kb = download_pdf(url, filename, session)
        if ok:
            index_logger.log(filename, circular_no, date, title, url, size_kb)
            success += 1
        else:
            fail += 1

    total_mb = sum(f.stat().st_size for f in OUTPUT_DIR.glob("*.pdf")) / (1024*1024) if OUTPUT_DIR.exists() else 0
    logger.info("\n" + "=" * 60)
    logger.info("SCRAPING COMPLETE — FEMA + Income Tax")
    logger.info(f"  ✓ Downloaded:  {success} PDFs")
    logger.info(f"  ✗ Failed:      {fail} PDFs")
    logger.info(f"  💾 Storage Size: {total_mb:.2f} MB")
    logger.info("=" * 60)
    return success


def main():
    parser = argparse.ArgumentParser(description="Vidi — FEMA + Income Tax Scraper")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    
    scrape_fema(args.limit)
    
    if args.verify:
        index_path = OUTPUT_DIR / "index.csv"
        if index_path.exists():
            with open(index_path, encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
            print(f"\nFEMA Index Verification — {len(rows)} recorded records")
            for row in rows[:10]:
                print(f"  {row['filename'][:45]:<45} | {row['circular_no'][:25]}")


if __name__ == "__main__":
    main()