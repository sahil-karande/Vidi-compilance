import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { chatAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ComplianceCalendar from '../components/ComplianceCalendar';
import { 
  Terminal, 
  Activity, 
  MessageSquare, 
  Zap, 
  ChevronRight, 
  Server, 
  Briefcase, 
  Bell,
  Building2,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Share2,
  Sliders,
  Sparkles,
  ArrowUpRight,
  Compass
} from 'lucide-react';

// Lazy Load the Risk Scorecard
const RiskScorecard = lazy(() => import('../components/RiskScorecard'));

function SkeletonCard() {
  return (
    <div className="w-full bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-slate-800 rounded w-1/3 shadow-[0_0_10px_rgba(51,65,85,0.5)]"></div>
        <div className="h-6 bg-slate-800 rounded-full w-12"></div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-800 rounded w-full"></div>
        <div className="h-3 bg-cyan-950/40 rounded w-5/6"></div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { user, refreshUserSession, updateUserProfile } = useAuth() || {}; 
  const userRole = user?.role || 'free'; 
  const isLocked = userRole === 'free' || userRole === 'guest';

  const [showProfileForm, setShowProfileForm] = useState(!user?.business_profile);
  const [formData, setFormData] = useState({
    business_type: user?.business_profile?.business_type || "Private Limited",
    industry: user?.business_profile?.industry || "Fintech",
    turnover_range: user?.business_profile?.turnover_range || "₹1Cr - ₹5Cr",
    has_foreign_funding: user?.business_profile?.has_foreign_funding || "No",
    gst_registered: user?.business_profile?.gst_registered || "Yes"
  });

  const [scorecard, setScorecard] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [recentThreads, setRecentThreads] = useState([]);
  const [queryUsage, setQueryUsage] = useState({ used: 0, max: 20 });
  const [unreadAlerts, setUnreadAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isClearingAlert, setIsClearingAlert] = useState(false);

  // Drill-down modal state
  const [drillDownCategory, setDrillDownCategory] = useState(null);
  const [drillDownChecks, setDrillDownChecks] = useState([]);

  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Active';
    try {
      const diffMs = new Date() - new Date(isoString);
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Active';
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('checkout') === 'success') {
      if (refreshUserSession) {
        refreshUserSession();
      } else {
        window.location.reload();
      }
    }
  }, [location, refreshUserSession]);

  useEffect(() => {
    if (showProfileForm) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadDashboardData() {
      try {
        setIsLoading(true);
        setError(null);
        
        let scorecardData = null;
        let calendarData = [];
        let threadsData = [];
        let activeAlerts = [];

        const baselineFallback = {
          overall_health: "81% - Stable Active Posture",
          scores: {
            gst: { percentage: 85, status: 'GREEN', checks: [] },
            rbi: { percentage: 70, status: 'AMBER', checks: [] },
            sebi: { percentage: 90, status: 'GREEN', checks: [] },
            mca: { percentage: 45, status: 'RED', checks: [] } 
          }
        };

        const activePayload = user?.business_profile || formData;

        try {
          activeAlerts = await chatAPI.getUnreadAlerts().catch(() => []);
        } catch (alertErr) {
          console.error("Failed to parse runtime pipeline alert updates:", alertErr);
        }

        if (!isLocked) {
          try {
            const [sc, cal, th] = await Promise.all([
              chatAPI.getScorecard(activePayload).catch(() => null),
              chatAPI.getCalendarDeadlines().catch(() => []),
              chatAPI.getThreads().catch(() => [])
            ]);
            
            scorecardData = sc || baselineFallback;
            calendarData = cal || [];
            threadsData = th || [];
          } catch (apiErr) {
            console.warn("API parsing skipped. Rolling back onto fallback defaults:", apiErr);
            scorecardData = baselineFallback;
          }
        } else {
          scorecardData = baselineFallback;
          const [cal, th] = await Promise.all([
            chatAPI.getCalendarDeadlines().catch(() => []),
            chatAPI.getThreads().catch(() => [])
          ]);
          calendarData = cal || [];
          threadsData = th || [];
        }
        
        if (isMounted) {
          setScorecard(scorecardData);
          setDeadlines(calendarData);
          setRecentThreads(threadsData.slice(0, 5));
          setUnreadAlerts(activeAlerts);
          setQueryUsage({ used: userRole === 'pro' ? 142 : 12, max: userRole === 'pro' ? 500 : 20 });
        }
      } catch (err) {
        console.error("Dashboard mount execution failed:", err);
        if (isMounted) setError("Failed to synchronize component maps with active database vectors.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboardData();
    return () => { isMounted = false; };
  }, [isLocked, userRole, showProfileForm, user?.business_profile, formData]);

  const handleProfileSubmit = async (e) => {
    e?.preventDefault();
    setIsSubmittingProfile(true);
    try {
      if (updateUserProfile) {
        await updateUserProfile({ business_profile: formData });
      }
      setShowProfileForm(false);
    } catch (err) {
      console.error("Failed to commit profile vectors:", err);
      setError("Failed to save corporate parameters profile mapping.");
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleAcknowledgeCorpusAlerts = async (corpusName) => {
    const alertIdsToClear = unreadAlerts
      .filter((a) => a.corpus.toLowerCase() === corpusName.toLowerCase())
      .map((a) => a.id);

    if (alertIdsToClear.length === 0) return;

    setIsClearingAlert(true);
    try {
      await chatAPI.acknowledgeAlerts({ alert_ids: alertIdsToClear });
      setUnreadAlerts((prev) => prev.filter((a) => a.corpus.toLowerCase() !== corpusName.toLowerCase()));
    } catch (err) {
      console.error(`Failed to dismiss notification vectors for ${corpusName}:`, err);
    } finally {
      setIsClearingAlert(false);
    }
  };

  const handleAnalyzeDeadline = (item) => {
    const predefinedQuery = `What are my exact compliance requirements and penalties for missing the ${item.authority} deadline: ${item.title}?`;
    navigate('/chat', { state: { initialQuery: predefinedQuery } });
  };

  const handleOpenDrillDown = (category, checks) => {
    setDrillDownCategory(category.toUpperCase());
    setDrillDownChecks(checks || []);
  };

  const checkHasActiveAlert = (corpusName) => unreadAlerts.some((a) => a.corpus.toLowerCase() === corpusName.toLowerCase());

  // Business types list
  const CONSTITUTIONS = [
    { id: "Private Limited", label: "Private Limited", desc: "Companies Act 2013, MCA Filings & Board Audits", icon: Building2 },
    { id: "LLP", label: "Limited Liability (LLP)", desc: "LLP Act 2008, Form 11 & Annual Partners Filing", icon: Briefcase },
    { id: "Partnership", label: "Partnership Firm", desc: "Partnership Act 1932, State Registrar & Tax Matrix", icon: Sliders },
    { id: "Proprietorship", label: "Sole Proprietorship", desc: "Individual MSME Registration & Direct Compliance", icon: ShieldCheck }
  ];

  // Industry sectors
  const INDUSTRIES = [
    "Fintech", "SaaS / Tech Services", "Manufacturing", "E-commerce", "Healthcare & Pharma", "Logistics & Supply Chain"
  ];

  // Turnover tiers
  const TURNOVER_TIERS = [
    { id: "Under ₹20 Lakhs", label: "Under ₹20 Lakhs", note: "Below standard GST threshold" },
    { id: "₹20 Lakhs - ₹1Cr", label: "₹20 Lakhs - ₹1Cr", note: "Mandatory GST in all states" },
    { id: "₹1Cr - ₹5Cr", label: "₹1Cr - ₹5Cr", note: "Tax Audit & Regular Return Matrix" },
    { id: "Above ₹5Cr", label: "Above ₹5Cr", note: "Comprehensive Corporate Governance" }
  ];

  if (error) {
    return (
      <div className="min-h-screen w-full bg-[#030712] text-slate-200 flex flex-col items-center justify-center p-6">
        <div className="p-8 bg-rose-950/30 backdrop-blur-xl border border-rose-500/30 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(225,29,72,0.2)] text-center">
          <Server className="w-12 h-12 text-rose-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-black text-white mb-2">Vector Sync Failure</h3>
          <p className="text-rose-300/80 text-xs mb-6 leading-relaxed">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)]"
          >
            Reinitialize Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0D0E12] text-slate-200 font-sans px-6 md:px-10 lg:px-16 py-8 flex flex-col antialiased selection:bg-purple-500/20 selection:text-purple-200 relative overflow-x-hidden">
      
      {/* ── Ambient Radial Background Glow (Exact Landing Page style) ── */}
      <div 
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle at 20% 15%, rgba(120, 80, 220, 0.12), transparent 55%), radial-gradient(circle at 80% 60%, rgba(100, 60, 200, 0.06), transparent 50%), #0D0E12'
        }}
      />
      <div 
        className="fixed inset-0 pointer-events-none -z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* Freemium Lock Overlay Banner */}
      {isLocked && !showProfileForm && (
        <div className="absolute inset-x-0 bottom-0 top-[140px] z-40 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-lg p-8 bg-[#12131A] border border-white/15 rounded-3xl shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
              <Zap className="w-7 h-7 animate-bounce" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">RegIQ Pro Matrix Locked</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Interactive risk scorecards, automated statutory filing reminders, and custom document blending RAG vectors are exclusively enabled for Pro & Enterprise members.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex items-center justify-center bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-8 py-3.5 rounded-2xl transition-all shadow-[0_0_25px_rgba(168,85,247,0.4)]"
            >
              Unlock Full Access (₹499/mo)
            </button>
          </div>
        </div>
      )}

      {/* ── Main Full-Width Content Canvas ── */}
      <div className="w-full flex flex-col gap-8 relative z-10">
        
        {/* ── Welcome Header Bar (Enterprise Grade) ── */}
        <header className="w-full bg-[#12131A]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden shadow-xl">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active Monitor
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-medium">5 Statutory Corpora</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono text-[11px]">RBI • SEBI • MCA • CBIC • FEMA</span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              Welcome back, {user?.name || 'Sahil Karande'}
            </h1>

            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Real-time statutory intelligence workspace. Query circulars, verify clause citations, and track filing obligations across Indian regulatory bodies.
            </p>
          </div>
          
          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              onClick={() => navigate('/explorer')}
              className="px-4 py-2.5 rounded-lg bg-[#181820] border border-white/10 hover:bg-[#20202c] hover:border-white/20 text-slate-200 text-xs font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Citation Network</span>
            </button>

            {!showProfileForm ? (
              <>
                <button
                  onClick={() => setShowProfileForm(true)}
                  className="px-4 py-2.5 rounded-lg bg-[#181820] border border-white/10 hover:bg-[#20202c] hover:border-white/20 text-slate-300 text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <span>Entity Parameters</span>
                </button>

                <button 
                  onClick={() => navigate('/chat')}
                  className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.45)] flex items-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>New Research Query</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </>
            ) : (
              <button 
                onClick={() => navigate('/chat')}
                className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.45)] flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Assistant</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Pipeline Alert Notification Header Banner */}
        {unreadAlerts.length > 0 && !showProfileForm && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">Statutory Regulatory Updates Triggered</h4>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Automated scraping cron has flagged updates in <strong>{new Set(unreadAlerts.map(a => a.corpus.toUpperCase())).size}</strong> monitored corpora.
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/chat', { state: { initialQuery: 'Summarize the latest regulatory notifications and compliance changes across GST, RBI, and MCA.' } })}
              className="text-xs font-bold text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/30 px-4 py-2 rounded-xl transition-all"
            >
              Analyze Changes
            </button>
          </div>
        )}

        {/* ── Onboarding / Corporate Parameters Configuration Hub ── */}
        {showProfileForm ? (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Scope & Jurisdictional Radar */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-2xl flex flex-col justify-between h-full space-y-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <Compass className="w-5 h-5 text-cyan-400" />
                    <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
                      Corporate Parameterization
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Compliance Radar & Jurisdictional Scope
                  </h2>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    RegIQ customizes your RAG retrieval, threshold alerts, and risk scorecard based on your corporate constitution, operational scale, and cross-border footprint.
                  </p>
                </div>

                {/* Regulatory Authorities Active Matrix */}
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Monitored Statutory Bodies
                  </div>
                  
                  {[
                    { code: "RBI", name: "Reserve Bank of India", desc: "Banking regulations, NBFC norms & lending caps", active: true, color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
                    { code: "MCA", name: "Ministry of Corporate Affairs", desc: "Companies Act 2013, LLP rules, Director KYC", active: formData.business_type === "Private Limited" || formData.business_type === "LLP", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
                    { code: "GST", name: "Goods & Services Tax Network", desc: "Monthly outward GSTR-1, GSTR-3B & Invoicing", active: formData.gst_registered === "Yes", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                    { code: "SEBI", name: "Securities & Exchange Board", desc: "Fundraising, venture capital & securities laws", active: formData.industry === "Fintech" || formData.turnover_range === "Above ₹5Cr", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
                    { code: "FEMA", name: "Foreign Exchange Management", desc: "Cross-border capital inflows, Form FC-GPR & ECBs", active: formData.has_foreign_funding === "Yes", color: "text-pink-400 border-pink-500/30 bg-pink-500/10" }
                  ].map((auth) => (
                    <div 
                      key={auth.code}
                      className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-start justify-between gap-3 ${
                        auth.active 
                          ? `${auth.color} shadow-[0_0_20px_rgba(0,0,0,0.4)]`
                          : 'border-slate-800/60 bg-slate-950/40 opacity-40'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs">{auth.code}</span>
                          <span className="text-[11px] text-slate-300 font-medium">— {auth.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{auth.desc}</p>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase ${auth.active ? 'bg-white/10 text-white' : 'text-slate-600'}`}>
                        {auth.active ? 'Active Scope' : 'Standby'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-slate-300 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
                  <span>All inputs remain encrypted and isolated within your tenant workspace.</span>
                </div>
              </div>
            </div>

            {/* Right Column: Parameter Configuration Form */}
            <div className="lg:col-span-7">
              <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">Configure Corporate Parameters</h2>
                      <p className="text-xs text-slate-400">Update company structure to generate tailored audit scorecards.</p>
                    </div>
                  </div>
                  {user?.business_profile && (
                    <button
                      onClick={() => setShowProfileForm(false)}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-6 pt-6 text-xs">
                  
                  {/* 1. Business Constitution */}
                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                      1. Business Constitution Structure
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CONSTITUTIONS.map((c) => {
                        const Icon = c.icon;
                        const isSelected = formData.business_type === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setFormData({ ...formData, business_type: c.id })}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start gap-3 ${
                              isSelected
                                ? 'bg-indigo-950/40 border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.2)] text-white'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-900 text-slate-400'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <div className="font-bold text-xs">{c.label}</div>
                              <p className="text-[10px] text-slate-400 leading-snug">{c.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Industry Sector */}
                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                      2. Primary Industry & Operational Domain
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map((ind) => {
                        const isSelected = formData.industry === ind;
                        return (
                          <button
                            type="button"
                            key={ind}
                            onClick={() => setFormData({ ...formData, industry: ind })}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                              isSelected
                                ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-300 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                          >
                            {ind}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Turnover Range */}
                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                      3. Annual Aggregate Turnover (Fiscal Year)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {TURNOVER_TIERS.map((tier) => {
                        const isSelected = formData.turnover_range === tier.id;
                        return (
                          <div
                            key={tier.id}
                            onClick={() => setFormData({ ...formData, turnover_range: tier.id })}
                            className={`p-3 rounded-2xl border cursor-pointer text-center transition-all ${
                              isSelected
                                ? 'bg-amber-950/40 border-amber-500/60 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                          >
                            <div className="font-bold text-xs">{tier.label}</div>
                            <p className="text-[9px] text-slate-500 mt-1">{tier.note}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Binary Toggles: GST & FDI */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    
                    {/* GST Registration */}
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-200">Registered for GST?</div>
                        <div className="text-[10px] text-slate-500">Activates CBIC monthly compliance</div>
                      </div>
                      <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                        {["Yes", "No"].map((v) => (
                          <button
                            type="button"
                            key={v}
                            onClick={() => setFormData({ ...formData, gst_registered: v })}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              formData.gst_registered === v
                                ? 'bg-emerald-500 text-slate-950 shadow-md'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* FDI Foreign Funding */}
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-200">Foreign Funding (FDI)?</div>
                        <div className="text-[10px] text-slate-500">Triggers FEMA & FC-GPR tracking</div>
                      </div>
                      <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                        {["Yes", "No"].map((v) => (
                          <button
                            type="button"
                            key={v}
                            onClick={() => setFormData({ ...formData, has_foreign_funding: v })}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              formData.has_foreign_funding === v
                                ? 'bg-pink-500 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingProfile}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 text-xs tracking-wide"
                    >
                      {isSubmittingProfile ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Generating Compliance Scorecard...</span>
                        </>
                      ) : (
                        <>
                          <span>Save Corporate Parameters & Generate Scorecard</span>
                          <ChevronRight className="w-4 h-4 opacity-80" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        ) : isLoading ? (
          /* Loading Skeletons Full Width */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
            <div className="lg:col-span-8 space-y-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        ) : (
          /* ── Full Dashboard View ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
            
            {/* Left Column (Main Analytics & Calendar) */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              
              {/* Risk Scorecard Container */}
              <Suspense fallback={<SkeletonCard />}>
                <div className="bg-[#12131A]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden relative">
                  <RiskScorecard data={scorecard} onMetricClick={handleOpenDrillDown} />
                </div>
              </Suspense>

              {/* Dynamic Corpus Tracker Badging Panels */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { code: 'GST', label: 'Goods & Services', color: 'border-emerald-500/30 text-emerald-400' },
                  { code: 'RBI', label: 'Reserve Bank', color: 'border-sky-500/30 text-sky-400' },
                  { code: 'SEBI', label: 'Securities Board', color: 'border-purple-500/30 text-purple-400' },
                  { code: 'MCA', label: 'Corporate Affairs', color: 'border-amber-500/30 text-amber-400' }
                ].map((corp) => {
                  const hasAlert = checkHasActiveAlert(corp.code);
                  return (
                    <div 
                      key={corp.code}
                      className={`p-4 rounded-xl border transition-all duration-200 bg-[#12131A]/90 backdrop-blur-xl flex flex-col justify-between ${
                        hasAlert 
                          ? 'border-amber-500/50 bg-amber-950/20' 
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">{corp.code}</span>
                        {hasAlert && (
                          <button
                            disabled={isClearingAlert}
                            onClick={() => handleAcknowledgeCorpusAlerts(corp.code)}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors disabled:opacity-40"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] text-slate-400">{corp.label}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 rounded-full ${hasAlert ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                          <span className={`text-[11px] font-medium ${hasAlert ? 'text-amber-300' : 'text-slate-300'}`}>
                            {hasAlert ? 'Update Available' : 'Up to date'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compliance Calendar */}
              <div className="bg-[#12131A]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                <ComplianceCalendar deadlines={deadlines} onDeadlineClick={handleAnalyzeDeadline} />
              </div>
            </div>

            {/* Right Column (Telemetry, Quick Inquiries & Audit Threads) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Quick Launch Card */}
              <div className="bg-[#12131A]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs font-semibold text-white">Suggested Inquiries</h3>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                    Statutory RAG
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Direct statutory questions mapped to circular numbers, penalty clauses, and exemptions.
                </p>
                <div className="space-y-1.5">
                  {[
                    "What are the mandatory MCA annual returns for my LLP?",
                    "What is the GST threshold exemption for services?",
                    "Do I need RBI approval for FDI in Fintech?"
                  ].map((samplePrompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate('/chat', { state: { initialQuery: samplePrompt } })}
                      className="w-full text-left p-2.5 rounded-xl bg-[#181820] hover:bg-[#20202c] border border-white/10 hover:border-white/20 text-[11px] text-slate-300 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate pr-2">{samplePrompt}</span>
                      <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-purple-300 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Usage Allocation Card */}
              <div className="bg-[#12131A]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    <span>Query Allocation</span>
                  </h3>
                  <span className="text-[10px] font-mono bg-white/5 text-purple-300 px-2 py-0.5 rounded-full border border-white/10 uppercase">
                    {userRole} Tier
                  </span>
                </div>
                
                <div className="mb-2 flex justify-between items-baseline">
                  <span className="text-2xl font-bold text-white font-mono">{queryUsage.used}</span>
                  <span className="text-xs text-slate-400 font-mono">/ {queryUsage.max} daily allocation</span>
                </div>
                
                <div className="h-2 w-full bg-[#181820] border border-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      queryUsage.max && (queryUsage.used / queryUsage.max) * 100 > 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                    }`} 
                    style={{ width: `${Math.min(((queryUsage.used / (queryUsage.max || 1)) * 100), 100)}%` }} 
                  />
                </div>
              </div>

              {/* Active Audit Threads */}
              <div className="bg-[#12131A]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden max-h-[420px]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                    <h3 className="text-xs font-semibold text-slate-200">Recent Sessions</h3>
                  </div>
                  <button 
                    onClick={() => navigate('/chat')}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                  >
                    View All
                  </button>
                </div>
                <div className="flex-1 divide-y divide-white/5 overflow-y-auto">
                  {recentThreads.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs py-12">
                      No active research sessions found
                    </div>
                  ) : (
                    recentThreads.map(thread => (
                      <div 
                        key={thread.id} 
                        onClick={() => navigate(`/chat?id=${thread.id}`)} 
                        className="p-3.5 hover:bg-white/[0.03] cursor-pointer transition-colors group"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(thread.corpus_tags && thread.corpus_tags.length > 0 ? thread.corpus_tags : [thread.corpus || 'RAG']).map((tag, i) => (
                              <span key={i} className="text-[9px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-semibold">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatTimeAgo(thread.updated_at || thread.created_at || thread.date)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
                          {thread.title}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Drill-Down Modal */}
        {drillDownCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={() => setDrillDownCategory(null)} />
            <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>{drillDownCategory} Compliance Review</span>
                </h3>
                <button 
                  onClick={() => setDrillDownCategory(null)} 
                  className="text-slate-400 hover:text-slate-200 text-xs font-medium px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
                {drillDownChecks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No specific compliance checks registered for this category.</p>
                ) : (
                  drillDownChecks.map((check, idx) => (
                    <div key={check.id || idx} className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${check.passed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">{check.name || check.title || "Compliance Check"}</h4>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{check.description || check.desc || "Standard statutory guideline applies."}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}