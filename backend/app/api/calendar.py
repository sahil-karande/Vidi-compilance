"""
🏛️ RegIQ — backend/app/api/calendar.py
Phase 2: Operational Compliance Calendar Timeline Router
Outputs profile-specific corporate legal deadlines formatted as standardized ISO telemetry arrays.
"""

from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from app.models.user import User
from typing import List
from datetime import datetime

router = APIRouter(prefix="/calendar", tags=["Calendar"])

@router.get("", response_model=List[dict])
async def get_compliance_calendar(current_user: User = Depends(get_current_user)):
    """
    Generates a localized corporate filing timeline array containing key Indian corporate 
    compliance deadlines, matched dynamically to the user's business metadata configuration.
    """
    # Safeguard attribute extraction pipeline across complex user models
    profile = current_user.business_profile or {}

    # Translate onboarding form payload naming directly into rule variables
    business_type = profile.get("business_type", "Private Limited")
    gst_registered = profile.get("gst_registered", "Yes")
    industry = profile.get("industry", "Fintech")

    current_year = datetime.now().year
    deadlines = []

    # --- GST Authority Deadlines ---
    if gst_registered == "Yes":
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

    # --- MCA / Registrar of Companies (ROC) Deadlines ---
    if business_type in ["Private Limited", "Public Limited", "LLP"]:
        # Adjust default statutory forms depending on corporate classification
        mca_form = "Form 11 (LLP)" if business_type == "LLP" else "Form AOC-4"
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
                "id": "mca_annual_financials",
                "authority": "MCA",
                "form": mca_form,
                "title": f"Filing Financial Statements ({mca_form})",
                "notes": "Annual continuous statutory declaration outlining corporate asset balances and entity profiling records.",
                "description": "Annual continuous statutory declaration outlining corporate asset balances and entity profiling records.",
                "due_date": f"{current_year}-07-30T23:59:59Z",
                "priority": "LOW"
            }
        ])

    # --- Income Tax Authority Deadlines ---
    deadlines.extend([
        {
            "id": "it_adv_tax_q1",
            "authority": "Income Tax",
            "form": "ITR-6",
            "title": "First Installment of Advance Tax",
            "notes": "15% of estimated net corporate tax liability due for remittance within current accounting parameters.",
            "description": "15% of estimated net corporate tax liability due for remittance within current accounting parameters.",
            "due_date": f"{current_year}-06-15T23:59:59Z",
            "priority": "MEDIUM"
        }
    ])

    # --- RBI/FEMA Specific Framework Parameters ---
    if industry in ["Fintech", "SaaS / Tech Services", "E-commerce"]:
        deadlines.append({
            "id": "rbi_fla",
            "authority": "RBI",
            "form": "FLA Return",
            "title": "Annual Return on Foreign Liabilities and Assets",
            "notes": "Annual Return on Foreign Assets and Liabilities matching cross-border venture capital structures.",
            "description": "Annual Return on Foreign Assets and Liabilities matching cross-border venture capital structures.",
            "due_date": f"{current_year}-07-15T23:59:59Z",
            "priority": "HIGH"
        })

    # Sort array sequentially by date proximity strings
    deadlines.sort(key=lambda x: x["due_date"])

    return deadlines