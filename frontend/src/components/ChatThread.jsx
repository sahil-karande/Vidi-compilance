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
            className="animate-message-enter"
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
              {isUser ? 'You' : 'VIDI ENGINE'}
            </span>

            {/* Bubble Content */}
            <div
              className={`w-full transition-all box-border ${
                isUser 
                  ? 'max-w-[88%] sm:max-w-[75%]' 
                  : 'max-w-full sm:max-w-[92%] md:max-w-[88%]'
              }`}
              style={{
                padding: '14px 16px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: isUser ? 'pre-wrap' : 'normal',
                wordBreak: 'break-word',
                textAlign: 'left',
                background: isUser 
                  ? 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)' 
                  : '#12131A',
                color: '#f8fafc',
                border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: isUser 
                  ? '0 4px 14px rgba(147, 51, 234, 0.35)' 
                  : '0 4px 20px rgba(0, 0, 0, 0.5)',
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
                        background: 'rgba(168, 85, 247, 0.12)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        color: '#d8b4fe',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(168, 85, 247, 0.25)';
                        e.target.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(168, 85, 247, 0.12)';
                        e.target.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                      }}
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