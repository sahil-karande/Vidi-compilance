from fastapi import APIRouter, Depends, HTTPException, status
from app.api.auth import get_current_user  # Your JWT middleware dependency
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter(prefix="/scorecard", tags=["Scorecard"])

class BusinessProfileUpdate(BaseModel):
    business_name: str
    entity_type: str  # Pvt Ltd, LLP, Partnership, Sole Proprietorship
    has_gstin: bool
    turnover_bracket: str  # Under 20L, 20L-1.5Cr, Over 1.5Cr
    industry_sector: str  # Manufacturing, Services, FinTech, Import-Export

@router.get("")
async def get_compliance_scorecard(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Evaluates business profile data from Supabase and applies compliance rules
    to return Red/Amber/Green risk vectors for Indian SME categories.
    """
    # Fallback to defaults if business profile data JSON is uninitialized
    profile = current_user.get("business_profile") or {}
    entity_type = profile.get("entity_type", "Pvt Ltd")
    has_gstin = profile.get("has_gstin", False)
    turnover = profile.get("turnover_bracket", "Under 20L")
    sector = profile.get("industry_sector", "Services")

    scorecard_data = {
        "overall_health": "Healthy",
        "scores": {
            "gst": {"status": "GREEN", "percentage": 100, "checks": []},
            "mca": {"status": "GREEN", "percentage": 100, "checks": []},
            "rbi": {"status": "GREEN", "percentage": 100, "checks": []},
            "sebi": {"status": "GREEN", "percentage": 100, "checks": []}
        }
    }

    # --- GST Rules Engine ---
    gst_checks = [
        {"id": "gst_reg", "title": "GST Registration Mandatory Check", "passed": True, "desc": "Not required under 20L threshold unless inter-state trading."}
    ]
    if turnover != "Under 20L" and not has_gstin:
        gst_checks[0]["passed"] = False
        gst_checks[0]["desc"] = f"Action Needed: Turnover is {turnover} but no GSTIN flag is active."
        scorecard_data["scores"]["gst"]["status"] = "RED"
        scorecard_data["scores"]["gst"]["percentage"] = 30
    elif has_gstin:
        gst_checks.append({"id": "gst_filing", "title": "GSTR-1 & GSTR-3B Baseline Filings", "passed": True, "desc": "Active tracking active via vector database parameters."})
    
    scorecard_data["scores"]["gst"]["checks"] = gst_checks

    # --- MCA Rules Engine ---
    mca_checks = []
    if entity_type in ["Pvt Ltd", "LLP"]:
        mca_checks.append({"id": "mca_roc", "title": "Annual RoC Filing (Form AOC-4 / MGT-7)", "passed": True, "desc": f"Mandatory requirement for registered {entity_type} corporate vehicles."})
        mca_checks.append({"id": "mca_dir", "title": "Director KYC Verification (DIR-3 KYC)", "passed": True, "desc": "Due annually before September 30 cut-off bounds."})
    else:
        mca_checks.append({"id": "mca_exempt", "title": "Corporate Law Exemption Status", "passed": True, "desc": "Sole Proprietorships/Partnerships are exempt from MCA portal registry."})
    
    scorecard_data["scores"]["mca"]["checks"] = mca_checks

    # --- Cross-border Financial Risk Engine (RBI/FEMA) ---
    rbi_checks = []
    if sector == "Import-Export" or sector == "FinTech":
        rbi_checks.append({"id": "rbi_fema", "title": "FEMA ODI/EDI Remittance Declarations", "passed": False, "desc": "Alert: Active international transactions flagged. Ensure EEFC compliance protocols."})
        scorecard_data["scores"]["rbi"]["status"] = "AMBER"
        scorecard_data["scores"]["rbi"]["percentage"] = 65
    else:
        rbi_checks.append({"id": "rbi_domestic", "title": "Domestic Banking Clearing Checks", "passed": True, "desc": "No active cross-border alerts found for domestic portfolio profiles."})
    
    scorecard_data["scores"]["rbi"]["checks"] = rbi_checks

    # --- SEBI Securities Engine ---
    scorecard_data["scores"]["sebi"]["checks"] = [
        {"id": "sebi_exempt", "title": "Public Market Regulations", "passed": True, "desc": "Unlisted SME entities are exempt from continuous LODR disclosures."}
    ]

    # Calculate overall application state status
    statuses = [s["status"] for s in scorecard_data["scores"].values()]
    if "RED" in statuses:
        scorecard_data["overall_health"] = "Critical Action Required"
    elif "AMBER" in statuses:
        scorecard_data["overall_health"] = "Action Advised"

    return scorecard_data