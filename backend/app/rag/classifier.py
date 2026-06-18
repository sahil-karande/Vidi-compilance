"""
Vidi — backend/app/rag/classifier.py
Day 12 Task: Query Classifier

Routes an incoming user query to the correct ChromaDB corpus namespace:
gst / rbi / sebi / mca / fema / user_docs

Two-stage classification:
1. KEYWORD MATCHING (fast, high precision for obvious terms)
   - "GST", "GSTR", "input tax credit" → gst
   - "RBI", "KYC", "NBFC", "UPI"        → rbi
   - "SEBI", "listing", "insider"      → sebi
   - "Companies Act", "LLP", "ROC"     → mca
   - "FEMA", "forex", "remittance"     → fema

2. EMBEDDING SIMILARITY (fallback, for ambiguous queries)
   - Embeds the query with all-MiniLM-L6-v2
   - Compares against pre-computed "centroid" embeddings for each corpus
     (average embedding of a sample of real chunks from each ChromaDB collection)
   - Returns the corpus with highest cosine similarity

If a user explicitly sets `corpus` in QueryRequest, that overrides the classifier.
"""

import re
from pathlib import Path
from functools import lru_cache

import numpy as np
from loguru import logger
from sentence_transformers import SentenceTransformer

from app.models.user import Corpus

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Confidence threshold — below this, classifier falls back to keyword
# match result (or 'gst' as ultimate default if nothing matches)
MIN_EMBEDDING_CONFIDENCE = 0.15

# ─────────────────────────────────────────────────────────────
#  Stage 1: Keyword Patterns
#  Ordered by specificity — checked top to bottom, first match wins
#  Each pattern is a compiled regex (case-insensitive)
# ─────────────────────────────────────────────────────────────

KEYWORD_PATTERNS: dict[Corpus, list[re.Pattern]] = {

    Corpus.GST: [re.compile(p, re.IGNORECASE) for p in [
        r"\bgst\b", r"\bgstr[\-\s]?\d", r"goods\s+and\s+services\s+tax",
        r"input\s+tax\s+credit", r"\bitc\b", r"e[\-\s]?invoic",
        r"reverse\s+charge", r"composition\s+scheme",
        r"cbic", r"hsn\s+code", r"gst\s+council",
        r"central\s+tax", r"cgst|sgst|igst",
    ]],

    Corpus.RBI: [re.compile(p, re.IGNORECASE) for p in [
        r"\brbi\b", r"reserve\s+bank", r"\bkyc\b", r"\bnbfc\b",
        r"\bupi\b", r"prepaid\s+payment", r"\bppi\b",
        r"digital\s+lending", r"priority\s+sector",
        r"kisan\s+credit", r"savings\s+(?:bank\s+)?account",
        r"interest\s+rate\s+on\s+(?:advances|deposits|loans)",
        r"liberalised\s+remittance\s+scheme",  # LRS is both RBI MD and FEMA — RBI wins
        r"master\s+direction", r"master\s+circular",
        r"monetary\s+policy", r"repo\s+rate",
        r"debit\s+card|credit\s+card",
    ]],

    Corpus.SEBI: [re.compile(p, re.IGNORECASE) for p in [
        r"\bsebi\b", r"stock\s+exchange", r"\bipo\b",
        r"insider\s+trading", r"listing\s+(?:obligation|requirement)",
        r"\blodr\b", r"takeover\s+code", r"mutual\s+fund",
        r"portfolio\s+manager", r"investment\s+adviser",
        r"alternative\s+investment\s+fund", r"\baif\b",
        r"research\s+analyst", r"\besg\b\s+disclosure",
        r"settlement\s+cycle", r"\bt\+0\b", r"\bt\+1\b",
        r"substantial\s+acquisition", r"demat",
    ]],

    Corpus.MCA: [re.compile(p, re.IGNORECASE) for p in [
        r"companies\s+act", r"\bllp\b", r"\broc\b",
        r"registrar\s+of\s+companies", r"director\s+(?:kyc|identification|din)",
        r"\bdin\b", r"board\s+meeting", r"annual\s+(?:return|filing)",
        r"\bagm\b", r"incorporat", r"strik(?:e|ing)\s+off",
        r"related\s+party\s+transaction", r"registered\s+office",
        r"company\s+secretary", r"\bmoa\b|\baoa\b",
        r"shareholding\s+pattern", r"winding\s+up",
    ]],

    Corpus.FEMA: [re.compile(p, re.IGNORECASE) for p in [
        r"\bfema\b", r"foreign\s+exchange", r"\bforex\b",
        r"remittance", r"\blrs\b", r"liberalised\s+remittance",
        r"\bfdi\b", r"foreign\s+direct\s+investment",
        r"external\s+commercial\s+borrow", r"\becb\b",
        r"overseas\s+direct\s+investment", r"\bodi\b",
        r"\bnri\b|\bnre\b|\bnro\b", r"export\s+of\s+(?:goods|services)",
        r"import\s+of\s+(?:goods|services)", r"trade\s+credit",
        r"cross[\-\s]?border",
    ]],
}


