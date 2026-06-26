import 'react';

export default function RiskScorecard({ data, onMetricClick }) {
  if (!data || !data.scores) {
    return (
      <div className="rounded-2xl bg-slate-900/50 p-6 border border-slate-800 text-center text-slate-400">
        No active business parameters loaded. Update company configurations.
      </div>
    );
  }

  // Color utility maps based on structured categories
  const getTheme = (status) => {
    switch (status) {
      case 'GREEN':
        return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500' };
      case 'AMBER':
        return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500' };
      case 'RED':
        return { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', badge: 'bg-rose-500' };
      default:
        return { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', badge: 'bg-slate-500' };
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 text-slate-200">
      
      {/* Executive Heading Indicator Bar */}
      <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-800 rounded-xl">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Compliance Health Matrix</h3>
          <p className="text-lg font-bold mt-0.5">{data.overall_health}</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800">
          Updated: Live Vector Status
        </span>
      </div>

      {/* Grid of the 4 Corporate Regulatory Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(data.scores).map(([key, value]) => {
          const theme = getTheme(value.status);
          return (
            <div 
              key={key}
              onClick={() => onMetricClick && onMetricClick(key, value.checks)}
              className={`p-5 rounded-xl border ${theme.bg} ${theme.border} cursor-pointer transition-all hover:scale-[1.02] duration-200 shadow-lg flex flex-col justify-between`}
            >
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold uppercase tracking-widest text-slate-400">{key}</span>
                  <div className={`h-2.5 w-2.5 rounded-full ${theme.badge} animate-pulse`} />
                </div>
                <div className="mt-4 text-3xl font-extrabold text-white">
                  {value.percentage}%
                </div>
                <p className="text-xs text-slate-400 mt-1">Audit Completeness Check</p>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs font-semibold group">
                <span className={theme.text}>View Active Parameters</span>
                <span className={`${theme.text} transition-transform group-hover:translate-x-1`}>→</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}