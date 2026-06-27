import { AnswerText } from './PlainLegalToggle';

export default function ChatThread({ messages, mode = 'plain', onSelectCitation }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
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
              boxSizing: 'border-box'
            }}
          >
            {/* Speaker Label */}
            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
                marginBottom: '4px',
                padding: '0 4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                alignSelf: isUser ? 'flex-end' : 'flex-start'
              }}
            >
              {isUser ? 'You' : 'RegIQ Engine'}
            </span>

            {/* Bubble Content */}
            <div
              style={{
                padding: '16px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                maxWidth: '75%',
                width: 'auto',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: isUser ? 'pre-wrap' : 'normal', // Let AnswerText handle the structural flow for engine blocks
                wordBreak: 'break-word',
                textAlign: 'left',
                background: isUser 
                  ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' 
                  : 'rgba(30, 41, 59, 0.7)',
                color: '#f8fafc',
                border: isUser ? 'none' : '1px solid rgba(129, 140, 248, 0.2)',
                boxShadow: isUser 
                  ? '0 4px 14px rgba(79, 70, 229, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.2)',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ textAlign: 'left', width: '100%' }}>
                {isUser ? (
                  msg.content
                ) : (
                  <AnswerText text={msg.content} mode={mode} />
                )}
              </div>

              {/* Render Citations Container if available */}
              {!isUser && msg.citations && msg.citations.length > 0 && (
                <div 
                  style={{ 
                    marginTop: '12px', 
                    paddingTop: '10px', 
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    justifyContent: 'flex-start'
                  }}
                >
                  {msg.citations.map((cite, cIdx) => (
                    <button 
                      key={cIdx}
                      type="button"
                      onClick={() => onSelectCitation(cite)}
                      style={{
                        background: 'rgba(129, 140, 248, 0.15)',
                        border: '1px solid rgba(129, 140, 248, 0.4)',
                        color: '#c7d2fe',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(129, 140, 248, 0.3)'}
                      onMouseLeave={(e) => e.target.style.background = 'rgba(129, 140, 248, 0.15)'}
                    >
                      📄 {cite.circular_no || cite.source || 'Section Link'}
                    </button>
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
                padding: '0 4px'
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