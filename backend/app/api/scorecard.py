"""
🏛️ RegIQ — backend/app/api/scorecard.py
Phase 2: Operational Scorecard Router Engine
Handles rule orchestration, model parsing validations, and Groq LLM tuning fallback layers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
import os
import httpx
from loguru import logger

# Import explicit structural schemas from the centralized models layer
from app.models.scorecard import ScorecardPayload, ScorecardResponse, AxisScoreDetail, ComplianceCheckItem
from app.models.user import User
from app.api.auth import get_current_user  # Authenticated identity injection layer

router = APIRouter(prefix="/scorecard", tags=["Scorecard"])

# Load Groq API configurations cleanly from environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")


def execute_deterministic_rule_engine(profile: ScorecardPayload) -> Dict[str, Any]:
    """
    Executes structural framework logic based on statutory Indian regulations
    mapping the frontend form variables onto strict compliance metrics.
    """
    # 1. GST Framework Rule Sets
    gst_checks = []
    gst_percentage = 100

    if profile.gst_registered == "No":
        if profile.turnover_range in ["₹1Cr - ₹5Cr", "Above ₹5 Cr", "Above ₹5cr"]:
            gst_checks.append(ComplianceCheckItem(
                name="Mandatory GSTIN Registration Lapse",
                description="Turnover falls into taxable brackets. Operating without active GSTIN triggers penalty liabilities under the CGST Act.",
                passed=False
            ))
            gst_percentage -= 60
        else:
            gst_checks.append(ComplianceCheckItem(
                name="GST Registration Voluntary Status",
                description="Turnover falls within standard exemption margins. Continuous monitoring advised.",
                passed=True
            ))
            gst_percentage = 95
    else:
        gst_checks.append(ComplianceCheckItem(
            name="Active GSTIN Registration Network",
            description="Entity registered under CBIC ledger nodes. Monthly GSTR filing active track assumed.",
            passed=True
        ))

    # 2. RBI & FEMA Framework Rule Sets
    rbi_checks = []
    rbi_percentage = 100

    if profile.has_foreign_funding == "Yes":
        rbi_checks.append(ComplianceCheckItem(
            name="FEMA Structural Capital Inflow Tracker",
            description="Cross-border VC/FDI detected. Requires mandatory Foreign Liabilities & Assets (FLA) filing returns.",
            passed=True
        ))
        if profile.business_type in ["Proprietorship", "Partnership", "LLP"]:
            rbi_checks.append(ComplianceCheckItem(
                name="FDI Compliance Restrictions",
                description="Unincorporated businesses face structural limits regarding venture funding. Risk of regulatory flags.",
                passed=False
            ))
            rbi_percentage -= 40
    else:
        rbi_checks.append(ComplianceCheckItem(
            name="RBI Currency Exemption Window",
            description="No outward/inward foreign capital allocations declared. Subject to basic corporate account maintenance rules.",
            passed=True
        ))

    # 3. SEBI Framework Rule Sets
    sebi_checks = []
    sebi_percentage = 100

    if profile.business_type == "Public Limited":
        sebi_checks.append(ComplianceCheckItem(
            name="SEBI LODR Statutory Disclosures",
            description="Public infrastructure tracking active. Continuous quarterly board reports mandatory.",
            passed=False
        ))
        sebi_percentage = 55
    else:
        sebi_checks.append(ComplianceCheckItem(
            name="SEBI Listing Exemption Margin",
            description="Entity is closely held or private. Shielded from continuous public asset disclosures.",
            passed=True
        ))

    # 4. MCA Framework Rule Sets
    mca_checks = []
    mca_percentage = 100

    if profile.business_type in ["Private Limited", "Public Limited"]:
        mca_checks.append(ComplianceCheckItem(
            name="MCA Incorporation Compliance Tracking",
            description="Statutory forms (AOC-4 Financials, MGT-7 Annual Returns) must be submitted cleanly to the Registrar of Companies (ROC).",
            passed=True
        ))
    else:
        mca_checks.append(ComplianceCheckItem(
            name="ROC Company Act Exemption",
            description="Unincorporated structures skip rigorous registry filing workflows.",
            passed=True
        ))

    return {
        "gst": {"base_score": max(gst_percentage, 0), "checks": gst_checks},
        "rbi": {"base_score": max(rbi_percentage, 0), "checks": rbi_checks},
        "sebi": {"base_score": max(sebi_percentage, 0), "checks": sebi_checks},
        "mca": {"base_score": max(mca_percentage, 0), "checks": mca_checks}
    }


def analyze_with_llm_fallback(profile: ScorecardPayload, rule_results: Dict[str, Any]) -> ScorecardResponse:
    """
    Blends the calculated parameters matrix with a Groq inference call
    to return perfectly balanced, frontend-friendly labels.
    """
    def assign_label(pct: int) -> str:
        return "GREEN" if pct >= 80 else "AMBER" if pct >= 50 else "RED"

    g_p = rule_results["gst"]["base_score"]
    r_p = rule_results["rbi"]["base_score"]
    s_p = rule_results["sebi"]["base_score"]
    m_p = rule_results["mca"]["base_score"]

    avg_score = (g_p + r_p + s_p + m_p) / 4
    health_msg = f"{int(avg_score)}% - Balanced Posture Rating" if avg_score >= 75 else f"{int(avg_score)}% - Remediation Priorities Recommended"

    # Construct clean response using standardized schemas
    fallback_response = ScorecardResponse(
        overall_status=health_msg,
        scores={
            "gst": AxisScoreDetail(percentage=g_p, status=assign_label(g_p), checks=rule_results["gst"]["checks"]),
            "rbi": AxisScoreDetail(percentage=r_p, status=assign_label(r_p), checks=rule_results["rbi"]["checks"]),
            "sebi": AxisScoreDetail(percentage=s_p, status=assign_label(s_p), checks=rule_results["sebi"]["checks"]),
            "mca": AxisScoreDetail(percentage=m_p, status=assign_label(m_p), checks=rule_results["mca"]["checks"]),
        }
    )

    if not GROQ_API_KEY:
        logger.warning("[scorecard] Groq API key missing. Returning structural rule base matrix directly.")
        return fallback_response

    try:
        # Utilize httpx synchronously to target Groq's chat completions endpoint endpoint
        with httpx.Client() as client:
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            body = {
                "model": "llama3-8b-8192",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are the operational posture engine for RegIQ. Respond ONLY with a single clean string. Do not output code blocks, JSON formatting, or explanations."
                    },
                    {
                        "role": "user",
                        "content": f"Evaluate context parameters: Type={profile.business_type}, Sector={profile.industry}, Turnover={profile.turnover_range}. Current calculated compliance matrices list scores as: GST={g_p}, RBI={r_p}, SEBI={s_p}, MCA={m_p}. Generate a dynamic description string matching exactly this summary format: '82% - Stable Active Posture'."
                    }
                ],
                "temperature": 0.2,
                "max_tokens": 30
            }
            
            response = client.post("https://api.groq.com/openai/v1/chat/completions", json=body, headers=headers, timeout=5.0)
            
            if response.status_code == 200:
                res_data = response.json()
                text_res = res_data["choices"][0]["message"]["content"].strip().replace('"', '')
                if "%" in text_res:
                    fallback_response.overall_status = text_res
                    logger.info(f"[scorecard] Groq telemetry calibrated status to: {text_res}")
            else:
                logger.error(f"[scorecard] Groq API error response: {response.text}")

        return fallback_response
    except Exception as e:
        logger.error(f"[scorecard] Groq inference fallback pass encountered an issue: {e}")
        return fallback_response


# --- GET Router Method to handle initial Dashboard Page hydration ---
@router.get("", response_model=ScorecardResponse)
async def get_initial_scorecard(current_user: User = Depends(get_current_user)):
    """
    GET /api/scorecard: Pre-hydrates dashboard layouts automatically with baseline corporate parameters profiles on mount.
    """
    # Use real user details if onboarded business profile exists, fallback to standard matrix if empty
    default_profile = ScorecardPayload(
        business_type=current_user.business_profile.get("business_type", "Private Limited") if current_user.business_profile else "Private Limited",
        industry=current_user.business_profile.get("industry", "Fintech") if current_user.business_profile else "Fintech",
        turnover_range=current_user.business_profile.get("turnover_range", "₹1Cr - ₹5Cr") if current_user.business_profile else "₹1Cr - ₹5Cr",
        has_foreign_funding=current_user.business_profile.get("has_foreign_funding", "No") if current_user.business_profile else "No",
        gst_registered=current_user.business_profile.get("gst_registered", "Yes") if current_user.business_profile else "Yes"
    )
    rule_results = execute_deterministic_rule_engine(default_profile)
    return analyze_with_llm_fallback(default_profile, rule_results)


# --- POST Router Method to recalculate indicators based on form inputs ---
@router.post("", response_model=ScorecardResponse)
async def generate_compliance_scorecard(
    profile: ScorecardPayload, 
    current_user: User = Depends(get_current_user)
):
    """
    POST /api/scorecard: Recalculates statutory compliance health indices dynamically from form parameters.
    """
    try:
        rule_results = execute_deterministic_rule_engine(profile)
        final_scorecard = analyze_with_llm_fallback(profile, rule_results)
        return final_scorecard
    except Exception as e:
        logger.error(f"[scorecard] Operational routing breakdown on index evaluation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate scorecard indicators tracking parameters."
        )