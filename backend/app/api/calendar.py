"""
🏛️ Vidi — backend/app/api/calendar.py
Dynamic Compliance Calendar Timeline Router
Dynamically calculates real-time Indian corporate, tax, GST, MCA, RBI & SEBI statutory deadlines
relative to the current date, month, and year.
"""

from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from app.models.user import User
from typing import List
from datetime import datetime, timedelta
import calendar as py_calendar

router = APIRouter(prefix="/calendar", tags=["Calendar"])

def get_days_in_month(year: int, month: int) -> int:
    return py_calendar.monthrange(year, month)[1]

@router.get("", response_model=List[dict])
async def get_compliance_calendar(current_user: User = Depends(get_current_user)):
    """
    Generates dynamic real-time compliance deadlines for the current month and surrounding months,
    personalized to the user's business metadata (Private Limited, LLP, GST registered, etc.).
    """
    profile = current_user.business_profile or {}
    business_type = profile.get("business_type", "Private Limited")
    gst_registered = profile.get("gst_registered", "Yes")
    industry = profile.get("industry", "Fintech")

    now = datetime.now()
    current_year = now.year
    current_month = now.month

    deadlines = []

    # Calculate month window: 1 month prior, current month, and next 3 months
    months_to_generate = []
    for offset in range(-1, 4):
        target_month = current_month + offset
        target_year = current_year
        while target_month < 1:
            target_month += 12
            target_year -= 1
        while target_month > 12:
            target_month -= 12
            target_year += 1
        months_to_generate.append((target_year, target_month))

    # --- 1. Monthly Recurring Statutory Deadlines ---
    for yr, mo in months_to_generate:
        mo_str = f"{mo:02d}"
        days_in_mo = get_days_in_month(yr, mo)

        # TDS Payment (Challan 281) - 7th of every month
        deadlines.append({
            "id": f"tds_pmt_{yr}_{mo}",
            "authority": "Income Tax",
            "form": "Challan 281",
            "title": f"TDS Payment Deposit ({py_calendar.month_name[mo]} Deductions)",
            "notes": "Remittance of tax deducted at source for contractor, salary, and vendor payouts.",
            "description": "Remittance of tax deducted at source for contractor, salary, and vendor payouts.",
            "due_date": f"{yr}-{mo_str}-07T23:59:59Z",
            "priority": "HIGH"
        })

        # GST Authority Deadlines (Monthly)
        if gst_registered == "Yes":
            # GSTR-1: 11th of every month
            deadlines.append({
                "id": f"gst_gstr1_{yr}_{mo}",
                "authority": "GST",
                "form": "GSTR-1",
                "title": f"GSTR-1 Outward Supplies Statement ({py_calendar.month_name[mo]})",
                "notes": "Mandatory declaration of monthly outward taxable supplies and B2B invoices.",
                "description": "Mandatory declaration of monthly outward taxable supplies and B2B invoices.",
                "due_date": f"{yr}-{mo_str}-11T23:59:59Z",
                "priority": "HIGH"
            })

            # GSTR-3B: 20th of every month
            deadlines.append({
                "id": f"gst_gstr3b_{yr}_{mo}",
                "authority": "GST",
                "form": "GSTR-3B",
                "title": f"GSTR-3B Return & Tax Payment ({py_calendar.month_name[mo]})",
                "notes": "Monthly summary return mapping inward ITC directly against net tax liability remittance.",
                "description": "Monthly summary return mapping inward ITC directly against net tax liability remittance.",
                "due_date": f"{yr}-{mo_str}-20T23:59:59Z",
                "priority": "CRITICAL"
            })

        # PF & ESIC Contribution: 15th of every month
        deadlines.append({
            "id": f"epfo_esic_{yr}_{mo}",
            "authority": "Labour / EPFO",
            "form": "ECR Filing",
            "title": f"EPF & ESIC Monthly Remittance ({py_calendar.month_name[mo]})",
            "notes": "Statutory employee provident fund and insurance electronic challan return.",
            "description": "Statutory employee provident fund and insurance electronic challan return.",
            "due_date": f"{yr}-{mo_str}-15T23:59:59Z",
            "priority": "MEDIUM"
        })

    # --- 2. Quarterly Advance Tax Installments ---
    advance_tax_schedule = [
        ("06-15", "First Installment (15% Advance Tax)", "Q1 corporate advance tax installment"),
        ("09-15", "Second Installment (45% Advance Tax)", "Cumulative 45% of estimated net corporate tax liability"),
        ("12-15", "Third Installment (75% Advance Tax)", "Cumulative 75% advance tax installment"),
        ("03-15", "Final Installment (100% Advance Tax)", "Final advance tax adjustment before fiscal year closing")
    ]
    for date_suffix, title, desc in advance_tax_schedule:
        # Check current year and next year
        for yr in [current_year, current_year + 1]:
            deadlines.append({
                "id": f"it_adv_tax_{yr}_{date_suffix.replace('-', '_')}",
                "authority": "Income Tax",
                "form": "ITR-Advance",
                "title": title,
                "notes": desc,
                "description": desc,
                "due_date": f"{yr}-{date_suffix}T23:59:59Z",
                "priority": "HIGH"
            })

    # --- 3. MCA / ROC Corporate Annual Deadlines ---
    for yr in [current_year, current_year + 1]:
        # Form 11 (LLP Annual Return) due May 30
        if business_type == "LLP":
            deadlines.append({
                "id": f"mca_form11_{yr}",
                "authority": "MCA",
                "form": "Form 11 (LLP)",
                "title": "LLP Annual Return Submission",
                "notes": "Mandatory annual summary filing for LLPs declaring partners and capital contributions.",
                "description": "Mandatory annual summary filing for LLPs declaring partners and capital contributions.",
                "due_date": f"{yr}-05-30T23:59:59Z",
                "priority": "HIGH"
            })

        # Director KYC (DIR-3 KYC) - Due September 30 every year
        deadlines.append({
            "id": f"mca_dir3_kyc_{yr}",
            "authority": "MCA",
            "form": "DIR-3 KYC",
            "title": "Director KYC Annual Verification",
            "notes": "Statutory DIN KYC verification for all company directors to prevent deactivation.",
            "description": "Statutory DIN KYC verification for all company directors to prevent deactivation.",
            "due_date": f"{yr}-09-30T23:59:59Z",
            "priority": "CRITICAL"
        })

        # Income Tax Audit Filing - Due September 30
        deadlines.append({
            "id": f"it_tax_audit_{yr}",
            "authority": "Income Tax",
            "form": "Form 3CD",
            "title": "Tax Audit Report Submission",
            "notes": "Statutory audit report for companies subject to tax audit under section 44AB.",
            "description": "Statutory audit report for companies subject to tax audit under section 44AB.",
            "due_date": f"{yr}-09-30T23:59:59Z",
            "priority": "CRITICAL"
        })

        # Form AOC-4 (Financial Statements to ROC) - Due October 29/30
        if business_type in ["Private Limited", "Public Limited"]:
            deadlines.append({
                "id": f"mca_aoc4_{yr}",
                "authority": "MCA",
                "form": "Form AOC-4",
                "title": "Filing Audited Financial Statements (AOC-4)",
                "notes": "Balance sheet, P&L, auditor report submission with Registrar of Companies (ROC).",
                "description": "Balance sheet, P&L, auditor report submission with Registrar of Companies (ROC).",
                "due_date": f"{yr}-10-29T23:59:59Z",
                "priority": "HIGH"
            })

            # Form MGT-7 (Annual Return to ROC) - Due November 29
            deadlines.append({
                "id": f"mca_mgt7_{yr}",
                "authority": "MCA",
                "form": "Form MGT-7",
                "title": "Filing Company Annual Return (MGT-7)",
                "notes": "Annual statutory return covering shareholding patterns, members, and AGM details.",
                "description": "Annual statutory return covering shareholding patterns, members, and AGM details.",
                "due_date": f"{yr}-11-29T23:59:59Z",
                "priority": "MEDIUM"
            })

    # --- 4. RBI / FEMA Framework Deadlines ---
    for yr in [current_year, current_year + 1]:
        # FLA Return due July 15
        deadlines.append({
            "id": f"rbi_fla_{yr}",
            "authority": "RBI",
            "form": "FLA Return",
            "title": "Foreign Liabilities and Assets Annual Return",
            "notes": "Annual Return on Foreign Liabilities and Assets for companies with FDI/ODI.",
            "description": "Annual Return on Foreign Liabilities and Assets for companies with FDI/ODI.",
            "due_date": f"{yr}-07-15T23:59:59Z",
            "priority": "HIGH"
        })

    # --- 5. SEBI / LODR Quarterly Deadlines ---
    if industry in ["Fintech", "BFSI", "Financial Services"] or business_type == "Public Limited":
        sebi_quarters = [
            ("01-21", "Q3 SEBI LODR Shareholding Disclosure"),
            ("04-21", "Q4 SEBI LODR Shareholding Disclosure"),
            ("07-21", "Q1 SEBI LODR Shareholding Disclosure"),
            ("10-21", "Q2 SEBI LODR Shareholding Disclosure")
        ]
        for yr in [current_year, current_year + 1]:
            for date_suf, sebi_title in sebi_quarters:
                deadlines.append({
                    "id": f"sebi_lodr_{yr}_{date_suf.replace('-', '_')}",
                    "authority": "SEBI",
                    "form": "Reg 31 LODR",
                    "title": sebi_title,
                    "notes": "Quarterly submission of compliance certificates and shareholding patterns.",
                    "description": "Quarterly submission of compliance certificates and shareholding patterns.",
                    "due_date": f"{yr}-{date_suf}T23:59:59Z",
                    "priority": "MEDIUM"
                })

    # Filter deadlines to a reasonable chronological window (last 60 days to next 180 days)
    cutoff_past = now - timedelta(days=60)
    cutoff_future = now + timedelta(days=180)

    filtered = [
        d for d in deadlines 
        if cutoff_past <= datetime.strptime(d["due_date"].split("T")[0], "%Y-%m-%d") <= cutoff_future
    ]

    # Sort sequentially by due date
    filtered.sort(key=lambda x: x["due_date"])

    return filtered