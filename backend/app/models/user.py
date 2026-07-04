"""
Vidi — backend/app/models/user.py
Day 11 Task: Core Pydantic Models

Defines the request/response schemas used across the RAG API:
- User           — authenticated user profile (from Supabase JWT)
- QueryRequest   — incoming /query payload
- QueryResponse  — outgoing /query result with citations
- Citation       — a single source citation
- UserRole       — tier enum (Guest/Free/Pro/Enterprise)
"""

from enum import Enum
from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
#  Enums
# ─────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    """User tier — matches profiles.role in Supabase schema."""
    GUEST = "guest"
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class Corpus(str, Enum):
    """ChromaDB collection namespaces — matches indexed corpora."""
    GST = "gst"
    RBI = "rbi"
    SEBI = "sebi"
    MCA = "mca"
    FEMA = "fema"
    USER_DOCS = "user_docs"


class AnswerMode(str, Enum):
    """Plain vs Legal toggle — matches LLM prompt rules."""
    PLAIN = "plain"
    LEGAL = "legal"


# ─────────────────────────────────────────────────────────────
#  User Model
# ─────────────────────────────────────────────────────────────

class User(BaseModel):
    """
    Authenticated user — populated from Supabase JWT claims
    by the auth middleware (Day 20).
    """
    user_id: str = Field(..., description="Supabase auth user UUID")
    email: Optional[str] = None
    name: Optional[str] = None
    role: UserRole = UserRole.GUEST
    business_profile: Optional[dict] = Field(
        default=None,
        description="JSONB business profile: type, turnover, state, sector, activities",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "email": "sahil@example.com",
                "name": "Sahil Karande",
                "role": "free",
                "business_profile": {
                    "type": "private_limited",
                    "turnover": "50L-1Cr",
                    "state": "Maharashtra",
                    "sector": "IT Services",
                },
            }
        }
    }


# ─────────────────────────────────────────────────────────────
#  Citation Model
# ─────────────────────────────────────────────────────────────

class Citation(BaseModel):
    """
    A single source citation attached to an LLM-generated answer.
    Populated from ChromaDB chunk metadata.
    """
    corpus: Corpus
    circular_no: str = "unknown"
    date: str = "unknown"
    title: str = ""
    filename: str = ""
    url: str = ""
    chunk_id: str = ""
    similarity: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score")
    preview: str = Field("", description="First ~200 chars of the source chunk")

    model_config = {
        "json_schema_extra": {
            "example": {
                "corpus": "gst",
                "circular_no": "CT-01/2017",
                "date": "2017",
                "title": "Threshold limit of aggregate turnover for registration",
                "filename": "01062019-GST-An-Update.pdf",
                "url": "https://cbic-gst.gov.in/pdf/01062019-GST-An-Update.pdf",
                "chunk_id": "gst_01062019-GST-An-Update_0012",
                "similarity": 0.701,
                "preview": "Threshold limit of aggregate turnover for registration shall be...",
            }
        }
    }


# ─────────────────────────────────────────────────────────────
#  Query Request / Response
# ─────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    """
    Incoming payload for POST /query
    """
    query: str = Field(..., min_length=3, max_length=1000,
                        description="User's compliance question in natural language")
    mode: AnswerMode = Field(default=AnswerMode.PLAIN,
                              description="Plain (simple English) or Legal (formal, cited)")
    corpus: Optional[Corpus] = Field(
        default=None,
        description="Force a specific corpus; if None, classifier auto-routes",
    )
    thread_id: Optional[str] = Field(
        default=None,
        description="Existing chat thread UUID; if None, a new thread is created",
    )
    top_k: int = Field(default=5, ge=1, le=20,
                        description="Number of chunks to retrieve before reranking")

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "What is the GST registration threshold for turnover?",
                "mode": "plain",
                "corpus": None,
                "thread_id": None,
                "top_k": 5,
            }
        }
    }



class QueryResponse(BaseModel):
    answer: str
    response: str  # 💡 ADD THIS LINE HERE
    citations: List[Dict[str, Any]]
    mode: str
    corpus_used: str
    thread_id: str
    confidence: str
    response_time_ms: int
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "answer": (
                    "Under GST, businesses with an aggregate turnover exceeding "
                    "₹40 lakh (₹20 lakh for special category states) must register "
                    "for GST. For service providers, the threshold is ₹20 lakh "
                    "(₹10 lakh for special category states)."
                ),
                "citations": [
                    {
                        "corpus": "gst",
                        "circular_no": "CT-01/2017",
                        "date": "2017",
                        "title": "Threshold limit of aggregate turnover for registration",
                        "filename": "01062019-GST-An-Update.pdf",
                        "url": "https://cbic-gst.gov.in/pdf/01062019-GST-An-Update.pdf",
                        "chunk_id": "gst_01062019-GST-An-Update_0012",
                        "similarity": 0.701,
                        "preview": "Threshold limit of aggregate turnover for registration shall be...",
                    }
                ],
                "mode": "plain",
                "corpus_used": "gst",
                "thread_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                "confidence": "high",
                "response_time_ms": 1240,
                "created_at": "2026-06-14T10:30:00Z",
            }
        }
    }


# ─────────────────────────────────────────────────────────────
#  Usage / Limit Models (used by Day 21 query limit enforcement)
# ─────────────────────────────────────────────────────────────

class QueryUsage(BaseModel):
    """Tracks daily query count per user — matches query_usage table."""
    user_id: str
    date: str   # YYYY-MM-DD
    count: int = 0

    @property
    def limit_for_role(self) -> dict[UserRole, int]:
        return {
            UserRole.GUEST: 3,
            UserRole.FREE: 20,
            UserRole.PRO: -1,          # -1 = unlimited
            UserRole.ENTERPRISE: -1,
        }

    def remaining(self, role: UserRole) -> int:
        limit = self.limit_for_role.get(role, 3)
        if limit == -1:
            return -1  # unlimited
        return max(0, limit - self.count)

    def has_quota(self, role: UserRole) -> bool:
        limit = self.limit_for_role.get(role, 3)
        if limit == -1:
            return True
        return self.count < limit