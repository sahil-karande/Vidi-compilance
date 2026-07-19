"""
RegIQ — backend/app/api/alerts_api.py
Connects `/alerts` endpoints directly to Supabase with strict ownership verification.
Includes frontend in-app notification state handlers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from app.models.alert import Alert, AlertCreate, AlertUpdate, ALERT_TOPICS
from app.models.user import User
from app.api.auth import get_current_user, get_supabase_admin
from loguru import logger

router = APIRouter()

# --- Pydantic Schema for Frontend Badge Operations ---
class AcknowledgeRequest(BaseModel):
    alert_ids: List[str]


@router.get("/alerts", response_model=list[Alert])
def list_alerts(current_user: User = Depends(get_current_user)):
    """
    List all active and inactive alert subscriptions for the authenticated user.
    """
    admin_client = get_supabase_admin()
    try:
        response = admin_client.table("alerts")\
            .select("*")\
            .eq("user_id", current_user.user_id)\
            .order("created_at", desc=True)\
            .execute()
        
        return [Alert(**item) for item in response.data]
    except Exception as e:
        logger.error(f"[alerts] Failed to list alerts for user {current_user.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve your alert subscriptions."
        )


@router.get("/alerts/topics")
def list_topics():
    """
    List all pre-defined alert topics grouped by regulatory corpus (No Auth required).
    """
    return ALERT_TOPICS


@router.get("/alerts/unread", response_model=list[Alert])
def list_unread_alerts(current_user: User = Depends(get_current_user)):
    """
    Exposes active triggered changes that haven't been acknowledged yet.
    Directly feeds into the dynamic layout badge logic on the React frontend.
    """
    admin_client = get_supabase_admin()
    try:
        response = admin_client.table("alerts")\
            .select("*")\
            .eq("user_id", current_user.user_id)\
            .eq("is_active", True)\
            .not_.is_("last_triggered", "null")\
            .execute()
        
        return [Alert(**item) for item in response.data]
    except Exception as e:
        logger.error(f"[alerts] Failed to pull unread triggers for user {current_user.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to query active notification triggers."
        )


@router.post("/alerts/acknowledge")
def acknowledge_alerts(payload: AcknowledgeRequest, current_user: User = Depends(get_current_user)):
    """
    Clears active notice highlights by setting 'last_triggered' back to null.
    This action turns off the active notification pulse animations on the client UI.
    """
    admin_client = get_supabase_admin()
    try:
        # Loop over targets safely validating ownership context implicitly
        for alert_id in payload.alert_ids:
            admin_client.table("alerts")\
                .update({"last_triggered": None})\
                .eq("id", alert_id)\
                .eq("user_id", current_user.user_id)\
                .execute()
                
        return {"status": "success", "message": "Notification badges cleared successfully."}
    except Exception as e:
        logger.error(f"[alerts] Acknowledge transaction routine failed for user {current_user.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred while clearing down dynamic interface notifications."
        )


@router.post("/alerts", response_model=Alert, status_code=status.HTTP_201_CREATED)
def create_alert(payload: AlertCreate, current_user: User = Depends(get_current_user)):
    """
    Subscribe the current user to a regulatory change alert topic.
    Verifies that the requested topic belongs to the designated corpus.
    """
    valid_topics = ALERT_TOPICS.get(payload.corpus.lower())
    if not valid_topics or payload.topic not in valid_topics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic '{payload.topic}' for corpus '{payload.corpus}'."
        )

    admin_client = get_supabase_admin()
    
    insert_data = {
        "user_id": current_user.user_id,
        "topic": payload.topic,
        "corpus": payload.corpus.lower(),
        "is_active": True
    }

    try:
        response = admin_client.table("alerts")\
            .insert(insert_data)\
            .execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Subscription was not saved correctly."
            )
            
        return Alert(**response.data[0])
    except Exception as e:
        logger.error(f"[alerts] Failed to create alert subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred while setting up your alert subscription."
        )


@router.patch("/alerts/{alert_id}", response_model=Alert)
def update_alert(alert_id: str, payload: AlertUpdate, current_user: User = Depends(get_current_user)):
    """
    Toggles an existing alert subscription on/off.
    Verifies that the requested alert record belongs to the current user.
    """
    admin_client = get_supabase_admin()
    
    try:
        check_res = admin_client.table("alerts")\
            .select("user_id")\
            .eq("id", alert_id)\
            .execute()
            
        if not check_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert subscription not found."
            )
            
        record_user_id = check_res.data[0].get("user_id")
        if record_user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not own this alert subscription."
            )
    except HTTPException:
        raise
    except Exception as check_err:
        logger.error(f"[alerts] Error validating alert {alert_id} ownership: {check_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify authorization for updating the alert."
        )

    try:
        update_res = admin_client.table("alerts")\
            .update({"is_active": payload.is_active})\
            .eq("id", alert_id)\
            .execute()
            
        return Alert(**update_res.data[0])
    except Exception as e:
        logger.error(f"[alerts] Failed to update alert {alert_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating alert subscription state."
        )


@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: str, current_user: User = Depends(get_current_user)):
    """
    Permanently deletes a user's alert subscription.
    Verifies ownership before executing the deletion.
    """
    admin_client = get_supabase_admin()
    
    try:
        check_res = admin_client.table("alerts")\
            .select("user_id")\
            .eq("id", alert_id)\
            .execute()
            
        if not check_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert subscription not found."
            )
            
        record_user_id = check_res.data[0].get("user_id")
        if record_user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not own this alert subscription."
            )
    except HTTPException:
        raise
    except Exception as check_err:
        logger.error(f"[alerts] Error validating alert {alert_id} ownership: {check_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify authorization for deleting the alert."
        )

    try:
        admin_client.table("alerts")\
            .delete()\
            .eq("id", alert_id)\
            .execute()
            
        return {"deleted": True, "alert_id": alert_id}
    except Exception as e:
        logger.error(f"[alerts] Failed to delete alert {alert_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error removing subscription."
        )