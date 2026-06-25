import  { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ChatThread from '../components/ChatThread';

export default function Chat() {
  const { signOut } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // RAG Mode Toggle State: 'plain' (8th-grade simplified) or 'legal' (formal statutory text)
  const [ragMode, setRagMode] = useState('plain');

  const messagesEndRef = useRef(null);

  // Automatically scroll chat context downward on new tokens/replies
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userPrompt = input.trim();
    setInput('');
    setIsLoading(true);

    // Append user query client-side immediately
    const userMessageObj = { 
      role: 'user', 
      content: userPrompt,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessageObj]);

    try {
      // Connects to POST /api/query matching your axios definitions
      const data = await chatAPI.sendQuery(userPrompt, activeThreadId, ragMode);

      if (!activeThreadId && data.thread_id) {
        setActiveThreadId(data.thread_id);
      }

      // Append RegIQ grounding answer
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
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '896px', display: 'flex', flexDirection: 'column', height: '85vh', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', overflow: 'hidden', backdropFilter: 'blur(12px)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
        
        {/* Workspace Top Header */}
        <div style={{ padding: '16px 24px', background: 'rgba(30, 41, 59, 0.5)', borderBottom: '1px solid rgba(51, 65, 85, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#818cf8', fontWeight: '600', letterSpacing: '-0.025em' }}>RegIQ Real-Time Compliance Feed</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Grounded Legal Analysis and Source Citation</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Plain vs Legal prompt Strategy Control Toggle */}
            <div style={{ display: 'flex', background: '#0f172a', borderRadius: '8px', padding: '4px', border: '1px solid #334155' }}>
              <button 
                type="button"
                onClick={() => setRagMode('plain')}
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: ragMode === 'plain' ? '#4f46e5' : 'transparent', color: '#fff', transition: 'all 0.2s' }}
              >
                Plain English
              </button>
              <button 
                type="button"
                onClick={() => setRagMode('legal')}
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: ragMode === 'legal' ? '#4f46e5' : 'transparent', color: '#fff', transition: 'all 0.2s' }}
              >
                Statutory Code
              </button>
            </div>

            <button 
              onClick={() => signOut()} 
              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s', hover: { color: '#ef4444' } }}
              onMouseEnter={(e) => e.target.style.borderColor = '#ef4444'}
              onMouseLeave={(e) => e.target.style.borderColor = '#334155'}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Scrollable Conversation Matrix */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', gap: '8px', margin: 'auto' }}>
              <div style={{ fontSize: '32px' }}>⚡</div>
              <p style={{ fontSize: '15px', color: '#94a3b8', margin: 0 }}>Ask a business compliance or regulatory question.</p>
              <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>RegIQ crawls RBI, SEBI, GST, and MCA parameters instantly.</p>
            </div>
          ) : (
            <ChatThread messages={messages} />
          )}

          {/* Inline Loading / RAG Generation Indicator */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', color: '#818cf8', fontSize: '13px', fontStyle: 'italic' }}>
              <span className="animate-pulse" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8' }}></span>
              Querying vectors and cross-matching compliance items...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Query Input Action Footer */}
        <form onSubmit={handleSendMessage} style={{ padding: '20px 24px', background: 'rgba(15, 23, 42, 0.8)', borderTop: '1px solid rgba(51, 65, 85, 0.6)', display: 'flex', gap: '14px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ragMode === 'plain' ? "Ask about compliance rules in plain language..." : "Query exact legal clauses/circular context..."}
            style={{ flex: 1, background: '#020617', border: '1px solid #334155', borderRadius: '12px', padding: '14px 16px', color: '#f8fafc', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
            disabled={isLoading}
            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
            onBlur={(e) => e.target.style.borderColor = '#334155'}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '0 24px', fontSize: '14px', cursor: 'pointer', fontWeight: '600', transition: 'opacity 0.2s', opacity: (isLoading || !input.trim()) ? 0.5 : 1 }}
          >
            {isLoading ? 'Processing...' : 'Send'}
          </button>
        </form>

      </div>
    </div>
  );
}