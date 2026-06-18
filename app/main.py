"""
Vidi — backend/app/main.py
Updated: Day 16 — Threads + Alerts routers added
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from app.config import settings
from app.api import query
from app.api import threads_api, alerts_api   # Day 16 (Updated names)

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
#  Routers
# ─────────────────────────────────────────────────────────────

app.include_router(query.router)                                        # Day 14

# Update your router inclusion at the bottom:
app.include_router(threads_api.router, prefix="/api", tags=["Threads"])
app.include_router(alerts_api.router, prefix="/api", tags=["Alerts"]) # Added the 's' here too

# Day 20: from app.api import auth
#         app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Day 34: from app.api import scorecard
#         app.include_router(scorecard.router, prefix="/api", tags=["Scorecard"])

# Day 42: from app.api import billing
#         app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])