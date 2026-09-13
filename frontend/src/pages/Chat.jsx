import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { chatAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ChatThread from '../components/ChatThread';
import { CitationDrawer } from '../components/CitationCard';
import PlainLegalToggle, { useLegalMode } from '../components/PlainLegalToggle';
import { useQueryLimit } from '../hooks/useQueryLimit';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Folder, 
  Download, 
  Send, 
  AlertTriangle, 
  AlertCircle, 
  Sparkles, 
  X, 
  Menu,
  FileText,
  ChevronRight
} from 'lucide-react';

export default function Chat() {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate(); 
  const { usage, limit, refreshUsage } = useQueryLimit();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false); // Local state tracker for generating file arrays
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [activeCitation, setActiveCitation] = useState(null);
  
  // Mobile UI States
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [errorState, setErrorState] = useState(null); 

  const [lastQuery, setLastQuery] = useState('');
  const { mode: ragMode, setMode: setRagMode } = useLegalMode();
  const messagesEndRef = useRef(null);

  const handleSelectThread = async (threadId) => {
    if (!threadId || isLoading) return;
    setActiveThreadId(threadId);
    setActiveCitation(null);
    setErrorState(null);
    setIsLoading(true);
    setIsMobileSidebarOpen(false); 
    try {
      const history = await chatAPI.getThreadMessages(threadId);
      setMessages(history || []);
    } catch (err) {
      console.error('Error opening thread context:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewChat = () => {
    if (isLoading) return;
    setActiveThreadId(null);
    setMessages([]);
    setActiveCitation(null);
    setLastQuery('');
    setErrorState(null);
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteThread = async (e, threadId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to permanently delete this compliance session log?')) {
      try {
        await chatAPI.deleteThread(threadId);
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (activeThreadId === threadId) {
          handleStartNewChat();
        }
      } catch (err) {
        console.error('Failed to remove compliance session:', err);
        setErrorState({ type: 'NETWORK', message: 'Could not delete session log. Please check your connection.' });
      }
    }
  };

  const handleExportPDF = async () => {
    if (!activeThreadId || isExporting) return;
    try {
      setIsExporting(true);
      setErrorState(null);
      await chatAPI.exportThreadPDF(activeThreadId);
    } catch (err) {
      console.error('Export button triggered backend failure:', err);
      setErrorState({
        type: 'NETWORK',
        message: 'Could not render PDF. Please ensure your FastAPI server is active and has ReportLab installed.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const executeAutomatedQuery = useCallback(async (queryText, overrideMode) => {
    if (!queryText.trim() || isLoading) return;

    if (usage >= limit) {
      setErrorState({
        type: 'LIMIT_EXHAUSTED',
        message: `You have exhausted your daily query limit (${usage}/${limit}). Upgrade to Pro for unlimited access.`
      });
      return;
    }

    setIsLoading(true);
    setErrorState(null);
    const targetMode = overrideMode || ragMode;

    const userMessageObj = { 
      role: 'user', 
      content: queryText,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessageObj]);

    try {
      const data = await chatAPI.sendQuery(queryText, activeThreadId, targetMode);

      const updatedThreads = await chatAPI.getThreads();
      setThreads(updatedThreads || []);

      if (!activeThreadId && data.thread_id) {
        setActiveThreadId(data.thread_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations || [],
          created_at: new Date().toISOString()
        },
      ]);
      
      if (refreshUsage) refreshUsage();
    } catch (err) {
      console.error('RegIQ Backend Network Error:', err);
      setErrorState({
        type: 'NETWORK',
        message: 'Failed to pull compliance references. Please check that your FastAPI backend service is running smoothly.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeThreadId, isLoading, ragMode, usage, limit, refreshUsage]);

  const handleModeChange = (newMode) => {
    setRagMode(newMode);
    if (lastQuery) {
      executeAutomatedQuery(lastQuery, newMode);
    }
  };

  useEffect(() => {
    if (location.state?.initialQuery) {
      const dashboardPrompt = location.state.initialQuery;
      
      navigate(location.pathname, { replace: true, state: {} });
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastQuery(dashboardPrompt);
      setInput(dashboardPrompt);
      
      executeAutomatedQuery(dashboardPrompt);
    }
  }, [executeAutomatedQuery, location.state, location.pathname, navigate]);

  useEffect(() => {
    let isMounted = true;
    async function initializeSidebar() {
      try {
        const data = await chatAPI.getThreads();
        if (isMounted) setThreads(data || []);
      } catch (err) {
        console.error('Initial fallback fetch failed:', err);
      } finally {
        if (isMounted) setIsSidebarLoading(false);
      }
    }
    initializeSidebar();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userPrompt = input.trim();
    setInput('');
    setLastQuery(userPrompt);
    await executeAutomatedQuery(userPrompt);
  };

  const mapCitationToCardProps = (cite) => {
    if (!cite) return null;
    
    const resolvedTitle = cite.title || cite.source || cite.filename || cite.authority || 'GST Compliance Document';
    const resolvedText = cite.preview || cite.text || cite.excerpt || cite.content || cite.page_content || 'Regulatory context fragment attached.';
    const resolvedNo = cite.circular_no || cite.circular || 'Document Reference Context';
    const resolvedDate = cite.date || cite.notification_date || '2026-06-13';
    const resolvedSec = cite.section || cite.relevant_section || `Clause Index: ${resolvedNo}`;

    return {
      authority: String(resolvedTitle),
      circular_no: String(resolvedNo),
      date: String(resolvedDate),
      section: String(resolvedSec),
      text: String(resolvedText),
      url: cite.url || ''
    };
  };

  const getGroupedThreads = () => {
    const groups = {
      'GST Compliance': [],
      'RBI Framework': [],
      'SEBI Directives': [],
      'MCA & Corporate Acts': [],
      'General Compliance': []
    };

    threads.forEach((thread) => {
      const tags = Array.isArray(thread.corpus_tags) ? thread.corpus_tags.map(t => t.toUpperCase()) : [];
      if (tags.includes('GST')) groups['GST Compliance'].push(thread);
      else if (tags.includes('RBI') || tags.includes('FEMA')) groups['RBI Framework'].push(thread);
      else if (tags.includes('SEBI')) groups['SEBI Directives'].push(thread);
      else if (tags.includes('MCA')) groups['MCA & Corporate Acts'].push(thread);
      else groups['General Compliance'].push(thread);
    });

    return Object.fromEntries(Object.entries(groups).filter(([, items]) => items.length > 0));
  };

  const groupedThreads = getGroupedThreads();

  return (
    <div className="w-full h-[calc(100vh-53px)] bg-transparent text-slate-100 flex overflow-hidden font-sans antialiased">
      
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* ── Left Sidebar: Sessions & Threads ── */}
      <aside className={`
        fixed md:static inset-y-0 left-0 w-72 bg-[#12131A]/95 backdrop-blur-xl border-r border-white/10 flex flex-col p-4 z-50 shrink-0
        transform transition-transform duration-200 ease-in-out md:translate-x-0
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-3 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Research Sessions</span>
          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleStartNewChat}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-2.5 px-3.5 text-xs font-semibold shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.45)] transition-all flex items-center justify-center gap-2 mb-4"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Research Session</span>
        </button>

        <div className="text-[10px] text-slate-500 font-mono font-semibold uppercase tracking-wider mb-2 px-1">
          Historical Inquiries
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
          {isSidebarLoading ? (
            <div className="space-y-2 mt-2">
              <div className="h-6 bg-[#16161F] rounded animate-pulse w-3/4" />
              <div className="h-6 bg-[#16161F] rounded animate-pulse w-5/6" />
            </div>
          ) : threads.length === 0 ? (
            <div className="text-slate-500 text-xs text-center py-6">No previous inquiries</div>
          ) : (
            Object.entries(groupedThreads).map(([groupName, items]) => (
              <div key={groupName} className="flex flex-col gap-1">
                <div className="text-[10px] text-slate-400 font-medium px-1 flex items-center gap-1.5 uppercase tracking-wider">
                  <Folder className="w-3 h-3 text-purple-400" />
                  <span>{groupName}</span>
                </div>
                {items.map((thread, index) => {
                  const isActive = thread.id === activeThreadId;
                  const displayId = thread.id ? String(thread.id).substring(0, 6) : index;
                  return (
                    <div
                      key={thread.id || index}
                      onClick={() => handleSelectThread(thread.id)}
                      className={`group w-full flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-all border ${
                        isActive 
                          ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 font-medium shadow-[0_0_10px_rgba(168,85,247,0.15)]' 
                          : 'bg-transparent border-transparent hover:bg-[#16161F] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        <MessageSquare className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate text-xs">
                          {thread.title || `Session ${displayId}`}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteThread(e, thread.id)}
                        title="Delete session"
                        className="text-slate-600 hover:text-rose-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Chat Stream Workspace ── */}
      <div className="flex-1 flex flex-col bg-transparent relative overflow-hidden h-full">
        
        {/* Workspace Sub-Header */}
        <header className="px-3 sm:px-6 py-2.5 sm:py-3 bg-[#12131A]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-md md:hidden focus:outline-none shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-semibold text-white truncate">Regulatory Research Assistant</h2>
                <span className="hidden sm:inline-flex text-[10px] text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 whitespace-nowrap">
                  Zero Hallucination
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-400 truncate">Statutory ground truth across GST, RBI, SEBI, MCA, and FEMA</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {activeThreadId && messages.length > 0 && (
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium border border-white/10 rounded-xl bg-[#181820] hover:bg-[#20202c] hover:border-white/20 text-slate-300 hover:text-white transition-all disabled:opacity-40"
              >
                {isExporting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-slate-400 border-t-purple-500 rounded-full animate-spin" />
                    <span className="hidden sm:inline">Rendering...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span className="hidden sm:inline">Export PDF</span>
                  </>
                )}
              </button>
            )}
            <PlainLegalToggle mode={ragMode} onModeChange={handleModeChange} />
          </div>
        </header>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:px-12 flex flex-col w-full space-y-4 sm:space-y-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto my-auto py-12">
              <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                Indian Statutory Compliance Intelligence
              </h3>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
                Query official circulars, master directions, and notifications. Every response cites exact sections and gazette publications.
              </p>

              {/* Suggested Questions Grid */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {[
                  { text: "GST Input Tax Credit reversal conditions under Rule 42/43", tag: "GST" },
                  { text: "RBI Overseas Direct Investment reporting compliance via Form FC-GPR", tag: "RBI" },
                  { text: "SEBI LODR Regulation 30 material event disclosure timeline", tag: "SEBI" },
                  { text: "MCA annual filing deadlines and DIR-3 KYC compliance for Directors", tag: "MCA" }
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(item.text);
                      executeAutomatedQuery(item.text, ragMode);
                    }}
                    className="p-3.5 rounded-xl bg-[#12131A]/90 hover:bg-[#16161F] border border-white/10 hover:border-purple-500/40 text-xs text-slate-300 hover:text-white transition-all flex flex-col justify-between group shadow-lg"
                  >
                    <span className="leading-snug mb-2">{item.text}</span>
                    <span className="text-[10px] font-mono font-semibold text-purple-400 self-start">
                      {item.tag} Framework →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-5xl mx-auto flex flex-col">
              <ChatThread messages={messages} mode={ragMode} onSelectCitation={setActiveCitation} />
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-3 p-3.5 bg-[#12131A]/90 border border-purple-500/30 rounded-xl text-purple-300 text-xs max-w-xl mx-auto shadow-xl">
              <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
              <span>Matching statutory clauses and re-ranking candidate circulars...</span>
            </div>
          )}

          {errorState && (
            <div className={`p-4 rounded-xl border max-w-xl mx-auto w-full text-xs space-y-2 shadow-xl ${
              errorState.type === 'LIMIT_EXHAUSTED' 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="font-semibold flex items-center gap-2">
                {errorState.type === 'LIMIT_EXHAUSTED' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>{errorState.type === 'LIMIT_EXHAUSTED' ? 'Daily Allocation Reached' : 'System Notice'}</span>
              </div>
              <p className="text-slate-400 leading-relaxed">{errorState.message}</p>
              {errorState.type === 'LIMIT_EXHAUSTED' && (
                <button 
                  onClick={() => navigate('/pricing')} 
                  className="mt-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Upgrade to Unlimited Plan
                </button>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Command Bar */}
        <footer className="p-4 bg-[#12131A]/90 backdrop-blur-md border-t border-white/10 w-full shrink-0">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2 bg-[#181820] border border-white/10 rounded-xl p-1.5 focus-within:border-purple-500/60 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={usage >= limit ? "Daily allocation reached. Upgrade plan to continue..." : (ragMode === 'plain' ? "Ask any business compliance question in plain language..." : "Search official circular numbers, statutory clauses, or notifications...")}
              className="flex-1 bg-transparent px-3 py-2 text-slate-100 text-xs outline-none placeholder:text-slate-500 disabled:opacity-40"
              disabled={isLoading || usage >= limit}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim() || usage >= limit} 
              className="bg-purple-600 hover:bg-purple-500 disabled:bg-[#12131A] disabled:text-slate-600 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.45)] transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>Query</span>
              <Send className="w-3 h-3" />
            </button>
          </form>
        </footer>

        {/* Citation Metadata Inspector Drawer */}
        <CitationDrawer 
          citation={mapCitationToCardProps(activeCitation)} 
          onClose={() => setActiveCitation(null)} 
        />

      </div>
    </div>
  );
}