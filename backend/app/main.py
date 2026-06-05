from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize the core FastAPI app instance
app = FastAPI(
    title="Vidi API",
    description="Backend engine for Vidi Compliance RAG platform",
    version="0.1.0"
)

# Configure CORS so your React frontend can talk to the backend smoothly later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # We will restrict this to your Vercel URL during deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """Service health state validation endpoint."""
    return {
        "status": "healthy",
        "environment": "development"
    }