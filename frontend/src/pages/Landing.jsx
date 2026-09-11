import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  Search, 
  Share2, 
  FileText, 
  Bell, 
  Layers, 
  CheckCircle2, 
  Sparkles,
  TrendingUp,
  Lock,
  ChevronRight,
  Compass,
  Cpu
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const handleCTA = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-100 font-sans flex flex-col antialiased relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* ── Ambient Background Glows ── */}
      <div className="absolute top-0 left-1/3 w-[800px] h-[600px] bg-gradient-to-tr from-cyan-500/15 via-indigo-600/10 to-transparent rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse-glow" />
      <div className="absolute top-1/2 right-10 w-[650px] h-[650px] bg-purple-600/10 rounded-full blur-[180px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* ── Top Navbar ── */}
      <header className="w-full border-b border-slate-800/80 backdrop-blur-2xl bg-slate-950/70 px-6 sm:px-12 lg:px-20 py-4 flex items-center justify-between sticky top-0 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-10">
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-[0_0_20px_rgba(56,189,248,0.4)] group-hover:shadow-[0_0_30px_rgba(56,189,248,0.7)] transition-all">
              V
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
                RegIQ
              </span>
              <span className="text-[10px] text-cyan-400 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono uppercase tracking-widest bg-cyan-950/40">
                Matrix
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-400 tracking-wide">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#corpora" className="hover:text-white transition-colors">Monitored Corpora</a>
            <span onClick={() => navigate('/login')} className="hover:text-white cursor-pointer transition-colors">Citation Explorer</span>
            <span onClick={() => navigate('/login')} className="hover:text-cyan-400 text-cyan-400/90 cursor-pointer transition-colors flex items-center gap-1 font-bold">
              <span>💳</span> Pricing Plans
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/login')} 
            className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2 transition-colors"
          >
            Sign In
          </button>
          <button 
            onClick={handleCTA} 
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(56,189,248,0.35)] hover:shadow-[0_0_30px_rgba(56,189,248,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95"
          >
            Get Started Free
          </button>
        </div>
      </header>

      {/* ── Hero Section (Full Screen Desktop Canvas) ── */}
      <main className="flex-1 w-full px-6 sm:px-12 lg:px-20 py-16 lg:py-24 flex flex-col items-center justify-center text-center relative z-10">
        
        {/* Grounded Engine Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/50 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-semibold tracking-wide uppercase mb-8 shadow-[0_0_25px_rgba(99,102,241,0.2)] animate-pulse">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Grounded Financial Regulation Q&A Engine — Zero Hallucination</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-white max-w-5xl leading-[1.1] mb-6">
          Automate Indian SME Compliance with{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
            Zero Hallucination
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-sm sm:text-base lg:text-lg text-slate-300/90 max-w-3xl leading-relaxed mb-10 font-normal">
          Instant plain-language and statutory answers across <strong className="text-white">GST, RBI, SEBI, MCA, and FEMA</strong> regulations. 
          Every answer hyperlinked directly to official circular numbers, statutory clauses, and gazette notifications.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center w-full max-w-md mb-16">
          <button 
            onClick={handleCTA} 
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-[0_0_30px_rgba(56,189,248,0.4)] hover:shadow-[0_0_40px_rgba(56,189,248,0.6)] transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2.5 group"
          >
            <Sparkles className="w-4 h-4 text-cyan-200" />
            <span>Try Free Workspace</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <button 
            onClick={() => {
              const el = document.getElementById('features');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/40 text-slate-200 text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Explore Features</span>
          </button>
        </div>

        {/* Monitored Corpora Bar */}
        <div id="corpora" className="w-full max-w-4xl pt-8 border-t border-slate-800/80">
          <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest font-bold mb-4">
            COMPREHENSIVE MULTI-CORPUS RETRIEVAL ARCHITECTURE
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-semibold">
            {[
              { label: 'GST Portal & CBIC', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20' },
              { label: 'RBI Master Directions', color: 'text-sky-400 border-sky-500/30 bg-sky-950/20' },
              { label: 'SEBI Circulars', color: 'text-purple-400 border-purple-500/30 bg-purple-950/20' },
              { label: 'MCA Companies Act', color: 'text-amber-400 border-amber-500/30 bg-amber-950/20' },
              { label: 'FEMA Inflows', color: 'text-pink-400 border-pink-500/30 bg-pink-950/20' },
            ].map((item, i) => (
              <div key={i} className={`p-2.5 rounded-xl border ${item.color} flex items-center justify-center gap-1.5`}>
                <span>•</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Key Metrics Scorecard Bar ── */}
        <div className="w-full max-w-6xl mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { metric: "15,984+", label: "Verified Regulatory Chunks", icon: Layers, color: "text-cyan-400" },
            { metric: "1,432", label: "Topological Circular Nodes", icon: Share2, color: "text-indigo-400" },
            { metric: "0.0%", label: "Strict Grounded Hallucination", icon: ShieldCheck, color: "text-emerald-400" },
            { metric: "< 850ms", label: "LangGraph Pipeline Latency", icon: Cpu, color: "text-amber-400" }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="p-6 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 text-left shadow-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-2xl lg:text-3xl font-black font-mono ${stat.color}`}>{stat.metric}</span>
                  <Icon className={`w-5 h-5 ${stat.color} opacity-80`} />
                </div>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* ── Features Grid (Full Width Responsive Grid) ── */}
        <div id="features" className="w-full max-w-6xl mt-24 text-left space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
            <span className="text-xs font-mono font-bold text-cyan-400 tracking-widest uppercase">
              STATE-OF-THE-ART RAG PIPELINE
            </span>
            <h2 className="text-3xl font-black text-white tracking-tight">
              Enterprise Compliance Features Built for Indian Founders
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Eliminate expensive legal consultation for routine questions while remaining 100% compliant with statutory deadlines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 hover:border-cyan-500/40 transition-all duration-300 shadow-xl group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                Grounded Source Citations
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every response strictly cites verified database chunks. Click any citation to inspect circular numbers, issuing authorities, clauses, and gazette links instantly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 hover:border-indigo-500/40 transition-all duration-300 shadow-xl group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                Compliance Risk Scorecard
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatically monitors your company parameters (constitution, turnover, FDI status) and generates real-time Red / Amber / Green health indicators.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 hover:border-purple-500/40 transition-all duration-300 shadow-xl group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                D3 Citation Graph Explorer
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Interactive topological force-directed citation network mapping 1,400+ regulatory circulars and cross-statutory citations across Indian law.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 hover:border-emerald-500/40 transition-all duration-300 shadow-xl group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                Automated Filing Calendar
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Personalized statutory deadlines for GSTR-1, GSTR-3B, MCA Form 11, and RBI FLA returns with integrated one-click RAG penalty analysis.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 hover:border-amber-500/40 transition-all duration-300 shadow-xl group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                LangGraph State Pipeline
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Intelligent query routing with automated fallback retries when confidence is low, slashing not-found errors across multi-corpus inquiries.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 hover:border-pink-500/40 transition-all duration-300 shadow-xl group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-pink-300 transition-colors">
                Conversation Memory
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ask natural follow-up questions like "What about for Maharashtra specifically?" and the LLM retains all preceding circular context.
              </p>
            </div>

          </div>
        </div>

        {/* ── Final Call to Action Banner ── */}
        <div className="w-full max-w-5xl mt-24 p-10 lg:p-14 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-purple-950/40 border border-cyan-500/30 backdrop-blur-2xl text-center space-y-6 shadow-[0_0_50px_rgba(56,189,248,0.15)] relative overflow-hidden">
          <div className="space-y-2">
            <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
              Ready to Upgrade Your Corporate Compliance?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
              Join Indian founders, CAs, and compliance teams navigating RBI, SEBI, MCA, GST, and FEMA with confidence.
            </p>
          </div>
          <button 
            onClick={handleCTA}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all transform hover:-translate-y-0.5 active:scale-95 inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-cyan-200" />
            <span>Launch Free RegIQ Matrix</span>
          </button>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-slate-800/80 px-6 sm:px-12 lg:px-20 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 bg-slate-950/60 backdrop-blur-xl">
        <p>&copy; {new Date().getFullYear()} RegIQ Regulatory Matrix. Designed for Indian SME corporate parameters.</p>
        <div className="flex items-center gap-6 font-mono text-[11px]">
          <span>FastAPI + ChromaDB</span>
          <span>•</span>
          <span>Groq + LangGraph</span>
          <span>•</span>
          <span>D3.js Visualization</span>
        </div>
      </footer>
    </div>
  );
}