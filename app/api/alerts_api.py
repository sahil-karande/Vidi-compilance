"""
Vidi — backend/app/api/alerts.py
Day 16 Task: /alerts endpoint stub

Returns empty responses for now.
Wired to Supabase in Week 4 (Day 44).
"""

from fastapi import APIRouter
from app.models.alert import Alert, AlertCreate, AlertUpdate, ALERT_TOPICS

router = APIRouter()


@router.get("/alerts", response_model=list[Alert])
def list_alerts():
    """List all alert subscriptions for the current user. (Stub — wired Day 44)"""
    return []


@router.get("/alerts/topics")
def list_topics():
    """List all available alert topics grouped by corpus."""
    return ALERT_TOPICS


@router.post("/alerts", response_model=Alert)
def create_alert(payload: AlertCreate):
    """Subscribe to a regulation change alert. (Stub — wired Day 44)"""
    return Alert(
        id="stub-alert-id",
        user_id="stub-user-id",
        topic=payload.topic,
        corpus=payload.corpus,
    )


@router.patch("/alerts/{alert_id}", response_model=Alert)
def update_alert(alert_id: str, payload: AlertUpdate):
    """Toggle alert on/off. (Stub — wired Day 44)"""
    return Alert(
        id=alert_id,
        user_id="stub-user-id",
        topic="stub-topic",
        corpus="gst",
        is_active=payload.is_active,
    )


@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: str):
    """Delete an alert subscription. (Stub — wired Day 44)"""
    return {"deleted": True, "alert_id": alert_id}