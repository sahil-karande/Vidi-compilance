from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import os
import json
import google.generativeai as genai  # pyright: ignore[reportMissingImports]
from app.api.auth import get_current_user  # Established JWT middleware

router = APIRouter(prefix="/api/scorecard", tags=["Scorecard"])

# Ensure Gemini API is loaded properly
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- Pydantic Request Model Aligned Perfectly with Frontend Keys ---
class BusinessProfile(BaseModel):
    business_type: str = Field(..., description="Proprietorship, Partnership / LLP, Private Limited, Public Limited")
    industry: str = Field(..., description="Fintech, E-Commerce Retail, Logistics & Supply, SaaS / Tech Services, Manufacturing")
    turnover_range: str = Field(..., description="Under ₹20 Lakhs, ₹20 Lakhs - ₹1 Cr, ₹1Cr - ₹5Cr, Above ₹5 Cr")
    has_foreign_funding: str = Field(..., description="Yes, No")
    gst_registered: str = Field(..., description="Yes, No")

# --- Pydantic Structured Response Models Matching Frontend Structure ---
class AuditCheckItem(BaseModel):
    title: str
    desc: str
    passed: bool

class CategoryScore(BaseModel):
    percentage: int = Field(..., ge=0, le=100, description="Compliance Percentage from 0 to 100")
    status: str = Field(..., description="GREEN, AMBER, or RED")
    checks: List[AuditCheckItem]

class ScorecardResponse(BaseModel):
    overall_health: str
    scores: Dict[str, CategoryScore]


# --- Aligned Deterministic Rule Engine Core Function ---
def execute_deterministic_rule_engine(profile: BusinessProfile) -> Dict[str, Any]:
    """
    Executes structural framework logic based on statutory Indian regulations
    mapping the frontend form variables onto strict compliance metrics.
    """
    # 1. GST Framework Rule Sets
    gst_checks = []
    gst_percentage = 100

    if profile.gst_registered == "No":
        if profile.turnover_range in ["₹1Cr - ₹5Cr", "Above ₹5 Cr"]:
            gst_checks.append(AuditCheckItem(
                title="Mandatory GSTIN Registration Lapse",
                desc="Turnover falls into high tax brackets. Operating without active GSTIN triggers continuous penalty liabilities.",
                passed=False
            ))
            gst_percentage -= 60
        else:
            gst_checks.append(AuditCheckItem(
                title="GST Registration Voluntary Status",
                desc="Turnover falls within standard exemption margins. Continuous monitoring advised.",
                passed=True
            ))
            gst_percentage = 95
    else:
        gst_checks.append(AuditCheckItem(
            title="Active GSTIN Registration Network",
            desc="Entity registered under CBIC ledger nodes. Monthly GSTR filing active track assumed.",
            passed=True
        ))

    # 2. RBI & FEMA Framework Rule Sets
    rbi_checks = []
    rbi_percentage = 100

    if profile.has_foreign_funding == "Yes":
        rbi_checks.append(AuditCheckItem(
            title="FEMA Structural Capital Inflow Tracker",
            desc="Cross-border VC/FDI detected. Requires mandatory Foreign Liabilities & Assets (FLA) filing returns.",
            passed=True
        ))
        if profile.business_type in ["Proprietorship", "Partnership / LLP"]:
            rbi_checks.append(AuditCheckItem(
                title="FDI Compliance Restrictions",
                desc="Unincorporated businesses face structural limits regarding venture funding. Risk of compliance flags.",
                passed=False
            ))
            rbi_percentage -= 40
    else:
        rbi_checks.append(AuditCheckItem(
            title="RBI Currency Exemption Window",
            desc="No outward/inward capital allocations declared. Subject to basic corporate account maintenance rules.",
            passed=True
        ))

    # 3. SEBI Framework Rule Sets
    sebi_checks = []
    sebi_percentage = 100

    if profile.business_type == "Public Limited":
        sebi_checks.append(AuditCheckItem(
            title="SEBI LODR Statutory Disclosures",
            desc="Public infrastructure tracking active. Continuous quarterly board reports mandatory.",
            passed=False
        ))
        sebi_percentage = 55
    else:
        sebi_checks.append(AuditCheckItem(
            title="SEBI Listing Exemption Margin",
            desc="Entity is closely held or private. Shielded from continuous public disclosures.",
            passed=True
        ))

    # 4. MCA Framework Rule Sets
    mca_checks = []
    mca_percentage = 100

    if profile.business_type in ["Private Limited", "Public Limited"]:
        mca_checks.append(AuditCheckItem(
            title="MCA Incorporation Compliance Tracking",
            desc="Statutory forms (AOC-4 Financials, MGT-7 Annual Returns) must be submitted cleanly to ROC.",
            passed=True
        ))
    else:
        mca_checks.append(AuditCheckItem(
            title="ROC Company Act Exemption",
            desc="Unincorporated structures skip rigorous registry filing workflows.",
            passed=True
        ))

    return {
        "gst": {"base_score": max(gst_percentage, 0), "checks": gst_checks},
        "rbi": {"base_score": max(rbi_percentage, 0), "checks": rbi_checks},
        "sebi": {"base_score": max(sebi_percentage, 0), "checks": sebi_checks},
        "mca": {"base_score": max(mca_percentage, 0), "checks": mca_checks}
    }


