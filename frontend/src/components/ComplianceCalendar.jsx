import 'react';

export default function ComplianceCalendar({ deadlines, onDeadlineClick }) {
  if (!deadlines || deadlines.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900/40 p-6 border border-slate-800/80 text-center text-slate-400 text-sm">
        No active compliance deadlines calculated for this quarter timeline.
      </div>
    );
  }

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="border-b border-slate-800 pb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400"> approaching compliance timelines</h3>
      </div>
      
      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
        {deadlines.map((item) => {
          const badgeStyle = getPriorityStyle(item.priority);
          // Format date presentation cleanly
          const dateObj = new Date(item.due_date);
          const formattedDate = dateObj.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });

          return (
            <div 
              key={item.id}
              className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-800/60 bg-slate-900/20 backdrop-blur-sm transition-all hover:bg-slate-900/50 hover:border-indigo-500/30"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-indigo-400 tracking-wide uppercase px-2 py-0.5 rounded bg-indigo-500/10">
                    {item.authority}
                  </span>
                  <span className={`text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded border ${badgeStyle}`}>
                    {item.priority}
                  </span>
                  <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                    {item.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {item.description}
                </p>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 border-slate-800/60 pt-2 sm:pt-0 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] block text-slate-500 uppercase font-semibold">Due Date</span>
                  <span className="text-xs font-mono font-bold text-slate-300">{formattedDate}</span>
                </div>
                
                {onDeadlineClick && (
                  <button
                    onClick={() => onDeadlineClick(item)}
                    className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <span>Analyze Scope</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}