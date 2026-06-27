/**
 * Vidi — frontend/src/components/PlainLegalToggle.jsx
 * Day 28 Task: Plain / Legal Mode Toggle
 *
 * Toggle between two answer modes:
 *   PLAIN  — simple English, bullet points, 8th-grade level
 *   LEGAL  — formal language, full section references, citations
 *
 * Features:
 * - Persists preference in localStorage across sessions
 * - Calls onModeChange(newMode) so Chat.jsx can re-send the last query
 * - Shows a visual tooltip explaining the difference
 * - Smooth animated toggle pill
 *
 * Usage in Chat.jsx:
 *   import PlainLegalToggle from '../components/PlainLegalToggle';
 *   <PlainLegalToggle mode={mode} onModeChange={setMode} />
 *
 * Hook usage (standalone):
 *   import { useLegalMode } from '../components/PlainLegalToggle';
 *   const { mode, setMode } = useLegalMode();
 */

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────

export const MODE_PLAIN = 'plain';
export const MODE_LEGAL = 'legal';
const STORAGE_KEY = 'vidi_answer_mode';

// ─────────────────────────────────────────────────────────────
//  Hook — use this in Chat.jsx to manage mode state
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useLegalMode() {
  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || MODE_PLAIN;
    } catch {
      return MODE_PLAIN;
    }
  });

  const setMode = (newMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // localStorage unavailable — continue without persisting
    }
  };

  return { mode, setMode, isLegal: mode === MODE_LEGAL };
}

// ─────────────────────────────────────────────────────────────
//  PlainLegalToggle Component
// ─────────────────────────────────────────────────────────────

export default function PlainLegalToggle({ mode = MODE_PLAIN, onModeChange }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isLegal = mode === MODE_LEGAL;

  const handleToggle = () => {
    const newMode = isLegal ? MODE_PLAIN : MODE_LEGAL;
    onModeChange?.(newMode);
  };

  return (
    <div style={styles.wrapper}>
      {/* Mode labels */}
      <span
        style={{
          ...styles.modeLabel,
          color: !isLegal ? '#fff' : '#666',
          fontWeight: !isLegal ? 600 : 400,
        }}
      >
        Plain
      </span>

      {/* Toggle pill */}
      <button
        onClick={handleToggle}
        style={{
          ...styles.pill,
          background: isLegal ? '#3C3489' : '#1D9E75',
        }}
        title={isLegal ? 'Switch to Plain English' : 'Switch to Legal language'}
        aria-label={`Switch to ${isLegal ? 'plain' : 'legal'} mode`}
      >
        <div
          style={{
            ...styles.thumb,
            transform: isLegal ? 'translateX(18px)' : 'translateX(0px)',
          }}
        />
      </button>

      {/* Mode labels */}
      <span
        style={{
          ...styles.modeLabel,
          color: isLegal ? '#fff' : '#666',
          fontWeight: isLegal ? 600 : 400,
        }}
      >
        Legal
      </span>

      {/* Info icon + tooltip */}
      <div style={styles.infoWrapper}>
        <button
          style={styles.infoButton}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip((v) => !v)}
          aria-label="What is Plain vs Legal mode?"
        >
          ?
        </button>

        {showTooltip && (
          <div style={styles.tooltip}>
            <div style={styles.tooltipSection}>
              <span style={{ ...styles.tooltipBadge, background: '#E1F5EE', color: '#085041' }}>
                Plain
              </span>
              <p style={styles.tooltipText}>
                Simple English, bullet points, 8th-grade reading level.
                Best for SME owners who need quick, actionable answers.
              </p>
            </div>
            <div style={styles.tooltipDivider} />
            <div style={styles.tooltipSection}>
              <span style={{ ...styles.tooltipBadge, background: '#EEEDFE', color: '#3C3489' }}>
                Legal
              </span>
              <p style={styles.tooltipText}>
                Formal legal language, full section references, precise citations.
                Best for CAs, lawyers, and compliance officers.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Active mode indicator chip */}
      <span style={{
        ...styles.activeChip,
        background: isLegal ? 'rgba(60,52,137,0.15)' : 'rgba(29,158,117,0.15)',
        color: isLegal ? '#8B85D4' : '#1D9E75',
        border: `1px solid ${isLegal ? 'rgba(60,52,137,0.3)' : 'rgba(29,158,117,0.3)'}`,
      }}>
        {isLegal ? '⚖ Legal mode' : '✦ Plain mode'}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Answer renderer — applies visual diff based on mode
//  Use this in Chat.jsx to display the answer text
// ─────────────────────────────────────────────────────────────

export function AnswerText({ text = '', mode = MODE_PLAIN }) {
  const isLegal = mode === MODE_LEGAL;

  if (!text) return null;

  // Split into lines for rendering
  const lines = text.split('\n').filter(Boolean);

  return (
    <div style={{
      ...answerStyles.base,
      ...(isLegal ? answerStyles.legal : answerStyles.plain),
    }}>
      {lines.map((line, i) => {
        const isBullet = line.trim().startsWith('•') ||
                         line.trim().startsWith('-') ||
                         line.trim().startsWith('*');
        const isNumbered = /^\d+\./.test(line.trim());
        const isHeading = line.trim().startsWith('**') && line.trim().endsWith('**');

        if (isHeading) {
          return (
            <p key={i} style={answerStyles.heading}>
              {line.replace(/\*\*/g, '')}
            </p>
          );
        }

        if (isBullet || isNumbered) {
          return (
            <div key={i} style={answerStyles.bulletRow}>
              <span style={answerStyles.bulletDot}>
                {isNumbered ? line.match(/^\d+\./)[0] : '•'}
              </span>
              <span>
                {line.replace(/^[•\-*]\s*/, '').replace(/^\d+\.\s*/, '')}
              </span>
            </div>
          );
        }

        return (
          <p key={i} style={isLegal ? answerStyles.legalPara : answerStyles.plainPara}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

const answerStyles = {
  base: {
    fontSize: 14,
    lineHeight: 1.65,
    color: '#e0e0e0',
  },
  plain: {
    fontFamily: 'sans-serif',
  },
  legal: {
    fontFamily: 'Georgia, serif',
    fontSize: 13.5,
    lineHeight: 1.8,
    color: '#d4d4d4',
  },
  plainPara: {
    margin: '0 0 8px',
  },
  legalPara: {
    margin: '0 0 12px',
    textAlign: 'justify',
  },
  heading: {
    fontWeight: 600,
    color: '#fff',
    margin: '12px 0 6px',
    fontSize: 14,
  },
  bulletRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  bulletDot: {
    color: '#1D9E75',
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 1,
  },
};

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  modeLabel: {
    fontSize: 12,
    transition: 'color 0.2s, font-weight 0.2s',
    userSelect: 'none',
  },
  pill: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: 'none',
    cursor: 'pointer',
    padding: 3,
    transition: 'background 0.2s',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  activeChip: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 20,
    letterSpacing: '0.02em',
    marginLeft: 4,
  },
  infoWrapper: {
    position: 'relative',
  },
  infoButton: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#262626',
    border: '1px solid #444',
    color: '#888',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  tooltip: {
    position: 'absolute',
    top: 26,
    right: 0,
    width: 260,
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 10,
    padding: 14,
    zIndex: 999,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  tooltipSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  tooltipBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    alignSelf: 'flex-start',
    letterSpacing: '0.06em',
  },
  tooltipText: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 1.5,
    margin: 0,
  },
  tooltipDivider: {
    height: 1,
    background: '#333',
    margin: '10px 0',
  },
};
