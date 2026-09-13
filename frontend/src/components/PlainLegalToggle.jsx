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

function renderInlineMarkdown(str) {
  if (!str) return null;

  // Split by linebreaks (<br> or <br/>)
  const brParts = str.split(/(<br\s*\/?>)/gi);
  if (brParts.length > 1) {
    return brParts.map((bp, bIdx) => {
      if (/<br\s*\/?>/i.test(bp)) {
        return <br key={bIdx} />;
      }
      return renderInlineTokens(bp);
    });
  }

  return renderInlineTokens(str);
}

function renderInlineTokens(str) {
  if (!str) return null;

  // Split by markdown bold-italic (***), bold (**), italic (*), code (`), and citations ([Source X])
  const tokenRegex = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|\[Source\s*\d+\])/g;
  const parts = str.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return (
        <strong key={idx} style={{ fontWeight: 700, fontStyle: 'italic', color: '#ffffff' }}>
          {part.slice(3, -3)}
        </strong>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} style={{ fontWeight: 700, color: '#ffffff' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} style={{ fontStyle: 'italic', color: '#cbd5e1' }}>
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 5px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#d8b4fe',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (/^\[Source\s*\d+\]$/i.test(part)) {
      return (
        <span
          key={idx}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '11px',
            fontWeight: 600,
            color: '#c084fc',
            background: 'rgba(192, 132, 252, 0.15)',
            border: '1px solid rgba(192, 132, 252, 0.3)',
            padding: '1px 6px',
            borderRadius: '4px',
            marginLeft: '4px',
            marginRight: '2px',
            verticalAlign: 'baseline',
          }}
        >
          {part}
        </span>
      );
    }

    return part;
  });
}

