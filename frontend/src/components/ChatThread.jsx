

export default function ChatThread({ messages }) {
  // Format timestamps neatly
  const formatTime = (dateString) => {
    try {
      const date = dateString ? new Date(dateString) : new Date();
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id || index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
              width: '100%',
            }}
          >
            {/* Speaker Label */}
            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
                marginBottom: '4px',
                paddingHorizontal: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {isUser ? 'You' : 'RegIQ Engine'}
            </span>

            {/* Bubble Content */}
            <div
              style={{
                padding: '16px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                maxWidth: '85%',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-line',
                background: isUser 
                  ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' 
                  : 'rgba(30, 41, 59, 0.7)',
                color: '#f8fafc',
                border: isUser ? 'none' : '1px solid rgba(129, 140, 248, 0.2)',
                boxShadow: isUser 
                  ? '0 4px 14px rgba(79, 70, 229, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.2)',
              }}
            >
              <p style={{ margin: 0 }}>{msg.content}</p>

              {/* Render Citations Container if available */}
              {!isUser && msg.citations && msg.citations.length > 0 && (
                <div 
                  style={{ 
                    marginTop: '12px', 
                    paddingTop: '10px', 
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}
                >
                  {msg.citations.map((cite, cIdx) => (
                    <span 
                      key={cIdx} 
                      style={{
                        background: 'rgba(129, 140, 248, 0.15)',
                        border: '1px solid rgba(129, 140, 248, 0.4)',
                        color: '#c7d2fe',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}
                    >
                      📄 {cite.circular_no || cite.source || 'Regulation Section'}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Timestamp */}
            <span
              style={{
                fontSize: '10px',
                color: '#475569',
                marginTop: '4px',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              {formatTime(msg.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}