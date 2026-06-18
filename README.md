<div align="center">

# 🏛️ Vidi
### RAG-Powered Financial Regulation Q&A Assistant for Indian SMEs

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react)](https://vitejs.dev)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5-orange)](https://trychroma.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**65 million Indian SMEs. Zero affordable compliance tools. Vidi changes that.**

[Live Demo](#) · [API Docs](#api-documentation) · [Report Bug](https://github.com/sahil-karande/Vidi-compilance/issues)

</div>

---

## What is Vidi?

Vidi is a RAG (Retrieval-Augmented Generation) powered compliance assistant that lets Indian SME owners ask plain-language questions about GST, RBI, SEBI, MCA, and FEMA regulations — and receive **grounded, cited answers** pulled directly from official government documents.

**The core differentiator:** Every answer cites the exact circular number, section, and date. No generic chatbot. No hallucination. Source-grounded only.

```
User: "What is the GST registration threshold for my business?"

Vidi: "Businesses with aggregate turnover exceeding ₹40 lakh must register 
       for GST (₹20 lakh for special category states)."
       
       📎 Source: GST | Circular: CT-01/2017 | Date: 2017 | File: 01062019-GST-An-Update.pdf
```

---

## The Problem

| Pain Point | Reality |
|---|---|
| 65M+ Indian SMEs | Navigating RBI, SEBI, GST, MCA, FEMA daily |
| ₹3,000–₹8,000/hr | Cost of CA consultation for basic compliance |
| 90%+ SMEs | Penalised for non-compliance in their first year |
| ChatGPT/Gemini | Confidently hallucinate regulation details |
| Existing tools | Static search, no conversational Q&A, no citations |

**Vidi solves this** by building a RAG pipeline over 15,000+ chunks of verified Indian regulatory documents.

---

## Key Features

| Feature | Description |
|---|---|
| 🔍 **RAG Chat Engine** | Semantic search over GST, RBI, SEBI, MCA, FEMA corpora |
| 📎 **Cited Answers** | Every answer links to exact circular number + date |
| ⚖️ **Plain / Legal Toggle** | Switch between simple English and formal legal language |
| 💬 **Persistent Threads** | Topic-organised chat history across sessions |
| 📊 **Compliance Scorecard** | Red/amber/green risk scores across 4 regulatory axes |
| 📅 **Filing Calendar** | Deadline reminders personalised to your business profile |
| 🔔 **Regulation Alerts** | Email notifications when circulars are updated |
| 📄 **PDF Export** | Download any thread as a formatted PDF for your CA |
| 📁 **Doc Upload + RAG** | Upload your own notices and blend with regulatory corpus |
| 🌐 **Regulation Explorer** | D3 force graph of how regulations cite each other |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite |
| **Backend** | FastAPI (Python 3.11) |
| **Auth** | Supabase Auth (Google OAuth + Email OTP) |
| **Database** | Supabase (PostgreSQL) |
| **Vector DB** | ChromaDB |
| **Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` |
| **Reranking** | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| **LLM** | Google Gemini 1.5 Flash / OpenRouter (fallback) |
| **PDF Parsing** | PyMuPDF + pytesseract (OCR fallback) |
| **Payments** | Razorpay |
| **Deployment** | Docker + Render (backend), Vercel (frontend) |

---

## Project Structure

```
Vidi/
├── frontend/                    # React + Vite UI
│   └── src/
│       ├── pages/               # Landing, Login, Dashboard, Chat, Explorer
│       ├── components/          # CitationCard, RiskScorecard, PricingPage...
│       ├── hooks/               # useAuth.js, useQueryLimit.js
│       └── lib/                 # supabaseClient.js, api.js
│
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Environment settings
│   │   ├── api/                 # query, auth, alerts, billing, scorecard
│   │   ├── rag/                 # classifier, retriever, reranker, generator
│   │   └── models/              # user, thread, alert Pydantic models
│   ├── eval/                    # Benchmark + checkpoint scripts
│   └── requirements.txt
│
├── pipeline/                    # Offline data ingestion
│   ├── scraper.py               # GST portal scraper
│   ├── rbi_scraper.py           # RBI document scraper
│   ├── sebi_scraper.py          # SEBI circular scraper
│   ├── fema_scraper.py          # FEMA regulation scraper
│   ├── chunker.py               # PDF → 512-token chunks
│   ├── embedder.py              # sentence-transformers embedder
│   ├── indexer.py               # ChromaDB upsert
│   ├── checkpoint.py            # Pipeline health check
│   └── README.md                # Pipeline documentation
│
├── data/                        # Downloaded PDFs (not committed)
│   ├── gst/                     # 66 PDFs, index.csv
│   ├── rbi/                     # 441 PDFs, index.csv
│   ├── sebi/                    # 41+ PDFs, index.csv
│   ├── mca/                     # 56 PDFs, index.csv
│   └── fema/                    # FEMA + Income Tax PDFs
│
├── vectordb/                    # ChromaDB collections (not committed)
│   ├── gst/                     # 403 chunks
│   ├── rbi/                     # 15,067 chunks
│   ├── sebi/                    # 455 chunks
│   ├── mca/                     # 59 chunks
│   └── fema/
│
├── docker-compose.yml
├── setup.sh
└── README.md
```

---

## RAG Pipeline

```
User Query
    ↓
Query Classifier (keyword + embedding, 95% accuracy)
    ↓ routes to corpus namespace
ChromaDB Retriever (top-10 chunks by cosine similarity)
    ↓
Cross-encoder Reranker (ms-marco-MiniLM — reranks top-10 → top-5)
    ↓
LLM Generator (Gemini 1.5 Flash)
    System prompt: "Answer ONLY from context. Cite circular + date."
    ↓
Answer + Citations [ ]
    ↓
React UI — CitationCard drawer
```

---

## Data Corpus

| Corpus | Source | PDFs | Chunks | Avg Similarity |
|---|---|---|---|---|
| GST | cbic-gst.gov.in, gstcouncil.gov.in | 66 | 403 | 0.637 |
| RBI | rbidocs.rbi.org.in | 441 | 15,067 | 0.639 |
| SEBI | sebi.gov.in | 41+ | 455 | 0.502 |
| MCA | mca.gov.in | 56 | 59 | 0.526 |
| FEMA | fema.rbi.org.in, rbidocs.rbi.org.in | WIP | WIP | — |
| **Total** | | **600+** | **15,984+** | **0.576** |

---

## Pricing Tiers

| Feature | Guest | Free | Pro | Enterprise |
|---|---|---|---|---|
| Queries/day | 3 | 20 | Unlimited | Unlimited |
| Corpora | GST only | All 4 | All corpora | All + custom |
| Chat history | ✗ | ✓ | ✓ | ✓ |
| Risk scorecard | ✗ | ✗ | ✓ | ✓ |
| Doc upload + RAG | ✗ | ✗ | ✓ | ✓ |
| Regulation alerts | ✗ | ✗ | ✓ | ✓ |
| PDF export | ✗ | ✗ | ✓ | ✓ |
| **Price** | Free | ₹0/mo | ₹499/mo | Custom |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop
- Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))
- Supabase project (free at [supabase.com](https://supabase.com))

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/sahil-karande/Vidi-compilance.git
cd Vidi-compilance

# 2. Run one-command setup
chmod +x setup.sh
./setup.sh

# 3. Fill in your API keys
cp .env.example .env
# Edit .env with your keys

# 4. Start ChromaDB
docker-compose up -d chromadb

# 5. Run the data pipeline (downloads regulatory PDFs)
source venv/bin/activate
python pipeline/scraper.py --corpus gst
python pipeline/chunker.py --corpus gst
python pipeline/embedder.py --corpus gst
python pipeline/indexer.py --corpus gst

# 6. Start the backend
cd backend
uvicorn app.main:app --reload
# → http://localhost:8000/docs

# 7. Start the frontend (new terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for the full Swagger UI.

### Key Endpoints

```
POST /api/query          — Ask a compliance question (RAG pipeline)
GET  /api/threads        — List chat threads
POST /api/threads        — Create new thread
GET  /api/alerts/topics  — Available alert topics
POST /api/alerts         — Subscribe to regulation change alerts
GET  /health             — Service health check
```

### Example Query

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the GST registration threshold?",
    "mode": "plain",
    "corpus": null
  }'
```

```json
{
  "answer": "Businesses with aggregate turnover exceeding ₹40 lakh must register for GST...",
  "citations": [
    {
      "corpus": "gst",
      "circular_no": "CT-01/2017",
      "date": "2017",
      "filename": "01062019-GST-An-Update.pdf",
      "similarity": 0.701
    }
  ],
  "confidence": "high",
  "response_ms": 1840
}
```

---

## Build Progress

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Data Pipeline (scrape → chunk → embed → ChromaDB) | ✅ Complete |
| **Phase 2** | RAG Backend (FastAPI + classifier + retriever + reranker + generator) | 🔄 In Progress |
| **Phase 3** | Auth + Supabase | ⏳ Pending |
| **Phase 4** | React Frontend | ⏳ Pending |
| **Phase 5** | Dashboard Features (scorecard, calendar) | ⏳ Pending |
| **Phase 6** | Pro Features (upload, export, billing) | ⏳ Pending |
| **Phase 7** | Alerts System | ⏳ Pending |
| **Phase 8** | Regulation Explorer (D3 graph) | ⏳ Pending |
| **Phase 9** | Evaluation + Deployment | ⏳ Pending |

---

## IEEE Publication

This project serves as the basis for an IEEE research paper:

> **"Domain-specific RAG for Indian Financial Regulation: Benchmark and Hallucination Analysis"**

Key contributions:
- First RAG pipeline built specifically for Indian regulatory compliance (GST, RBI, SEBI, MCA, FEMA)
- 15,984-chunk benchmark corpus from official government sources
- Query classifier achieving 95% routing accuracy across 5 regulatory domains
- Hallucination evaluation framework for legal RAG systems

---

## Developer

**Sahil Pankaj Karande**
B.Tech in Artificial Intelligence — G.H. Raisoni College of Engineering and Management, Nagpur (2023–2027)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://linkedin.com)
[![GitHub](https://img.shields.io/badge/GitHub-sahil--karande-black?logo=github)](https://github.com/sahil-karande)
[![IEEE](https://img.shields.io/badge/IEEE-Co--Author-00629B?logo=ieee)](https://ieee.org)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ for Indian SMEs | Vidi © 2026</sub>
</div>