# ─────────────────────────────────────────────────────────────
#  Stage 2: Embedding Centroids
#  Representative sample queries per corpus — used to build
#  centroid embeddings for semantic fallback classification.
#  (In production these could be precomputed from real chunk
#   embeddings; sample queries are a lightweight bootstrap.)
# ─────────────────────────────────────────────────────────────

CENTROID_SEED_TEXTS: dict[Corpus, list[str]] = {
    Corpus.GST: [
        "goods and services tax registration and filing requirements",
        "tax invoice, input credit, and GST return filing for businesses",
        "indirect tax compliance for supply of goods and services in India",
    ],
    Corpus.RBI: [
        "banking regulations, interest rates, and monetary policy",
        "rules for banks, NBFCs, payment systems, and digital lending",
        "Reserve Bank of India directions on deposits, KYC, and credit",
    ],
    Corpus.SEBI: [
        "securities market regulations, stock exchange listing, and disclosures",
        "rules for mutual funds, IPOs, insider trading, and investment advisers",
        "capital markets compliance for listed companies and intermediaries",
    ],
    Corpus.MCA: [
        "company law, incorporation, director duties, and corporate governance",
        "Companies Act compliance, annual filings, and LLP regulations",
        "ministry of corporate affairs rules for company registration and ROC filings",
    ],
    Corpus.FEMA: [
        "foreign exchange management, cross-border transactions, and remittances",
        "FEMA regulations for foreign investment, export, import, and overseas borrowing",
        "rules for NRIs, foreign direct investment, and liberalised remittance scheme",
    ],
}


# ─────────────────────────────────────────────────────────────
#  Model Loading (cached — loaded once per process)
# ─────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    logger.info(f"Loading classifier embedding model: {EMBEDDING_MODEL}")
    return SentenceTransformer(EMBEDDING_MODEL)


@lru_cache(maxsize=1)
def get_centroids() -> dict[Corpus, np.ndarray]:
    """
    Compute a single centroid embedding per corpus by averaging
    the embeddings of the seed texts in CENTROID_SEED_TEXTS.
    Cached for the lifetime of the process.
    """
    model = get_embedding_model()
    centroids = {}
    for corpus, texts in CENTROID_SEED_TEXTS.items():
        embeddings = model.encode(texts, normalize_embeddings=True)
        centroid = np.mean(embeddings, axis=0)
        # re-normalize after averaging
        centroid = centroid / np.linalg.norm(centroid)
        centroids[corpus] = centroid
    logger.info(f"Built embedding centroids for {len(centroids)} corpora")
    return centroids


# ─────────────────────────────────────────────────────────────
#  Stage 1: Keyword Classification
# ─────────────────────────────────────────────────────────────

