import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ComplianceCalendar from '../components/ComplianceCalendar';
import { Terminal, Activity, MessageSquare, Zap, ChevronRight, Server, Briefcase } from 'lucide-react';

// Day 37 Requirement: Lazy Load the Risk Scorecard
const RiskScorecard = lazy(() => import('../components/RiskScorecard'));

function SkeletonCard() {
  return (
    <div className="w-full bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-slate-700/50 rounded w-1/3 shadow-[0_0_10px_rgba(51,65,85,0.5)]"></div>
        <div className="h-6 bg-slate-700/50 rounded-full w-12"></div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-700/50 rounded w-full"></div>
        <div className="h-3 bg-cyan-900/30 rounded w-5/6"></div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth() || {}; // Assuming updateUserProfile is exposed via useAuth hook

  //  (Bypasses the locked restriction state for dev mode):
  const userRole = 'pro'; 
  const isLocked = false;

  // Toggle true profile form onboarding state if business details are missing
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

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
    // If onboarding form is active, delay operational metrics fetching
    if (showProfileForm) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    e.preventDefault();
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

  const handleAnalyzeDeadline = (item) => {
    const predefinedQuery = `What are my exact compliance requirements and penalties for missing the ${item.authority} deadline: ${item.title}?`;
    navigate('/chat', { state: { initialQuery: predefinedQuery } });
  };

  const handleOpenDrillDown = (category, checks) => {
    setDrillDownCategory(category.toUpperCase());
    setDrillDownChecks(checks || []);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-200 flex flex-col items-center justify-center p-4">
        <div className="p-6 bg-rose-950/30 backdrop-blur-md border border-rose-500/30 rounded-2xl max-w-md w-full shadow-[0_0_30px_rgba(225,29,72,0.15)] text-center">
          <Server className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-100 mb-2">Vector Sync Failure</h3>
          <p className="text-rose-400/80 text-sm mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/50 text-rose-100 rounded-xl text-sm font-semibold transition-all shadow-[0_0_15px_rgba(225,29,72,0.2)]"
          >
            Reinitialize Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 font-sans p-4 md:p-8 flex flex-col items-center antialiased relative overflow-hidden">
      
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-7xl flex flex-col gap-6 md:gap-8 relative z-10">
        
        {/* Welcome Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <span className="text-xs font-mono text-cyan-400/80 tracking-widest uppercase">System Online</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">{user?.name || 'Sahil'}</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Vidi RAG Engine active. Monitoring 5 regulatory corpora.
            </p>
          </div>
          
          {!showProfileForm && (
            <button 
              onClick={() => navigate('/chat')}
              className="group flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
            >
              <Zap className="w-4 h-4" />
              New RAG Query
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </header>

        {/* Onboarding Profile Form Block to prevent empty state rendering */}
        {showProfileForm ? (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Configure Corporate Parameters</h2>
            </div>
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Business Constitution</label>
                  <select 
                    value={formData.business_type} 
                    onChange={e => setFormData({...formData, business_type: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option>Private Limited</option>
                    <option>LLP</option>
                    <option>Partnership</option>
                    <option>Proprietorship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Industry Sector</label>
                  <select 
                    value={formData.industry} 
                    onChange={e => setFormData({...formData, industry: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                  >
                    <option>Fintech</option>
                    <option>SaaS / Tech Services</option>
                    <option>Manufacturing</option>
                    <option>E-commerce</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Annual Aggregate Turnover</label>
                <select 
                  value={formData.turnover_range} 
                  onChange={e => setFormData({...formData, turnover_range: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                >
                  <option>Under ₹20 Lakhs</option>
                  <option>₹20 Lakhs - ₹1Cr</option>
                  <option>₹1Cr - ₹5Cr</option>
                  <option>Above ₹5Cr</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <span className="text-sm text-slate-300">Registered for GST?</span>
                  <select 
                    value={formData.gst_registered} 
                    onChange={e => setFormData({...formData, gst_registered: e.target.value})}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <span className="text-sm text-slate-300">Foreign Funding (FDI)?</span>
                  <select 
                    value={formData.has_foreign_funding} 
                    onChange={e => setFormData({...formData, has_foreign_funding: e.target.value})}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingProfile}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:brightness-110 disabled:opacity-50 mt-4"
              >
                {isSubmittingProfile ? "Generating Audit Context Matrix..." : "Generate Compliance Scorecard"}
              </button>
            </form>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="space-y-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Suspense fallback={<SkeletonCard />}>
                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
                  <RiskScorecard data={scorecard} onMetricClick={handleOpenDrillDown} />
                </div>
              </Suspense>

              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
                <ComplianceCalendar deadlines={deadlines} onDeadlineClick={handleAnalyzeDeadline} />
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-bl-full blur-xl group-hover:bg-cyan-500/20 transition-colors" />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    API Telemetry
                  </h3>
                  <span className="text-xs font-mono bg-slate-800 text-cyan-400 px-2 py-1 rounded border border-slate-700">
                    {userRole.toUpperCase()} TIER
                  </span>
                </div>
                
                <div className="mb-2 flex justify-between items-end">
                  <span className="text-3xl font-bold text-white">{queryUsage.used}</span>
                  <span className="text-sm text-slate-400 mb-1">/ {queryUsage.max} queries</span>
                </div>
                
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)] transition-all duration-1000 ${queryUsage.max && (queryUsage.used / queryUsage.max) * 100 > 80 ? 'bg-rose-500' : 'bg-cyan-400'}`} 
                    style={{ width: `${Math.min(((queryUsage.used / (queryUsage.max || 1)) * 100), 100)}%` }} 
                  />
                </div>
              </div>

              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden max-h-[450px]">
                <div className="p-5 border-b border-slate-800 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-300">Active Threads</h3>
                </div>
                <div className="flex-1 divide-y divide-slate-800/50 overflow-y-auto custom-scrollbar">
                  {recentThreads.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono py-12">
                      NO_ACTIVE_THREADS_FOUND
                    </div>
                  ) : (
                    recentThreads.map(thread => (
                      <div 
                        key={thread.id} 
                        onClick={() => navigate(`/chat?id=${thread.id}`)} 
                        className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors group"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(thread.corpus_tags && thread.corpus_tags.length > 0 ? thread.corpus_tags : [thread.corpus || 'RAG']).map((tag, i) => (
                              <span key={i} className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatTimeAgo(thread.updated_at || thread.created_at || thread.date)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 group-hover:text-cyan-400 transition-colors line-clamp-2">
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
            <div className="absolute inset-0 bg-[#030712]/80 backdrop-blur-sm transition-opacity" onClick={() => setDrillDownCategory(null)} />
            <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-sm font-bold text-cyan-400 tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> {drillDownCategory} PARAMETERS AUDIT
                </h3>
                <button onClick={() => setDrillDownCategory(null)} className="text-slate-500 hover:text-rose-400 text-xs font-semibold focus:outline-none">
                  [ ESC ]
                </button>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2 custom-scrollbar">
                {drillDownChecks.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono text-center py-8">NO_VECTORS_INDEXED_FOR_BRANCH</p>
                ) : (
                  drillDownChecks.map((check, idx) => (
                    <div key={check.id || idx} className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-cyan-900/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${check.passed ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
                        <div>
                          <h4 className="text-sm font-bold text-slate-200">{check.name || check.title || "Audit Compliance Check"}</h4>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{check.description || check.desc || "No supplemental details logged."}</p>
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