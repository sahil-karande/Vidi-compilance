"""
Vidi — backend/app/main.py
Day 14 Task: FastAPI Scaffold + Query Router Integration

Initializes the FastAPI application:
- CORS middleware
- Health check endpoint
- Settings loaded from .env
- Connected to Day 14 Structured RAG /query router layer
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from app.config import settings
# Explicitly import the query api submodule that handles our RAG pipelines
from app.api import query

# ─────────────────────────────────────────────────────────────
#  FastAPI App
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Vidi API",
    description="RAG-powered Financial Regulation Q&A Assistant for Indian SMEs",
    version="0.1.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
)

# ─────────────────────────────────────────────────────────────
#  CORS Middleware
# ─────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
#  Root + Health Check
# ─────────────────────────────────────────────────────────────

@app.get("/", tags=["System"])
def root():
    """Root endpoint — basic service info."""
    return {
        "service": "Vidi API",
        "version": "0.1.0",
        "status": "ok",
        "docs": "/docs" if settings.environment == "development" else "disabled in production",
    }


@app.get("/health", tags=["System"])
def health():
    """
    Health check endpoint.
    Used by Docker healthcheck, Render, and uptime monitors.
    """
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
    """Catch-all exception handler — returns clean JSON errors."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.environment == "development" else "An error occurred",
        },
    )


# ─────────────────────────────────────────────────────────────
#  Routers
# ─────────────────────────────────────────────────────────────

# Day 14: Activated query pipeline engine endpoint router
app.include_router(query.router)

# Day 20: auth middleware (added incrementally in later days)
# from app.api import auth
# app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Day 34: scorecard
# from app.api import scorecard
# app.include_router(scorecard.router, prefix="/api", tags=["Scorecard"])

# Day 44: alerts
# from app.api import alerts
# app.include_router(alerts.router, prefix="/api", tags=["Alerts"])

# Day 42: billing
# from app.api import billing
# app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])