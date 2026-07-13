import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel
import razorpay
from loguru import logger
from dotenv import load_dotenv

# Import real system models and dependency
from app.api.auth import get_current_user
from app.models.user import User

# Pull config parameters from local .env files
load_dotenv()

router = APIRouter(prefix="/billing", tags=["Billing"])

# Initialize Razorpay Client keys securely
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "mockwebhooksecret")

# Setup the live client instance
try:
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        logger.info("[billing] Razorpay client linked successfully using dashboard environment variables.")
    else:
        razorpay_client = None
except Exception as e:
    logger.error(f"Failed to initialize Razorpay client: {e}")
    razorpay_client = None

class SubscriptionRequest(BaseModel):
    plan: str

@router.post("/create-subscription")
async def create_subscription(
    payload: SubscriptionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Creates a live Razorpay order mapping transaction items down to the checkout module.
    """
    if current_user.user_id == "anonymous-guest":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="You must be logged in with a registered account to purchase a subscription plan."
        )

    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay integration configuration is missing.")

    plan_lower = payload.plan.lower()
    
    # Pricing configuration map in Paisa (1 INR = 100 Paisa)
    amount_map = {
        "monthly": 49900,     # ₹499
        "quarterly": 134700,  # ₹1347
        "yearly": 448800      # ₹4488
    }

    if plan_lower not in amount_map:
        raise HTTPException(status_code=400, detail="Invalid billing cycle plan selected.")

    user_id = current_user.user_id
    user_email = current_user.email

    try:
        # Create an official transaction order mapping tracking parameters
        order_data = {
            "amount": amount_map[plan_lower],
            "currency": "INR",
            "receipt": f"rcpt_{user_id[:10]}_{int(datetime.utcnow().timestamp())}",
            "notes": {
                "user_id": user_id,
                "email": user_email,
                "plan_type": plan_lower
            }
        }
        
        razorpay_order = razorpay_client.order.create(data=order_data)
        
        return {
            "subscription_id": razorpay_order["id"],  # Maps cleanly into checkout options
            "razorpay_key_id": RAZORPAY_KEY_ID,
            "plan": plan_lower,
            "status": razorpay_order.get("status", "created")
        }

    except Exception as live_auth_error:
        logger.error(f"[billing] Live Razorpay transaction creation failed: {live_auth_error}")
        raise HTTPException(status_code=500, detail=f"Razorpay Gateway Error: {str(live_auth_error)}")


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None)
):
    """
    Webhook handler to process incoming checkout notifications.
    """
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing signature header.")

    raw_body = await request.body()
    
    try:
        if razorpay_client:
            razorpay_client.utility.verify_webhook_signature(
                raw_body.decode("utf-8"),
                x_razorpay_signature,
                RAZORPAY_WEBHOOK_SECRET
            )
    except Exception as sig_err:
        logger.error(f"Signature mismatch: {sig_err}")
        raise HTTPException(status_code=400, detail="Invalid signature verification.")

    try:
        event_json = json.loads(raw_body.decode("utf-8"))
        event_name = event_json.get("event")
        
        # Accommodate both order and subscription webhook payload payloads
        entity = event_json.get("payload", {}).get("order", {}).get("entity", {}) or \
                 event_json.get("payload", {}).get("payment", {}).get("entity", {})
        
        if not entity:
            return {"status": "ignored"}

        notes = entity.get("notes", {})
        user_id = notes.get("user_id")

        if not user_id:
            return {"status": "ignored"}

        if event_name in ["order.paid", "payment.captured"]:
            logger.info(f"Payment success for user {user_id}")
            # --- TODO: Update Supabase table mapping user role -> 'pro' here ---
            return {"status": "success", "action": "tier_upgraded"}
            
        return {"status": "ignored"}

    except Exception as parsing_exception:
        logger.error(f"Webhook tracking execution error: {parsing_exception}")
        raise HTTPException(status_code=500, detail="Error processing payload updates.")