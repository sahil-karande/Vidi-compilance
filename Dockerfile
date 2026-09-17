# ─────────────────────────────────────────────────────────────
#  Vidi — Backend Dockerfile
#  Build context: project root (set Root Directory to blank in Render)
# ─────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# System deps needed for PyMuPDF, pytesseract, and sentence-transformers
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cached layer)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code + pipeline module (needed by upload.py, pipeline_sync.py)
COPY backend/app/ ./app/
COPY pipeline/ ./pipeline/

# Create data directory
RUN mkdir -p /app/data

# Non-root user for security
RUN adduser --disabled-password --gecos "" regiquser
RUN chown -R regiquser:regiquser /app
USER regiquser

# Expose FastAPI port
EXPOSE 8000

# Start server — PORT is injected by Render at runtime
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1