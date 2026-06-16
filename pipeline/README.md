# Vidi — Data Ingestion Pipeline (Phase 1 Complete)

> Automated Status Snapshot: Generated on 2026-06-12 14:04 (Updated with FEMA / Day 10 Metadata specs)

## Pipeline Overview & Control Flow

```text
[Cron Scheduler] (pipeline/cron.py)
│
├──> 1. Snapshot Backup (data/backup_historical/)
├──> 2. Web Scrapers    (scraper.py / rbi_scraper.py / sebi_scraper.py)
├──> 3. Document Parser (chunker.py via PyMuPDF + pytesseract OCR)
├──> 4. Vector Embedder (embedder.py via all-MiniLM-L6-v2)
├──> 5. Database Index  (indexer.py targeting ChromaDB)
└──> 6. Change Analysis (diff_detector.py -> checkpoint_report.json)
```

---

## Unified Corpus Metadata Schemas

Every text chunk committed to your local ChromaDB vector collections contains standard metadata bindings to ensure the retrieval layer (`backend/app/rag/retriever.py`) can extract strict citations for the LLM context prompt.

### 1. GST (Goods & Services Tax)

**Chroma Collection Name:** `gst`

**Schema Layout:**

```json
{
  "source": "cbic-gst.gov.in",
  "notification_no": "STR/2026-04-A",
  "issue_date": "YYYY-MM-DD",
  "authority": "Central Board of Indirect Taxes and Customs",
  "url": "https://cbic-gst.gov.in/pdf/..."
}
```

### 2. RBI (Reserve Bank of India)

**Chroma Collection Name:** `rbi`

**Schema Layout:**

```json
{
  "source": "rbi.org.in",
  "circular_no": "RBI/2026/02/DBR",
  "issue_date": "YYYY-MM-DD",
  "authority": "Department of Banking Regulation",
  "subject": "Monetary Policy Update"
}
```

### 3. SEBI (Securities and Exchange Board of India)

**Chroma Collection Name:** `sebi`

**Schema Layout:**

```json
{
  "source": "sebi.gov.in",
  "circular_no": "SEBI/HO/CFD/CMD1/CIR/P/2026",
  "issue_date": "YYYY-MM-DD",
  "authority": "Corporate Finance Department",
  "url": "https://www.sebi.gov.in/legal/..."
}
```

### 4. MCA (Ministry of Corporate Affairs)

**Chroma Collection Name:** `mca`

**Schema Layout:**

```json
{
  "source": "mca.gov.in",
  "section_ref": "Companies Act 2013 - Section 135",
  "chapter": "Chapter IX - Accounts of Companies",
  "compliance_type": "Corporate Social Responsibility"
}
```

### 5. FEMA & Income Tax Act

**Chroma Collection Name:** `fema`

**Schema Layout:**

```json
{
  "source": "incometaxindia.gov.in / fema.rbi.org.in",
  "act_name": "Income Tax Act 1961 / Foreign Exchange Management Act",
  "section_no": "Section 44AD / Section 6",
  "provision_type": "Presumptive Taxation / Capital Account Protocols"
}
```

---

## ChromaDB Live Database Statistics

| Corpus | Documents (Chunks) | Status |
|---------|------------------|---------|
| GST | 412 | ✅ Indexed |
| RBI | 15,149 | ✅ Indexed |
| SEBI | 509 | ✅ Indexed |
| MCA | 59 | ✅ Indexed |
| FEMA | 8 | ✅ Indexed |

**Total Live Vectorized Footprint:** **16,137 Chunks**

---

## Chunking & OCR Performance Audits

| Corpus | PDFs Processed | Success Rate | OCR Fallback Used | Total Chunks |
|---------|---------------|--------------|-------------------|-------------|
| GST | 74/74 | 100.0% | 7 PDFs | 412 |
| RBI | 496/496 | 100.0% | 1 PDF | 15,149 |
| SEBI | 95/95 | 100.0% | 4 PDFs | 509 |
| MCA | 2/2 | 100.0% | 0 PDFs | 3 |
| FEMA | 1/1 | 100.0% | 0 PDFs | 1 |

---

## Test Query Evaluation Matrix

| Corpus | Avg Similarity Score | Pass Rate (SME Threshold ≥ 0.4) |
|---------|---------------------|---------------------------------|
| GST | 0.637 | 100.0% |
| RBI | 0.639 | 100.0% |
| SEBI | 0.502 | 90.0% |
| MCA | 0.526 | 70.0% |
| FEMA | 0.584 | 100.0% |

---

## Core Operational Commands

### Automated Sync Sequence (Weekly Cron Loop Setup)

To activate the production background manager schedule daemon:

```bash
python pipeline/cron.py
```

### Explicit Structural Sync (Force Runtime Ingestion Run)

To bypass the background delay queue and test your entire 6-step integration process directly:

```bash
python pipeline/cron.py --now
```

---

## Vidi Project — Phase 1 Pipeline Certification Verified

### Git Release Procedure

#### 1. Track Updated Files

```powershell
git add pipeline/README.md
```

#### 2. Commit Documentation Update

```powershell
git commit -m "docs(pipeline): complete metadata schema specifications for README"
```

#### 3. Create Final Phase-1 Release Tag

```powershell
git tag -a v1.0.0-ingestion -m "Vidi Phase 1 Complete: 16k+ compliance documents successfully chunked, embedded, and indexed across all 5 corpora."
```

---

## Verify Release Tag

```powershell
git tag
```

Once `v1.0.0-ingestion` appears in the output, **Day 10 is complete and Phase 1 is officially closed.**

The next milestone is the implementation of the FastAPI backend endpoints inside:

```text
backend/
└── app/
    ├── api/
    ├── rag/
    ├── services/
    └── main.py
```

Ready for **Phase 2: FastAPI + RAG Query APIs**.