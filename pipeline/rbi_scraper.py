"""
Vidi — pipeline/rbi_scraper.py
Day 5 Task: RBI Document Scraper

RBI portal uses JavaScript to render PDF links — BeautifulSoup
cannot scrape it directly. This script uses:
1. RBI's static rbidocs.rbi.org.in domain (direct PDF links)
2. RBI sitemap / known URL patterns
3. Curated list of high-value Master Directions & Circulars

Downloads PDFs to data/rbi/
Logs metadata to data/rbi/index.csv

Usage:
    python pipeline/rbi_scraper.py              # full scrape
    python pipeline/rbi_scraper.py --limit 10   # test: 10 PDFs only
    python pipeline/rbi_scraper.py --verify     # print index.csv after
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
OUTPUT_DIR = DATA_DIR / "rbi"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.rbi.org.in/",
}

DELAY  = 2.0    # seconds between requests
TIMEOUT = 30
MAX_RETRIES = 3

# ─────────────────────────────────────────────────────────────
#  RBI Scraping Sources
#  3-pronged strategy:
#  A) Crawl RBI sitemap XML for PDF links
#  B) Crawl RBI notification listing pages (HTML tables)
#  C) Curated Master Directions (highest-value documents)
# ─────────────────────────────────────────────────────────────

# A) RBI sitemap URLs — these list pages that link to PDFs
RBI_LISTING_PAGES = [
    # Master Directions
    "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx",
    # Master Circulars
    "https://www.rbi.org.in/Scripts/BS_ViewMasCirculardetails.aspx",
    # Notifications index pages (year-wise)
    "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12673&Mode=0",
    "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12500&Mode=0",
    "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12300&Mode=0",
    "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12100&Mode=0",
    "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11900&Mode=0",
    "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11700&Mode=0",
    # Press releases
    "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx",
    # Publications
    "https://www.rbi.org.in/Scripts/PublicationsView.aspx?id=22150",
    "https://www.rbi.org.in/Scripts/PublicationsView.aspx?id=22100",
    "https://www.rbi.org.in/Scripts/PublicationsView.aspx?id=22000",
]

# B) Direct PDF base URLs on rbidocs domain
# RBI stores all PDFs at rbidocs.rbi.org.in/rdocs/...
RBI_PDF_BASE = "https://rbidocs.rbi.org.in/rdocs"

# C) Curated high-value Master Directions — direct PDF links
# These are the most important RBI documents for SME compliance

CURATED_RBI_PDFS = []

# CURATED_RBI_PDFS = [
    # ── Master Directions ─────────────────────────────────
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDNBFC300120201B503D0B66A4453A8F8C45E9718BFDA.PDF",
#         "title": "Master Direction - Non-Banking Financial Companies",
#         "circular_no": "MD-NBFC/2016",
#         "date": "01-09-2016",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/FEMA20R310820181.PDF",
#         "title": "Master Direction - Foreign Exchange Management (Transfer or Issue of Security by a Person Resident outside India)",
#         "circular_no": "MD-FEMA20R/2018",
#         "date": "31-08-2018",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDIR15022016.PDF",
#         "title": "Master Direction - Interest Rate on Advances",
#         "circular_no": "MD-DIR/2016",
#         "date": "15-02-2016",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDKYCAML300120202.PDF",
#         "title": "Master Direction - Know Your Customer (KYC)",
#         "circular_no": "MD-KYC/2016",
#         "date": "25-02-2016",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDUPI271220191.PDF",
#         "title": "Master Direction - Unified Payments Interface (UPI)",
#         "circular_no": "MD-UPI/2019",
#         "date": "27-12-2019",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDPREPAID240820231.PDF",
#         "title": "Master Direction - Prepaid Payment Instruments",
#         "circular_no": "MD-PPI/2021",
#         "date": "27-08-2021",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDFX01092020.PDF",
#         "title": "Master Direction - Liberalised Remittance Scheme",
#         "circular_no": "MD-LRS/2016",
#         "date": "01-01-2016",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDDBT26032021.PDF",
#         "title": "Master Direction - Debit Card Issuance and Operation",
#         "circular_no": "MD-DBT/2021",
#         "date": "26-03-2021",
#     },
#     # ── Master Circulars ──────────────────────────────────
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MC01072024.PDF",
#         "title": "Master Circular - Prudential Norms on Income Recognition, Asset Classification and Provisioning",
#         "circular_no": "MC-IRAC/2024",
#         "date": "01-07-2024",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MCKCC01072024.PDF",
#         "title": "Master Circular - Kisan Credit Card Scheme",
#         "circular_no": "MC-KCC/2024",
#         "date": "01-07-2024",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MCSB01072024.PDF",
#         "title": "Master Circular - Savings Bank Accounts",
#         "circular_no": "MC-SB/2024",
#         "date": "01-07-2024",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MCFD01072024.PDF",
#         "title": "Master Circular - Foreign Direct Investment in India",
#         "circular_no": "MC-FDI/2024",
#         "date": "01-07-2024",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MCLOAN01072024.PDF",
#         "title": "Master Circular - Loans and Advances - Statutory and Other Restrictions",
#         "circular_no": "MC-Loans/2024",
#         "date": "01-07-2024",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MCPRIORITY01072024.PDF",
#         "title": "Master Circular - Priority Sector Lending",
#         "circular_no": "MC-PSL/2024",
#         "date": "01-07-2024",
#     },
#     # ── Recent Notifications (2023–2025) ─────────────────
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/notification/PDFs/NT2024MSME.PDF",
#         "title": "RBI Notification - MSME Lending Guidelines 2024",
#         "circular_no": "RBI/2024/MSME",
#         "date": "2024",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/notification/PDFs/NOTI12520240112.PDF",
#         "title": "RBI Circular - Digital Lending Guidelines",
#         "circular_no": "RBI/2024-25/23",
#         "date": "12-01-2024",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/notification/PDFs/NREGS_INTEREST.PDF",
#         "title": "RBI - Interest Rates on NRE Deposits",
#         "circular_no": "RBI/NREGS",
#         "date": "2023",
#     },
#     # ── Annual Reports & Policy Docs ──────────────────────
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/AnnualReport/PDFs/0AR202324_F.PDF",
#         "title": "RBI Annual Report 2023-24",
#         "circular_no": "AR/2023-24",
#         "date": "2024",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/Speeches/PDFs/MONETARYPOLICY2024.PDF",
#         "title": "RBI Monetary Policy Statement 2024",
#         "circular_no": "MPC/2024",
#         "date": "2024",
#     },
#     # ── FEMA Regulations ─────────────────────────────────
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/FEMA22020191.PDF",
#         "title": "FEMA 22 - Foreign Exchange Management (Export of Goods and Services)",
#         "circular_no": "FEMA-22/2000",
#         "date": "03-05-2000",
#     },
#     {
#         "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/FEMA120190527.PDF",
#         "title": "FEMA 1 - Foreign Exchange Management (Permissible Capital Account Transactions)",
#         "circular_no": "FEMA-1/2000",
#         "date": "03-05-2000",
#     },
# ]

# ─────────────────────────────────────────────────────────────
#  Logger
# ─────────────────────────────────────────────────────────────

def setup_logger():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log_file = OUTPUT_DIR / "rbi_scraper.log"
    logger.remove()
    logger.add(
        lambda msg: print(msg, end=""),
        level="INFO",
        format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}",
    )
    logger.add(str(log_file), level="DEBUG", rotation="10 MB",
               format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}")


# ─────────────────────────────────────────────────────────────
#  HTTP Helper
# ─────────────────────────────────────────────────────────────

def make_request(url: str, session: requests.Session) -> requests.Response | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(url, headers=HEADERS, timeout=TIMEOUT)
            response.raise_for_status()
            time.sleep(DELAY)
            return response
        except requests.exceptions.HTTPError as e:
            logger.warning(f"HTTP {e.response.status_code} — {url[:60]} (attempt {attempt}/{MAX_RETRIES})")
        except Exception as e:
            logger.warning(f"Error on {url[:60]}: {type(e).__name__} (attempt {attempt}/{MAX_RETRIES})")
        if attempt < MAX_RETRIES:
            time.sleep(attempt * 5)
    logger.error(f"Failed after {MAX_RETRIES} attempts: {url[:60]}")
    return None


# ─────────────────────────────────────────────────────────────
#  Crawl RBI Listing Pages for PDF Links
# ─────────────────────────────────────────────────────────────

def crawl_listing_pages(session: requests.Session) -> list[dict]:
    """
    Crawl RBI listing pages and extract PDF links from HTML tables.
    RBI listing pages render some HTML even without JS.
    """
    found_links = []
    seen_urls   = set()

    logger.info(f"Crawling {len(RBI_LISTING_PAGES)} RBI listing pages...")

    for page_url in RBI_LISTING_PAGES:
        logger.info(f"  Crawling: {page_url[:65]}...")
        response = make_request(page_url, session)
        if not response:
            continue

        soup = BeautifulSoup(response.text, "lxml")

        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()

            # Look for PDF links
            if not (href.lower().endswith(".pdf") or
                    "rdocs" in href.lower() or
                    "/PDFs/" in href):
                continue

            # Build absolute URL
            if href.startswith("http"):
                abs_url = href
            elif href.startswith("/"):
                abs_url = f"https://www.rbi.org.in{href}"
            else:
                abs_url = urljoin(page_url, href)

            if abs_url in seen_urls:
                continue
            seen_urls.add(abs_url)

            title = a_tag.get_text(strip=True) or "RBI Document"

            # Get parent row context for metadata
            context = ""
            for parent in a_tag.parents:
                if parent.name in ["tr", "li", "td", "div"]:
                    context = parent.get_text(" ", strip=True)[:300]
                    break

            found_links.append({
                "url":     abs_url,
                "title":   title[:200],
                "context": context,
                "source":  "listing_page",
            })

        if found_links:
            logger.info(f"    Found {len(found_links)} PDF links so far")

    return found_links


# ─────────────────────────────────────────────────────────────
#  Metadata Extraction
# ─────────────────────────────────────────────────────────────

def extract_metadata(url: str, title: str, context: str) -> dict:
    """Extract circular_no and date from URL/title."""
    circular_no = "unknown"
    date_str    = "unknown"

    # Circular number patterns
    circ_patterns = [
        r"RBI/(\d{4}-\d{2}/\d+)",          # RBI/2024-25/23
        r"circular[_\s]no[.\s]*(\S+)",      # Circular No. 45
        r"(MC|MD|FEMA|NOTI)[_\-]?(\w+)",   # MC-KCC, MD-UPI
        r"(\d{2,4}/\d{2,4})",              # 45/2024
    ]
    combined = f"{title} {context} {url}"
    for pat in circ_patterns:
        m = re.search(pat, combined, re.IGNORECASE)
        if m:
            circular_no = m.group(0)[:30]
            break

    # Date patterns
    date_patterns = [
        r"(\d{1,2}[-/]\d{1,2}[-/]\d{4})",
        r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})",
        r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})",
        r"(20\d{2})",
    ]
    for pat in date_patterns:
        m = re.search(pat, combined, re.IGNORECASE)
        if m:
            date_str = m.group(1)
            break

    return {"circular_no": circular_no, "date": date_str}


# ─────────────────────────────────────────────────────────────
#  Index CSV Logger
# ─────────────────────────────────────────────────────────────

class IndexLogger:
    def __init__(self):
        self.csv_path   = OUTPUT_DIR / "index.csv"
        self.fieldnames = ["corpus","filename","circular_no","date",
                           "title","url","downloaded_at","file_size_kb"]
        if not self.csv_path.exists():
            with open(self.csv_path, "w", newline="", encoding="utf-8") as f:
                csv.DictWriter(f, fieldnames=self.fieldnames).writeheader()

    def log(self, filename, circular_no, date, title, url, size_kb):
        with open(self.csv_path, "a", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=self.fieldnames).writerow({
                "corpus":       "rbi",
                "filename":     filename,
                "circular_no":  circular_no,
                "date":         date,
                "title":        title[:200],
                "url":          url,
                "downloaded_at":datetime.now().isoformat(),
                "file_size_kb": round(size_kb, 1),
            })


# ─────────────────────────────────────────────────────────────
#  PDF Downloader
# ─────────────────────────────────────────────────────────────

def sanitize_filename(url: str, title: str, idx: int) -> str:
    url_name = Path(urlparse(url).path).name
    if url_name.lower().endswith(".pdf") and len(url_name) > 5:
        return re.sub(r"[^\w\-.]", "_", url_name)[:100]
    clean = re.sub(r"[^\w\s-]", "", title)
    clean = re.sub(r"\s+", "_", clean.strip())[:60]
    return f"rbi_{idx:04d}_{clean}.pdf" if clean else f"rbi_{idx:04d}.pdf"


def download_pdf(url: str, filename: str, session: requests.Session) -> tuple[bool, float]:
    """Download PDF. Returns (success, size_kb)."""
    out_path = OUTPUT_DIR / filename
    if out_path.exists() and out_path.stat().st_size > 1000:
        return True, out_path.stat().st_size / 1024

    response = make_request(url, session)
    if not response:
        return False, 0

    content_type = response.headers.get("content-type", "")
    if len(response.content) < 500:
        logger.warning(f"Too small ({len(response.content)} bytes): {filename}")
        return False, 0

    with open(out_path, "wb") as f:
        f.write(response.content)

    size_kb = len(response.content) / 1024
    logger.debug(f"  ✓ {filename} ({size_kb:.0f} KB)")
    return True, size_kb


# ─────────────────────────────────────────────────────────────
#  Main Scraper
# ─────────────────────────────────────────────────────────────

def scrape_rbi(limit: int = None):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    setup_logger()

    logger.info("=" * 60)
    logger.info("Vidi RBI Scraper")
    logger.info("Strategy: Curated PDFs + Listing page crawl")
    logger.info(f"Output: {OUTPUT_DIR}")
    if limit:
        logger.info(f"Limit: {limit} PDFs (test mode)")
    logger.info("=" * 60)

    session      = requests.Session()
    session.headers.update(HEADERS)
    index_logger = IndexLogger()

    # ── Build full PDF list ───────────────────────────────────
    # Start with curated high-value docs
    all_links = []
    seen_urls = set()

    # Add curated PDFs first (guaranteed high quality)
    for item in CURATED_RBI_PDFS:
        if item["url"] not in seen_urls:
            seen_urls.add(item["url"])
            all_links.append({
                "url":         item["url"],
                "title":       item["title"],
                "circular_no": item["circular_no"],
                "date":        item["date"],
                "source":      "curated",
            })

    logger.info(f"Curated docs:  {len(all_links)}")

    # Crawl listing pages for additional PDFs
    crawled = crawl_listing_pages(session)
    new_crawled = [l for l in crawled if l["url"] not in seen_urls]
    seen_urls.update(l["url"] for l in new_crawled)
    all_links.extend(new_crawled)

    logger.info(f"Crawled docs:  {len(new_crawled)}")
    logger.info(f"Total links:   {len(all_links)}")

    # Apply limit
    if limit:
        all_links = all_links[:limit]
        logger.info(f"Limited to:    {limit} PDFs")

    # ── Download PDFs ─────────────────────────────────────────
    logger.info(f"\nDownloading {len(all_links)} RBI PDFs...")
    success_count = 0
    fail_count    = 0

    for i, link in enumerate(tqdm(all_links, desc="Downloading RBI PDFs")):
        url      = link["url"]
        title    = link.get("title", "RBI Document")
        filename = sanitize_filename(url, title, i + 1)

        # Use pre-set metadata for curated, extract for crawled
        if link.get("source") == "curated":
            circular_no = link.get("circular_no", "unknown")
            date        = link.get("date", "unknown")
        else:
            meta        = extract_metadata(url, title, link.get("context", ""))
            circular_no = meta["circular_no"]
            date        = meta["date"]

        success, size_kb = download_pdf(url, filename, session)

        if success:
            index_logger.log(filename, circular_no, date, title, url, size_kb)
            success_count += 1
        else:
            fail_count += 1

    # ── Summary ───────────────────────────────────────────────
    total_mb = sum(
        f.stat().st_size for f in OUTPUT_DIR.glob("*.pdf")
    ) / (1024 * 1024)

    logger.info("\n" + "=" * 60)
    logger.info("SCRAPING COMPLETE — RBI")
    logger.info(f"  ✓ Downloaded:  {success_count} PDFs")
    logger.info(f"  ✗ Failed:      {fail_count} PDFs")
    logger.info(f"  📁 Saved to:   {OUTPUT_DIR}")
    logger.info(f"  📋 Index:      {OUTPUT_DIR}/index.csv")
    logger.info(f"  💾 Total size: {total_mb:.1f} MB")
    logger.info("=" * 60)

    return success_count


# ─────────────────────────────────────────────────────────────
#  Verify — Print Index
# ─────────────────────────────────────────────────────────────

def verify():
    index_path = OUTPUT_DIR / "index.csv"
    if not index_path.exists():
        print("No index.csv found.")
        return
    with open(index_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"\n{'='*60}")
    print(f"RBI Index — {len(rows)} documents")
    print(f"{'='*60}")
    for row in rows[:10]:
        print(f"  {row['filename'][:40]:<40} | {row['circular_no'][:20]:<20} | {row['date']}")
    if len(rows) > 10:
        print(f"  ... and {len(rows)-10} more")


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Vidi — RBI Scraper")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit number of PDFs (for testing)")
    parser.add_argument("--verify", action="store_true",
                        help="Print index.csv after scraping")
    args = parser.parse_args()

    scrape_rbi(args.limit)

    if args.verify:
        verify()


if __name__ == "__main__":
    main()