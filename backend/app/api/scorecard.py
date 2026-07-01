from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import os
import json
import google.generativeai as genai # pyright: ignore[reportMissingImports]
from app.api.auth import get_current_user  # Your established JWT middleware

router = APIRouter(prefix="/api/scorecard", tags=["Scorecard"])

# Ensure Gemini API is loaded properly
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- Pydantic Request Models ---
class BusinessProfile(BaseModel):
    industry_type: str = Field(..., description="e.g., Manufacturing, FinTech, IT Services, Retail")
    annual_turnover_inr: float = Field(..., description="Annual turnover in Indian Rupees")
    is_import_export: bool = Field(default=False, description="Whether company engages in cross-border trade")
    has_listed_securities: bool = Field(default=False, description="True if public/listed under SEBI parameters")
    missing_filings: List[str] = Field(
        default_for=[], 
        description="List of known missed tasks like GSTR-1, AOC-4, MGT-7, KYC"
    )

# --- Pydantic Structured Response Models ---
class AuditCheckItem(BaseModel):
    title: str
    desc: str
    passed: bool

class CategoryScore(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Risk Score from 0 (Safe) to 100 (Critical)")
    label: str = Field(..., description="RED, AMBER, or GREEN")
    checks: List[AuditCheckItem]

class ScorecardResponse(BaseModel):
    overall_status: str
    gst: CategoryScore
    rbi: CategoryScore
    sebi: CategoryScore
    mca: CategoryScore


# --- Rule Engine Core Functions ---
def execute_deterministic_rule_engine(profile: BusinessProfile) -> Dict[str, Any]:
    """
    Executes a deterministic framework logic based on statutory Indian regulations
    to compute baseline parameters, thresholds, and flag missing compliance items.
    """
    # 1. GST Framework Rule Sets
    gst_passed_items = []
    gst_score = 0
    
    # Registration requirement threshold rules
    threshold = 4000000 if profile.industry_type.lower() == "manufacturing" else 2000000
    if profile.annual_turnover_inr >= threshold:
        gst_passed_items.append(AuditCheckItem(
            title="GST Registration Threshold",
            desc=f"Turnover exceeds registration boundary (₹{threshold//100000}L). Registration active.",
            passed=True
        ))
    else:
        gst_passed_items.append(AuditCheckItem(
            title="GST Voluntary Threshold Check",
            desc="Turnover falls below standard mandatory registration boundaries.",
            passed=True
        ))
        
    if "GSTR-1" in [x.upper() for x in profile.missing_filings] or "GSTR-3B" in [x.upper() for x in profile.missing_filings]:
        gst_passed_items.append(AuditCheckItem(
            title="Periodic Returns Filing",
            desc="Missing active periodic returns (GSTR-1/3B). Triggers immediate high interest and penalty metrics.",
            passed=False
        ))
        gst_score += 45
    else:
        gst_passed_items.append(AuditCheckItem(
            title="Periodic Returns Filing",
            desc="No outstanding defaults flagged on active monthly/quarterly tracks.",
            passed=True
        ))

    # 2. RBI & FEMA Framework Rule Sets
    rbi_passed_items = []
    rbi_score = 0
    if profile.is_import_export:
        rbi_passed_items.append(AuditCheckItem(
            title="FEMA EEFC Compliance",
            desc="Cross-border operations active. Requires operational realization compliance within 9 months.",
            passed=True
        ))
        if "RBI-KYC" in [x.upper() for x in profile.missing_filings] or "FEMA-FLA" in [x.upper() for x in profile.missing_filings]:
            rbi_passed_items.append(AuditCheckItem(
                title="Foreign Liabilities and Assets (FLA)",
                desc="Missed annual mandatory FLA financial return reporting window or Master Direction KYC mandates.",
                passed=False
            ))
            rbi_score += 50
        else:
            rbi_passed_items.append(AuditCheckItem(
                title="RBI Compliance Master Track",
                desc="Basic international settlement reporting checks passed cleanly.",
                passed=True
            ))
    else:
        rbi_passed_items.append(AuditCheckItem(
            title="FEMA Statutory Applicability",
            desc="No active foreign currency inflows or cross-border liabilities declared.",
            passed=True
        ))

    # 3. SEBI Framework Rule Sets
    sebi_passed_items = []
    sebi_score = 0
    if profile.has_listed_securities:
        if "LODR-COMPLIANCE" in [x.upper() for x in profile.missing_filings] or "SEBI-INSIDER" in [x.upper() for x in profile.missing_filings]:
            sebi_passed_items.append(AuditCheckItem(
                title="SEBI LODR Regulation 30/55",
                desc="Critical governance lapse: missed submission of quarterly disclosures or structural report components.",
                passed=False
            ))
            sebi_score += 65
        else:
            sebi_passed_items.append(AuditCheckItem(
                title="SEBI Listing Disclosures",
                desc="Governance frameworks comply with standard dynamic market tracking metrics.",
                passed=True
            ))
    else:
        sebi_passed_items.append(AuditCheckItem(
            title="SEBI Public Listing Applicability",
            desc="Entity is categorized as a closely-held private organization or partnership structure.",
            passed=True
        ))

    # 4. MCA & Companies Act Framework Rule Sets
    mca_passed_items = []
    mca_score = 0
    
    # Check statutory company filing omissions
    mca_misses = [x.upper() for x in profile.missing_filings if x.upper() in ["AOC-4", "MGT-7", "DIR-3-KYC"]]
    if mca_misses:
        mca_passed_items.append(AuditCheckItem(
            title="Annual Return Form Filings",
            desc=f"Lapse detected in mandatory corporate compliance returns: {', '.join(mca_misses)}. Triggers dynamic daily per-form penalties.",
            passed=False
        ))
        mca_score += (25 * len(mca_misses))
    else:
        mca_passed_items.append(AuditCheckItem(
            title="MCA Corporate Integrity Maintenance",
            desc="Annual financial statements (AOC-4) and Director registries align with current registries.",
            passed=True
        ))

    return {
        "gst": {"base_score": min(gst_score, 100), "checks": gst_passed_items},
        "rbi": {"base_score": min(rbi_score, 100), "checks": rbi_passed_items},
        "sebi": {"base_score": min(sebi_score, 100), "checks": sebi_passed_items},
        "mca": {"base_score": min(mca_score, 100), "checks": mca_passed_items}
    }


def analyze_with_llm_fallback(profile: BusinessProfile, rule_results: Dict[str, Any]) -> ScorecardResponse:
    """
    Blends the hard rule metrics with a fast Gemini reasoning execution pass 
    to dynamically adjust weight distribution, append granular risk explanations, 
    and guarantee production-grade JSON format structures.
    """
    if not GEMINI_API_KEY:
        # Graceful fallback schema generation if API key is unassigned
        def assign_label(s: int) -> str:
            return "RED" if s >= 60 else "AMBER" if s >= 20 else "GREEN"
            
        g_s = rule_results["gst"]["base_score"]
        r_s = rule_results["rbi"]["base_score"]
        s_s = rule_results["sebi"]["base_score"]
        m_s = rule_results["mca"]["base_score"]
        
        avg_score = (g_s + r_s + s_s + m_s) / 4
        status_msg = "CRITICAL ACTION REQUIRED" if avg_score >= 50 else "STABLE OPERATION"
        
        return ScorecardResponse(
            overall_status=status_msg,
            gst=CategoryScore(score=g_s, label=assign_label(g_s), checks=rule_results["gst"]["checks"]),
            rbi=CategoryScore(score=r_s, label=assign_label(r_s), checks=rule_results["rbi"]["checks"]),
            sebi=CategoryScore(score=s_s, label=assign_label(s_s), checks=rule_results["sebi"]["checks"]),
            mca=CategoryScore(score=m_s, label=assign_label(m_s), checks=rule_results["mca"]["checks"])
        )

    # Initialize dynamic system template block
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
    You are RegIQ's compliance system scoring router engine.
    Analyze the corporate profile input constraints and deterministic baseline score indicators to calculate accurate Indian financial regulation risk vectors (0 to 100).
    
    Input Business Parameters:
    - Industry Segment: {profile.industry_type}
    - Annual Turnover (INR): {profile.annual_turnover_inr}
    - Import/Export Activity status: {profile.is_import_export}
    - Listed Security under SEBI status: {profile.has_listed_securities}
    - Reported Outstanding Filings omissions: {profile.missing_filings}
    
    Deterministic Engine Baseline Computed Checks:
    {json.dumps({k: {"base_score": v["base_score"]} for k, v in rule_results.items()})}

    Your core task:
    1. Calibrate risk scores out of 100 per category (GST, RBI, SEBI, MCA) based on compliance metrics. 
       - 0-25: GREEN (Compliant, low exposure)
       - 26-59: AMBER (Moderate risk/remediations pending)
       - 60-100: RED (High structural non-compliance risk or massive penalty exposure)
    2. Respond ONLY with a clean, unquoted, strictly valid JSON matching this identical layout schema. Do not output markdown code blocks.

    JSON Structure Target Example:
    {{
      "overall_status": "CRITICAL RISK PROFILE" or "STABLE FRAMEWORK",
      "gst": {{ "score": 45, "label": "AMBER" }},
      "rbi": {{ "score": 0, "label": "GREEN" }},
      "sebi": {{ "score": 0, "label": "GREEN" }},
      "mca": {{ "score": 75, "label": "RED" }}
    }}
    """

    try:
        response = model.generate_content(prompt)
        text_content = response.text.strip()
        
        # Clean potential markdown output wrappers if present
        if text_content.startswith("```json"):
            text_content = text_content.split("```json")[1].split("```")[0].strip()
        elif text_content.startswith("```"):
            text_content = text_content.split("```")[1].split("```")[0].strip()

        llm_data = json.loads(text_content)
        
        # Merge semantic evaluation labels with original deterministic check arrays
        def build_category(cat_key: str) -> CategoryScore:
            base_checks = rule_results[cat_key]["checks"]
            score_val = llm_data.get(cat_key, {}).get("score", rule_results[cat_key]["base_score"])
            label_val = llm_data.get(cat_key, {}).get("label", "GREEN")
            return CategoryScore(score=int(score_val), label=str(label_val).upper(), checks=base_checks)

        return ScorecardResponse(
            overall_status=llm_data.get("overall_status", "COMPLIANCE REVIEW UNDERWAY"),
            gst=build_category("gst"),
            rbi=build_category("rbi"),
            sebi=build_category("sebi"),
            mca=build_category("mca")
        )
    except Exception as e:
        print(f"Fallback activation. JSON parsing error on dynamic LLM layout generation: {e}")
        # Secondary defensive strategy invocation
        return analyze_with_llm_fallback(profile, rule_results)


@router.post("", response_model=ScorecardResponse, status_code=status.HTTP_200_OK)
async def generate_compliance_scorecard(
    profile: BusinessProfile, 
    current_user: dict = Depends(get_current_user)
):
    """
    POST /api/scorecard: Validates systemic business parameters against active statutory criteria 
    and updates user dashboard posture ratings across key financial networks.
    """
    try:
        # Run baseline calculation step
        rule_results = execute_deterministic_rule_engine(profile)
        
        # Evaluate composition metrics
        final_scorecard = analyze_with_llm_fallback(profile, rule_results)
        return final_scorecard
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate scorecard telemetry processing indicators: {str(e)}"
        )