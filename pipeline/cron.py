"""
RegIQ — pipeline/cron.py
Day 9 Task: Pipeline Cron Automation Orchestrator

Manages the weekly automated execution workflow:
Creates historical snapshot backup ➔ Scraper ➔ Chunker ➔ Embedder ➔ Indexer ➔ Diff Detector
"""

import os
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
from loguru import logger
from apscheduler.schedulers.blocking import BlockingScheduler

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
PIPELINE_DIR = BASE_DIR / "pipeline"

logger.add(DATA_DIR / "cron_pipeline.log", rotation="10 MB", level="INFO")

def backup_current_chunks():
    """Caches the existing metadata chunk structure before downloading mutations."""
    backup_root = DATA_DIR / "backup_historical"
    corpora_list = ["gst", "rbi", "sebi", "mca", "fema"]
    
    logger.info("Initializing pre-sync data structure backup...")
    for corpus in corpora_list:
        active_chunks = DATA_DIR / corpus / "chunks.json"
        if active_chunks.exists():
            backup_corpus_dir = backup_root / corpus
            backup_corpus_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(active_chunks, backup_corpus_dir / "chunks.json")
            logger.info(f"Successfully backed up active {corpus} chunks.")

def execute_pipeline_step(script_name: str) -> bool:
    """Runs a sub-module script inside our environment and streams logging states."""
    script_path = PIPELINE_DIR / script_name
    if not script_path.exists():
        logger.error(f"Execution failed: script path {script_path} does not exist.")
        return False

    logger.info(f"▶️ Starting core module task: {script_name}")
    try:
        # Executes within our activated virtual environment framework context
        result = subprocess.run(
            ["python", str(script_path)],
            capture_output=True,
            text=True,
            check=True
        )
        logger.info(f"✅ Finished module task cleanly: {script_name}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ CRITICAL SUBSYSTEM FAULT running {script_name}!")
        logger.error(f"STDOUT: {e.stdout}")
        logger.error(f"STDERR: {e.stderr}")
        return False

def run_weekly_sync_sequence():
    """Complete system integration sequence wrapper."""
    start_time = datetime.now()
    logger.info(f"=================== CRON SYNC SEQUENCE INITIATED: {start_time} ===================")
    
    # 1. Take a clean snapshot profile copy of yesterday's parsed state
    backup_current_chunks()

    # 2. Run your portal requests network update engines sequentially
    steps = [
        "scraper.py",       # Sync newest portal PDFs
        "chunker.py",       # Run PyMuPDF + Tesseract matching
        "embedder.py",      # Build vectors with all-MiniLM-L6-v2
        "indexer.py",       # Commit records inside Chroma Vector DB
        "diff_detector.py"  # Compute difference metrics and flag changes
    ]

    for step in steps:
        success = execute_pipeline_step(step)
        if not success:
            logger.critical(f"Pipeline flow terminated abruptly at layer: {step}")
            return

    end_time = datetime.now()
    duration = end_time - start_time
    logger.info(f"=================== CRON SYNC COMPLETED SUCCESSFUL: Duration {duration} ===================")

def start_scheduler():
    """Initializes standard background process bindings via APScheduler loops."""
    scheduler = BlockingScheduler()
    
    # Scheduled execution bound for Sunday midnight to match Indian banking cycles
    scheduler.add_job(
        run_weekly_sync_sequence,
        'cron',
        day_of_week='sun',
        hour=0,
        minute=0,
        id='weekly_regiq_sync',
        mismatch_grace_time=3600
    )
    
    logger.info("RegIQ Background Engine Scheduler Initialized Successfully [Active Weekly Loop].")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler execution suspended cleanly.")

if __name__ == "__main__":
    # If explicitly fired manual testing parameter, trigger sync immediately instead of stalling
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--now":
        run_weekly_sync_sequence()
    else:
        start_scheduler()