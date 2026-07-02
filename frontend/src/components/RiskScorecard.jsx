import  { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';

export default function RiskScorecard({ onMetricClick }) {
  const { user } = useAuth();
  
  // Extract user role from context tier setup
  const userRole = user?.role || 'guest';
  const isLocked = userRole === 'guest' || userRole === 'free';

  // Business profile form parameters matching Backend Schema expectations
  const [formData, setFormData] = useState({
    business_type: 'Private Limited',
    industry: 'Fintech',
    turnover_range: '₹1Cr - ₹5Cr',
    has_foreign_funding: 'No',
    gst_registered: 'Yes',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scoreData, setScoreData] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/scorecard', formData);
      // Response from backend matches format: { overall_health: "...", scores: { gst: { percentage: 85, status: "GREEN", checks: [...] }, ... } }
      setScoreData(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to calculate compliance profile risks.');
    } finally {
      setLoading(false);
    }
  };

  // UI Theme Engine maps status values to specific stroke colors and styles
  const getScoreTheme = (percentage, status) => {
    const normalizeStatus = status?.toUpperCase() || (percentage >= 80 ? 'GREEN' : percentage >= 50 ? 'AMBER' : 'RED');
    switch (normalizeStatus) {
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

  // Stand-in metrics preview display shown prior to form execution
  const defaultDisplayAxes = {
    GST: { percentage: 0, status: 'NONE', checks: [] },
    RBI: { percentage: 0, status: 'NONE', checks: [] },
    SEBI: { percentage: 0, status: 'NONE', checks: [] },
    MCA: { percentage: 0, status: 'NONE', checks: [] }
  };

  const activeScores = scoreData?.scores || defaultDisplayAxes;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-6 space-y-8">
      {/* Dashboard Top Row Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            🛡️ Corporate Compliance Risk Scorecard
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Generate risk indices and verification statuses relative to ongoing operations.
          </p>
        </div>
        {scoreData?.overall_health && !isLocked && (
          <div className="bg-zinc-900/80 px-4 py-2 border border-zinc-800 rounded-xl flex flex-col justify-center">
            <span className="text-[10px] uppercase font-mono font-bold text-zinc-500">Overall Assessment</span>
            <span className="text-sm font-bold text-white mt-0.5">{scoreData.overall_health}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Form Column - Left Section */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 lg:p-6 space-y-5">
          <div>
            <h3 className="text-md font-semibold text-zinc-200">Company Configuration Profile</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Parameters drive continuous automated evaluation formulas.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Business Constitution</label>
              <select
                name="business_type"
                value={formData.business_type}
                onChange={handleInputChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              >
                <option value="Proprietorship">Proprietorship</option>
                <option value="Partnership / LLP">Partnership / LLP</option>
                <option value="Private Limited">Private Limited</option>
                <option value="Public Limited">Public Limited</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Operational Sector</label>
              <select
                name="industry"
                value={formData.industry}
                onChange={handleInputChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              >
                <option value="Fintech">Fintech & Payments</option>
                <option value="E-Commerce Retail">E-Commerce Retail</option>
                <option value="Logistics & Supply">Logistics & Supply</option>
                <option value="SaaS / Tech Services">SaaS / Tech Services</option>
                <option value="Manufacturing">Manufacturing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Annualized Gross Turnover</label>
              <select
                name="turnover_range"
                value={formData.turnover_range}
                onChange={handleInputChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              >
                <option value="Under ₹20 Lakhs">Under ₹20 Lakhs</option>
                <option value="₹20 Lakhs - ₹1 Cr">₹20 Lakhs - ₹1 Cr</option>
                <option value="₹1Cr - ₹5Cr">₹1Cr - ₹5Cr</option>
                <option value="Above ₹5 Cr">Above ₹5 Cr</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Cross-Border Capital (FEMA / Inflows)</label>
              <select
                name="has_foreign_funding"
                value={formData.has_foreign_funding}
                onChange={handleInputChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              >
                <option value="No">No Foreign Funding</option>
                <option value="Yes">Yes (FDI / Venture Capital Inflow)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">GSTIN Registration Status</label>
              <select
                name="gst_registered"
                value={formData.gst_registered}
                onChange={handleInputChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
              >
                <option value="Yes">Active Registered Entity</option>
                <option value="No">Unregistered / Exempted</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || isLocked}
              className={`w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 mt-2 ${
                isLocked
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-md active:scale-[0.99]'
              }`}
            >
              {loading ? 'Processing Parameters...' : 'Re-evaluate Risk Vectors'}
            </button>
          </form>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
              {error}
            </div>
          )}
        </div>

        {/* Matrix Visualization Column Stack - Right Section */}
        <div className="lg:col-span-2 relative min-h-[460px]">
          {/* Pro Gate Layer Feature Overlay */}
          {isLocked && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/70 backdrop-blur-md rounded-2xl border border-zinc-800/60 p-6 text-center">
              <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 flex items-center justify-center rounded-2xl mb-4 shadow-xl">
                <span className="text-xl">🔒</span>
              </div>
              <h4 className="text-lg font-bold text-white tracking-tight">Unlock Dynamic Risk Scorecarding</h4>
              <p className="text-zinc-400 text-sm max-w-sm mt-1.5 mb-6">
                Analyzing business matrices and monitoring cross-platform regulatory vulnerabilities require an upgraded account tier.
              </p>
              <button
                onClick={() => {
                  const pricingEl = document.getElementById('pricing');
                  if (pricingEl) pricingEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-white text-zinc-950 font-semibold text-xs py-2.5 px-6 rounded-xl hover:bg-zinc-200 shadow-xl transition-all active:scale-[0.98]"
              >
                Upgrade to Pro (₹499/mo)
              </button>
            </div>
          )}

          {/* Grid Layout of the 4 Pillars */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 h-full ${isLocked ? 'blur-[4px] select-none pointer-events-none' : ''}`}>
            {Object.entries(activeScores).map(([key, value]) => {
              const displayKey = key.toUpperCase();
              const theme = getScoreTheme(value.percentage, value.status);
              
              // SVG Math calculation constants for crisp circular tracks
              const radius = 36;
              const circumference = 2 * Math.PI * radius;
              const strokeOffset = circumference - (value.percentage / 100) * circumference;

              return (
                <div
                  key={key}
                  onClick={() => onMetricClick && value.percentage > 0 && onMetricClick(key, value.checks)}
                  className={`p-5 rounded-2xl border bg-zinc-900/40 transition-all duration-200 flex flex-col justify-between ${
                    value.percentage > 0 ? 'cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/60' : 'border-zinc-800/80'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono tracking-wider text-zinc-500 uppercase">Jurisdiction</span>
                        {value.percentage > 0 && <span className={`h-2 w-2 rounded-full ${theme.dot} animate-pulse`} />}
                      </div>
                      <h4 className="text-lg font-bold text-white tracking-tight">{displayKey} Framework</h4>
                    </div>

                    {/* SVG Circular Progress Meter */}
                    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        {/* Background track circle */}
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          className="stroke-zinc-800/70"
                          strokeWidth="6"
                          fill="none"
                        />
                        {/* Dynamic data tracking foreground fill circle */}
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          stroke={theme.stroke}
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeOffset}
                          strokeLinecap="round"
                          className="transition-all duration-500 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-mono font-bold text-white">{value.percentage}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-zinc-800/60 flex items-center justify-between">
                    <span className="text-xs text-zinc-400">
                      {displayKey === 'GST' && 'Filing cycles & logs'}
                      {displayKey === 'RBI' && 'FDI limits & declarations'}
                      {displayKey === 'SEBI' && 'Shareholding & investments'}
                      {displayKey === 'MCA' && 'Annual continuous filings'}
                    </span>
                    {value.percentage > 0 && (
                      <span className={`text-xs font-medium ${theme.text} flex items-center gap-0.5 group`}>
                        Analyze <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </span>
                    )}
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