def analyze_with_llm_fallback(profile: BusinessProfile, rule_results: Dict[str, Any]) -> ScorecardResponse:
    """
    Blends the calculated parameters matrix with a Gemini flash validation pass
    to return perfectly balanced, front-end friendly labels.
    """
    def assign_label(pct: int) -> str:
        return "GREEN" if pct >= 80 else "AMBER" if pct >= 50 else "RED"

    g_p = rule_results["gst"]["base_score"]
    r_p = rule_results["rbi"]["base_score"]
    s_p = rule_results["sebi"]["base_score"]
    m_p = rule_results["mca"]["base_score"]

    avg_score = (g_p + r_p + s_p + m_p) / 4
    health_msg = f"{int(avg_score)}% - Balanced Posture Rating" if avg_score >= 75 else f"{int(avg_score)}% - Remediation Priorities Recommended"

    # Fast fallback logic used primarily to protect runtime speed performance boundaries
    fallback_response = ScorecardResponse(
        overall_health=health_msg,
        scores={
            "gst": CategoryScore(percentage=g_p, status=assign_label(g_p), checks=rule_results["gst"]["checks"]),
            "rbi": CategoryScore(percentage=r_p, status=assign_label(r_p), checks=rule_results["rbi"]["checks"]),
            "sebi": CategoryScore(percentage=s_p, status=assign_label(s_p), checks=rule_results["sebi"]["checks"]),
            "mca": CategoryScore(percentage=m_p, status=assign_label(m_p), checks=rule_results["mca"]["checks"]),
        }
    )

    if not GEMINI_API_KEY:
        return fallback_response

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        You are RegIQ's real-time risk framework engine. Based on the calculated rule markers, evaluate the final summary.
        Parameters: Type={profile.business_type}, Sector={profile.industry}, Range={profile.turnover_range}.
        Computed Scores: GST={g_p}, RBI={r_p}, SEBI={s_p}, MCA={m_p}.
        
        Generate a summary string for corporate compliance health status (e.g., '82% - Stable Active Posture').
        Respond ONLY with a valid string matching that format. Do not use JSON formatting or code backticks.
        """
        response = model.generate_content(prompt)
        text_res = response.text.strip()
        if "%" in text_res:
            fallback_response.overall_health = text_res
        return fallback_response
    except Exception as e:
        print(f"LLM tuning step skipped: {e}")
        return fallback_response


# --- GET Router Method to clear 404 Dashboard Hydration Drops ---
@router.get("", response_model=ScorecardResponse)
async def get_initial_scorecard(current_user: dict = Depends(get_current_user)):
    """
    GET /api/scorecard: Handles dashboard page hydration beautifully on boot-up.
    """
    default_profile = BusinessProfile(
        business_type="Private Limited",
        industry="Fintech",
        turnover_range="₹1Cr - ₹5Cr",
        has_foreign_funding="No",
        gst_registered="Yes"
    )
    rule_results = execute_deterministic_rule_engine(default_profile)
    return analyze_with_llm_fallback(default_profile, rule_results)


# --- POST Router Method to recalculate live form adjustments ---
@router.post("", response_model=ScorecardResponse)
async def generate_compliance_scorecard(
    profile: BusinessProfile, 
    current_user: dict = Depends(get_current_user)
):
    """
    POST /api/scorecard: Computes new compliance indicators dynamically from form configurations.
    """
    try:
        rule_results = execute_deterministic_rule_engine(profile)
        final_scorecard = analyze_with_llm_fallback(profile, rule_results)
        return final_scorecard
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate scorecard indicators tracking parameters: {str(e)}"
        )