"""
RegIQ — test_alerts_checkpoint.py
Day 47 Checkpoint: Auto-seeding subscriber fallback + manual verification script
for pipeline diff alerts, database trigger logs, and email transmission via Resend.
"""

import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

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
        
        target_alert = None
        if res.data:
            target_alert = res.data[0]
            print(f"✅ Found active subscriber! User: {target_alert['user_id']} | Corpus: {target_alert['corpus']} | Topic: {target_alert['topic']}")
        else:
            print("⚠️ No active alert found. Automatically seeding a test subscription...")
            
            # Find a real registered user profile from Supabase
            user_res = supabase.table("profiles").select("user_id").limit(1).execute()
            
            if not user_res.data:
                print("❌ No profiles found in 'profiles' table. Creating seed subscription with default UUID...")
                test_user_id = "00000000-0000-0000-0000-000000000000"
            else:
                test_user_id = user_res.data[0]["user_id"]

            # Insert an active GST subscription row
            seed_data = {
                "user_id": test_user_id,
                "corpus": "gst",
                "topic": "GST rate changes",
                "is_active": True,
                "created_at": datetime.utcnow().isoformat()
            }
            insert_res = supabase.table("alerts").insert(seed_data).execute()
            if insert_res.data:
                target_alert = insert_res.data[0]
                print(f"✅ Successfully seeded active alert for User ID: {test_user_id}!")
            else:
                print("❌ Failed to seed alert row into database.")
                return

        user_id = target_alert["user_id"]
        corpus = target_alert["corpus"]
        topic = target_alert["topic"]

    except Exception as e:
        print(f"❌ Supabase lookup/seeding failure: {e}")
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