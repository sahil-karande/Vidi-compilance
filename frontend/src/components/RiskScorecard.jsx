import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';

export default function RiskScorecard({ data, onMetricClick }) {
  const { user } = useAuth();
  const userRole = user?.role || 'guest';
  const isLocked = userRole === 'guest' || userRole === 'free';

  // Local state tracking parameters matching backend evaluation keys
  const [formData, setFormData] = useState({
    business_type: 'Private Limited',
    industry: 'Fintech',
    turnover_range: '₹1Cr - ₹5Cr',
    has_foreign_funding: 'No',
    gst_registered: 'Yes',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localScores, setLocalScores] = useState(null);

  // Sync with initial hydration metrics passed from dashboard container load
  useEffect(() => {
    if (data) {
      // Safely transform initial dashboard payload keys if structured via standard formats
      if (data.overall_status && !data.overall_health) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalScores({
          overall_health: data.overall_status,
          scores: data.scores
        });
      } else {
        setLocalScores(data);
      }
    }
  }, [data]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;

    setLoading(true);
    setError('');

    // Map your frontend select choices into the exact schema expected by the backend Pydantic model
    const mappedPayload = {
      industry_type: formData.industry, 
      annual_turnover_inr: formData.turnover_range === "Under ₹20 Lakhs" ? 1500000 
                          : formData.turnover_range === "₹20 Lakhs - ₹1 Cr" ? 5000000 
                          : formData.turnover_range === "₹1Cr - ₹5Cr" ? 30000000 
                          : 60000000,
      is_import_export: formData.has_foreign_funding === "Yes",
      has_listed_securities: formData.business_type === "Public Limited",
      missing_filings: [] 
    };

    try {
      const response = await api.post('/api/scorecard', mappedPayload);
      
      // Adapt schema response variables directly back into parent states matching formatting hooks
      const formattedResponse = {
        overall_health: response.data.overall_status,
        scores: response.data.scores || response.data
      };
      
      setLocalScores(formattedResponse);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to re-calculate compliance matrix profiles.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreTheme = (percentage, status) => {
    const normStatus = status?.toUpperCase() || (percentage >= 80 ? 'GREEN' : percentage >= 50 ? 'AMBER' : 'RED');
    switch (normStatus) {
      case 'GREEN':
        return { stroke: '#10B981', text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400' };
      case 'AMBER':
        return { stroke: '#F59E0B', text: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5', dot: 'bg-amber-400' };
      case 'RED':
        return { stroke: '#EF4444', text: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/5', dot: 'bg-rose-400' };
      default:
        return { stroke: '#64748B', text: 'text-zinc-400', border: 'border-zinc-800', bg: 'bg-zinc-900/40', dot: 'bg-zinc-500' };
    }
  };

  // Safe baseline fallback settings matching backend evaluation defaults
  const defaultDisplayAxes = {
    gst: { score: 85, label: 'GREEN', checks: [] },
    rbi: { score: 70, label: 'AMBER', checks: [] },
    sebi: { score: 90, label: 'GREEN', checks: [] },
    mca: { score: 45, label: 'RED', checks: [] }
  };

  const activeScores = localScores?.scores || defaultDisplayAxes;

  return (
    <div className="w-full flex flex-col gap-6 text-slate-200">
      
      {/* Upper Status Banner Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-900/40 p-4 border border-slate-800 rounded-xl gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Compliance Health Matrix</h3>
          <p className="text-base font-bold mt-0.5 text-white">
            {localScores?.overall_health || (isLocked ? '🔒 Restricted Tier Vector Status' : 'Awaiting Parameters Evaluation')}
          </p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800 w-max self-start sm:self-center">
          Updated: Live Vector Status
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Form Configuration Input Box */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-200">Company Vector Parameters</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Adjust fields to feed back into calculation formulas.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Constitution</label>
              <select name="business_type" value={formData.business_type} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700">
                <option value="Proprietorship">Proprietorship</option>
                <option value="Partnership / LLP">Partnership / LLP</option>
                <option value="Private Limited">Private Limited</option>
                <option value="Public Limited">Public Limited</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Operational Sector</label>
              <select name="industry" value={formData.industry} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700">
                <option value="Fintech">Fintech & Payments</option>
                <option value="E-Commerce Retail">E-Commerce Retail</option>
                <option value="Logistics & Supply">Logistics & Supply</option>
                <option value="SaaS / Tech Services">SaaS / Tech Services</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Annual Turnover</label>
              <select name="turnover_range" value={formData.turnover_range} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700">
                <option value="Under ₹20 Lakhs">Under ₹20 Lakhs</option>
                <option value="₹20 Lakhs - ₹1 Cr">₹20 Lakhs - ₹1 Cr</option>
                <option value="₹1Cr - ₹5Cr">₹1Cr - ₹5Cr</option>
                <option value="Above ₹5 Cr">Above ₹5 Cr</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Cross-Border Funding</label>
              <select name="has_foreign_funding" value={formData.has_foreign_funding} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700">
                <option value="No">No Inflows</option>
                <option value="Yes">Yes (FDI / Venture Capital)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">GSTIN Status</label>
              <select name="gst_registered" value={formData.gst_registered} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700">
                <option value="Yes">Active Registered</option>
                <option value="No">Unregistered / Exempt</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || isLocked}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all mt-1 ${
                isLocked ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-950 hover:bg-slate-200'
              }`}
            >
              {loading ? 'Evaluating Vectors...' : 'Re-evaluate Risk Vectors'}
            </button>
          </form>
          {error && <p className="text-[11px] text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10 mt-2">{error}</p>}
        </div>

        {/* Dynamic Scoring Display Row Area */}
        <div className="lg:col-span-2 relative min-h-[380px] h-full">
          {isLocked && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md rounded-2xl border border-slate-800/40 p-6 text-center">
              <div className="w-10 h-10 bg-slate-900 border border-slate-800 flex items-center justify-center rounded-xl mb-3 shadow-xl">
                <span className="text-sm">🔒</span>
              </div>
              <h4 className="text-sm font-bold text-white">Unlock Live Risk Scorecard</h4>
              <p className="text-slate-400 text-xs max-w-xs mt-1 mb-4">
                Dynamic execution algorithms across statutory frameworks are reserved for premium tiers.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-white text-slate-950 font-bold text-xs py-2 px-5 rounded-xl hover:bg-slate-200 shadow-md transition-all"
              >
                Upgrade to Pro (₹499/mo)
              </button>
            </div>
          )}

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 h-full ${isLocked ? 'blur-[4px] select-none pointer-events-none' : ''}`}>
            {Object.entries(activeScores).map(([key, value]) => {
              const displayAxis = key.toUpperCase();
              
              // Aligned perfectly to extract values dynamically from response fields
              const currentScore = value?.score !== undefined ? value.score : (value?.percentage || 0);
              const currentLabel = value?.label || value?.status || 'GREEN';
              const theme = getScoreTheme(currentScore, currentLabel);
              
              const radius = 32;
              const circumference = 2 * Math.PI * radius;
              const strokeOffset = circumference - (currentScore / 100) * circumference;

              return (
                <div
                  key={key}
                  onClick={() => onMetricClick && onMetricClick(key, value.checks)}
                  className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/30 flex flex-col justify-between cursor-pointer hover:border-slate-700 hover:bg-slate-900/50 transition-all group shadow-md"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold font-mono tracking-wider text-slate-500 uppercase">Axis Pillar</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${theme.dot} animate-pulse`} />
                      </div>
                      <h4 className="text-base font-bold text-white tracking-tight">{displayAxis} Metric</h4>
                    </div>

                    {/* SVG Graphic Component Fill Wheel */}
                    <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r={radius} className="stroke-slate-800/60" strokeWidth="5" fill="none" />
                        <circle
                          cx="32"
                          cy="32"
                          r={radius}
                          stroke={theme.stroke}
                          strokeWidth="5"
                          fill="none"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeOffset}
                          strokeLinecap="round"
                          className="transition-all duration-500 ease-out"
                        />
                      </svg>
                      <span className="absolute text-xs font-mono font-bold text-white">{currentScore}%</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-400 text-[11px] italic">
                      {displayAxis === 'GST' && 'Indirect audit checks'}
                      {displayAxis === 'RBI' && 'Capital inflow path validation'}
                      {displayAxis === 'SEBI' && 'Asset securities check logs'}
                      {displayAxis === 'MCA' && 'Annual Continuous Filing logs'}
                    </span>
                    <span className={`${theme.text} flex items-center gap-0.5`}>
                      View <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}