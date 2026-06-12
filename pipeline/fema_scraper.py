"""
Vidi — pipeline/fema_scraper.py
Day 8 Task: FEMA + Income Tax Act Scraper

Scrapes:
- FEMA regulations from fema.rbi.org.in (and rbi.org.in FEMA notifications)
- Income Tax Act, rules, and circulars from incometaxindia.gov.in

Both are indexed into a NEW "fema" ChromaDB collection
(separate from MCA, as FEMA + Income Tax are distinct compliance domains
relevant to SMEs doing cross-border trade and tax filing).

Downloads PDFs to data/fema/
Logs metadata to data/fema/index.csv

Usage:
    python pipeline/fema_scraper.py              # full scrape
    python pipeline/fema_scraper.py --limit 10   # test: 10 PDFs
    python pipeline/fema_scraper.py --verify     # print index after
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

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

DELAY       = 2.0
TIMEOUT     = 30
MAX_RETRIES = 3

# ─────────────────────────────────────────────────────────────
#  Listing Pages (HTML — BS4 readable)
# ─────────────────────────────────────────────────────────────

LISTING_PAGES = [
    # FEMA notifications on RBI site
    "https://www.rbi.org.in/Scripts/Fema.aspx",
    "https://www.rbi.org.in/Scripts/BS_FemaNotifications.aspx",
    # Income Tax Act sections + rules
    "https://incometaxindia.gov.in/Pages/acts/income-tax-act.aspx",
    "https://incometaxindia.gov.in/Pages/rules/income-tax-rules.aspx",
    "https://incometaxindia.gov.in/Pages/communications/circulars.aspx",
    "https://incometaxindia.gov.in/Pages/communications/notifications.aspx",
    "https://incometaxindia.gov.in/Pages/utilities/forms.aspx",
]

# ─────────────────────────────────────────────────────────────
#  Curated High-Value FEMA + Income Tax Documents
# ─────────────────────────────────────────────────────────────

CURATED_PDFS = [
    # ── FEMA Master Directions & Regulations ──────────────
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/FEMA22020191.PDF",
        "title": "FEMA 22 - Foreign Exchange Management (Export of Goods and Services) Regulations",
        "circular_no": "FEMA-22/2000",
        "date": "03-05-2000",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/FEMA120190527.PDF",
        "title": "FEMA 1 - Foreign Exchange Management (Permissible Capital Account Transactions) Regulations",
        "circular_no": "FEMA-1/2000",
        "date": "03-05-2000",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/FEMA20R310820181.PDF",
        "title": "FEMA 20(R) - Foreign Exchange Management (Transfer or Issue of Security by a Person Resident outside India)",
        "circular_no": "FEMA-20R/2018",
        "date": "31-08-2018",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDFX01092020.PDF",
        "title": "Master Direction - Liberalised Remittance Scheme (LRS)",
        "circular_no": "MD-LRS/2016",
        "date": "01-01-2016",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDEXP01012016.PDF",
        "title": "Master Direction - Export of Goods and Services",
        "circular_no": "MD-EXP/2016",
        "date": "01-01-2016",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDIMP01012016.PDF",
        "title": "Master Direction - Import of Goods and Services",
        "circular_no": "MD-IMP/2016",
        "date": "01-01-2016",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDODI01012016.PDF",
        "title": "Master Direction - Direct Investment by Residents in Joint Venture/Wholly Owned Subsidiary Abroad",
        "circular_no": "MD-ODI/2016",
        "date": "01-01-2016",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/MDECB01012016.PDF",
        "title": "Master Direction - External Commercial Borrowings, Trade Credits and Structured Obligations",
        "circular_no": "MD-ECB/2016",
        "date": "01-01-2016",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/FEMA3R0608201A4D5C5C8C5A040C18E9F9D2FBEAE5F0.PDF",
        "title": "FEMA 3(R) - Foreign Exchange Management (Borrowing and Lending) Regulations",
        "circular_no": "FEMA-3R/2018",
        "date": "17-12-2018",
    },
    {
        "url": "https://rbidocs.rbi.org.in/rdocs/content/PDFs/FEMA5R010416.PDF",
        "title": "FEMA 5(R) - Foreign Exchange Management (Deposit) Regulations",
        "circular_no": "FEMA-5R/2016",
        "date": "01-04-2016",
    },

    # ── Income Tax Act / Rules / Forms ────────────────────
    {
        "url": "https://incometaxindia.gov.in/Pages/acts/income-tax-act.aspx",
        "title": "Income Tax Act 1961 - Full Text",
        "circular_no": "IT-Act/1961",
        "date": "1961",
    },
    {
        "url": "https://www.incometaxindia.gov.in/Pages/income-tax-rules.aspx",
        "title": "Income Tax Rules 1962",
        "circular_no": "IT-Rules/1962",
        "date": "1962",
    },
    {
        "url": "https://incometaxindia.gov.in/communications/circular/circular_no_1_2024.pdf",
        "title": "CBDT Circular - TDS Rates for FY 2024-25",
        "circular_no": "CBDT-Circular/01/2024",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/communications/circular/circular_no_4_2024.pdf",
        "title": "CBDT Circular - Guidelines for Compounding of Offences",
        "circular_no": "CBDT-Circular/04/2024",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/communications/notification/notification_no_1_2024.pdf",
        "title": "CBDT Notification - Income Tax Return Forms for AY 2024-25",
        "circular_no": "CBDT-Notif/01/2024",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/forms/income-tax%20rules/2024/itr1_english.pdf",
        "title": "ITR-1 (Sahaj) Form - For Individuals",
        "circular_no": "ITR-1/2024",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/forms/income-tax%20rules/2024/itr4_english.pdf",
        "title": "ITR-4 (Sugam) Form - For Presumptive Income (Small Businesses)",
        "circular_no": "ITR-4/2024",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/forms/income-tax%20rules/2024/itr6_english.pdf",
        "title": "ITR-6 Form - For Companies",
        "circular_no": "ITR-6/2024",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/Documents/Tax-Audit-Forms/form-3cd.pdf",
        "title": "Form 3CD - Tax Audit Report under Section 44AB",
        "circular_no": "Form-3CD",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/Documents/TDS/Form-16.pdf",
        "title": "Form 16 - TDS Certificate for Salary",
        "circular_no": "Form-16",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/Documents/presumptive-taxation-scheme-44ad-44ada-44ae.pdf",
        "title": "Presumptive Taxation Scheme - Section 44AD, 44ADA, 44AE",
        "circular_no": "IT-44AD",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/Documents/tds-on-salary.pdf",
        "title": "TDS on Salary - Section 192 Guidelines",
        "circular_no": "IT-192-TDS",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/Documents/advance-tax-payment.pdf",
        "title": "Advance Tax - Payment Schedule and Computation",
        "circular_no": "IT-AdvanceTax",
        "date": "2024",
    },
    {
        "url": "https://incometaxindia.gov.in/Documents/gst-tcs-compliance.pdf",
        "title": "TCS on Sale of Goods - Section 206C(1H)",
        "circular_no": "IT-206C-TCS",
        "date": "2024",
    },
]


# ─────────────────────────────────────────────────────────────
#  Logger
# ─────────────────────────────────────────────────────────────

def setup_logger():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    log_file = OUTPUT_DIR / "fema_scraper.log"
    logger.remove()
    logger.add(lambda msg: print(msg, end=""), level="INFO",
               format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | {message}")
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
            logger.warning(f"{type(e).__name__} on {url[:60]} (attempt {attempt}/{MAX_RETRIES})")
        if attempt < MAX_RETRIES:
            time.sleep(attempt * 4)
    logger.error(f"Failed: {url[:60]}")
    return None


# ─────────────────────────────────────────────────────────────
#  Crawl Listing Pages
# ─────────────────────────────────────────────────────────────

def crawl_listing_pages(session: requests.Session) -> list[dict]:
    found = []
    seen  = set()

    logger.info(f"Crawling {len(LISTING_PAGES)} FEMA/IncomeTax listing pages...")

    for page_url in LISTING_PAGES:
        logger.info(f"  {page_url[-55:]}")
        response = make_request(page_url, session)
        if not response:
            continue

        soup = BeautifulSoup(response.text, "lxml")

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not href.lower().endswith(".pdf"):
                continue

            abs_url = href if href.startswith("http") else urljoin(page_url, href)
            if abs_url in seen:
                continue
            seen.add(abs_url)

            title   = a.get_text(strip=True) or "FEMA/IncomeTax Document"
            context = ""
            for parent in a.parents:
                if parent.name in ["tr", "li", "td", "div"]:
                    context = parent.get_text(" ", strip=True)[:300]
                    break

            found.append({"url": abs_url, "title": title[:200],
                          "context": context, "source": "crawled"})

    logger.info(f"Crawled {len(found)} PDF links from listing pages")
    return found


# ─────────────────────────────────────────────────────────────
#  Metadata Extraction
# ─────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────
#  Index Logger
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
                "corpus": "fema", "filename": filename,
                "circular_no": circular_no, "date": date,
                "title": title[:200], "url": url,
                "downloaded_at": datetime.now().isoformat(),
                "file_size_kb": round(size_kb, 1),
            })


# ─────────────────────────────────────────────────────────────
#  Downloader
# ─────────────────────────────────────────────────────────────

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
    # verify it's a PDF (not an HTML error page served with 200)
    if not response.content.startswith(b"%PDF") and not url.lower().endswith(".pdf"):
        return False, 0
    with open(out_path, "wb") as f:
        f.write(response.content)
    return True, len(response.content) / 1024


# ─────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────

def scrape_fema(limit: int = None):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    setup_logger()

    logger.info("=" * 60)
    logger.info("Vidi FEMA + Income Tax Scraper")
    logger.info(f"Output: {OUTPUT_DIR}")
    logger.info(f"Target collection: 'fema' (new ChromaDB collection)")
    if limit:
        logger.info(f"Limit: {limit} PDFs")
    logger.info("=" * 60)

    session      = requests.Session()
    index_logger = IndexLogger()

    # Build link list
    all_links = []
    seen      = set()

    for item in CURATED_PDFS:
        if item["url"] not in seen:
            seen.add(item["url"])
            all_links.append({**item, "source": "curated"})

    logger.info(f"Curated docs: {len(all_links)}")

    crawled  = crawl_listing_pages(session)
    new_ones = [l for l in crawled if l["url"] not in seen]
    seen.update(l["url"] for l in new_ones)
    all_links.extend(new_ones)

    logger.info(f"Crawled docs:  {len(new_ones)}")
    logger.info(f"Total links:   {len(all_links)}")

    if limit:
        all_links = all_links[:limit]

    # Download
    success = fail = 0
    for i, link in enumerate(tqdm(all_links, desc="Downloading FEMA/IncomeTax PDFs")):
        url      = link["url"]
        title    = link.get("title", "FEMA/IncomeTax Document")
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

    total_mb = sum(f.stat().st_size for f in OUTPUT_DIR.glob("*.pdf")) / (1024*1024)
    logger.info("\n" + "=" * 60)
    logger.info("SCRAPING COMPLETE — FEMA + Income Tax")
    logger.info(f"  ✓ Downloaded:  {success} PDFs")
    logger.info(f"  ✗ Failed:      {fail} PDFs")
    logger.info(f"  💾 Total size: {total_mb:.1f} MB")
    logger.info(f"  📁 Saved to:   {OUTPUT_DIR}")
    logger.info("=" * 60)
    logger.info("\nNext steps:")
    logger.info("  python pipeline/chunker.py --corpus fema")
    logger.info("  python pipeline/embedder.py --corpus fema")
    logger.info("  python pipeline/indexer.py --corpus fema --verify")
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
            print(f"\nFEMA Index — {len(rows)} documents")
            for row in rows[:10]:
                print(f"  {row['filename'][:45]:<45} | {row['circular_no'][:25]}")


if __name__ == "__main__":
    main()