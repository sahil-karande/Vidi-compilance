"""
RegIQ — backend/app/main.py
Finalized Core Routing Aggregator Engine
Orchestrates API modules, handles global exception layers, and cleans up pre-flight CORS.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.config import settings
from app.rag.cache import query_cache
from app.api import (
    query, 
    threads_api, 
    alerts_api, 
    me, 
    scorecard, 
    calendar, 
    upload, 
    billing,
    graph,
    pipeline_sync
)

async def _warmup_rag_pipeline():
    """Asynchronously pre-warms embedding models, centroids, ChromaDB, and BM25 indexes on boot."""
    try:
        logger.info("[lifespan] Starting background pre-warming of RAG models & indexes...")
        loop = asyncio.get_running_loop()

        def _do_warmup():
            from app.rag.classifier import get_embedding_model as get_cls_model, get_centroids
            from app.rag.retriever import get_embedding_model as get_ret_model, get_chroma_client, get_bm25_index
            from app.rag.reranker import get_reranker_model

            # 1. Warm sentence-transformers and classifier centroids
            get_cls_model()
            get_centroids()
            get_ret_model()

            # 2. Warm ChromaDB connection
            get_chroma_client()

            # 3. Warm BM25 index for primary corpora
            for corpus in ["gst", "rbi", "sebi", "mca", "fema"]:
                try:
                    get_bm25_index(corpus)
                except Exception as bm_err:
                    logger.warning(f"[lifespan] BM25 pre-warm for '{corpus}' notice: {bm_err}")

            # 4. Warm Cross-Encoder reranker
            get_reranker_model()

        await loop.run_in_executor(None, _do_warmup)
        logger.info("[lifespan] Pre-warming completed! All RAG models and BM25 indexes are hot.")
    except Exception as e:
        logger.warning(f"[lifespan] Warmup completed with notice: {e}")

def _get_next_sync_datetime(last_run: datetime | None = None) -> datetime:
    """
    Calculates the exact next execution timestamp at 02:30 AM IST (inside the 1:00 AM - 4:00 AM low-firewall window)
    on alternate days (every 48 hours).
    """
    now = datetime.now()
    if last_run is None:
        target = now.replace(hour=2, minute=30, second=0, microsecond=0)
        if now >= target:
            target += timedelta(days=1)
        return target
    else:
        target = last_run + timedelta(days=2)
        target = target.replace(hour=2, minute=30, second=0, microsecond=0)
        while target <= now:
            target += timedelta(days=2)
        return target

async def _run_scheduled_sync():
    """
    Automated Regulatory Sync Engine:
    Executes on alternate days (every 48 hours) precisely at 02:30 AM (between 1:00 AM and 4:00 AM IST)
    when portal firewalls, rate limits, and server loads across RBI, SEBI, FEMA, MCA, and GST are lowest.
    """
    last_run: datetime | None = None
    while True:
        next_run = _get_next_sync_datetime(last_run)
        delay = (next_run - datetime.now()).total_seconds()
        hours = int(delay // 3600)
        mins = int((delay % 3600) // 60)
        logger.info(
            f"[auto-sync] Next regulatory delta sync scheduled for {next_run.strftime('%Y-%m-%d %H:%M:%S')} "
            f"(in {hours}h {mins}m) [Alternate Days / 1:00 AM - 4:00 AM Low-Firewall Window]."
        )
        await asyncio.sleep(max(1.0, delay))

        last_run = datetime.now()
        try:
            logger.info("[auto-sync] Entering low-firewall window (01:00 AM - 04:00 AM). Starting automated delta sync for RBI, SEBI, FEMA, MCA, GST...")
            loop = asyncio.get_running_loop()
            def _sync():
                from pipeline.auto_sync import run_delta_sync
                return run_delta_sync()
            result = await loop.run_in_executor(None, _sync)
            logger.info(f"[auto-sync] Scheduled sync complete: {result.get('new_documents_added', 0)} new documents ingested.")
        except Exception as err:
            logger.warning(f"[auto-sync] Scheduled sync notice: {err}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Non-blocking async background warmup so server binds and serves health check immediately
    warmup_task = asyncio.create_task(_warmup_rag_pipeline())
    sync_task = asyncio.create_task(_run_scheduled_sync())
    yield
    if not warmup_task.done():
        warmup_task.cancel()
    if not sync_task.done():
        sync_task.cancel()
    logger.info("[lifespan] Vidi backend shutdown.")

# ─────────────────────────────────────────────────────────────
#  FastAPI App Initialization
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="RegIQ API",
    description="RAG-powered Financial Regulation Q&A Assistant for Indian SMEs",
    version="0.1.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
    lifespan=lifespan,
)

# ─────────────────────────────────────────────────────────────
#  CORS Middleware Configuration
# ─────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Open configuration to completely eliminate local pre-flight blocker errors
    allow_credentials=False,  # Set to False explicitly when wildcards are active 
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
#  Root & Health Checks
# ─────────────────────────────────────────────────────────────

@app.get("/", tags=["System"])
def root():
    return {
        "service": "RegIQ API",
        "version": "0.1.0",
        "status": "ok",
        "docs": "/docs" if settings.environment == "development" else "disabled in production",
    }


@app.get("/health", tags=["System"])
def health():
    return {
        "status": "healthy",
        "environment": settings.environment,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/cache/stats", tags=["System"])
def get_cache_stats():
    """Returns telemetry on in-memory query cache hits, misses, and active size."""
    return {
        "status": "ok",
        "cache": query_cache.get_stats(),
    }


@app.post("/api/cache/clear", tags=["System"])
def clear_cache():
    """Flushes the query cache."""
    query_cache.clear()
    return {"status": "ok", "message": "Query cache flushed successfully"}


# ─────────────────────────────────────────────────────────────
#  Global Exception Handler
# ─────────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.environment == "development" else "An error occurred",
        },
    )


# ─────────────────────────────────────────────────────────────
#  API Router Registrations
# ─────────────────────────────────────────────────────────────

# Core features
app.include_router(query.router, prefix="/api", tags=["Query"])
app.include_router(threads_api.router, prefix="/api", tags=["Threads"])
app.include_router(alerts_api.router, prefix="/api", tags=["Alerts"])
app.include_router(me.router, prefix="/api", tags=["Authentication Test"])

# Interactive Diagnostics Dials (Scorecard & Calendar)
app.include_router(scorecard.router, prefix="/api", tags=["Scorecard"])
app.include_router(calendar.router, prefix="/api", tags=["Calendar"]) 

# Pro-Tier Document Upload Workspace Ingestion
app.include_router(upload.router, prefix="/api", tags=["Pro Upload"])

# Subscription Tier Webhooks and Processing
app.include_router(billing.router, prefix="/api", tags=["Billing"])

# D3 Citation Graph & Topological Explorer
app.include_router(graph.router, prefix="/api", tags=["Regulation Graph"])

# Automated Regulatory Pipeline Sync
app.include_router(pipeline_sync.router, prefix="/api", tags=["Pipeline Sync"])