function renderTableBlock(tableLines, key) {
  if (!tableLines || tableLines.length < 2) return null;

  const headerCells = tableLines[0]
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());

  const hasDivider = /^(\|\s*[-:]+\s*)+\|$/.test(tableLines[1].trim());
  const rowLines = hasDivider ? tableLines.slice(2) : tableLines.slice(1);

  const rows = rowLines.map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
  );

  return (
    <div
      key={key}
      style={{
        overflowX: 'auto',
        margin: '14px 0',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: '#0e1017',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
        {hasDivider && headerCells.length > 0 && (
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}>
              {headerCells.map((cell, cIdx) => (
                <th key={cIdx} style={{ padding: '9px 12px', fontWeight: 700, color: '#f8fafc' }}>
                  {renderInlineMarkdown(cell)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {(hasDivider ? rows : [headerCells, ...rows]).map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                borderBottom: rIdx < rows.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                background: rIdx % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
              }}
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ padding: '8px 12px', color: '#cbd5e1', verticalAlign: 'top', lineHeight: '1.55' }}>
                  {renderInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnswerText({ text = '', mode = MODE_PLAIN }) {
  const isLegal = mode === MODE_LEGAL;

  if (!text) return null;

  const rawLines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < rawLines.length) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // Empty line
    if (!trimmed) {
      elements.push(<div key={`sp-${i}`} style={{ height: '8px' }} />);
      i++;
      continue;
    }

    // Code Block ``` ... ```
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) i++; // skip closing ```
      elements.push(
        <pre
          key={`code-${i}`}
          style={{
            background: '#090a0f',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '12px 14px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#e2e8f0',
            overflowX: 'auto',
            margin: '12px 0',
          }}
        >
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Table Block | ... |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        tableLines.push(rawLines[i]);
        i++;
      }
      elements.push(renderTableBlock(tableLines, `table-${i}`));
      continue;
    }

    // Horizontal Dividers
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: 'none',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            margin: '14px 0',
          }}
        />
      );
      i++;
      continue;
    }

    // Markdown Headings (e.g. "### Title", "## Title", "# Title")
    if (/^#{1,4}\s+/.test(trimmed)) {
      const content = trimmed.replace(/^#{1,4}\s+/, '');
      elements.push(
        <div key={`h-${i}`} style={answerStyles.heading}>
          {renderInlineMarkdown(content)}
        </div>
      );
      i++;
      continue;
    }

    // Standalone Bold Headings
    const isStandaloneBold =
      (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) ||
      (trimmed.startsWith('**') && trimmed.endsWith(':**'));
    if (isStandaloneBold) {
      const inner =
        trimmed.startsWith('**') && trimmed.endsWith(':**')
          ? trimmed.slice(2, -3) + ':'
          : trimmed.slice(2, -2);
      elements.push(
        <div key={`bh-${i}`} style={answerStyles.heading}>
          {renderInlineMarkdown(inner)}
        </div>
      );
      i++;
      continue;
    }

    // Sub-bullet / Nested bullet
    const isSubBullet =
      rawLine.startsWith('  -') ||
      rawLine.startsWith('    -') ||
      trimmed.startsWith('- -') ||
      trimmed.startsWith('• -') ||
      trimmed.startsWith('*-');
    if (isSubBullet) {
      const cleanContent = trimmed.replace(/^[-•*]\s*[-•*]\s*/, '').replace(/^[-•*]\s*/, '');
      elements.push(
        <div key={`sub-${i}`} style={{ ...answerStyles.bulletRow, marginLeft: '20px', marginBottom: '5px' }}>
          <span style={{ ...answerStyles.bulletDot, color: isLegal ? '#8B85D4' : '#a855f7', fontSize: '13px' }}>–</span>
          <div style={{ flex: 1, lineHeight: '1.6' }}>{renderInlineMarkdown(cleanContent)}</div>
        </div>
      );
      i++;
      continue;
    }

    // Numbered List Item
    const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberMatch) {
      const num = numberMatch[1];
      const content = numberMatch[2];
      elements.push(
        <div key={`num-${i}`} style={{ ...answerStyles.bulletRow, marginBottom: '6px' }}>
          <span style={{ ...answerStyles.bulletDot, color: isLegal ? '#8B85D4' : '#1D9E75', minWidth: '18px' }}>
            {num}.
          </span>
          <div style={{ flex: 1, lineHeight: '1.6' }}>{renderInlineMarkdown(content)}</div>
        </div>
      );
      i++;
      continue;
    }

    // Regular Bullet Item
    const bulletMatch = trimmed.match(/^([•\-*])\s+(.*)/);
    if (bulletMatch) {
      const content = bulletMatch[2];
      elements.push(
        <div key={`bul-${i}`} style={{ ...answerStyles.bulletRow, marginBottom: '6px' }}>
          <span style={{ ...answerStyles.bulletDot, color: isLegal ? '#8B85D4' : '#1D9E75' }}>•</span>
          <div style={{ flex: 1, lineHeight: '1.6' }}>{renderInlineMarkdown(content)}</div>
        </div>
      );
      i++;
      continue;
    }

    // Regular Paragraph
    elements.push(
      <p key={`p-${i}`} style={isLegal ? answerStyles.legalPara : answerStyles.plainPara}>
        {renderInlineMarkdown(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div
      style={{
        ...answerStyles.base,
        ...(isLegal ? answerStyles.legal : answerStyles.plain),
      }}
    >
      {elements}
    </div>
  );
}

const answerStyles = {
  base: {
    fontSize: 14,
    lineHeight: 1.65,
    color: '#e2e8f0',
  },
  plain: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  legal: {
    fontFamily: 'Georgia, serif',
    fontSize: 13.5,
    lineHeight: 1.8,
    color: '#cbd5e1',
  },
  plainPara: {
    margin: '0 0 8px',
  },
  legalPara: {
    margin: '0 0 12px',
    textAlign: 'justify',
  },
  heading: {
    fontWeight: 700,
    color: '#ffffff',
    margin: '16px 0 8px',
    fontSize: '15px',
    lineHeight: '1.5',
    letterSpacing: '-0.01em',
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
