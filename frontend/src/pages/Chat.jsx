import { useState } from 'react';
import { chatAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export default function Chat() {
  const { signOut } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userPrompt = input.trim();
    setInput('');
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }]);

    try {
      const data = await chatAPI.sendQuery(userPrompt, activeThreadId, 'plain');

      if (!activeThreadId && data.thread_id) {
        setActiveThreadId(data.thread_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error connecting to backend. Please check your FastAPI server.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '768px', display: 'flex', flexDirection: 'column', height: '80vh', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(51, 65, 85, 0.8)', borderRadius: '16px', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.6)', borderBottom: '1px solid rgba(51, 65, 85, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#818cf8' }}>RegIQ Real-Time RAG Stream</h2>
          <button onClick={() => signOut()} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Sign Out</button>
        </div>

        {/* Messages Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center' }}>
              <p>Send a prompt below to test your database loops.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ padding: '16px', borderRadius: '12px', maxWidth: '512px', fontSize: '14px', background: msg.role === 'user' ? '#4f46e5' : 'rgba(30, 41, 59, 0.9)', color: '#fff', border: msg.role === 'user' ? 'none' : '1px solid rgba(51, 65, 85, 0.8)' }}>
                  <p style={{ margin: 0 }}>{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.4)', borderTop: '1px solid rgba(51, 65, 85, 0.8)', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter prompt..."
            style={{ flex: 1, background: '#020617', border: '1px solid #334155', borderRadius: '12px', padding: '12px 16px', color: '#f8fafc', fontSize: '14px', outline: 'none' }}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()} style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '0 20px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isLoading ? 'Processing...' : 'Send'}
          </button>
        </form>

      </div>
    </div>
  );
}