def classify_by_keywords(query: str) -> tuple[Corpus | None, list[Corpus]]:
    """
    Match query against keyword patterns for each corpus.
    Returns (best_match, all_matches) where best_match is the corpus
    with the most pattern hits, or None if no patterns match.
    """
    scores: dict[Corpus, int] = {}

    for corpus, patterns in KEYWORD_PATTERNS.items():
        hits = sum(1 for pattern in patterns if pattern.search(query))
        if hits > 0:
            scores[corpus] = hits

    if not scores:
        return None, []

    # Sort by score descending. On ties, prefer a fixed priority order
    # since RBI Master Directions often overlap with FEMA topics (e.g. LRS).
    PRIORITY = [Corpus.RBI, Corpus.GST, Corpus.SEBI, Corpus.MCA, Corpus.FEMA]
    ranked = sorted(
        scores.items(),
        key=lambda x: (-x[1], PRIORITY.index(x[0]) if x[0] in PRIORITY else 99),
    )
    best_corpus = ranked[0][0]
    all_matched = [c for c, _ in ranked]

    return best_corpus, all_matched


# ─────────────────────────────────────────────────────────────
#  Stage 2: Embedding Classification
# ─────────────────────────────────────────────────────────────

def classify_by_embedding(query: str) -> tuple[Corpus, float, dict[Corpus, float]]:
    """
    Embed the query and compare against corpus centroids using
    cosine similarity. Returns (best_corpus, best_score, all_scores).
    """
    model = get_embedding_model()
    centroids = get_centroids()

    query_emb = model.encode(query, normalize_embeddings=True)

    scores: dict[Corpus, float] = {}
    for corpus, centroid in centroids.items():
        # both vectors are normalized → dot product = cosine similarity
        similarity = float(np.dot(query_emb, centroid))
        scores[corpus] = round(similarity, 4)

    best_corpus = max(scores, key=scores.get)
    best_score = scores[best_corpus]

    return best_corpus, best_score, scores


# ─────────────────────────────────────────────────────────────
#  Main Classifier
# ─────────────────────────────────────────────────────────────

def classify_query(query: str, verbose: bool = False) -> Corpus:
    """
    Classify a query into a ChromaDB corpus namespace.

    Strategy:
    1. Try keyword matching first (fast, high precision)
    2. If keyword match found → use it
    3. If no keyword match → fall back to embedding similarity
    4. If embedding confidence too low → default to GST (largest/most common)

    Args:
        query: User's natural language question
        verbose: If True, logs the classification reasoning

    Returns:
        Corpus enum value (gst/rbi/sebi/mca/fema)
    """
    if not query or not query.strip():
        return Corpus.GST  # safe default

    # ── Stage 1: Keyword matching ─────────────────────────────
    keyword_match, all_keyword_matches = classify_by_keywords(query)

    if keyword_match is not None:
        if verbose:
            logger.debug(
                f"[classifier] '{query[:50]}' → KEYWORD match: {keyword_match.value} "
                f"(all matches: {[c.value for c in all_keyword_matches]})"
            )
        return keyword_match

    # ── Stage 2: Embedding fallback ───────────────────────────
    embed_match, embed_score, all_scores = classify_by_embedding(query)

    if verbose:
        scores_str = ", ".join(f"{c.value}={s:.3f}" for c, s in
                                sorted(all_scores.items(), key=lambda x: -x[1]))
        logger.debug(
            f"[classifier] '{query[:50]}' → EMBEDDING match: {embed_match.value} "
            f"(score={embed_score:.3f}) | all: {scores_str}"
        )

    if embed_score < MIN_EMBEDDING_CONFIDENCE:
        if verbose:
            logger.debug(
                f"[classifier] Low confidence ({embed_score:.3f} < "
                f"{MIN_EMBEDDING_CONFIDENCE}) → defaulting to GST"
            )
        return Corpus.GST

    return embed_match


def classify_query_detailed(query: str) -> dict:
    """
    Returns full classification breakdown — used for debugging
    and the test harness below.
    """
    keyword_match, all_keyword_matches = classify_by_keywords(query)
    embed_match, embed_score, all_embed_scores = classify_by_embedding(query)

    final = classify_query(query)

    return {
        "query": query,
        "final_corpus": final.value,
        "keyword_match": keyword_match.value if keyword_match else None,
        "keyword_all_matches": [c.value for c in all_keyword_matches],
        "embedding_match": embed_match.value,
        "embedding_score": embed_score,
        "embedding_all_scores": {c.value: s for c, s in all_embed_scores.items()},
        "method_used": "keyword" if keyword_match else (
            "embedding" if embed_score >= MIN_EMBEDDING_CONFIDENCE else "default_fallback"
        ),
    }


