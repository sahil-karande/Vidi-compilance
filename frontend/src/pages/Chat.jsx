import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom'; // Intercept incoming cross-dashboard automated prompts
import { chatAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ChatThread from '../components/ChatThread';
import { CitationDrawer } from '../components/CitationCard';

// Wire up the Day 28 component and hook
import PlainLegalToggle, { useLegalMode } from '../components/PlainLegalToggle';

export default function Chat() {
  const { signOut } = useAuth();
  const location = useLocation(); // Instantiate location listener
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [activeCitation, setActiveCitation] = useState(null);

  // Tracks the last manual or automated text input to allow toggle-to-resend logic
  const [lastQuery, setLastQuery] = useState('');

  // Persists mode logic and syncs seamlessly with localStorage
  const { mode: ragMode, setMode: setRagMode } = useLegalMode();

  const messagesEndRef = useRef(null);

  const handleSelectThread = async (threadId) => {
    if (!threadId || isLoading) return;
    setActiveThreadId(threadId);
    setActiveCitation(null);
    setIsLoading(true);
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
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Automated prompt execution engine linked to Dashboard click interactions
  const executeAutomatedQuery = useCallback(async (queryText, overrideMode) => {
    if (!queryText.trim() || isLoading) return;
    setIsLoading(true);

    const targetMode = overrideMode || ragMode;

    const userMessageObj = { 
      role: 'user', 
      content: queryText,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessageObj]);

    try {
      const data = await chatAPI.sendQuery(queryText, activeThreadId, targetMode);

      if (!activeThreadId && data.thread_id) {
        setActiveThreadId(data.thread_id);
        const updatedThreads = await chatAPI.getThreads();
        setThreads(updatedThreads || []);
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
    } catch (err) {
      console.error('RegIQ Backend Network Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Failed to pull compliance references. Please check that your FastAPI backend service is running smoothly.',
          created_at: new Date().toISOString()
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [activeThreadId, isLoading, ragMode]);

  // Handle immediate UI updates + system queries upon clicking the pill toggle
  const handleModeChange = (newMode) => {
    setRagMode(newMode);
    if (lastQuery) {
      executeAutomatedQuery(lastQuery, newMode);
    }
  };

  // INTERCEPT ROUTER STATE HANDLER: Catches incoming dashboard redirect links
  useEffect(() => {
    if (location.state?.initialQuery) {
      const dashboardPrompt = location.state.initialQuery;
      
      // Clear out router history instantly to prevent re-firing on standard page reloads
      window.history.replaceState({}, document.title);
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastQuery(dashboardPrompt);
      // Fire execution request against vector DB
      executeAutomatedQuery(dashboardPrompt);
    }
  }, [executeAutomatedQuery, location.state]);

  // CLEAN LIFECYCLE FIX: Resolves cascading render engine errors completely
  useEffect(() => {
    let isMounted = true;
    
    async function initializeSidebar() {
      try {
        const data = await chatAPI.getThreads();
        if (isMounted) {
          setThreads(data || []);
        }
      } catch (err) {
        console.error('Initial fallback fetch failed:', err);
      } finally {
        if (isMounted) {
          setIsSidebarLoading(false);
        }
      }
    }

    initializeSidebar();

    return () => {
      isMounted = false;
    };
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

  // Adapter function mapping metadata structure from internal engine formats
  const mapCitationToCardProps = (cite) => {
    if (!cite) return null;
    return {
      authority: cite.source || 'Regulatory Body',
      circular_no: cite.circular_no || 'Document Context',
      date: cite.date || 'N/A',
      section: cite.section || '',
      text: cite.excerpt || '',
      url: cite.url || ''
    };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', display: 'flex', padding: '24px', boxSizing: 'border-box', fontFamily: 'sans-serif', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* Container Framework */}
      <div style={{ display: 'flex', width: '100%', maxWidth: '1200px', height: '85vh', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', overflow: 'hidden', backdropFilter: 'blur(12px)', position: 'relative' }}>
        
        {/* Left Sidebar */}
        <div style={{ width: '260px', minWidth: '260px', background: 'rgba(15, 23, 42, 0.8)', borderRight: '1px solid rgba(51, 65, 85, 0.6)', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box' }}>
          <button
            onClick={handleStartNewChat}
            style={{ width: '100%', background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}
          >
            + New Chat Session
          </button>

          <div style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', textAlign: 'left' }}>Saved History</div>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {isSidebarLoading ? (
              <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>Loading sessions...</div>
            ) : threads.length === 0 ? (
              <div style={{ color: '#475569', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>No session logs found</div>
            ) : (
              threads.map((thread, index) => {
                const isActive = thread.id === activeThreadId;
                const displayId = thread.id ? String(thread.id).substring(0, 6) : index;
                
                return (
                  <button
                    key={thread.id || index}
                    onClick={() => handleSelectThread(thread.id)}
                    style={{ width: '100%', textAlign: 'left', background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent', border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent', borderRadius: '8px', padding: '10px', color: isActive ? '#818cf8' : '#94a3b8', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'all 0.2s' }}
                  >
                    💬 {thread.title || `Session ${displayId}`}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Main Chat Console Window */}
        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', background: 'transparent', position: 'relative', overflow: 'hidden' }}>
          
          {/* Top Header Controls Bar */}
          <div style={{ padding: '16px 24px', background: 'rgba(30, 41, 59, 0.4)', borderBottom: '1px solid rgba(51, 65, 85, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ margin: 0, fontSize: '17px', color: '#818cf8', fontWeight: '600' }}>RegIQ Real-Time Compliance Feed</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Grounded Legal Analysis and Source Citation</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              {/* Beautiful Pill Mode Switcher replacing old raw layout */}
              <PlainLegalToggle mode={ragMode} onModeChange={handleModeChange} />

              <button 
                onClick={() => signOut()} 
                style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
                onMouseEnter={(e) => e.target.style.borderColor = '#ef4444'}
                onMouseLeave={(e) => e.target.style.borderColor = '#334155'}
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Chat Messages Body Container Layout */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
            {messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', gap: '12px', width: '100%', height: '100%', margin: 'auto' }}>
                <div style={{ fontSize: '32px' }}>⚡</div>
                <p style={{ fontSize: '15px', color: '#94a3b8', margin: 0 }}>Ask a business compliance or regulatory question.</p>
                <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>RegIQ crawls RBI, SEBI, GST, and MCA parameters instantly.</p>
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Note: In Day 29, update ChatThread interior message wrappers to wrap with <AnswerText /> for style changes */}
                <ChatThread messages={messages} onSelectCitation={(cite) => setActiveCitation(cite)} />
              </div>
            )}

            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 0', color: '#818cf8', fontSize: '13px', fontStyle: 'italic', textAlign: 'left', width: '100%' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8' }}></span>
                Querying vectors and cross-matching compliance items...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Field Control Bar */}
          <form onSubmit={handleSendMessage} style={{ padding: '20px 24px', background: 'rgba(15, 23, 42, 0.8)', borderTop: '1px solid rgba(51, 65, 85, 0.6)', display: 'flex', gap: '14px', width: '100%', boxSizing: 'border-box' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ragMode === 'plain' ? "Ask about compliance rules in plain language..." : "Query exact legal clauses/circular context..."}
              style={{ flex: 1, background: '#020617', border: '1px solid #334155', borderRadius: '12px', padding: '14px 16px', color: '#f8fafc', fontSize: '14px', outline: 'none' }}
              disabled={isLoading}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()} 
              style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '0 24px', fontSize: '14px', cursor: 'pointer', fontWeight: '600', opacity: (isLoading || !input.trim()) ? 0.5 : 1 }}
            >
              {isLoading ? 'Processing...' : 'Send'}
            </button>
          </form>

          {/* Smooth Side-out Context Drawer Component overlay */}
          <CitationDrawer 
            citation={mapCitationToCardProps(activeCitation)} 
            onClose={() => setActiveCitation(null)} 
          />

        </div>
      </div>
    </div>
  );
}