from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from typing import Dict, Any, List
from datetime import datetime

router = APIRouter(prefix="/calendar", tags=["Calendar"])

@router.get("")
async def get_compliance_calendar(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Generates a timeline calendar array containing key Indian corporate compliance
    deadlines, customized against the authenticated user's profile metadata.
    """
    profile = current_user.get("business_profile") or {}
    entity_type = profile.get("entity_type", "Pvt Ltd")
    has_gstin = profile.get("has_gstin", False)
    sector = profile.get("industry_sector", "Services")

    current_year = datetime.now().year
    
    # Baseline static & dynamic Indian compliance deadlines matrix
    deadlines = []

    # --- GST Deadlines ---
    if has_gstin:
        deadlines.extend([
            {
                "id": "gst_gstr1",
                "title": "GSTR-1 Outward Supplies Statement",
                "authority": "GST",
                "due_date": f"{current_year}-07-11",
                "priority": "HIGH",
                "description": "Monthly filing mandatory for itemizing summary of outward supply transactions."
            },
            {
                "id": "gst_gstr3b",
                "title": "GSTR-3B Summary Return & Tax Payment",
                "authority": "GST",
                "due_date": f"{current_year}-07-20",
                "priority": "CRITICAL",
                "description": "Self-assessment return summarizing sales, claiming ITC, and discharging liabilities."
            }
        ])

    # --- MCA Deadlines ---
    if entity_type in ["Pvt Ltd", "LLP"]:
        deadlines.extend([
            {
                "id": "mca_dir3_kyc",
                "title": "Director KYC Verification (Form DIR-3 KYC)",
                "authority": "MCA",
                "due_date": f"{current_year}-09-30",
                "priority": "HIGH",
                "description": "Annual web or form verification for all active DIN holders to avoid deactivation."
            },
            {
                "id": "mca_aoc4",
                "title": "Filing Financial Statements (Form AOC-4)",
                "authority": "MCA",
                "due_date": f"{current_year}-10-29",
                "priority": "CRITICAL",
                "description": f"Due within 30 days of the AGM for registered {entity_type} corporations."
            }
        ])

    # --- Income Tax / Corporate Tax Deadlines ---
    deadlines.extend([
        {
            "id": "it_adv_tax_q1",
            "title": "First Installment of Advance Tax",
            "authority": "Income Tax",
            "due_date": f"{current_year}-06-15",
            "priority": "MEDIUM",
            "description": "15% of estimated net corporate tax liability due for the financial year cycle."
        },
        {
            "id": "it_itr_corp",
            "title": "Corporate Income Tax Return (ITR-6)",
            "authority": "Income Tax",
            "due_date": f"{current_year}-10-31",
            "priority": "CRITICAL",
            "description": "Applicable for companies other than companies claiming exemption under section 11."
        }
    ])

    # --- RBI/FEMA Specific parameters ---
    if sector in ["Import-Export", "FinTech"]:
        deadlines.append({
            "id": "rbi_fla",
            "title": "Annual Return on Foreign Liabilities and Assets (FLA Return)",
            "authority": "RBI",
            "due_date": f"{current_year}-07-15",
            "priority": "HIGH",
            "description": "Mandatory filing for companies that have received FDI or made ODI transactions."
        })

    # Sort deadlines sequentially by proximity
    deadlines.sort(key=lambda x: x["due_date"])

    return deadlines