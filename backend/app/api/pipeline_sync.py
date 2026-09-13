"""
Vidi — backend/app/api/pipeline_sync.py
Regulatory Delta Synchronization Router
Provides endpoints to check sync status and manually trigger incremental sync routines.
"""

from fastapi import APIRouter, BackgroundTasks, Depends
from app.api.auth import get_current_user
from app.models.user import User
from typing import Dict, Any
from pathlib import Path
import json

router = APIRouter(prefix="/sync", tags=["Pipeline Sync"])

BASE_DIR = Path(__file__).parent.parent.parent.parent
LEDGER_FILE = BASE_DIR / "data" / "sync_ledger.json"

@router.get("/status", response_model=Dict[str, Any])
async def get_sync_status():
    """Returns the current regulatory sync ledger status and tracked document counts."""
    if LEDGER_FILE.exists():
        try:
            with open(LEDGER_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {
                    "status": "ready",
                    "last_sync": data.get("last_sync"),
                    "total_documents_tracked": sum(data.get("corpora_counts", {}).values()),
                    "corpora_counts": data.get("corpora_counts", {})
                }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return {
        "status": "uninitialized",
        "last_sync": None,
        "total_documents_tracked": 0,
        "corpora_counts": {}
    }

def _background_sync_worker():
    try:
        from pipeline.auto_sync import run_delta_sync
        run_delta_sync()
    except Exception as e:
        print(f"[Sync Worker Error] {e}")

@router.post("/run")
async def trigger_sync(background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """Triggers an incremental delta sync across RBI, SEBI, MCA, GST and FEMA."""
    background_tasks.add_task(_background_sync_worker)
    return {
        "message": "Regulatory delta synchronization triggered in background.",
        "status": "in_progress"
    }
