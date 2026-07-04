"""
🏛️ Vidi — backend/app/api/calendar.py
Phase 2: Operational Compliance Calendar Timeline Router
Outputs profile-specific corporate legal deadlines formatted as standardized ISO telemetry arrays.
"""

from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from typing import Any, List
from datetime import datetime

router = APIRouter(prefix="/calendar", tags=["Calendar"])

@router.get("", response_model=List[dict])
async def get_compliance_calendar(current_user: Any = Depends(get_current_user)):
    """
    Generates a localized corporate filing timeline array containing key Indian corporate 
    compliance deadlines, matched dynamically to the user's business metadata configuration.
    """
    # Safeguard attribute extraction pipeline across complex user models
    profile = getattr(current_user, "business_profile", {}) or {}
    
    if not isinstance(profile, dict):
        profile = getattr(profile, "__dict__", {})

    # Extract configuration variables with precise fallback defaults matching typical SME footprints
    # Translates internal db profile values safely onto rule variables
    entity_type = profile.get("entity_type", "Pvt Ltd") or "Private Limited"
    has_gstin = profile.get("has_gstin", True)  # Default True to match dashboard pre-hydration assumptions
    sector = profile.get("industry_sector", "Fintech")

    current_year = datetime.now().year
    deadlines = []

    # --- GST Authority Deadlines ---
    if has_gstin or "GST" in str(profile):
        deadlines.extend([
            {
                "id": "gst_gstr1",
                "authority": "GST",
                "form": "GSTR-1",
                "title": "GSTR-1 Outward Supplies Statement",
                "notes": "Mandatory declaration of monthly outward supplies for businesses with regular registration profiles.",
                "description": "Mandatory declaration of monthly outward supplies for businesses with regular registration profiles.",
                "due_date": f"{current_year}-07-11T23:59:59Z",
                "priority": "HIGH"
            },
            {
                "id": "gst_gstr3b",
                "authority": "GST",
                "form": "GSTR-3B",
                "title": "GSTR-3B Summary Return & Tax Payment",
                "notes": "Monthly summary returns mapping inward tax credits directly against payment execution paths.",
                "description": "Monthly summary returns mapping inward tax credits directly against payment execution paths.",
                "due_date": f"{current_year}-07-20T23:59:59Z",
                "priority": "CRITICAL"
            }
        ])

    # --- MCA Authority Deadlines ---
    if any(term in str(entity_type).collate() if hasattr(str(entity_type), 'collate') else str(entity_type) for term in ["Pvt Ltd", "Private Limited", "LLP", "Partnership / LLP"]):
        deadlines.extend([
            {
                "id": "mca_dir3_kyc",
                "authority": "MCA",
                "form": "DIR-3 KYC",
                "title": "Director KYC Verification",
                "notes": "Annual verification workflow for all active registered DIN holders to avoid summary status deactivation.",
                "description": "Annual verification workflow for all active registered DIN holders to avoid summary status deactivation.",
                "due_date": f"{current_year}-09-30T23:59:59Z",
                "priority": "HIGH"
            },
            {
                "id": "mca_aoc4",
                "authority": "MCA",
                "form": "Form 11 (LLP)",
                "title": "Filing Financial Statements (Form AOC-4)",
                "notes": "Annual continuous statutory declaration outlining corporate asset balances and partnership profiling records.",
                "description": "Annual continuous statutory declaration outlining corporate asset balances and partnership profiling records.",
                "due_date": f"{current_year}-07-30T23:59:59Z",
                "priority": "LOW"
            }
        ])

    # --- Income Tax / Corporate Tax Authority Deadlines ---
    deadlines.extend([
        {
            "id": "it_adv_tax_q1",
            "authority": "Income Tax",
            "form": "ITR-6",
            "title": "First Installment of Advance Tax",
            "notes": "15% of estimated net corporate tax liability due for remittance within current accounting loop parameters.",
            "description": "15% of estimated net corporate tax liability due for remittance within current accounting loop parameters.",
            "due_date": f"{current_year}-06-15T23:59:59Z",
            "priority": "MEDIUM"
        }
    ])

    # --- RBI/FEMA Specific Framework Parameters ---
    if sector in ["Import-Export", "Fintech", "FinTech", "SaaS / Tech Services"]:
        deadlines.append({
            "id": "rbi_fla",
            "authority": "RBI",
            "form": "FLA Return",
            "title": "Annual Return on Foreign Liabilities and Assets",
            "notes": "Annual Return on Foreign Assets and Liabilities matching cross-border venture structures.",
            "description": "Annual Return on Foreign Assets and Liabilities matching cross-border venture structures.",
            "due_date": f"{current_year}-07-15T23:59:59Z",
            "priority": "HIGH"
        })

    # Sort array sequentially by date strings proximity parameters
    deadlines.sort(key=lambda x: x["due_date"])

    return deadlines