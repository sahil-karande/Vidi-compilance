"""
RegIQ — backend/app/rag/rewriter.py
Agentic Regulatory Query Rewriter & Statutory Expander

Translates conversational SME queries (e.g. "Can I claim GST on my car purchase?")
into high-recall statutory search queries enriched with official circular keywords,
section numbers, and act references before ChromaDB / BM25 hybrid lookup.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Set, Tuple
from loguru import logger

# Safe LangFuse import
try:
    from langfuse.decorators import observe, langfuse_context
except ImportError:
    try:
        from langfuse import observe
        try:
            from langfuse._context import langfuse_context
        except ImportError:
            langfuse_context = None
    except ImportError:
        import functools
        def observe(name=None, **kwargs):
            def decorator(fn):
                @functools.wraps(fn)
                def wrapper(*args, **kw):
                    return fn(*args, **kw)
                return wrapper
            return decorator if not callable(name) else decorator(name)
        langfuse_context = None


# ─────────────────────────────────────────────────────────────
#  Statutory Term Dictionaries & Synonyms
# ─────────────────────────────────────────────────────────────
STATUTORY_SYNONYMS: Dict[str, List[str]] = {
    # GST
    "blocked credit": ["Section 17(5)", "ineligible ITC", "motor vehicles", "food and beverages", "CGST Act"],
    "car": ["motor vehicle", "Section 17(5)(a)", "blocked input tax credit", "passenger seating capacity"],
    "vehicle": ["motor vehicles", "conveyance", "Section 17(5)", "blocked credit"],
    "itc deadline": ["Section 16(4)", "30th November", "GSTR-3B return", "financial year"],
    "input tax credit": ["ITC", "Section 16", "GSTR-2B", "tax invoice", "CGST Act"],
    "reverse charge": ["RCM", "Section 9(3)", "Section 9(4)", "recipient liability", "self invoice"],
    "rcm": ["Reverse Charge Mechanism", "Section 9(3)", "recipient liability", "GTA", "legal services"],
    "e-invoicing": ["Rule 48(4)", "IRN", "Invoice Registration Portal", "5 crore aggregate turnover", "B2B"],
    "einvoice": ["e-invoicing", "Rule 48(4)", "IRN", "5 crore threshold", "Notification 10/2023"],
    "e-way bill": ["Rule 138", "consignment value", "50,000", "Part A", "Part B", "validity per 200 km"],
    "eway bill": ["e-way bill", "Rule 138", "50000 rupees", "inter-state movement", "transporter"],
    "composition": ["Section 10", "1.5 crore", "CMP-08", "quarterly return", "composition levy"],
    "export service": ["Section 2(6) IGST", "convertible foreign exchange", "zero rated", "LUT"],

    # RBI
    "priority sector": ["PSL", "40 percent ANBC", "agriculture", "MSME", "weaker sections", "RBI master direction"],
    "psl": ["Priority Sector Lending", "40% target", "ANBC", "CEO target", "sub-targets"],
    "crar": ["Capital to Risk-Weighted Assets Ratio", "15 percent", "Tier 1 capital", "Tier 2 capital", "NBFC prudential"],
    "capital adequacy": ["CRAR", "15%", "Tier 1 capital", "NBFC regulatory capital", "RBI scale based"],
    "re-kyc": ["periodic update", "2 years high risk", "8 years medium risk", "10 years low risk", "Master Direction KYC"],
    "kyc update": ["re-KYC", "high risk 2 years", "low risk 10 years", "Aadhaar", "PAN"],
    "npa": ["Non Performing Asset", "90 days overdue", "IRAC norms", "substandard asset", "Prudential Norms"],
    "overdue loan": ["NPA", "90 days overdue", "SMA-0", "SMA-1", "SMA-2", "IRAC"],
    "digital lending": ["direct disbursal", "Regulated Entity", "LSP", "DLG", "no third party pool account"],
    "loan app": ["digital lending guidelines", "Lending Service Provider", "direct account transfer", "KFS"],
    "ombudsman": ["Reserve Bank - Integrated Ombudsman Scheme 2021", "deficiency in service", "complaint portal", "CMS"],
    "net owned funds": ["NOF", "10 crore", "NBFC-ICC", "scale based regulation", "base layer"],
    "nof": ["Net Owned Funds", "10 crore requirement", "NBFC registration", "Reserve Bank of India Act 45-IA"],
    "cash deposit pan": ["quoting PAN", "50,000 in a day", "Rule 114B", "cash transaction monitoring"],

    # SEBI
    "upsi": ["Unpublished Price Sensitive Information", "Regulation 2(1)(n)", "PIT Regulations", "material event"],
    "insider trading": ["PIT Regulations 2015", "trading window closure", "48 hours post disclosure", "UPSI"],
    "trading window": ["Regulation 9", "PIT Regulations", "quarterly closure", "48 hours financial results"],
    "material disclosure": ["Regulation 30", "LODR", "30 minutes board meeting", "12 hours", "24 hours"],
    "lodr": ["Listing Obligations and Disclosure Requirements", "Regulation 30", "schedule III", "material event"],
    "minimum public shareholding": ["MPS", "25 percent", "Rule 19A SCRR", "Regulation 38 LODR", "continuous listing"],
    "mps": ["Minimum Public Shareholding", "25% public float", "Rule 19A", "SCRR 1957"],
    "open offer": ["SAST Regulations", "25 percent voting rights", "26 percent offer size", "mandatory tender offer"],
    "takeover": ["SAST 2011", "substantial acquisition", "25% threshold", "open offer 26%"],
    "minimum subscription": ["90 percent", "ICDR Regulations", "refund within 4 days", "public issue"],
    "independent director": ["Regulation 17", "one third", "one half", "board composition", "LODR"],
    "structured digital database": ["SDD", "Regulation 3(5) PIT", "time-stamped audit trail", "PAN sharing UPSI"],
    "sdd": ["Structured Digital Database", "Regulation 3(5)", "SEBI PIT", "UPSI recipient log"],

    # MCA
    "csr": ["Section 135", "Corporate Social Responsibility", "2 percent", "net worth 500 cr", "turnover 1000 cr", "net profit 5 cr"],
    "annual filing": ["Form AOC-4", "Form MGT-7", "30 days AGM", "60 days AGM", "Companies Act 2013"],
    "aoc-4": ["Form AOC-4", "financial statements", "30 days of AGM", "Section 137"],
    "mgt-7": ["Form MGT-7", "annual return", "60 days of AGM", "Section 92"],
    "board meeting": ["Section 173", "120 days maximum gap", "4 meetings per year", "Companies Act"],
    "board quorum": ["Section 174", "one third", "two directors", "whichever is higher", "Companies Act 2013"],
    "directorship limit": ["Section 165", "20 companies", "10 public companies", "maximum directorships"],
    "woman director": ["Section 149(1)", "Rule 3 Companies Rules", "listed company", "paid up capital 100 cr", "turnover 300 cr"],
    "strike off": ["Section 248", "Form STK-2", "removal of name", "defunct company", "ROC"],
    "paid up capital": ["minimum paid up capital omitted", "Companies Amendment Act 2015", "zero minimum capital"],

    # FEMA
    "lrs": ["Liberalised Remittance Scheme", "250,000 USD", "current account transactions", "capital account", "FEMA"],
    "remittance abroad": ["LRS", "250000 USD", "Form A2", "resident individuals", "TCS 20%"],
    "export realization": ["9 months", "repatriation of export proceeds", "FEMA 23(R)", "Authorized Dealer"],
    "fc-gpr": ["Foreign Collaboration - General Permission Route", "30 days", "FIRMS portal", "FDI reporting"],
    "ecb": ["External Commercial Borrowings", "750 million USD", "MAMP 3 years", "automatic route", "FEMA 3(R)"],
    "mamp": ["Minimum Average Maturity Period", "3 years ECB", "infrastructure 5 years", "Master Direction ECB"],
    "prohibited fdi": ["lottery", "gambling", "atomic energy", "chit funds", "Nidhi company", "agricultural activities"],
    "fla return": ["Foreign Liabilities and Assets", "July 15", "annual FLA return", "RBI reporting"],
    "softex": ["export of software", "30 days from invoice", "STPI", "EDPMS", "SOFTEX form"],
    "odi": ["Overseas Direct Investment", "400 percent of net worth", "OI Rules 2022", "financial commitment"],
    "tcs on lrs": ["Tax Collected at Source", "20 percent", "7 lakh threshold", "Section 206C(1G)", "Income Tax Act"],
}

# Regex to capture statutory mentions like "Section 17(5)", "Rule 138", "Reg 30", "Form AOC-4"
STATUTE_PATTERN = re.compile(
    r"\b(section\s+\d+[\(\)\w]*|rule\s+\d+[\(\)\w]*|regulation\s+\d+[\(\)\w]*|form\s+[\w\-]+|circular\s+[\w\/\-]+)\b",
    re.IGNORECASE
)


@observe(name="query_rewriter")
def expand_query(query: str, corpus: Optional[str] = None) -> str:
    """
    Agentic query expansion:
    Detects key regulatory topics in the user's query and appends official statutory
    synonyms, legal terms, and section references to optimize dense + lexical retrieval.

    Args:
        query: Raw SME user query.
        corpus: Optional corpus hint ('gst', 'rbi', 'sebi', 'mca', 'fema').

    Returns:
        Enriched query string with high-value statutory tokens.
    """
    query_clean = query.strip()
    query_lower = query_clean.lower()

    # Step 1: Detect matching statutory synonyms
    matched_terms: Set[str] = set()
    for trigger_phrase, expansions in STATUTORY_SYNONYMS.items():
        # Match whole word or phrase
        pattern = r"\b" + re.escape(trigger_phrase) + r"\b"
        if re.search(pattern, query_lower):
            for exp in expansions:
                # Avoid redundancy if term is already in the query
                if exp.lower() not in query_lower:
                    matched_terms.add(exp)

    # Step 2: Detect statutory markers already present
    explicit_sections = STATUTE_PATTERN.findall(query_clean)

    # Step 3: Append corpus authority tokens if appropriate
    corpus_authority_tokens: Dict[str, str] = {
        "gst": "CBIC GST Council CGST Act 2017",
        "rbi": "Reserve Bank of India RBI Master Directions",
        "sebi": "Securities and Exchange Board of India SEBI Regulations",
        "mca": "Ministry of Corporate Affairs Companies Act 2013 ROC",
        "fema": "Foreign Exchange Management Act FEMA RBI Circulars",
    }

    expansion_parts: List[str] = []

    # Limit expansions to top 4 highest value terms to prevent query drift
    if matched_terms:
        sorted_terms = sorted(list(matched_terms), key=lambda x: len(x), reverse=True)[:4]
        expansion_parts.append(" ".join(sorted_terms))

    if corpus and corpus.lower() in corpus_authority_tokens:
        auth_str = corpus_authority_tokens[corpus.lower()]
        # Append only if not already present
        if not any(token.lower() in query_lower for token in auth_str.split()[:2]):
            expansion_parts.append(auth_str)

    if not expansion_parts:
        return query_clean

    expanded_query = f"{query_clean} ({', '.join(expansion_parts)})"

    logger.debug(
        f"[rewriter] Original: '{query_clean[:50]}' -> Expanded: '{expanded_query[:80]}...'"
    )

    if langfuse_context:
        try:
            langfuse_context.update_current_observation(
                input={"original_query": query, "corpus": corpus},
                output={"expanded_query": expanded_query, "added_terms": list(matched_terms)[:6]},
                metadata={"num_expanded_terms": len(matched_terms)}
            )
        except Exception:
            pass

    return expanded_query


def extract_statutory_entities(query: str) -> Dict[str, List[str]]:
    """
    Extract explicitly stated statutory citations from a user prompt.
    Returns dictionary with lists of detected sections, rules, regulations, forms.
    """
    found = STATUTE_PATTERN.findall(query)
    entities: Dict[str, List[str]] = {
        "sections": [],
        "rules": [],
        "regulations": [],
        "forms": [],
        "circulars": []
    }
    for item in found:
        low = item.lower()
        if "section" in low:
            entities["sections"].append(item)
        elif "rule" in low:
            entities["rules"].append(item)
        elif "regulation" in low:
            entities["regulations"].append(item)
        elif "form" in low:
            entities["forms"].append(item)
        elif "circular" in low:
            entities["circulars"].append(item)
    return entities
