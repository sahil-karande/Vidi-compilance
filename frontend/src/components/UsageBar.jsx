/**
 * Vidi — frontend/src/components/UsageBar.jsx
 * Day 21 Task: Usage Bar UI Component
 *
 * Visual progress bar showing daily query usage.
 * Place this in the chat header or sidebar.
 *
 * Usage:
 *   import { UsageBar } from '../components/UsageBar';
 *   <UsageBar />
 */

import { useQueryLimit } from '../hooks/useQueryLimit';

export function UsageBar() {
  const {
    used,
    limit,
    remaining,
    unlimited,
    percentUsed,
    loading,
    isNearLimit,
    isAtLimit,
    role,
  } = useQueryLimit();

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.skeleton} />
      </div>
    );
  }

  if (unlimited) {
    return (
      <div style={styles.container}>
        <span style={styles.unlimitedBadge}>
          ✨ {role.toUpperCase()} — Unlimited queries
        </span>
      </div>
    );
  }

  const barColor = isAtLimit ? '#E24B4A' : isNearLimit ? '#F4A42A' : '#1D9E75';

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>
          {used} / {limit} queries today
        </span>
        <span style={{ ...styles.roleBadge, color: barColor }}>
          {role.toUpperCase()}
        </span>
      </div>

      <div style={styles.trackWrap}>
        <div
          style={{
            ...styles.fill,
            width: `${percentUsed}%`,
            background: barColor,
          }}
        />
      </div>

      {isAtLimit && (
        <p style={styles.limitMessage}>
          You've hit today's limit.{' '}
          <a href="/settings?tab=plan" style={styles.upgradeLink}>
            Upgrade to Pro
          </a>{' '}
          for unlimited queries.
        </p>
      )}

      {isNearLimit && !isAtLimit && (
        <p style={styles.warningMessage}>
          Only {remaining} {remaining === 1 ? 'query' : 'queries'} left today.
        </p>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '10px 14px',
    borderRadius: 10,
    background: 'var(--color-background-secondary, #1a1a1a)',
    fontFamily: 'sans-serif',
    minWidth: 200,
  },
  skeleton: {
    height: 14,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.08)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    color: 'var(--color-text-secondary, #aaa)',
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  trackWrap: {
    height: 6,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease, background 0.3s ease',
  },
  unlimitedBadge: {
    fontSize: 12,
    fontWeight: 500,
    color: '#1D9E75',
  },
  limitMessage: {
    fontSize: 11,
    color: '#E24B4A',
    marginTop: 6,
    marginBottom: 0,
  },
  warningMessage: {
    fontSize: 11,
    color: '#F4A42A',
    marginTop: 6,
    marginBottom: 0,
  },
  upgradeLink: {
    color: '#0C447C',
    fontWeight: 600,
    textDecoration: 'underline',
  },
};
