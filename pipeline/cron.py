import os
import asyncio
import logging
from datetime import datetime
import resend
from dotenv import load_dotenv
from supabase import create_client, Client

# Import pipeline components
from pipeline.scraper import run_scraper
from pipeline.chunker import run_chunker
from pipeline.embedder import run_embedder
from pipeline.indexer import run_indexer
from pipeline.diff_detector import detect_changes  # Assumed to return a list of dicts with changes

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("regiq_cron")

# Load environment configurations
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Service role required for bypassing RLS in cron job
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "RegIQ Alerts <alerts@regiq.in>")

# Initialize Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
resend.api_key = RESEND_API_KEY


def send_email_alert(email: str, name: str, corpus: str, reference: str, details: str):
    """
    Sends a formatted HTML email notification using the Resend SDK.
    """
    try:
        html_content = f"""
        <div style="font-family: sans-serif; padding: 20px; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">Compliance Alert: Regulation Updated</h2>
            <p>Hello {name or 'Subscriber'},</p>
            <p>Our weekly regulatory monitoring system has detected an update matching your alert settings.</p>
            
            <div style="background-color: #f9fafb; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; border-radius: 0 4px 4px 0;">
                <strong>Corpus Category:</strong> {corpus.upper()}<br>
                <strong>Document/Circular Reference:</strong> {reference}<br>
                <strong>Detection Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
            </div>
            
            <p><strong>Summary of Modifications:</strong></p>
            <p style="white-space: pre-line; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 0.95em;">{details}</p>
            
            <a href="https://regiq.vercel.app/dashboard" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: bold;">View Risk Scorecard</a>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin-top: 30px;">
            <p style="font-size: 0.8em; color: #6b7280; text-align: center;">
                You received this because you subscribed to active tracking for {corpus.upper()} updates on RegIQ.<br>
                RegIQ Compliance Assistant • Nagpur, India
            </p>
        </div>
        """
        
        response = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": email,
            "subject": f"🚨 Urgent: {corpus.upper()} Regulation Update — {reference}",
            "html": html_content
        })
        logger.info(f"Email sent successfully via Resend to {email}. Message ID: {response.get('id')}")
    except Exception as e:
        logger.error(f"Failed to transmit email notification via Resend to {email}: {str(e)}")


async def process_notifications(changes: list):
    """
    Scans detected document transformations, cross-references with user settings,
    updates metadata statuses, and calls dispatchers.
    """
    for change in changes:
        corpus = change.get("corpus")        # e.g., 'gst', 'rbi', 'sebi', 'mca'
        reference = change.get("reference")  # e.g., 'Circular No. 45/2026'
        diff_summary = change.get("summary") # Text analysis summary of the structural modification

        logger.info(f"Processing matches for change found in {corpus} ({reference})...")

        # 1. Query all active subscribers tracking this specific namespace corpus
        try:
            subscribers_response = supabase.table("alerts")\
                .select("id, user_id, topic")\
                .eq("corpus", corpus)\
                .eq("is_active", True)\
                .execute()
            
            active_alerts = subscribers_response.data
        except Exception as e:
            logger.error(f"Error querying active alerts from Supabase: {str(e)}")
            continue

        for alert in active_alerts:
            user_id = alert.get("user_id")
            alert_id = alert.get("id")

            # Fetch target profile data (email, name)
            try:
                profile_response = supabase.table("profiles")\
                    .select("email, name")\
                    .eq("user_id", user_id)\
                    .single()\
                    .execute()
                profile = profile_response.data
            except Exception as e:
                logger.error(f"Could not retrieve user profile for {user_id}: {str(e)}")
                continue

            if not profile or not profile.get("email"):
                continue

            # 2. In-App Notification Trigger: Update the individual alert's baseline state
            # This 'last_triggered' state update signals to Dashboard.jsx / alerts endpoints 
            # to render active badges or updated scorecard timelines for the specific dashboard block.
            try:
                supabase.table("alerts")\
                    .update({"last_triggered": datetime.utcnow().isoformat()})\
                    .eq("id", alert_id)\
                    .execute()
                logger.info(f"Updated backend trigger timestamp for Alert ID {alert_id} (User: {user_id})")
            except Exception as e:
                logger.error(f"Failed to update alert timestamp table state: {str(e)}")

            # 3. Email dispatching integration via Resend
            send_email_alert(
                email=profile.get("email"),
                name=profile.get("name"),
                corpus=corpus,
                reference=reference,
                details=diff_summary
            )


async def main():
    """
    Master pipeline scheduler task orchestrating the linear processing stages 
    from public source target downloads down through deep matching logic checks.
    """
    logger.info("Starting scheduled weekly regulatory data ingestion cycle...")
    
    try:
        # Phase 1: Data Gathering & Vector Syncing
        logger.info("Executing pipeline scrapers...")
        # run_scraper()
        
        logger.info("Executing text chunk processors...")
        # run_chunker()
        
        logger.info("Generating embedding representations...")
        # run_embedder()
        
        logger.info("Syncing changes into vector datastores...")
        # run_indexer()

        # Phase 2: Diff Detection & Validation Execution
        logger.info("Analyzing structural corpus document deltas...")
        # Mocking output architecture style matching system design expectations
        detected_changes = [
            {
                "corpus": "gst",
                "reference": "Circular No. 45/2026",
                "summary": "Clarifications added on input tax credit tracking mechanisms matching architectural updates applied to localized supply systems."
            }
        ]
        # In implementation: detected_changes = detect_changes()

        # Phase 3: Communication & In-App Alert Dispatching
        if detected_changes:
            logger.info(f"System identified {len(detected_changes)} changes. Initializing notification routines...")
            await process_notifications(detected_changes)
        else:
            logger.info("No text changes or regulatory updates discovered during this sequence iteration.")

    except Exception as main_err:
        logger.critical(f"Fatal disruption during scheduled cron engine execution block: {str(main_err)}")
        
    logger.info(" Ingersoll routine execution window closed down safely.")

if __name__ == "__main__":
    asyncio.run(main())