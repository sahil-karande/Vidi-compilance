"""
🏛️ Vidi — backend/app/api/scorecard.py
Phase 2: Operational Scorecard Router Engine
Handles rule orchestration, model parsing validations, and LLM tuning fallback layers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
import os

# Import your explicit structural schemas from the centralized models layer
from app.models.scorecard import ScorecardPayload, ScorecardResponse, AxisScoreDetail, ComplianceCheckItem
from app.api.auth import get_current_user  # Authenticated identity injection layer

router = APIRouter(prefix="/scorecard", tags=["Scorecard"])

# Ensure Gemini API configurations load cleanly from environmental variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def execute_deterministic_rule_engine(profile: ScorecardPayload) -> Dict[str, Any]:
    """
    Executes structural framework logic based on statutory Indian regulations
    mapping the frontend form variables onto strict compliance metrics.
    """
    # 1. GST Framework Rule Sets
    gst_checks = []
    gst_percentage = 100

    if profile.gst_registered == "No":
        if profile.turnover_range in ["₹1Cr - ₹5Cr", "Above ₹5 Cr"]:
            gst_checks.append(ComplianceCheckItem(
                name="Mandatory GSTIN Registration Lapse",
                description="Turnover falls into high tax brackets. Operating without active GSTIN triggers continuous penalty liabilities under CGST Act.",
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
        if profile.business_type in ["Proprietorship", "Partnership / LLP"]:
            rbi_checks.append(ComplianceCheckItem(
                name="FDI Compliance Restrictions",
                description="Unincorporated businesses face structural limits regarding venture funding. Risk of compliance flags.",
                passed=False
            ))
            rbi_percentage -= 40
    else:
        rbi_checks.append(ComplianceCheckItem(
            name="RBI Currency Exemption Window",
            description="No outward/inward capital allocations declared. Subject to basic corporate account maintenance rules.",
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
            description="Entity is closely held or private. Shielded from continuous public disclosures.",
            passed=True
        ))

    # 4. MCA Framework Rule Sets
    mca_checks = []
    mca_percentage = 100

    if profile.business_type in ["Private Limited", "Public Limited"]:
        mca_checks.append(ComplianceCheckItem(
            name="MCA Incorporation Compliance Tracking",
            description="Statutory forms (AOC-4 Financials, MGT-7 Annual Returns) must be submitted cleanly to ROC.",
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

    # Construct clean internal type configurations using standardized nested schemas
    fallback_response = ScorecardResponse(
        overall_status=health_msg,
        scores={
            "gst": AxisScoreDetail(percentage=g_p, status=assign_label(g_p), checks=rule_results["gst"]["checks"]),
            "rbi": AxisScoreDetail(percentage=r_p, status=assign_label(r_p), checks=rule_results["rbi"]["checks"]),
            "sebi": AxisScoreDetail(percentage=s_p, status=assign_label(s_p), checks=rule_results["sebi"]["checks"]),
            "mca": AxisScoreDetail(percentage=m_p, status=assign_label(m_p), checks=rule_results["mca"]["checks"]),
        }
    )

    if not GEMINI_API_KEY:
        return fallback_response

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        You are the real-time compliance validation matrix engine for Vidi. Evaluate the posture based on data indicators.
        Parameters: Type={profile.business_type}, Sector={profile.industry}, Turnover={profile.turnover_range}.
        Scores: GST={g_p}, RBI={r_p}, SEBI={s_p}, MCA={m_p}.
        
        Generate a localized metrics description summary string for an Indian corporate compliance workspace (e.g., '82% - Stable Active Posture').
        Respond ONLY with a single clean string matching that literal format. Do not output markdown code blocks or json.
        """
        response = model.generate_content(prompt)
        text_res = response.text.strip()
        if "%" in text_res:
            fallback_response.overall_status = text_res
        return fallback_response
    except Exception as e:
        print(f"[Vidi Live Calibration Error]: LLM sync step skipped: {e}")
        return fallback_response


# --- GET Router Method to handle initial Dashboard Page hydration ---
@router.get("", response_model=ScorecardResponse)
async def get_initial_scorecard(current_user: dict = Depends(get_current_user)):
    """
    GET /api/scorecard: Pre-hydrates dashboard layouts automatically with enterprise baseline profiles on mount.
    """
    default_profile = ScorecardPayload(
        business_type="Private Limited",
        industry="Fintech",
        turnover_range="₹1Cr - ₹5Cr",
        has_foreign_funding="No",
        gst_registered="Yes"
    )
    rule_results = execute_deterministic_rule_engine(default_profile)
    return analyze_with_llm_fallback(default_profile, rule_results)


# --- POST Router Method to recalculate indicators based on form inputs ---
@router.post("", response_model=ScorecardResponse)
async def generate_compliance_scorecard(
    profile: ScorecardPayload, 
    current_user: dict = Depends(get_current_user)
):
    """
    POST /api/scorecard: Recalculates statutory compliance health indices dynamically from form parameters.
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