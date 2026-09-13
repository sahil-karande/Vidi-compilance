import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackgroundOrbs from '../components/BackgroundOrbs';
import IntroSplash from '../components/IntroSplash';
import RevealOnScroll from '../components/RevealOnScroll';
import { 
  ShieldCheck, 
  ArrowRight, 
  Search, 
  Share2, 
  FileText, 
  Layers, 
  CheckCircle2, 
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  Activity,
  Check,
  Zap,
  Sparkles,
  RotateCw
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(true);
  const [heroEntered, setHeroEntered] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [activeTab, setActiveTab] = useState('query');
  const [flippedCards, setFlippedCards] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [copiedLink, setCopiedLink] = useState(false);

  // High-performance scroll tracking for smooth hero fade-out on scroll down
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Ensure hero enters if intro splash is skipped or unmounted
  useEffect(() => {
    if (!showIntro && !heroEntered) {
      setHeroEntered(true);
    }
  }, [showIntro, heroEntered]);

  // Dynamic scroll opacity & translation for Hero Header
  // Starts at 1, fades smoothly to 0 as user scrolls down to ~260px, floats gently upward
  const heroHeaderOpacity = Math.max(0, Math.min(1, 1 - scrollY / 260));
  const heroHeaderTranslateY = -Math.min(50, scrollY * 0.25);

  const toggleCardFlip = (code) => {
    setFlippedCards(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  // eslint-disable-next-line no-unused-vars
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#0D0E12] text-slate-200 font-sans flex flex-col antialiased selection:bg-purple-500/20 selection:text-purple-200 overflow-x-hidden relative">
      
      {/* ── Cinematic Opening Animation Sequence ── */}
      {showIntro && (
        <IntroSplash 
          onStartDissolve={() => setHeroEntered(true)}
          onComplete={() => {
            setShowIntro(false);
            setHeroEntered(true);
          }} 
        />
      )}

      {/* ── 3 Big Animated Floating Purple Circles with Intensity Pulses & Fade ── */}
      <BackgroundOrbs />

      {/* ── Top Navigation Bar (Exact NoteDeck style) ── */}
      <header className="w-full border-b border-white/10 bg-[#0D0E12]/80 backdrop-blur-md px-6 sm:px-12 lg:px-20 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2.5 select-none cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img 
              src="/vidi_icon_only.png" 
              alt="Vidi Logo" 
              className="w-7 h-7 rounded-lg object-contain shadow-sm" 
            />
            <span className="text-lg font-bold tracking-tight text-white">Vidi</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#features" className="hover:text-slate-200 transition-colors">Features</a>
            <a href="#workflow" className="hover:text-slate-200 transition-colors">How it works</a>
            <a href="#corpora" className="hover:text-slate-200 transition-colors">Monitored acts</a>
            <a href="#pricing" className="hover:text-slate-200 transition-colors">Pricing</a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/login')} 
            className="text-sm font-medium text-slate-300 hover:text-white px-4 py-2 rounded-lg bg-slate-900 border border-white/10 hover:bg-slate-800 transition-all"
          >
            Sign In
          </button>
          <button 
            onClick={() => navigate('/login')} 
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-950 text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>Get Started</span>
          </button>
        </div>
      </header>

      {/* ── Main Hero Section (Exact NoteDeck style) ── */}
      <main className="flex-1 w-full px-6 sm:px-12 lg:px-20 pt-20 pb-28 flex flex-col items-center text-center relative z-10 max-w-6xl mx-auto">
        
        {/* ── Hero Header (Pill, Title, Subtitle, CTAs) with scroll fade-out & entrance animation ── */}
        <div 
          style={{
            opacity: heroHeaderOpacity,
            transform: `translateY(${heroHeaderTranslateY}px)`,
            pointerEvents: heroHeaderOpacity < 0.05 ? 'none' : 'auto',
            willChange: 'opacity, transform',
          }}
          className="flex flex-col items-center text-center w-full transition-opacity duration-150"
        >
          {/* Release Tag Pill */}
          <RevealOnScroll delay={60} direction="down" enabled={heroEntered}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#181820] border border-white/10 text-slate-300 text-xs font-medium mb-8 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-slate-400 font-normal">Grounded Indian Legaltech</span>
              <span className="text-slate-600">•</span>
              <span className="text-purple-300 font-semibold">Zero Hallucination RAG</span>
            </div>
          </RevealOnScroll>

          {/* Hero Title (NoteDeck typography) */}
          <RevealOnScroll delay={180} enabled={heroEntered}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.08] mb-6">
              Indian compliance,<br />
              now intelligent.
            </h1>
          </RevealOnScroll>

          {/* Hero Subtitle */}
          <RevealOnScroll delay={300} enabled={heroEntered}>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
              Vidi instantly transforms complex statutory circulars across GST, RBI, SEBI, and MCA into plain-language answers verified with clause-level citations.
            </p>
          </RevealOnScroll>

          {/* Hero Action Buttons */}
          <RevealOnScroll delay={420} enabled={heroEntered}>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center w-full max-w-md mb-12">
              <button 
                onClick={() => navigate('/login')} 
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#181820] hover:bg-[#20202c] border border-white/15 text-white font-semibold text-sm transition-all duration-300 shadow-lg hover:border-purple-500/40 hover:shadow-[0_0_25px_rgba(168,85,247,0.2)] hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <span>Start Learning Smarter</span>
                <ArrowRight className="w-4 h-4 text-purple-400" />
              </button>

              <button 
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-semibold text-sm transition-all duration-300 hover:scale-[1.02] shadow-sm flex items-center justify-center gap-2"
              >
                <span>Try as Guest</span>
              </button>
            </div>
          </RevealOnScroll>
        </div>

        {/* ── Interactive Product Preview Window (NoteDeck Dark Card Style) ── */}
        <RevealOnScroll delay={540} duration={850} enabled={heroEntered} className="w-full max-w-5xl mb-14">
          <div className="w-full rounded-2xl bg-[#13131A] border border-white/10 shadow-2xl overflow-hidden text-left">
            
            {/* Window Header */}
            <div className="px-5 py-3.5 border-b border-white/10 bg-[#0E0F14] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span className="text-[11px] font-mono text-slate-400 ml-2">app.regiq.in/research</span>
              </div>

              {/* Interactive Preview Tabs */}
              <div className="hidden sm:flex items-center gap-1 bg-[#181822] p-1 rounded-lg border border-white/10 text-xs">
                <button 
                  onClick={() => setActiveTab('query')}
                  className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'query' ? 'bg-[#252535] text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  RAG Inspector
                </button>
                <button 
                  onClick={() => setActiveTab('citations')}
                  className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'citations' ? 'bg-[#252535] text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Verified Citations (3)
                </button>
                <button 
                  onClick={() => setActiveTab('trace')}
                  className={`px-3 py-1 rounded-md transition-colors ${activeTab === 'trace' ? 'bg-[#252535] text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  LangGraph State
                </button>
              </div>
            </div>

            {/* Window Body */}
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* Simulated User Question */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
                  U
                </div>
                <div className="bg-[#181820] border border-white/10 rounded-xl px-4 py-3 max-w-xl text-xs text-slate-200 leading-relaxed">
                  What is the threshold limit for mandatory GST registration for goods suppliers in Maharashtra, and what are the invoicing compliance requirements?
                </div>
              </div>

              {/* Simulated AI Response */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-semibold text-white shrink-0 shadow-md">
                  R
                </div>
                <div className="space-y-4 flex-1">
                  <div className="bg-[#16161F] border border-white/10 rounded-xl p-5 space-y-3 text-xs leading-relaxed text-slate-300">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                        Grounded • 98.4% Confidence
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[11px] text-slate-400 font-mono">Corpus: GST (CBIC Master Portal)</span>
                    </div>

                    <p>
                      Under <strong>Section 22(1) of the Central Goods and Services Tax (CGST) Act, 2017</strong> read with <strong>Notification No. 10/2019 – Central Tax</strong>:
                    </p>

                    <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                      <li>
                        <strong>Threshold Limit:</strong> For businesses engaged exclusively in the intra-state supply of goods in Maharashtra (normal category state), the aggregate turnover threshold for mandatory registration is <strong>₹40 Lakhs</strong> in a financial year.
                      </li>
                      <li>
                        <strong>Service Providers:</strong> If your entity supplies taxable services or mixed supplies, the threshold remains <strong>₹20 Lakhs</strong>.
                      </li>
                      <li>
                        <strong>E-Invoicing Applicability:</strong> If your aggregate annual turnover exceeds ₹5 Crores in any preceding fiscal year, generating e-invoices with an IRN (Invoice Reference Number) is mandatory.
                      </li>
                    </ul>
                  </div>

                  {/* Citation Cards Strip */}
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <div className="px-3 py-1.5 rounded-lg bg-[#181820] border border-white/10 text-[11px] flex items-center gap-2 text-slate-300 hover:border-white/20 transition-colors cursor-pointer">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Notification No. 10/2019-CT</span>
                      <span className="text-slate-500 text-[10px] font-mono">p. 2</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#181820] border border-white/10 text-[11px] flex items-center gap-2 text-slate-300 hover:border-white/20 transition-colors cursor-pointer">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>CGST Act 2017, Sec 22</span>
                      <span className="text-slate-500 text-[10px] font-mono">cl. 1</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#181820] border border-white/10 text-[11px] flex items-center gap-2 text-slate-300 hover:border-white/20 transition-colors cursor-pointer">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Circular No. 160/16/2021-GST</span>
                      <span className="text-slate-500 text-[10px] font-mono">p. 4</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          </RevealOnScroll>

        {/* ── Features Section (Exact NoteDeck style cards with hover lift) ── */}
        <div id="features" className="w-full pt-2 pb-20 text-left space-y-12">
          <RevealOnScroll delay={50}>
            <div className="max-w-xl space-y-2">
              <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
                Platform Features
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Instant AI answers, zero hallucination.
              </h2>
              <p className="text-sm text-slate-400">
                From dense 60-page RBI master directions to weekly CBIC gazettes, our pipeline extracts the key clauses and builds your audit trail in seconds.
              </p>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <RevealOnScroll delay={50}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 space-y-3 group h-full">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-2">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Clause-Level Citations</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every generated statement links directly to official circular numbers, statutory clauses, gazette publication dates, and government portal URLs.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={150}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 space-y-3 group h-full">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-2">
                  <Share2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Citation Graph Network</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Interactive D3 force-directed topological graph mapping 1,400+ regulatory circulars and cross-statutory citations across Indian financial jurisprudence.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={250}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 space-y-3 group h-full">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-2">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Filing Obligations Calendar</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automated statutory deadlines for GSTR-1, GSTR-3B, MCA Form 11, and RBI FLA returns, complete with penalty clauses and one-click RAG analysis.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={100}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 space-y-3 group h-full">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-2">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">LangGraph Routing</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Multi-corpus classification with automated conditional retry loops, ensuring cross-regulatory inquiries retrieve the highest-scoring candidate documents.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={200}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 space-y-3 group h-full">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-2">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Corporate Risk Scorecard</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Calculates real-time compliance health across 4 regulatory axes based on your corporate constitution, operational sector, and turnover.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={300}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 space-y-3 group h-full">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-2">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Private Document Ingestion</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Blend your internal company agreements, tax notices, and board resolutions with official statutory Indian regulatory databases.
                </p>
              </div>
            </RevealOnScroll>

          </div>
        </div>

        {/* ── Workflow Section (Exact NoteDeck style: 1. Upload, 2. Generate, 3. Master) ── */}
        <div id="workflow" className="w-full pt-10 pb-24 border-t border-white/10 text-left space-y-12">
          <RevealOnScroll delay={50}>
            <div className="max-w-xl space-y-2">
              <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
                How It Works
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                A frictionless workflow.
              </h2>
              <p className="text-sm text-slate-400">
                Get grounded answers with verifiable official citations in three simple steps.
              </p>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <RevealOnScroll delay={50}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 space-y-3 h-full hover-lift">
                <div className="text-3xl font-extrabold text-white font-mono">01</div>
                <h3 className="text-lg font-bold text-white">Specify Your Query</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask about compliance rules, thresholds, penalties, or filing dates in simple plain language.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={150}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 space-y-3 h-full hover-lift">
                <div className="text-3xl font-extrabold text-white font-mono">02</div>
                <h3 className="text-lg font-bold text-white">Multi-Corpus Retrieval</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Our pipeline searches isolated ChromaDB vector stores across RBI, SEBI, GST, MCA, and FEMA.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={250}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 space-y-3 h-full hover-lift">
                <div className="text-3xl font-extrabold text-white font-mono">03</div>
                <h3 className="text-lg font-bold text-white">Verified Ground Truth</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Receive answers with clause-level citations, direct government source links, and PDF audit exports.
                </p>
              </div>
            </RevealOnScroll>
          </div>
        </div>

        {/* ── Monitored Corpora Strip: Interactive 3D Flip Flashcards ── */}
        <div id="corpora" className="w-full pt-10 pb-24 border-t border-white/10 text-left space-y-8">
          <RevealOnScroll delay={50}>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="max-w-xl space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
                    Interactive Flashcards
                  </span>
                  <span className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full font-mono">
                    Click card to flip
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Monitored Indian statutory frameworks.
                </h2>
              </div>

              {/* Quick Actions: Flip All / Reset */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allFlipped = { RBI: true, SEBI: true, MCA: true, GST: true, FEMA: true };
                    setFlippedCards(allFlipped);
                  }}
                  className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-[#13131A] transition-colors"
                >
                  Flip all
                </button>
                <button
                  type="button"
                  onClick={() => setFlippedCards({})}
                  className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-[#13131A] transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                code: 'RBI',
                category: 'Banking & Fintech',
                title: 'Reserve Bank of India',
                desc: 'Master Directions, NBFC & Digital Lending Guidelines',
                act: 'RBI Act 1934',
                circulars: '520+ Circulars'
              },
              {
                code: 'SEBI',
                category: 'Securities Market',
                title: 'Securities & Exchange',
                desc: 'LODR Reg. 30, PIT & ICDR Material Disclosures',
                act: 'SEBI Act 1992',
                circulars: '380+ Circulars'
              },
              {
                code: 'MCA',
                category: 'Corporate Law',
                title: 'Corporate Affairs',
                desc: 'Companies Act 2013, LLP Rules & Annual Returns',
                act: 'Companies Act 2013',
                circulars: '640+ Circulars'
              },
              {
                code: 'GST',
                category: 'Indirect Taxation',
                title: 'Goods & Services Tax',
                desc: 'CBIC Notifications, Rule 42/43 ITC & Schedules',
                act: 'CGST Act 2017',
                circulars: '750+ Circulars'
              },
              {
                code: 'FEMA',
                category: 'Cross-Border FX',
                title: 'Foreign Exchange',
                desc: 'FDI Regulations, Inbound Capital & Compounding',
                act: 'FEMA 1999',
                circulars: '180+ Circulars'
              },
            ].map((c, idx) => {
              const isFlipped = !!flippedCards[c.code];
              return (
                <RevealOnScroll key={c.code} delay={idx * 80} className="h-full">
                  <div
                    onClick={() => toggleCardFlip(c.code)}
                    className="group perspective-1000 h-72 cursor-pointer select-none"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCardFlip(c.code);
                      }
                    }}
                    title={`Click to flip ${c.code} card`}
                  >
                    <div
                      className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                        isFlipped ? 'rotate-y-180' : ''
                      }`}
                    >
                      {/* ── Front Face: Acronym Flashcard ── */}
                      <div className="absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-[#13131A] border border-white/10 p-5 flex flex-col justify-between group-hover:border-purple-500/40 group-hover:shadow-[0_0_25px_rgba(168,85,247,0.12)] transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                            {c.category}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-purple-300 transition-colors">
                            <RotateCw className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-180" />
                            <span className="text-[10px]">Flip</span>
                          </div>
                        </div>

                        <div className="space-y-1 my-auto text-center py-2">
                          <div className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-white group-hover:text-purple-200 transition-colors">
                            {c.code}
                          </div>
                          <div className="text-xs font-semibold text-slate-300">
                            {c.title}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[11px] text-slate-500">
                          <span className="font-mono text-[10px]">{c.act}</span>
                          <span className="text-purple-400 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                            Click to flip ↺
                          </span>
                        </div>
                      </div>

                      {/* ── Back Face: Framework Details & Clean Dual Actions ── */}
                      <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl bg-[#161622] border border-purple-500/30 p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                        {/* Back Header */}
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-mono font-bold text-white bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded shrink-0">
                            {c.code}
                          </span>
                          <span className="text-xs text-slate-200 font-semibold leading-tight">
                            {c.title}
                          </span>
                        </div>

                        {/* Framework Details */}
                        <div className="space-y-2.5 my-auto py-2 text-left">
                          <div className="text-xs text-slate-300 leading-snug font-normal">
                            {c.desc}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded">
                              {c.act}
                            </span>
                            <span className="text-[10px] font-mono bg-white/5 text-slate-400 border border-white/10 px-2 py-0.5 rounded">
                              {c.circulars}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Action Controls */}
                        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCardFlip(c.code);
                            }}
                            className="flex-1 py-2 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            title="Flip back to acronym"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                            <span>Flip back</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/chat?corpus=${c.code}`);
                            }}
                            className="flex-1 py-2 px-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs transition-all flex items-center justify-center gap-1 shadow-sm active:scale-[0.98] cursor-pointer"
                          >
                            <span>Ask {c.code}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </RevealOnScroll>
              );
            })}
          </div>
        </div>

        {/* ── Pricing Section (Exact NoteDeck style pricing cards) ── */}
        <div id="pricing" className="w-full pt-10 pb-24 border-t border-white/10 text-center space-y-10">
          <RevealOnScroll delay={50}>
            <div className="max-w-xl mx-auto space-y-3">
              <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
                Transparent Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Find the plan that's right for you
              </h2>
              <p className="text-sm text-slate-400">
                Start for free, or unlock unlimited queries and personal document blending.
              </p>

              {/* NoteDeck Capsule Billing Switcher */}
              <div className="inline-flex items-center bg-slate-900 border border-white/10 rounded-full p-1 gap-2 mt-4">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    billingCycle === 'monthly' ? 'bg-white text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    billingCycle === 'yearly' ? 'bg-white text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Yearly</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    Save 25%
                  </span>
                </button>
              </div>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left items-stretch">
            
            {/* Free Plan */}
            <RevealOnScroll delay={50} className="h-full">
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 flex flex-col justify-between space-y-6 hover:-translate-y-1 transition-transform duration-300 h-full">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Free</h3>
                    <p className="text-xs text-slate-400 mt-1">Essential compliance monitoring for local SMEs.</p>
                  </div>
                  <div className="text-3xl font-extrabold text-white">₹0</div>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>20 queries / day allocation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>All 4 core regulatory corpora</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Persistent chat history logs</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Plain / Legal toggle filters</span>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                >
                  Get Started
                </button>
              </div>
            </RevealOnScroll>

            {/* Pro Plan (Featured NoteDeck Style) */}
            <RevealOnScroll delay={150} className="h-full">
              <div className="p-8 rounded-2xl bg-[#161622] border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.25)] flex flex-col justify-between space-y-6 relative hover:-translate-y-1.5 transition-transform duration-300 h-full">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-400 text-slate-950 text-[11px] font-bold px-3 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                  Most Popular
                </span>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Pro</h3>
                    <p className="text-xs text-slate-400 mt-1">Complete automated compliance intelligence for expanding teams.</p>
                  </div>
                  {billingCycle === 'yearly' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-white">₹4,488</span>
                        <span className="text-xs text-slate-400 font-medium">/ year</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          -25% OFF
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-purple-300 font-semibold bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                          ₹374 / month
                        </span>
                        <span className="text-slate-500 line-through">₹5,988</span>
                        <span className="text-emerald-400 font-medium">Save ₹1,500/yr</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white">₹499</span>
                        <span className="text-xs text-slate-400">/ month</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Standard monthly entry lease · ₹5,988/yr
                      </div>
                    </div>
                  )}
                  <ul className="space-y-2.5 text-xs text-slate-200">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Unlimited regulatory queries</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Interactive Compliance Risk Scorecard</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Statutory Compliance Calendar</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Personal doc upload + RAG blending</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Server-side automated PDF exports</span>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors shadow-md"
                >
                  Upgrade to Pro
                </button>
              </div>
            </RevealOnScroll>

            {/* Enterprise Plan */}
            <RevealOnScroll delay={250} className="h-full">
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 flex flex-col justify-between space-y-6 hover:-translate-y-1 transition-transform duration-300 h-full">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Enterprise</h3>
                    <p className="text-xs text-slate-400 mt-1">Dedicated scale parameters, SLAs, and custom on-premise vectors.</p>
                  </div>
                  <div className="text-3xl font-extrabold text-white">Custom</div>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Unlimited runtime access</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Custom ERP / DMS integrations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Dedicated ChromaDB vector nodes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Priority SLA line support</span>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                >
                  Contact Sales
                </button>
              </div>
            </RevealOnScroll>

          </div>
        </div>

        {/* ── Testimonials (Exact NoteDeck style) ── */}
        <div className="w-full pt-10 pb-24 border-t border-white/10 text-left space-y-8">
          <RevealOnScroll delay={50}>
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Don't just take our word for it.
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <RevealOnScroll delay={100}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 space-y-4 hover-lift">
                <p className="text-slate-300 text-sm leading-relaxed italic">
                  "Vidi is our secret weapon for monthly compliance audits. What used to take hours of searching government portals now takes seconds."
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xs">
                    CA
                  </div>
                  <div>
                    <div className="font-semibold text-white">Rajesh Mehta, FCA</div>
                    <div className="text-slate-500 text-[11px]">Senior Tax Partner, Mumbai</div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={200}>
              <div className="p-8 rounded-2xl bg-[#13131A] border border-white/10 space-y-4 hover-lift">
                <p className="text-slate-300 text-sm leading-relaxed italic">
                  "The best regulatory research tool on the market. The quality of the cited circulars and statutory clauses is consistently 100% accurate."
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xs">
                    VP
                  </div>
                  <div>
                    <div className="font-semibold text-white">Ananya Sen</div>
                    <div className="text-slate-500 text-[11px]">VP Compliance, Bengaluru Fintech</div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>

        {/* ── Final Call to Action ── */}
        <RevealOnScroll delay={100}>
          <div className="w-full rounded-2xl bg-[#13131A] border border-white/10 p-12 lg:p-16 text-center space-y-6 shadow-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Start automating compliance research today.
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Free tier includes 20 daily queries across GST, RBI, SEBI, and MCA. No credit card required.
            </p>
            <button 
              onClick={() => navigate('/login')}
              className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-semibold text-sm transition-all shadow-md inline-flex items-center gap-2"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </RevealOnScroll>

      </main>

      {/* ── Footer (Exact NoteDeck style) ── */}
      <footer className="w-full border-t border-white/10 px-6 sm:px-12 lg:px-20 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 bg-[#0A0B0E]">
        <div className="flex items-center gap-2">
          <img 
            src="/vidi_icon_only.png" 
            alt="Vidi Logo" 
            className="w-4 h-4 rounded-sm object-contain" 
          />
          <span className="font-bold text-white text-sm">Vidi</span>
          <span>•</span>
          <span>© {new Date().getFullYear()} Regulatory Intelligence System. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <span onClick={() => navigate('/login')} className="hover:text-white cursor-pointer transition-colors">Sign In</span>
        </div>
      </footer>
    </div>
  );
}