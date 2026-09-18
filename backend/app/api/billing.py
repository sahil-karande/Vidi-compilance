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
        "monthly": 49900,         # ₹499
        "quarterly": 134700,      # ₹1347
        "yearly": 448800,         # ₹4488
        "notice_pass": 9900,      # ₹99 (One-time Deep Notice Analyzer)
        "student_monthly": 19900  # ₹199 (CA Article / Law Student Pass)
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
            "order_id": razorpay_order["id"],
            "subscription_id": razorpay_order["id"],  # Maps cleanly into checkout options
            "razorpay_key_id": RAZORPAY_KEY_ID,
            "plan": plan_lower,
            "amount": amount_map[plan_lower],
            "currency": "INR",
            "status": razorpay_order.get("status", "created")
        }

    except Exception as live_auth_error:
        logger.error(f"[billing] Live Razorpay transaction creation failed: {live_auth_error}")
        raise HTTPException(status_code=500, detail=f"Razorpay Gateway Error: {str(live_auth_error)}")


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: Optional[str] = "pro"


@router.post("/verify-payment")
async def verify_payment(
    payload: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Verifies Razorpay payment signature directly upon frontend checkout completion
    and immediately upgrades the user's role to 'pro' in Supabase without delay.
    """
    if current_user.user_id == "anonymous-guest":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to verify payment and activate subscription."
        )

    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay gateway integration is not configured.")

    try:
        # Cryptographically verify the payment signature using Razorpay HMAC-SHA256
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature
        })
        logger.info(f"[billing] Payment signature verified successfully for order: {payload.razorpay_order_id}")
    except Exception as sig_err:
        logger.error(f"[billing] Payment signature verification failed: {sig_err}")
        raise HTTPException(status_code=400, detail="Invalid payment signature. Verification failed.")

    # Mutate user role in Supabase profiles and invalidate auth cache
    try:
        from app.api.auth import get_supabase_admin, _user_cache
        supabase = get_supabase_admin()
        user_id = current_user.user_id
        
        target_role = "pro"
        db_response = supabase.table("profiles").update({"role": target_role}).eq("user_id", user_id).execute()
        
        # Invalidate in-memory user cache so subsequent queries immediately recognise Pro tier
        _user_cache.pop(user_id, None)
        
        logger.info(f"[billing] Upgraded user {user_id} to {target_role} after verified payment {payload.razorpay_payment_id}")
        return {
            "status": "success",
            "message": "Payment verified and account upgraded to Pro!",
            "role": target_role,
            "order_id": payload.razorpay_order_id,
            "payment_id": payload.razorpay_payment_id,
            "plan": payload.plan
        }
    except Exception as db_err:
        logger.error(f"[billing] Failed to update profile role in Supabase: {db_err}")
        raise HTTPException(status_code=500, detail="Database update error while activating subscription.")


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
            logger.info(f"Payment success intercepted for user {user_id}")
            
            try:
                # Dynamically fetch the admin client instance
                from app.api.auth import get_supabase_admin, _user_cache
                supabase = get_supabase_admin()
                
                # Mutate the user role property inside the profiles context table
                db_response = supabase.table("profiles").update({"role": "pro"}).eq("user_id", user_id).execute()
                
                # Invalidate in-memory cache
                _user_cache.pop(user_id, None)
                
                logger.info(f"Database role upgraded successfully for user {user_id}: {db_response.data}")
                return {"status": "success", "action": "tier_upgraded"}
                
            except Exception as db_err:
                logger.error(f"Failed to execute database profile update: {db_err}")
                raise HTTPException(status_code=500, detail="Database profile mutation error.")

    except Exception as parsing_exception:
        logger.error(f"Webhook tracking execution error: {parsing_exception}")
        raise HTTPException(status_code=500, detail="Error processing payload updates.")