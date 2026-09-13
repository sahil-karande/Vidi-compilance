import { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare, 
  AlertCircle,
  FileText,
  Clock,
  ExternalLink,
  X,
  Sparkles,
  Info
} from 'lucide-react';

// Formats statutory notice badges with clean, easily recognizable authority tags and short names
function getNoticeBadge(dl) {
  const auth = (dl.authority || '').toLowerCase();
  let code = 'REG';
  let badgeClass = 'bg-slate-500/20 text-slate-300 border-slate-500/40 hover:bg-slate-500/30';
  let dotClass = 'bg-slate-400';
  let authorityLabel = dl.authority || 'Regulatory';

  if (auth.includes('income') || auth.includes('tax') || auth.includes('it')) {
    code = 'IT';
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30';
    dotClass = 'bg-amber-400';
    authorityLabel = 'Income Tax';
  } else if (auth.includes('gst')) {
    code = 'GST';
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30';
    dotClass = 'bg-emerald-400';
    authorityLabel = 'GST / CBIC';
  } else if (auth.includes('labour') || auth.includes('epfo') || auth.includes('esic') || auth.includes('pf')) {
    code = 'EPF';
    badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30';
    dotClass = 'bg-cyan-400';
    authorityLabel = 'Labour / EPFO';
  } else if (auth.includes('mca') || auth.includes('corporate') || auth.includes('roc')) {
    code = 'MCA';
    badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30';
    dotClass = 'bg-purple-400';
    authorityLabel = 'MCA / ROC';
  } else if (auth.includes('rbi') || auth.includes('fema')) {
    code = 'RBI';
    badgeClass = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30';
    dotClass = 'bg-indigo-400';
    authorityLabel = 'RBI / FEMA';
  } else if (auth.includes('sebi')) {
    code = 'SEBI';
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30';
    dotClass = 'bg-rose-400';
    authorityLabel = 'SEBI';
  }

  // Generate clear concise label
  let label = dl.form || '';
  const titleLower = (dl.title || '').toLowerCase();
  if (!label || label.length > 12) {
    if (titleLower.includes('advance tax')) label = 'Advance Tax';
    else if (titleLower.includes('tds')) label = 'TDS (281)';
    else if (titleLower.includes('gstr-1')) label = 'GSTR-1';
    else if (titleLower.includes('gstr-3b')) label = 'GSTR-3B';
    else if (titleLower.includes('epf') || titleLower.includes('esic')) label = 'PF/ESI (ECR)';
    else if (titleLower.includes('dir-3')) label = 'DIR-3 KYC';
    else if (titleLower.includes('aoc-4')) label = 'AOC-4';
    else if (titleLower.includes('mgt-7')) label = 'MGT-7';
    else if (titleLower.includes('tax audit')) label = 'Tax Audit';
    else if (titleLower.includes('fla')) label = 'FLA Return';
    else if (titleLower.includes('lodr')) label = 'SEBI LODR';
    else {
      label = dl.title?.split('(')[0]?.trim() || 'Notice';
      if (label.length > 13) label = label.slice(0, 11) + '..';
    }
  }

  return { code, label, badgeClass, dotClass, authorityLabel };
}

