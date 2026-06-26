import  { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../lib/api';
import RiskScorecard from '../components/RiskScorecard';
import ComplianceCalendar from '../components/ComplianceCalendar';

export default function Dashboard() {
  const navigate = useNavigate();
  const [scorecard, setScorecard] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active parameter details modal state for the scorecard metrics drill down
  const [drillDownCategory, setDrillDownCategory] = useState(null);
  const [drillDownChecks, setDrillDownChecks] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setIsLoading(true);
        // Fire parallel asynchronous requests using your newly defined api wrappers
        const [scorecardData, calendarData] = await Promise.all([
          chatAPI.getScorecard(),
          chatAPI.getCalendarDeadlines()
        ]);
        
        setScorecard(scorecardData);
        setDeadlines(calendarData);
      } catch (err) {
        console.error("Failed loading corporate audit vectors:", err);
        setError("Could not parse compliance telemetry. Verify FastAPI backend status.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // Action callback routing item focus context into real-time Chat
  const handleAnalyzeDeadline = (item) => {
    const predefinedQuery = `What are my exact compliance requirements and penalties for missing the ${item.authority} deadline: ${item.title}?`;
    
    // Redirect cleanly to chat, feeding state attributes down into route parameters
    navigate('/chat', { state: { initialQuery: predefinedQuery } });
  };

  const handleOpenDrillDown = (category, checks) => {
    setDrillDownCategory(category.toUpperCase());
    setDrillDownChecks(checks);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex flex-col items-center justify-center font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
        <p className="text-sm font-medium tracking-wide">Syncing compliance vectors and timeline indices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-rose-400 font-bold max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] font-sans p-6 md:p-8 lg:p-12 flex flex-col items-center">
      <div className="w-full max-w-6xl flex flex-col gap-8">
        
        {/* Dynamic Greeting Title */}
        <div className="text-left">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            Corporate Compliance Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time verification matrix derived from official regulatory circular notifications.
          </p>
        </div>

        {/* Pillar 1: Risk Scoring Grid */}
        <RiskScorecard 
          data={scorecard} 
          onMetricClick={handleOpenDrillDown} 
        />

        {/* Pillar 2: Timeline Deadline Board */}
        <div className="w-full bg-slate-900/10 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md shadow-xl">
          <ComplianceCalendar 
            deadlines={deadlines} 
            onDeadlineClick={handleAnalyzeDeadline} 
          />
        </div>

        {/* Interactive Parameter Inspection Drawer (Drill-Down Modal) */}
        {drillDownCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrillDownCategory(null)} />
            <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[80vh]">
              
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-base font-bold text-indigo-400 tracking-wider">
                  {drillDownCategory} PARAMETERS AUDIT
                </h3>
                <button 
                  onClick={() => setDrillDownCategory(null)}
                  className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
                >
                  ✕ Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                {drillDownChecks.map((check, idx) => (
                  <div key={check.id || idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/60 text-left">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${check.passed ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <h4 className="text-sm font-bold text-slate-200">{check.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed pl-4">{check.desc}</p>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}