# ─────────────────────────────────────────────────────────────
#  Test Harness — 20 Sample Queries
#  Run: python -m app.rag.classifier
# ─────────────────────────────────────────────────────────────

TEST_QUERIES: list[tuple[str, Corpus]] = [
    # GST (4)
    ("What is the GST registration threshold for turnover?", Corpus.GST),
    ("How do I claim input tax credit on my purchases?", Corpus.GST),
    ("What is the due date for filing GSTR-3B?", Corpus.GST),
    ("Is e-invoicing mandatory for my business under GST?", Corpus.GST),

    # RBI (4)
    ("What are the KYC documents required to open a bank account?", Corpus.RBI),
    ("What is the Liberalised Remittance Scheme annual limit?", Corpus.RBI),
    ("How does an NBFC register with the Reserve Bank of India?", Corpus.RBI),
    ("What are the UPI transaction limits for merchants?", Corpus.RBI),

    # SEBI (4)
    ("What are the listing requirements for an SME IPO?", Corpus.SEBI),
    ("What is the SEBI insider trading regulation?", Corpus.SEBI),
    ("What disclosures are required for mutual fund houses?", Corpus.SEBI),
    ("What is the SEBI takeover code threshold?", Corpus.SEBI),

    # MCA (4)
    ("What is the procedure for incorporating a private limited company?", Corpus.MCA),
    ("What are the annual filing requirements under the Companies Act?", Corpus.MCA),
    ("How many directors are required for an LLP?", Corpus.MCA),
    ("What is the process for striking off a company name?", Corpus.MCA),

    # FEMA (4)
    ("What are the FEMA rules for receiving foreign investment?", Corpus.FEMA),
    ("What is the limit for outward remittance under LRS?", Corpus.FEMA),
    ("What are the regulations for external commercial borrowing?", Corpus.FEMA),
    ("Can an NRI invest in Indian company shares under FEMA?", Corpus.FEMA),
]


def run_classifier_tests(verbose: bool = True) -> dict:
    """
    Runs all 20 test queries and prints accuracy report.
    Target: 90%+ correct routing (18/20).
    """
    print("=" * 70)
    print("Vidi Classifier — Test Suite (20 queries)")
    print("=" * 70)

    correct = 0
    results = []

    for query, expected in TEST_QUERIES:
        predicted = classify_query(query, verbose=False)
        is_correct = predicted == expected
        correct += int(is_correct)

        status = "✓" if is_correct else "✗"
        results.append({
            "query": query,
            "expected": expected.value,
            "predicted": predicted.value,
            "correct": is_correct,
        })

        if verbose:
            print(f"{status} expected={expected.value:<5} predicted={predicted.value:<5} | {query[:55]}")

    accuracy = round(correct / len(TEST_QUERIES) * 100, 1)

    print("\n" + "=" * 70)
    print(f"RESULT: {correct}/{len(TEST_QUERIES)} correct  →  {accuracy}% accuracy")
    target_met = "✓ TARGET MET (≥90%)" if accuracy >= 90 else "✗ BELOW TARGET (<90%)"
    print(f"Target: 90%+  →  {target_met}")
    print("=" * 70)

    # Show misclassifications in detail
    wrong = [r for r in results if not r["correct"]]
    if wrong:
        print("\nMisclassified queries (detailed breakdown):")
        for r in wrong:
            detail = classify_query_detailed(r["query"])
            print(f"\n  Query: {r['query']}")
            print(f"    Expected:  {r['expected']}")
            print(f"    Predicted: {r['predicted']}")
            print(f"    Method:    {detail['method_used']}")
            print(f"    Keyword matches: {detail['keyword_all_matches']}")
            print(f"    Embedding scores: {detail['embedding_all_scores']}")

    return {"accuracy": accuracy, "correct": correct, "total": len(TEST_QUERIES), "results": results}


if __name__ == "__main__":
    run_classifier_tests()