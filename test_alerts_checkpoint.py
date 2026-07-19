"""
RegIQ — test_alerts_checkpoint.py
Day 47 Checkpoint: Manual verification script for pipeline diff alerts,
database trigger logs, and email transmission via Resend.
"""

import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # Bypasses RLS to simulate cron execution

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Error: Missing Supabase credentials in environment variables.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async def test_checkpoint():
    print("🚀 Starting Day 47 Alerts Checkpoint Validation...")

    # 1. Fetch an active alert subscription to mimic
    print("\n🔍 Step 1: Checking for an active subscriber in 'alerts' table...")
    try:
        res = supabase.table("alerts").select("*").eq("is_active", True).limit(1).execute()
        if not res.data:
            print("❌ No active alert subscriptions found. Please create an alert in your Settings page first!")
            return
        
        target_alert = res.data[0]
        user_id = target_alert["user_id"]
        corpus = target_alert["corpus"]
        topic = target_alert["topic"]
        print(f"✅ Found active subscriber target! User: {user_id} | Corpus: {corpus} | Topic: {topic}")
    except Exception as e:
        print(f"❌ Supabase lookup failure: {e}")
        return

    # 2. Simulate diff_detector catching a change
    print(f"\n⚡ Step 2: Simulating cron discovery of a new {corpus.upper()} circular...")
    fake_change = {
        "corpus": corpus,
        "reference": f"⚡ TEST Circular No. {datetime.now().strftime('%M/%Y')}",
        "summary": f"This is a manual checkpoint verification test for RegIQ Day 47. Verified match for topic: {topic}."
    }

    # 3. Import the processing logic from your cron script to handle database write + Resend dispatch
    print("\n📬 Step 3: Triggering pipeline notification processor...")
    try:
        from pipeline.cron import process_notifications
        
        # Pass the fake change through your real notification processing pipeline
        await process_notifications([fake_change])
        print("✅ Notification pipeline executed successfully.")
    except Exception as pipeline_err:
        print(f"❌ Notification processing failed: {pipeline_err}")
        return

    # 4. Verify database state mutation
    print("\n📊 Step 4: Verifying database 'last_triggered' state update...")
    try:
        verify_res = supabase.table("alerts").select("last_triggered").eq("id", target_alert["id"]).execute()
        updated_ts = verify_res.data[0]["last_triggered"]
        if updated_ts:
            print(f"✅ State verified in Supabase! 'last_triggered' updated to: {updated_ts}")
            print("🎉 Check your email inbox and frontend dashboard—the live badge should be pulsing!")
        else:
            print("❌ Verification failed: 'last_triggered' remains null.")
    except Exception as e:
        print(f"❌ Verification lookup failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_checkpoint())