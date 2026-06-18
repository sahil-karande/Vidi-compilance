"""
Vidi — backend/app/models/alert.py
Day 16 Task: Alert Pydantic Models

Matches Supabase schema (wired in Week 4):
    alerts (id, user_id, topic, corpus, last_triggered, is_active)
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.user import Corpus


class Alert(BaseModel):
    """Regulation change alert subscription — Supabase alerts table."""
    id:               Optional[str]  = None
    user_id:          str
    topic:            str            # e.g. "GST e-invoicing", "RBI digital lending"
    corpus:           str            # gst / rbi / sebi / mca / fema
    is_active:        bool           = True
    last_triggered:   Optional[datetime] = None
    created_at:       datetime       = Field(default_factory=datetime.utcnow)


class AlertCreate(BaseModel):
    """Payload to subscribe to a new alert topic."""
    topic:   str
    corpus:  str


class AlertUpdate(BaseModel):
    """Toggle alert on/off."""
    is_active: bool


# Pre-defined alert topics users can subscribe to
ALERT_TOPICS: dict[str, list[str]] = {
    "gst":  ["GST e-invoicing", "GST rate changes", "GSTR filing deadlines",
              "GST composition scheme", "GST council decisions"],
    "rbi":  ["RBI monetary policy", "RBI digital lending", "RBI KYC norms",
              "RBI NBFC regulations", "RBI UPI guidelines"],
    "sebi": ["SEBI listing norms", "SEBI mutual fund regulations",
              "SEBI insider trading", "SEBI IPO guidelines"],
    "mca":  ["Companies Act amendments", "MCA annual filing", "LLP regulations"],
    "fema": ["FEMA remittance rules", "FEMA FDI policy", "FEMA ECB guidelines"],
}