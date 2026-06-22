"""
Vidi — backend/app/main.py
Updated: Day 21 — Query limit enforcement wired in
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from app.config import settings
from app.api import query, threads_api, alerts_api
from app.api import me  # Day 20: authenticated test endpoint

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

# Change your CORS Middleware section to look exactly like this:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # <-- Change this from settings.allowed_origins_list to ["*"]
    allow_credentials=False,  # <-- Set this to False when using allow_origins=["*"]
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

# Day 21: query.router now has prefix="/api" baked into its own
# route paths internally is NOT the pattern used here — instead
# we add the prefix at include_router, matching threads/alerts style.
app.include_router(query.router, prefix="/api", tags=["Query"])         # Day 21 (was Day 14, prefix added)
app.include_router(threads_api.router, prefix="/api", tags=["Threads"]) # Day 16
app.include_router(alerts_api.router, prefix="/api", tags=["Alerts"])   # Day 16

# ── Day 20 Authentication Endpoints ───────────────────────────
app.include_router(me.router, prefix="/api", tags=["Authentication Test"])


# Future Roadmap Markers:
# Day 34: from app.api import scorecard
#         app.include_router(scorecard.router, prefix="/api", tags=["Scorecard"])

# Day 42: from app.api import billing
#         app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])