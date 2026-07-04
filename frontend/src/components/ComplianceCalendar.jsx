import  { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';

export default function ComplianceCalendar({ deadlines = [], onDeadlineClick }) {
  // Pin standard operational viewpoint to July 2026 for consistency with active timeline
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); 
  const [selectedAuthority, setSelectedAuthority] = useState('ALL');

  if (!deadlines || deadlines.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900/40 p-6 border border-slate-800/80 text-center text-slate-400 text-sm">
        No active compliance deadlines calculated for this quarter timeline.
      </div>
    );
  }

  // Priority and Urgency Color Matrix
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dot: 'bg-rose-500' };
      case 'HIGH':
        return { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-500' };
      default:
        return { bg: 'bg-slate-500/10 text-slate-300 border-slate-700/80', dot: 'bg-slate-400' };
    }
  };

  const getAuthorityBadge = (auth) => {
    const variants = {
      GST: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      RBI: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      SEBI: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      MCA: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
    return variants[auth?.toUpperCase()] || 'bg-slate-500/10 text-slate-400 border-slate-800';
  };

  // Calendar Utility Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const monthsStr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  // Cross-Filter deadliness by Selected Authority Code 
  const filteredDeadlines = deadlines.filter(dl => 
    selectedAuthority === 'ALL' || dl.authority?.toUpperCase() === selectedAuthority.toUpperCase()
  ).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full text-slate-200">
      
      {/* 1. INTERACTIVE SYSTEM MONTH GRID */}
      <div className="xl:col-span-2 bg-slate-900/40 backdrop-blur-sm rounded-xl border border-slate-800/80 p-5 flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">{monthsStr[month]} {year}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-800 rounded-lg border border-slate-800 transition text-slate-400 hover:text-slate-200">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-800 rounded-lg border border-slate-800 transition text-slate-400 hover:text-slate-200">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>

        {/* Matrix Mapping */}
        <div className="grid grid-cols-7 gap-2 flex-1">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20 bg-slate-950/20 rounded-lg border border-slate-900/40"></div>
          ))}
          
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            
            // Filter deadlines mapping strictly to exact year-month-day calendar cell
            const cellDeadlines = deadlines.filter(d => d.due_date.split('T')[0] === currentDayStr);
            const isToday = currentDayStr === '2026-07-04';

            return (
              <div 
                key={`day-${dayNum}`} 
                className={`h-20 p-1.5 border rounded-lg flex flex-col justify-between transition relative overflow-hidden group ${
                  isToday ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800/60 bg-slate-900/10'
                }`}
              >
                <span className={`text-[11px] font-bold ${isToday ? 'text-indigo-400 font-extrabold' : 'text-slate-500'}`}>
                  {dayNum}
                </span>
                
                <div className="flex flex-col gap-1 overflow-y-auto mt-1 max-h-[48px] custom-scrollbar">
                  {cellDeadlines.map(dl => {
                    const style = getPriorityStyle(dl.priority);
                    return (
                      <div 
                        key={dl.id}
                        onClick={() => onDeadlineClick?.(dl)}
                        className={`text-[9px] px-1 py-0.5 rounded border truncate cursor-pointer font-medium select-none transition-all hover:scale-[1.02] ${style.bg}`}
                        title={`${dl.authority}: ${dl.title}`}
                      >
                        <span className="font-bold opacity-80">{dl.authority}</span>: {dl.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CHRONOLOGICAL ACTION LIST & TIMELINE SCOPE */}
      <div className="bg-slate-900/40 backdrop-blur-sm rounded-xl border border-slate-800/80 p-5 flex flex-col max-h-[475px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Timeline Queue</h3>
          </div>

          <select
            value={selectedAuthority}
            onChange={(e) => setSelectedAuthority(e.target.value)}
            className="text-[11px] bg-slate-950 border border-slate-800 text-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 px-2 py-1 font-medium cursor-pointer"
          >
            <option value="ALL">All Authorities</option>
            <option value="GST">GST</option>
            <option value="RBI">RBI</option>
            <option value="SEBI">SEBI</option>
            <option value="MCA">MCA</option>
          </select>
        </div>

        {/* Scrollable Context Stack */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          {filteredDeadlines.length === 0 ? (
            <div className="text-center text-slate-500 py-12 text-xs">
              No matching deadlines found for this selection window.
            </div>
          ) : (
            filteredDeadlines.map((item) => {
              const priorityConfig = getPriorityStyle(item.priority);
              const authorityClass = getAuthorityBadge(item.authority);
              
              const formattedDate = new Date(item.due_date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
              });

              return (
                <div 
                  key={item.id} 
                  className="p-3 border border-slate-800/70 bg-slate-900/30 rounded-xl hover:border-slate-700/60 transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-extrabold tracking-wide uppercase px-1.5 py-0.5 border rounded ${authorityClass}`}>
                          {item.authority}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${priorityConfig.bg}`}>
                          {item.priority}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 font-medium">Due: {formattedDate}</span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {onDeadlineClick && (
                    <button
                      onClick={() => onDeadlineClick(item)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-indigo-600 border border-slate-800 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-lg py-1.5 text-xs font-semibold shadow-inner transition-all duration-200"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Analyze with Vidi RAG</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}