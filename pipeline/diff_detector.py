"""
RegIQ — pipeline/diff_detector.py
Day 9 Task: Automated Change Detection

Compares newly scraped text variations against previously chunked documents
to identify added, modified, or repealed regulatory text clauses.
"""

import os
import json
import difflib
from pathlib import Path
from datetime import datetime
from loguru import logger

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

# Setup monitoring logs
logger.add(DATA_DIR / "diff_detector.log", rotation="5 MB", level="INFO")

def load_json_chunks(file_path: Path) -> list:
    """Safely loads chunks from a chunks.json file."""
    if not file_path.exists():
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read chunks from {file_path}: {e}")
        return []

def calculate_text_diff(old_text: str, new_text: str) -> dict:
    """Performs a line-by-line delta comparison using standard library diffing."""
    old_lines = old_text.splitlines()
    new_lines = new_text.splitlines()
    
    differ = difflib.Differ()
    diff_results = list(differ.compare(old_lines, new_lines))
    
    additions = [line[2:] for line in diff_results if line.startswith("+ ")]
    deletions = [line[2:] for line in diff_results if line.startswith("- ")]
    
    return {
        "has_changes": len(additions) > 0 or len(deletions) > 0,
        "addition_count": len(additions),
        "deletion_count": len(deletions),
        "summary": {
            "snippets_added": additions[:5],   # Top 5 highlights
            "snippets_deleted": deletions[:5]
        }
    }

def detect_corpus_changes(corpus: str, backup_dir: Path) -> list:
    """Compares the active chunks.json against a cached historical version."""
    active_chunks_file = DATA_DIR / corpus / "chunks.json"
    historical_chunks_file = backup_dir / corpus / "chunks.json"
    
    if not active_chunks_file.exists():
        logger.warning(f"No active chunks found for corpus: {corpus}")
        return []
        
    if not historical_chunks_file.exists():
        logger.info(f"First-time run setup or missing backup data for {corpus}. Skipping diff matching.")
        return []

    logger.info(f"Analyzing changes for corpus: {corpus.upper()}")
    active_data = load_json_chunks(active_chunks_file)
    historical_data = load_json_chunks(historical_chunks_file)

    # Reconstruct whole corpus or match file-to-file based on metadata sources
    active_docs = {}
    for chunk in active_data:
        src = chunk.get("metadata", {}).get("source", "unknown")
        active_docs[src] = active_docs.get(src, "") + "\n" + chunk.get("text", "")

    historical_docs = {}
    for chunk in historical_data:
        src = chunk.get("metadata", {}).get("source", "unknown")
        historical_docs[src] = historical_docs.get(src, "") + "\n" + chunk.get("text", "")

    detected_alerts = []

    # Check for modifications or structural content changes
    for doc_source, current_text in active_docs.items():
        if doc_source in historical_docs:
            old_text = historical_docs[doc_source]
            diff_report = calculate_text_diff(old_text, current_text)
            
            if diff_report["has_changes"]:
                alert = {
                    "corpus": corpus,
                    "source_doc": doc_source,
                    "type": "modification",
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": {
                        "lines_added": diff_report["addition_count"],
                        "lines_removed": diff_report["deletion_count"]
                    },
                    "highlights": diff_report["summary"]
                }
                detected_alerts.append(alert)
                logger.info(f"🚨 REGULATION CHANGE FLAGGED in {corpus.upper()} -> {doc_source}")
        else:
            # Completely fresh file added during automated cycle
            alert = {
                "corpus": corpus,
                "source_doc": doc_source,
                "type": "new_provision",
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": {"lines_added": len(current_text.splitlines()), "lines_removed": 0},
                "highlights": {"snippets_added": current_text.splitlines()[:5], "snippets_deleted": []}
            }
            detected_alerts.append(alert)
            logger.info(f"✨ NEW DOCUMENT DETECTED in {corpus.upper()} -> {doc_source}")

    return detected_alerts

def run_diff_detection(backup_directory_name: str = "backup_historical") -> list:
    """Main orchestration entry point to detect variations across all 5 active systems."""
    backup_path = DATA_DIR / backup_directory_name
    corpora_list = ["gst", "rbi", "sebi", "mca", "fema"]
    all_system_alerts = []

    for corpus in corpora_list:
        corpus_alerts = detect_corpus_changes(corpus, backup_path)
        all_system_alerts.extend(corpus_alerts)

    # Output an alert manifest file which your Supabase alert trigger layer will ingest in Week 9
    manifest_out = DATA_DIR / "checkpoint_report.json"
    with open(manifest_out, "w", encoding="utf-8") as f:
        json.dump(all_system_alerts, f, indent=4)

    logger.info(f"Diff detection routine complete. Created {len(all_system_alerts)} system alert records.")
    return all_system_alerts

if __name__ == "__main__":
    run_diff_detection()