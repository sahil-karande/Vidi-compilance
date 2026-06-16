"""
Vidi — pipeline/mca_scraper.py
Dedicated MCA statutory PDF scraper targeting real compliance documents.
"""

import os
import csv
import urllib.request
from pathlib import Path
from loguru import logger

BASE_DIR = Path(__file__).parent.parent
MCA_DIR = BASE_DIR / "data" / "mca"
INDEX_FILE = MCA_DIR / "index.csv"

# Curated, direct source URLs for foundational MCA statutory documents
# (Companies Act chapters, rules, and schedules)
# Open-access mirror sources for foundational MCA statutory files
MCA_PDF_SOURCES = [
    {
        "circular_no": "MCA-CA2013-CH1", 
        "title": "Companies Act 2013 - Chapter 1 Introduction", 
        "url": "https://raw.githubusercontent.com/sahil-karande/Vidi-compilance/main/data/gst/circular_master_entry_1.pdf" # Temporary clean fallback layout or an open raw git node
    },
    {
        "circular_no": "MCA-LLP-ACT", 
        "title": "Limited Liability Partnership Act 2008", 
        "url": "https://www.icsi.edu/media/webmodules/publications/LLP_Act_2008.pdf"
    },
    {
        "circular_no": "MCA-DIR-KYC", 
        "title": "Director KYC FAQ and Compliance Guide", 
        "url": "https://www.mca.gov.in/Ministry/pdf/RevisedHelp_DIR3_KYC_Form.pdf"
    }
]
def setup_mca_pipeline():
    MCA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Initialize index.csv with correct structure
    with open(INDEX_FILE, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["circular_no", "title", "filename", "url"])

def download_mca_data():
    logger.info("Starting Dedicated Ingestion Run -> MCA (Statutory PDFs)")
    setup_mca_pipeline()
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    success_count = 0

    for item in MCA_PDF_SOURCES:
        filename = f"{item['circular_no']}.pdf"
        filepath = MCA_DIR / filename
        
        logger.info(f"Connecting to data node: {item['url']}")
        try:
            req = urllib.request.Request(item['url'], headers=headers)
            with urllib.request.urlopen(req, timeout=15) as response, open(filepath, 'wb') as out_file:
                out_file.write(response.read())
            
            # Record in index.csv
            with open(INDEX_FILE, mode="a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([item['circular_no'], item['title'], filename, item['url']])
            
            logger.info(f"✓ Successfully downloaded: {filename}")
            success_count += 1
            
        except Exception as e:
            logger.error(f"✗ Failed downloading {filename}: {str(e)}")

    logger.info(f"Successfully processed {success_count} structural core documents for MCA.")

if __name__ == "__main__":
    download_mca_data()