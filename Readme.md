# 🛡️ Vidi Compliance (RegIQ)

**AI-powered regulatory compliance platform** — Upload policy documents, ask natural-language questions, and get instant, citation-backed answers using a RAG (Retrieval-Augmented Generation) pipeline.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📄 **Document Upload** | Upload compliance PDFs and policy docs for automated ingestion |
| 💬 **AI Chat** | Ask questions in plain English and receive answers grounded in your documents |
| 🔍 **RAG Pipeline** | Retrieval → Reranking → Classification → Generation for accurate, hallucination-resistant answers |
| 📊 **Compliance Scorecard** | At-a-glance compliance posture across regulatory frameworks |
| 🔔 **Regulatory Alerts** | Stay notified of regulatory changes that affect your organization |
| 🌐 **Document Explorer** | Browse, search, and manage your indexed regulatory corpus |
| 💳 **Billing & Plans** | Integrated Razorpay-powered subscription management |
| 🔐 **Authentication** | Supabase-backed auth with role-based access |

---

## 🏗️ Architecture

```
┌────────────────┐       ┌────────────────────────────────────┐
│   React (Vite) │──────▶│  FastAPI Backend  (port 8000)      │
│   Frontend     │ REST  │  ┌──────────┐  ┌────────────────┐  │
└────────────────┘       │  │ RAG Core │  │ API Routes     │  │
                         │  │ retriever│  │ /query /upload │  │
                         │  │ reranker │  │ /auth /billing │  │
                         │  │ classifier│ │ /alerts /score │  │
                         │  │ generator│  └────────────────┘  │
                         │  └────┬─────┘                      │
                         └───────┼────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │  ChromaDB (port 8001)   │
                    │  Vector Store           │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │         Pipeline (Offline)          │
              │  scraper → diff_detector → chunker  │
              │  → embedder → indexer → cron        │
              └─────────────────────────────────────┘
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React (JSX), Vite |
| **Backend** | Python, FastAPI |
| **Vector DB** | ChromaDB |
| **Auth & DB** | Supabase (Postgres + Auth) |
| **LLM** | Gemini API / OpenRouter |
| **Payments** | Razorpay |
| **Email** | Resend |
| **Infra** | Docker Compose |

---

## 📁 Project Structure

```
Vidi-compilance/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI entrypoint
│       ├── api/
│       │   ├── auth.py          # Authentication routes
│       │   ├── query.py         # RAG query endpoint
│       │   ├── upload.py        # Document upload
│       │   ├── scorecard.py     # Compliance scoring
│       │   ├── alerts.py        # Regulatory alerts
│       │   └── billing.py       # Razorpay billing
│       ├── models/
│       │   ├── user.py          # User schema
│       │   ├── thread.py        # Chat thread schema
│       │   └── alert.py         # Alert schema
│       └── rag/
│           ├── retriever.py     # Vector similarity search
│           ├── reranker.py      # Result reranking
│           ├── classifier.py    # Intent classification
│           └── generator.py     # LLM answer generation
├── frontend/
│   └── src/
│       ├── components/          # Reusable UI components
│       ├── hooks/               # Custom React hooks
│       ├── lib/                 # Utilities & helpers
│       └── pages/
│           ├── Landing.jsx      # Marketing / landing page
│           ├── Login.jsx        # Auth page
│           ├── Dashboard.jsx    # Main dashboard
│           ├── Chat.jsx         # AI chat interface
│           ├── Explorer.jsx     # Document explorer
│           ├── Upload.jsx       # Document upload page
│           └── Settings.jsx     # User settings
├── pipeline/
│   ├── scraper.py               # Regulatory source scraper
│   ├── diff_detector.py         # Change detection
│   ├── chunker.py               # Document chunking
│   ├── embedder.py              # Embedding generation
│   ├── indexer.py               # ChromaDB indexing
│   └── cron.py                  # Scheduled pipeline runs
├── docker-compose.yml           # Backend + ChromaDB orchestration
├── setup.sh                     # Environment setup script
└── Readme.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Docker** & **Docker Compose** v2+
- **Node.js** ≥ 18 (for the frontend)
- **Python** ≥ 3.11 (for local pipeline development)

### 1. Clone the repo

```bash
git clone https://github.com/<your-org>/Vidi-compilance.git
cd Vidi-compilance
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# LLM
GEMINI_API_KEY=your-gemini-key
OPENROUTER_API_KEY=your-openrouter-key

# Payments
RAZORPAY_KEY_ID=your-razorpay-id
RAZORPAY_KEY_SECRET=your-razorpay-secret

# Email
RESEND_API_KEY=your-resend-key

# ChromaDB
CHROMA_AUTH_TOKEN=regiq_chroma_secret

# App
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Start the backend stack

```bash
docker-compose up --build
```

This spins up:
- **FastAPI backend** → `http://localhost:8000`
- **ChromaDB** → `http://localhost:8001`

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at `http://localhost:5173`.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/api/query` | Submit a compliance question |
| `POST` | `/api/upload` | Upload a document for indexing |
| `GET` | `/api/scorecard` | Retrieve compliance scorecard |
| `GET` | `/api/alerts` | Fetch regulatory alerts |
| `POST` | `/api/auth/*` | Authentication flows |
| `POST` | `/api/billing/*` | Billing & subscription management |

---

## 🔄 Pipeline

The offline ingestion pipeline keeps your knowledge base fresh:

1. **Scraper** — Crawls regulatory sources and downloads documents
2. **Diff Detector** — Identifies new or changed content since the last run
3. **Chunker** — Splits documents into semantically meaningful chunks
4. **Embedder** — Generates vector embeddings for each chunk
5. **Indexer** — Upserts embeddings into ChromaDB
6. **Cron** — Schedules periodic pipeline runs

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add new feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary. All rights reserved.

---

<p align="center">
  Built with ❤️ by the Vidi team
</p>
