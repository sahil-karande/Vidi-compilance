"""
🏛️ Vidi — backend/app/models/scorecard.py
Phase 2: Pydantic Validation Schemas for Dashboard Matrix Tuning
Enforces strict string rules ("Yes" / "No") to perfectly match your frontend parameter forms.
"""

from pydantic import BaseModel, Field
from typing import List, Optional

class ScorecardPayload(BaseModel):
    business_type: str = Field(
        ..., 
        description="Constitution format: e.g., 'Proprietorship', 'Partnership / LLP', 'Private Limited', 'Public Limited'"
    )
    industry: str = Field(
        ..., 
        description="SME Operational domain category matching active tracking rules"
    )
    turnover_range: str = Field(
        ..., 
        description="Annual structural revenue turnover bracket: e.g., 'Under ₹20 Lakhs', '₹1Cr - ₹5Cr'"
    )
    has_foreign_funding: str = Field(
        ..., 
        description="String binary matching cross-border inflow: strictly 'Yes' or 'No'"
    )
    gst_registered: str = Field(
        ..., 
        description="Active GSTIN registration lookup status: strictly 'Yes' or 'No'"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "business_type": "Private Limited",
                "industry": "Fintech",
                "turnover_range": "₹1Cr - ₹5Cr",
                "has_foreign_funding": "No",
                "gst_registered": "Yes"
            }
        }


class ComplianceCheckItem(BaseModel):
    name: str = Field(..., description="Short metric identifier description label")
    description: str = Field(..., description="Deep grounded structural clause context detailing operational steps")
    passed: bool = Field(..., description="Boolean assertion status reflecting compliance outcome")


class AxisScoreDetail(BaseModel):
    percentage: int = Field(..., ge=0, le=100, description="Calculated health rating metric integer scale")
    status: str = Field(..., description="Threshold categorization indicator color tracking text: GREEN, AMBER, RED")
    checks: List[ComplianceCheckItem] = Field(default=[], description="Nested verification checks executed within this branch")


class ScorecardResponse(BaseModel):
    overall_status: str = Field(..., description="Global workspace stance evaluation summary rating label")
    scores: dict = Field(..., description="Nested mappings dictionary linking to specific regulatory axes")