"""
Vidi — backend/app/main.py
Updated: Day 35 — Scorecard integration and calendar routing verification
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from app.config import settings
# FIXED: Imported calendar along with the other routers
from app.api import query, threads_api, alerts_api, me, scorecard, calendar, upload
from app.api import billing
from app.api import query, upload, scorecard, alerts, billing  # Add billing here

# ─────────────────────────────────────────────────────────────
#  FastAPI App Initialization
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Vidi API",
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
        "service": "Vidi API",
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

# Day 35 Scorecard Pillar Integration Route
app.include_router(scorecard.router, prefix="/api", tags=["Scorecard"])

# ─────────── 💡 DAY 35 CALENDAR ROUTE ───────────
# FIXED: Uncommented to register the live calendar timeline route parameters
app.include_router(calendar.router, prefix="/api", tags=["Calendar"]) 
# ──────────────────────────────────────────────────

# Register router line...
app.include_router(upload.router, prefix="/api", tags=["Pro Upload"])

app.include_router(billing.router)
