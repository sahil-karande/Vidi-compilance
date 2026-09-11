import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  ArrowRight, 
  Search, 
  Share2, 
  FileText, 
  Bell, 
  Layers, 
  CheckCircle2, 
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
  Cpu,
  Terminal,
  Activity
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('query');

  return (
    <div className="min-h-screen w-full bg-[#090d16] text-slate-200 font-sans flex flex-col antialiased selection:bg-indigo-500/20 selection:text-indigo-200">
      
      {/* ── Subtle Ambient Background ── */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent pointer-events-none -z-10" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* ── Top Navigation Bar ── */}
      <header className="w-full border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-xl px-6 sm:px-12 lg:px-20 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-10">
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              R
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">RegIQ</span>
              <span className="text-[11px] text-slate-400 border border-slate-700/80 px-1.5 py-0.2 rounded font-mono">
                Enterprise
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#platform" className="hover:text-slate-200 transition-colors">Platform</a>
            <a href="#corpora" className="hover:text-slate-200 transition-colors">Regulatory Coverage</a>
            <a href="#architecture" className="hover:text-slate-200 transition-colors">Architecture</a>
            <span onClick={() => navigate('/login')} className="hover:text-slate-200 cursor-pointer transition-colors">
              Citation Graph
            </span>
            <span onClick={() => navigate('/login')} className="hover:text-slate-200 cursor-pointer transition-colors">
              Pricing
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/login')} 
            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-2 transition-colors"
          >
            Sign In
          </button>
          <button 
            onClick={() => navigate('/login')} 
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>Get Started</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Main Hero Section ── */}
      <main className="flex-1 w-full px-6 sm:px-12 lg:px-20 pt-16 pb-24 flex flex-col items-center text-center relative z-10 max-w-7xl mx-auto">
        
        {/* Release Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <span className="text-slate-400 font-normal">Indian Regulatory Intelligence</span>
          <span className="text-slate-600">•</span>
          <span className="text-indigo-400 font-semibold">Grounded RAG Pipeline</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-4xl leading-[1.15] mb-6">
          Regulatory compliance and legal research for Indian businesses.
        </h1>

        {/* Hero Subtitle */}
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
          Query official RBI master directions, SEBI circulars, GST notifications, and MCA filings in plain language. Every response is verified with clause-level citations.
        </p>

        {/* Hero Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 justify-center w-full max-w-md mb-16">
          <button 
            onClick={() => navigate('/login')} 
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>Start Free Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button 
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4 text-indigo-400" />
            <span>View Citation Network</span>
          </button>
        </div>

        {/* ── Interactive Product Preview Window (Realistic SaaS Mockup) ── */}
        <div className="w-full max-w-5xl rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden text-left mb-24">
          
          {/* Window Header */}
          <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-700" />
              <div className="w-3 h-3 rounded-full bg-slate-700" />
              <div className="w-3 h-3 rounded-full bg-slate-700" />
              <span className="text-[11px] font-mono text-slate-500 ml-2">app.regiq.in/chat</span>
            </div>

            {/* Interactive Preview Tabs */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[11px]">
              <button 
                onClick={() => setActiveTab('query')}
                className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'query' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
              >
                RAG Query Inspector
              </button>
              <button 
                onClick={() => setActiveTab('citations')}
                className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'citations' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Verified Citations (3)
              </button>
              <button 
                onClick={() => setActiveTab('trace')}
                className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'trace' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
              >
                LangGraph Trace
              </button>
            </div>
          </div>

          {/* Window Body */}
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Simulated User Question */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
                U
              </div>
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl px-4 py-2.5 max-w-xl text-xs text-slate-200">
                What is the threshold limit for mandatory GST registration for goods suppliers in Maharashtra, and what are the invoicing compliance requirements?
              </div>
            </div>

            {/* Simulated RegIQ AI Response */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                R
              </div>
              <div className="space-y-4 flex-1">
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-3.5 text-xs leading-relaxed text-slate-300">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      Grounded • 98.4% Confidence
                    </span>
                    <span className="text-slate-500 text-[11px]">•</span>
                    <span className="text-[11px] text-slate-400 font-mono">Corpus: GST (CBIC Portal)</span>
                  </div>

                  <p>
                    Under <strong>Section 22(1) of the Central Goods and Services Tax (CGST) Act, 2017</strong> read with <strong>Notification No. 10/2019 – Central Tax</strong>:
                  </p>

                  <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                    <li>
                      <strong>Threshold Limit:</strong> For businesses engaged exclusively in the intra-state supply of goods in Maharashtra (a normal category state), the aggregate turnover threshold for mandatory registration is <strong>₹40 Lakhs</strong> in a financial year.
                    </li>
                    <li>
                      <strong>Service Providers:</strong> If your entity supplies taxable services or mixed supplies, the threshold remains <strong>₹20 Lakhs</strong>.
                    </li>
                    <li>
                      <strong>E-Invoicing Applicability:</strong> If your aggregate annual turnover exceeds ₹5 Crores in any preceding fiscal year, generating e-invoices with an IRN (Invoice Reference Number) via the IRP portal is mandatory.
                    </li>
                  </ul>
                </div>

                {/* Citation Cards Strip */}
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center gap-2 text-slate-300 hover:border-slate-700 transition-colors cursor-pointer">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Notification No. 10/2019-CT</span>
                    <span className="text-slate-500 text-[10px] font-mono">p. 2</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center gap-2 text-slate-300 hover:border-slate-700 transition-colors cursor-pointer">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>CGST Act 2017, Sec 22</span>
                    <span className="text-slate-500 text-[10px] font-mono">cl. 1</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center gap-2 text-slate-300 hover:border-slate-700 transition-colors cursor-pointer">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Circular No. 160/16/2021-GST</span>
                    <span className="text-slate-500 text-[10px] font-mono">p. 4</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Monitored Corpora Strip ── */}
        <div id="corpora" className="w-full pt-6 pb-20 border-t border-slate-800/80">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-6">
            Monitored Statutory Regulatory Frameworks
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 text-xs text-left">
            {[
              { code: 'RBI', title: 'Reserve Bank of India', desc: 'Master Directions, NBFC & Digital Lending' },
              { code: 'SEBI', title: 'Securities & Exchange', desc: 'Listing Regulations, Insider Trading & ICDR' },
              { code: 'MCA', title: 'Corporate Affairs', desc: 'Companies Act 2013, LLP Rules & Annual Returns' },
              { code: 'GST', title: 'Goods & Services Tax', desc: 'CBIC Notifications, Circulars & Rate Schedules' },
              { code: 'FEMA', title: 'Foreign Exchange', desc: 'FDI Regulations, Inbound Capital & Compounding' },
            ].map((c) => (
              <div key={c.code} className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-1">
                <div className="font-bold text-slate-200 font-mono text-sm">{c.code}</div>
                <div className="text-xs text-slate-400 font-medium">{c.title}</div>
                <div className="text-[11px] text-slate-500 leading-snug">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Core Platform Features (Enterprise Grid) ── */}
        <div id="platform" className="w-full pt-10 pb-20 text-left space-y-12">
          <div className="max-w-xl space-y-2">
            <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider">
              Platform Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Engineered for compliance teams, chartered accountants, and founders.
            </h2>
            <p className="text-xs text-slate-400">
              A single authoritative platform replacing manual PDF searches across disjointed government portals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Clause-Level Citations</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every generated statement links to the exact circular number, clause, publication date, and official CBIC/RBI portal source. Zero hallucinations.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Share2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">D3 Citation Network</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Interactive force-directed graph mapping 1,400+ regulatory circulars and their citation dependencies across Indian financial jurisprudence.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Statutory Filing Calendar</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automated statutory deadlines for GSTR-1, GSTR-3B, MCA Form 11, and RBI FLA returns, complete with penalty clauses and one-click RAG analysis.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">LangGraph Stateful Routing</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multi-corpus classification with automated conditional retry loops, ensuring cross-regulatory inquiries retrieve the highest-scoring candidate documents.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Corporate Risk Scorecard</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculates real-time compliance health across 4 regulatory axes based on your corporate constitution, operational sector, and turnover.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Enterprise Blended RAG</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload internal board resolutions, contracts, or tax notices to query custom documents alongside statutory Indian regulatory databases.
              </p>
            </div>

          </div>
        </div>

        {/* ── Architecture Pipeline Summary ── */}
        <div id="architecture" className="w-full pt-10 pb-20 border-t border-slate-800/80 text-left">
          <div className="max-w-xl space-y-2 mb-10">
            <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider">
              Technical Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Verified end-to-end retrieval architecture.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-mono text-indigo-400 font-bold">01 / INGESTION</div>
              <h4 className="font-bold text-white">Automated Gazette Scraping</h4>
              <p className="text-slate-400 leading-relaxed">Weekly cron jobs ingest official PDFs from rbi.org.in, cbic.gov.in, and mca.gov.in.</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-mono text-indigo-400 font-bold">02 / EMBEDDING</div>
              <h4 className="font-bold text-white">ChromaDB Vector Store</h4>
              <p className="text-slate-400 leading-relaxed">15,900+ chunks embedded using all-MiniLM-L6-v2 across isolated namespace collections.</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-mono text-indigo-400 font-bold">03 / RERANKING</div>
              <h4 className="font-bold text-white">Cross-Encoder Re-ranker</h4>
              <p className="text-slate-400 leading-relaxed">ms-marco-MiniLM reranks top-10 candidate chunks down to top-5 high-relevance citations.</p>
            </div>
            <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/80 space-y-2">
              <div className="text-[11px] font-mono text-indigo-400 font-bold">04 / GENERATION</div>
              <h4 className="font-bold text-white">Conversational Retrieval</h4>
              <p className="text-slate-400 leading-relaxed">LangChain ConversationalRetrievalChain formats answers with strict zero-hallucination rules.</p>
            </div>
          </div>
        </div>

        {/* ── Final Call to Action ── */}
        <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-800 p-10 lg:p-14 text-center space-y-6 shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Start automating compliance research today.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Free tier includes 20 daily queries across GST, RBI, SEBI, and MCA. No credit card required.
          </p>
          <button 
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-sm inline-flex items-center gap-2"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-slate-800/80 px-6 sm:px-12 lg:px-20 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 bg-[#090d16]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-300">RegIQ</span>
          <span>•</span>
          <span>© {new Date().getFullYear()} Regulatory Intelligence System. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px]">
          <span>FastAPI</span>
          <span>•</span>
          <span>ChromaDB</span>
          <span>•</span>
          <span>LangGraph</span>
          <span>•</span>
          <span>D3.js</span>
        </div>
      </footer>
    </div>
  );
}