export default function ComplianceCalendar({ deadlines = [], onDeadlineClick }) {
  // Dynamically initialize to current real-time month, year, and day
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedAuthority, setSelectedAuthority] = useState('ALL');
  const [selectedDateStr, setSelectedDateStr] = useState(null);
  const [hoveredNotice, setHoveredNotice] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const resetToToday = () => {
    setCurrentDate(new Date());
    setSelectedDateStr(null);
  };

  // Priority and Urgency Color Matrix
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return { bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dot: 'bg-rose-500' };
      case 'HIGH':
        return { bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' };
      default:
        return { bg: 'bg-slate-500/15 text-slate-300 border-slate-700/80', dot: 'bg-slate-400' };
    }
  };

  // Calendar Utility Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const monthsStr = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDateStr(null);
  };
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDateStr(null);
  };

  // Filter deadlines matching active month and selected authority
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  // Deadlines in active month
  const activeMonthDeadlines = deadlines.filter(dl => {
    const isCurrentMonth = dl.due_date && dl.due_date.startsWith(monthPrefix);
    const matchesAuth = selectedAuthority === 'ALL' || dl.authority?.toUpperCase() === selectedAuthority.toUpperCase();
    return isCurrentMonth && matchesAuth;
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // If a specific date is clicked/selected, filter Timeline Queue to that day
  const queueDeadlines = selectedDateStr 
    ? activeMonthDeadlines.filter(dl => dl.due_date.split('T')[0] === selectedDateStr)
    : activeMonthDeadlines;

  // Selected date formatted for display
  const formattedSelectedDate = selectedDateStr ? new Date(selectedDateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) : null;

  const handleNoticeMouseEnter = (e, dl) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({
      x: Math.min(rect.left + window.scrollX, window.innerWidth - 320),
      y: rect.bottom + window.scrollY + 8
    });
    setHoveredNotice(dl);
  };

  const handleNoticeMouseLeave = () => {
    setHoveredNotice(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full text-slate-200 font-sans relative">
      
      {/* 1. INTERACTIVE SYSTEM MONTH GRID */}
      <div className="xl:col-span-2 bg-[#12131A]/95 backdrop-blur-xl rounded-2xl border border-white/10 p-5 sm:p-6 flex flex-col shadow-xl self-start">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {monthsStr[month]} {year}
                <span className="text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  {activeMonthDeadlines.length} Statutory Deadlines
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedDateStr && (
              <button
                onClick={() => setSelectedDateStr(null)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition flex items-center gap-1.5"
              >
                <span>Filtered: {formattedSelectedDate}</span>
                <X className="h-3 w-3" />
              </button>
            )}
            <button 
              onClick={resetToToday} 
              className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition"
              title="Jump to Current Real-time Date"
            >
              Today
            </button>
            <div className="flex items-center rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
              <button 
                onClick={prevMonth} 
                className="p-1.5 hover:bg-white/10 transition text-slate-400 hover:text-slate-200 border-r border-white/10"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={nextMonth} 
                className="p-1.5 hover:bg-white/10 transition text-slate-400 hover:text-slate-200"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>

        {/* Matrix Mapping - Uniform, clean, compact cell heights */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-[88px] sm:h-[94px] bg-white/[0.01] rounded-xl border border-white/[0.03]"></div>
          ))}
          
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            
            // Filter deadlines mapping strictly to exact year-month-day calendar cell
            const cellDeadlines = deadlines.filter(d => d.due_date && d.due_date.split('T')[0] === currentDayStr);
            const isToday = currentDayStr === todayStr;
            const isSelected = selectedDateStr === currentDayStr;

            return (
              <div 
                key={`day-${dayNum}`} 
                onClick={() => {
                  if (cellDeadlines.length > 0) {
                    setSelectedDateStr(isSelected ? null : currentDayStr);
                  }
                }}
                className={`h-[88px] sm:h-[94px] p-2 border rounded-xl flex flex-col gap-1 transition-all relative select-none ${
                  cellDeadlines.length > 0 ? 'cursor-pointer hover:border-purple-400/50 hover:bg-[#191924]' : 'bg-[#15151E]'
                } ${
                  isSelected 
                    ? 'ring-2 ring-purple-400 bg-purple-950/30 border-purple-400/80 shadow-[0_0_20px_rgba(168,85,247,0.25)]' 
                    : isToday 
                    ? 'border-purple-500/70 bg-purple-500/10 shadow-[0_0_12px_rgba(168,85,247,0.15)]' 
                    : 'border-white/10'
                }`}
              >
                {/* Top Row: Date Number and Notice Count Indicator */}
                <div className="flex items-center justify-between shrink-0">
                  <span className={`text-[12px] font-bold ${
                    isSelected ? 'text-purple-300 font-black' : isToday ? 'text-purple-400 font-extrabold' : 'text-slate-400'
                  }`}>
                    {dayNum}
                  </span>
                  
                  {cellDeadlines.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-white/5 px-1.5 py-0.2 rounded-full border border-white/10">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                      {cellDeadlines.length}
                    </span>
                  )}
                </div>
                
                {/* Badges directly below date number */}
                <div className="flex flex-col gap-1 overflow-hidden mt-0.5">
                  {cellDeadlines.map(dl => {
                    const badge = getNoticeBadge(dl);
                    return (
                      <div 
                        key={dl.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDateStr(currentDayStr);
                          if (onDeadlineClick) onDeadlineClick(dl);
                        }}
                        onMouseEnter={(e) => handleNoticeMouseEnter(e, dl)}
                        onMouseLeave={handleNoticeMouseLeave}
                        className={`text-[9.5px] leading-tight px-1.5 py-0.5 rounded-md border flex items-center gap-1 font-medium transition-all shadow-sm ${badge.badgeClass}`}
                      >
                        <span className="text-[8px] font-black uppercase tracking-wider px-1 py-0.2 rounded bg-black/40 border border-white/10 shrink-0">
                          {badge.code}
                        </span>
                        <span className="font-semibold truncate text-[9.5px]">
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-white/5 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300">Regulators:</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400"></span> Income Tax (TDS / Advance Tax)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400"></span> GST (GSTR-1 / GSTR-3B)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400"></span> Labour (EPFO / ESIC)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-400"></span> MCA (DIR-3 / AOC-4 / MGT-7)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400"></span> SEBI & RBI</span>
        </div>
      </div>

      {/* 2. CHRONOLOGICAL ACTION LIST & TIMELINE SCOPE */}
      <div className="bg-[#12131A]/95 backdrop-blur-xl rounded-2xl border border-white/10 p-5 sm:p-6 flex flex-col max-h-[580px] shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Timeline Queue</h3>
              <p className="text-[10px] text-slate-400">
                {selectedDateStr ? `Filtered for ${formattedSelectedDate}` : `Showing ${monthsStr[month]} ${year}`}
              </p>
            </div>
          </div>

          <select
            value={selectedAuthority}
            onChange={(e) => setSelectedAuthority(e.target.value)}
            className="text-[11px] bg-[#181820] border border-white/10 text-slate-300 rounded-xl focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/60 px-2.5 py-1.5 font-medium cursor-pointer transition-all"
          >
            <option value="ALL">All Authorities</option>
            <option value="GST">GST</option>
            <option value="INCOME TAX">Income Tax</option>
            <option value="LABOUR / EPFO">Labour / EPFO</option>
            <option value="MCA">MCA</option>
            <option value="RBI">RBI</option>
            <option value="SEBI">SEBI</option>
          </select>
        </div>

        {/* Selected Date Reset Banner */}
        {selectedDateStr && (
          <div className="flex items-center justify-between mb-3 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
            <span className="font-semibold">Notices for {formattedSelectedDate} ({queueDeadlines.length})</span>
            <button 
              onClick={() => setSelectedDateStr(null)}
              className="text-[11px] underline hover:text-white transition"
            >
              Show All Month
            </button>
          </div>
        )}

        {/* Scrollable Context Stack */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {queueDeadlines.length === 0 ? (
            <div className="text-center text-slate-500 py-16 text-xs flex flex-col items-center gap-2">
              <CalendarIcon className="h-8 w-8 text-slate-600 stroke-1" />
              <span>No statutory notices due for this selection.</span>
              {selectedDateStr && (
                <button 
                  onClick={() => setSelectedDateStr(null)} 
                  className="text-purple-400 underline text-xs mt-1"
                >
                  View all notices in {monthsStr[month]}
                </button>
              )}
            </div>
          ) : (
            queueDeadlines.map((item) => {
              const priorityConfig = getPriorityStyle(item.priority);
              const badge = getNoticeBadge(item);
              
              const formattedDate = new Date(item.due_date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
              });

              return (
                <div 
                  key={item.id} 
                  className="p-3.5 border border-white/10 bg-[#161622] rounded-xl hover:border-purple-500/40 hover:bg-[#1a1a27] transition-all flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-extrabold tracking-wide uppercase px-2 py-0.5 border rounded-md ${badge.badgeClass}`}>
                          {item.authority}
                        </span>
                        {item.form && (
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                            {item.form}
                          </span>
                        )}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${priorityConfig.bg}`}>
                          {item.priority}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 font-semibold">
                        Due: {formattedDate}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100 group-hover:text-white transition-colors leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {item.description || item.notes}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onDeadlineClick?.(item)}
                      className="w-full flex items-center justify-center gap-1.5 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/40 hover:border-purple-500 text-purple-200 hover:text-white rounded-xl py-2 text-xs font-semibold shadow-sm transition-all duration-200"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Analyze with Vidi RAG</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. FLOATING HOVER CARD FOR FULL NOTICE DETAILS */}
      {hoveredNotice && (
        <div 
          className="fixed z-[9999] pointer-events-none w-80 p-3.5 bg-[#171824] border border-purple-500/40 rounded-xl shadow-2xl backdrop-blur-2xl animate-fade-in text-xs"
          style={{ left: `${popoverPos.x}px`, top: `${popoverPos.y}px` }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${getNoticeBadge(hoveredNotice).badgeClass}`}>
                {hoveredNotice.authority}
              </span>
              {hoveredNotice.form && (
                <span className="text-[9px] font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded text-slate-300">
                  {hoveredNotice.form}
                </span>
              )}
            </div>
            <span className="text-[9px] font-mono text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded font-bold">
              {new Date(hoveredNotice.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>

          <h5 className="font-bold text-white text-[12px] leading-snug">
            {hoveredNotice.title}
          </h5>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {hoveredNotice.description || hoveredNotice.notes}
          </p>
          <div className="mt-2 text-[10px] text-purple-400 font-semibold flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Click date to view and analyze in timeline
          </div>
        </div>
      )}

    </div>
  );
}