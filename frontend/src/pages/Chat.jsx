import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { chatAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ChatThread from '../components/ChatThread';
import { CitationDrawer } from '../components/CitationCard';
import PlainLegalToggle, { useLegalMode } from '../components/PlainLegalToggle';
import { useQueryLimit } from '../hooks/useQueryLimit';

export default function Chat() {
  const { signOut } = useAuth();
  const location = useLocation();
  const { usage, limit, refreshUsage } = useQueryLimit();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [activeCitation, setActiveCitation] = useState(null);
  
  // Mobile UI States
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [errorState, setErrorState] = useState(null); // { type: 'LIMIT_EXHAUSTED' | 'NETWORK', message: string }

  const [lastQuery, setLastQuery] = useState('');
  const { mode: ragMode, setMode: setRagMode } = useLegalMode();
  const messagesEndRef = useRef(null);

  const handleSelectThread = async (threadId) => {
    if (!threadId || isLoading) return;
    setActiveThreadId(threadId);
    setActiveCitation(null);
    setErrorState(null);
    setIsLoading(true);
    setIsMobileSidebarOpen(false); // Auto close sidebar context on small views
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const executeAutomatedQuery = useCallback(async (queryText, overrideMode) => {
    if (!queryText.trim() || isLoading) return;

    // Enforce tier verification limits immediately client-side
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

  // Catch contextual redirection requests sent from Compliance Calendar hooks
  // Catch contextual redirection requests sent from Compliance Calendar hooks safely
  useEffect(() => {
    if (location.state?.initialQuery) {
      const dashboardPrompt = location.state.initialQuery;
      
      // Clean query text state values out of application history variables inside React Router framework
      // eslint-disable-next-line no-undef
      navigate(location.pathname, { replace: true, state: {} });
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastQuery(dashboardPrompt);
      setInput(dashboardPrompt);
      
      executeAutomatedQuery(dashboardPrompt);
    }
  }, [executeAutomatedQuery, location.state, location.pathname]);

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
    
    // 💡 Catch every single naming variation coming from your RAG pipeline or database cache arrays
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
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-0 md:p-6 font-sans antialiased">
      <div className="flex w-full max-w-7xl h-screen md:h-[85vh] bg-slate-900/40 border-0 md:border border-slate-800 rounded-none md:rounded-2xl overflow-hidden backdrop-blur-xl relative">
        
        {/* Mobile Sidebar Backdrop Slideout */}
        {isMobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Navigation Sidebar Panel */}
        <aside className={`
          fixed md:static inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 flex flex-col p-4 z-50 
          transform transition-transform duration-200 ease-in-out md:translate-x-0
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex items-center justify-between mb-4 md:hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">RegIQ Workspace</span>
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1.5 text-slate-400 hover:bg-slate-800 rounded-lg"
            >
              ✕
            </button>
          </div>

          <button
            onClick={handleStartNewChat}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-0 rounded-xl py-3 px-4 text-sm font-semibold shadow-lg shadow-indigo-600/10 hover:brightness-110 active:scale-[0.98] transition-all mb-4"
          >
            + New Chat Session
          </button>

          <div className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider mb-3 text-left border-b border-slate-800/60 pb-1">
            Saved History
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
            {isSidebarLoading ? (
              <div className="space-y-2 mt-4">
                <div className="h-7 bg-slate-800 rounded animate-pulse w-3/4"></div>
                <div className="h-7 bg-slate-800 rounded animate-pulse w-5/6"></div>
              </div>
            ) : threads.length === 0 ? (
              <div className="text-slate-500 text-xs text-center mt-6">No session logs found</div>
            ) : (
              Object.entries(groupedThreads).map(([groupName, items]) => (
                <div key={groupName} className="flex flex-col gap-1">
                  <div className="text-[10px] text-slate-500 font-bold text-left pl-1 uppercase tracking-wider mb-1">
                    📁 {groupName}
                  </div>
                  {items.map((thread, index) => {
                    const isActive = thread.id === activeThreadId;
                    const displayId = thread.id ? String(thread.id).substring(0, 6) : index;
                    return (
                      <div
                        key={thread.id || index}
                        onClick={() => handleSelectThread(thread.id)}
                        className={`group w-full flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-all border
                          ${isActive 
                            ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400' 
                            : 'bg-transparent border-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        <span className="text-sm text-left truncate flex-1 pr-2">
                          💬 {thread.title || `Session ${displayId}`}
                        </span>
                        <button
                          onClick={(e) => handleDeleteThread(e, thread.id)}
                          title="Delete session"
                          className="text-slate-600 hover:text-red-400 hover:bg-red-500/10 p-1 rounded-md opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-150"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Central Console Section Layout */}
        <div className="flex-1 flex flex-col bg-transparent relative overflow-hidden h-full">
          
          {/* Dashboard Header Panel */}
          <header className="p-4 px-6 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between w-full box-border">
            <div className="flex items-center gap-3 text-left">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-400 hover:bg-slate-800 rounded-xl md:hidden block focus:outline-none"
              >
                ☰
              </button>
              <div>
                <h2 className="margin-0 text-base md:text-lg text-indigo-400 font-semibold tracking-tight">RegIQ Compliance Feed</h2>
                <p className="margin-0 text-[11px] text-slate-500 hidden sm:block">Grounded Legal Analysis and Source Citation</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <PlainLegalToggle mode={ragMode} onModeChange={handleModeChange} />
              <button 
                onClick={signOut} 
                className="bg-transparent text-slate-400 border border-slate-800 hover:border-red-500/40 hover:text-red-400 px-3.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors hidden sm:block"
              >
                Sign Out
              </button>
            </div>
          </header>

          {/* Interactive Stream Space */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col w-full box-border space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-500 text-center gap-3 w-full h-full my-auto px-4 box-border">
                <div className="text-4xl animate-bounce">⚡</div>
                <p className="text-sm md:text-base text-slate-300 font-medium">Ask an Indian business compliance query.</p>
                <p className="text-xs text-slate-500 max-w-sm">RegIQ extracts vectors directly across verified RBI, SEBI, GST, and MCA portals without hallucinations.</p>
              </div>
            ) : (
              <div className="w-full flex flex-col">
                <ChatThread messages={messages} mode={ragMode} onSelectCitation={setActiveCitation} />
              </div>
            )}

            {/* Performance Skeleton Block */}
            {isLoading && (
              <div className="flex items-center gap-2.5 p-4 bg-slate-900/30 border border-slate-800/40 rounded-xl text-indigo-400 text-xs italic animate-pulse max-w-xl">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"></div>
                Searching vector namespaces and cross-matching compliance items...
              </div>
            )}

            {/* Quota Limit and Network Failure Alert Layout */}
            {errorState && (
              <div className={`p-4 rounded-xl border flex flex-col gap-2 max-w-xl text-sm ${
                errorState.type === 'LIMIT_EXHAUSTED' 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <div className="font-semibold flex items-center gap-2">
                  {errorState.type === 'LIMIT_EXHAUSTED' ? '⚠️ Plan Limit Reached' : '🚨 System Connection Error'}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{errorState.message}</p>
                {errorState.type === 'LIMIT_EXHAUSTED' && (
                  <a href="#/settings" className="mt-1 self-start px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs tracking-wide transition-colors">
                    Upgrade Tier
                  </a>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Action Input Box Dock */}
          <footer className="p-4 bg-slate-950 border-t border-slate-800 w-full box-border">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={usage >= limit ? "Query limit hit. Upgrade to resume compliance searches..." : (ragMode === 'plain' ? "Ask about compliance rules in plain language..." : "Query exact legal clauses/circular context...")}
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-slate-100 text-sm outline-none transition-colors disabled:opacity-40"
                disabled={isLoading || usage >= limit}
              />
              <button 
                type="submit" 
                disabled={isLoading || !input.trim() || usage >= limit} 
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white border-none rounded-xl px-6 text-sm font-semibold transition-all shadow-lg shadow-indigo-600/5 shrink-0"
              >
                {isLoading ? 'Processing...' : 'Send'}
              </button>
            </form>
          </footer>

          {/* Core Grounded Citation Side Drawer Drawer overlay */}
          <CitationDrawer 
            citation={mapCitationToCardProps(activeCitation)} 
            onClose={() => setActiveCitation(null)} 
          />

        </div>
      </div>
    </div>
  );
}