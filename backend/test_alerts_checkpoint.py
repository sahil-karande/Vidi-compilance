"""
RegIQ — test_alerts_checkpoint.py
Day 47 Checkpoint: Standalone manual verification script for pipeline diff alerts,
database trigger logs, and email transmission via Resend.
"""

import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
import httpx

# ─────────────────────────────────────────────────────────────
#  DYNAMIC ROOT PATH INJECTION
# ─────────────────────────────────────────────────────────────
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
# ─────────────────────────────────────────────────────────────

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Error: Missing Supabase credentials in environment variables.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


async def send_resend_email(to_email: str, corpus: str, reference: str, summary: str):
    """Dispatches a test notification email via Resend API."""
    if not RESEND_API_KEY:
        print("⚠️ RESEND_API_KEY not found in environment. Skipping email dispatch (DB update will still run).")
        return False

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": "RegIQ Alerts <onboarding@resend.dev>",
        "to": [to_email],
        "subject": f"🚨 Urgent: {corpus.upper()} Regulation Update — {reference}",
        "html": f"""
        <div style="font-family: sans-serif; padding: 20px; color: #0f172a;">
            <h2>⚡ RegIQ Compliance Diff Alert</h2>
            <p><strong>Corpus Target:</strong> {corpus.upper()}</p>
            <p><strong>Circular Reference:</strong> {reference}</p>
            <p><strong>Summary:</strong> {summary}</p>
            <hr />
            <p style="font-size: 12px; color: #64748b;">This is a test notification generated for Day 47 Checkpoint Verification.</p>
        </div>
        """
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=payload)
        if res.status_code in [200, 201]:
            print(f"📧 Resend Email delivered successfully to: {to_email}")
            return True
        else:
            print(f"⚠️ Resend Email dispatch returned status {res.status_code}: {res.text}")
            return False


async def test_checkpoint():
    print("🚀 Starting Day 47 Alerts Checkpoint Validation...")

    # 1. Fetch an active alert subscription
    print("\n🔍 Step 1: Checking for an active subscriber in 'alerts' table...")
    try:
        res = supabase.table("alerts").select("*").eq("is_active", True).limit(1).execute()
        
        if not res.data:
            print("❌ No active alert subscriptions found.")
            return

        target_alert = res.data[0]
        user_id = target_alert["user_id"]
        corpus = target_alert["corpus"]
        topic = target_alert["topic"]
        print(f"✅ Found active subscriber! User ID: {user_id} | Corpus: {corpus} | Topic: {topic}")

        # Retrieve user email profile
        user_email = None
        profile_res = supabase.table("profiles").select("email").eq("user_id", user_id).execute()
        if profile_res.data and profile_res.data[0].get("email"):
            user_email = "sahilkarande6@gmail.com"
            print(f"👤 Target email set to Resend verified owner: {user_email}")
        else:
            # Fallback check on auth.users if profiles table email is empty
            user_email = "sahil.test@ghrcem.edu"
            print(f"ℹ️ Defaulting target test email address: {user_email}")

    except Exception as e:
        print(f"❌ Supabase lookup failure: {e}")
        return

    # 2. Simulate circular diff match
    reference_id = f"⚡ TEST Circular No. {datetime.now().strftime('%M/%Y')}"
    summary_text = f"Manual checkpoint verification test for RegIQ Day 47. Matching topic: '{topic}'."
    print(f"\n⚡ Step 2: Simulating cron diff match for {corpus.upper()} ({reference_id})...")

    # 3. Dispatch Email Notification
    print("\n📬 Step 3: Triggering Resend email delivery pipeline...")
    await send_resend_email(user_email, corpus, reference_id, summary_text)

    # 4. Mutate and verify database state
    print("\n📊 Step 4: Updating database 'last_triggered' state in Supabase...")
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        update_res = supabase.table("alerts").update({"last_triggered": now_iso}).eq("id", target_alert["id"]).execute()
        
        if update_res.data:
            print(f"✅ State updated in Supabase! 'last_triggered' timestamp is now: {now_iso}")
            print("\n🎉 Day 47 Checkpoint Trigger Complete! Check your inbox and React Dashboard.")
        else:
            print("❌ Database update returned no modified records.")

    except Exception as e:
        print(f"❌ Verification update failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_checkpoint())