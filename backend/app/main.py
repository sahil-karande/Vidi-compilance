"""
RegIQ — backend/app/main.py
Finalized Core Routing Aggregator Engine
Orchestrates API modules, handles global exception layers, and cleans up pre-flight CORS.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from app.config import settings
from app.api import (
    query, 
    threads_api, 
    alerts_api, 
    me, 
    scorecard, 
    calendar, 
    upload, 
    billing
)

# ─────────────────────────────────────────────────────────────
#  FastAPI App Initialization
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="RegIQ API",
    description="RAG-powered Financial Regulation Q&A Assistant for Indian SMEs",
    version="0.1.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
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