import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel
import razorpay

# Configure logging
logger = logging.getLogger("regiq.billing")

router = APIRouter(prefix="/billing", tags=["Billing"])

# Initialize Razorpay Client
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mockkeyid")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "mocksecret")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "mockwebhooksecret")

try:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except Exception as e:
    logger.error(f"Failed to initialize Razorpay client: {e}")
    razorpay_client = None

# Hardcoded Plan ID mappings (Replace these with actual Plan IDs from Razorpay Dashboard)
PLAN_ID_MAP = {
    "monthly": os.getenv("RAZORPAY_PLAN_MONTHLY", "plan_monthly_id"),
    "quarterly": os.getenv("RAZORPAY_PLAN_QUARTERLY", "plan_quarterly_id"),
    "yearly": os.getenv("RAZORPAY_PLAN_YEARLY", "plan_yearly_id"),
}

class SubscriptionRequest(BaseModel):
    plan: str  # "monthly", "quarterly", "yearly"

# Simulated Dependency for Auth (Replace with your actual JWT/Supabase auth dependency)
async def get_current_user(request: Request) -> Dict[str, Any]:
    # This should extract the user details from your JWT token middleware
    # e.g., request.state.user
    if hasattr(request.state, "user"):
        return request.state.user
    # Fallback for structural integration testing
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required"
    )

@router.post("/create-subscription")
async def create_subscription(
    payload: SubscriptionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Creates a Razorpay Subscription for the authenticated user based on chosen plan cycle.
    """
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay integration not configured.")

    plan_lower = payload.plan.lower()
    if plan_lower not in PLAN_ID_MAP:
        raise HTTPException(status_code=400, detail="Invalid billing cycle plan selected.")

    plan_id = PLAN_ID_MAP[plan_lower]
    user_id = current_user.get("id")
    user_email = current_user.get("email")

    try:
        # 1. Create Razorpay Subscription instance
        subscription_data = {
            "plan_id": plan_id,
            "total_count": 12 if plan_lower == "monthly" else (4 if plan_lower == "quarterly" else 1),
            "quantity": 1,
            "customer_notify": 1,
            "notes": {
                "user_id": user_id,
                "email": user_email,
                "plan_type": plan_lower
            }
        }
        
        razorpay_sub = razorpay_client.subscription.create(data=subscription_data)
        
        # 2. Return credentials to frontend to load Razorpay Checkout script wizard
        return {
            "subscription_id": razorpay_sub["id"],
            "razorpay_key_id": RAZORPAY_KEY_ID,
            "plan": plan_lower,
            "status": razorpay_sub.get("status", "created")
        }

    except Exception as e:
        logger.error(f"Error creating Razorpay subscription for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Razorpay Order Error: {str(e)}")


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None)
):
    """
    Asynchronous Razorpay Webhook listener to capture critical system subscription lifecycle states.
    Fulfills profile authorization tiers dynamically inside Supabase.
    """
    if not x_razorpay_signature:
        logger.warning("Webhook received without Razorpay signature header.")
        raise HTTPException(status_code=400, detail="Missing signature header.")

    # Read raw body binary structure for HMAC verification validation
    raw_body = await request.body()
    
    # 1. Verify Webhook Signature Authenticity
    try:
        if razorpay_client:
            razorpay_client.utility.verify_webhook_signature(
                raw_body.decode("utf-8"),
                x_razorpay_signature,
                RAZORPAY_WEBHOOK_SECRET
            )
    except Exception as sig_err:
        logger.error(f"Signature authentication validation mismatch failed: {sig_err}")
        raise HTTPException(status_code=400, detail="Invalid signature verification.")

    # 2. Extract Event Core Matrix Context
    try:
        event_json = json.loads(raw_body.decode("utf-8"))
        event_name = event_json.get("event")
        entity = event_json.get("payload", {}).get("subscription", {}).get("entity", {})
        
        if not entity:
            return {"status": "ignored", "message": "No functional subscription payload entities structure found."}

        sub_id = entity.get("id")
        notes = entity.get("notes", {})
        user_id = notes.get("user_id")
        plan_type = notes.get("plan_type", "pro") # Standard subscription tier maps to pro role

        if not user_id:
            logger.warning(f"Webhook event {event_name} processed with missing user_id context inside custom notes metadata.")
            return {"status": "ignored", "detail": "User reference missing context data points."}

        # Determine structural timelines
        starts_at = datetime.fromtimestamp(entity.get("start_at")) if entity.get("start_at") else datetime.utcnow()
        expires_at = datetime.fromtimestamp(entity.get("charge_at")) if entity.get("charge_at") else (starts_at + timedelta(days=31))

        # Handle Target Subscription Event Scenarios
        if event_name in ["subscription.authenticated", "subscription.activated", "subscription.charged"]:
            logger.info(f"Payment update confirmation success for subscription {sub_id}, upgrading user context profiles {user_id}")
            
            # --- DATABASE UPDATE SECTION ---
            # TODO: Integrate your Supabase Client / Database Engine Layer Here to save states:
            # 1. Update `subscriptions` table mapping status to 'active', 'starts_at', 'expires_at'.
            # 2. Update `profiles` table shifting matching user_id role field enum value -> 'pro'.
            
            return {"status": "success", "event": event_name, "action": "tier_upgraded"}

        elif event_name in ["subscription.cancelled", "subscription.halted"]:
            logger.info(f"Subscription disruption/cancellation flag caught for {sub_id}. Reverting profile tier configurations for user {user_id}")
            
            # --- DATABASE UPDATE SECTION ---
            # TODO: Integrate your Supabase Client / Database Engine Layer Here to save states:
            # 1. Update `subscriptions` status to 'cancelled' / 'expired'.
            # 2. Downgrade `profiles` corresponding user record role enum column back -> 'free'.
            
            return {"status": "success", "event": event_name, "action": "tier_downgraded"}

        else:
            logger.debug(f"Unhandled explicit Razorpay event received: {event_name}")
            return {"status": "ignored", "message": f"Event hook structure {event_name} execution bypassed."}

    except Exception as parsing_exception:
        logger.critical(f"Critical systems fault process event tracking hook execution error: {parsing_exception}")
        raise HTTPException(status_code=500, detail="Internal parsing system integration exception processing task payload updates.")