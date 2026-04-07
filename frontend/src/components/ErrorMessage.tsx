import React from 'react';

interface ErrorMessageProps {
  /** Human-readable error text */
  message: string;
  /** If true, a "Try Again" button is shown */
  onRetry?: () => void;
  /** Compact inline mode (no border box, smaller text) */
  inline?: boolean;
  /** Optional severity style */
  severity?: 'error' | 'warning';
  /** Optional title override */
  title?: string;
}

/**
 * Standardized dark-theme error display.
 * Supports retryable and inline variants.
 */
export default function ErrorMessage({
  message,
  onRetry,
  inline = false,
  severity = 'error',
  title,
}: ErrorMessageProps) {
  const isWarning = severity === 'warning';
  const fg = isWarning ? 'var(--amber)' : 'var(--coral)';
  const softBg = isWarning ? 'rgba(245, 158, 11, 0.12)' : 'var(--coral-soft)';
  const softBorder = isWarning ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(240,97,74,0.25)';
  const badgeBg = isWarning ? 'rgba(245, 158, 11, 0.2)' : 'rgba(240,97,74,0.15)';
  const resolvedTitle = title || (isWarning ? 'Action needed' : 'Something went wrong');

  if (inline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: fg, fontSize: 13 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{message}</span>
        {onRetry && (
          <button onClick={onRetry} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, padding: 0, marginLeft: 4 }}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: softBg,
      border: softBorder,
      borderRadius: 10,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: badgeBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="16" height="16" fill="none" stroke={fg} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: fg, fontSize: 13, marginBottom: 2 }}>{resolvedTitle}</div>
        <div style={{ color: fg, fontSize: 13, opacity: 0.85 }}>{message}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 10, padding: '5px 14px', borderRadius: 6,
              background: isWarning ? 'rgba(245,158,11,0.12)' : 'rgba(240,97,74,0.12)',
              border: isWarning ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(240,97,74,0.3)',
              color: fg, cursor: 'pointer', fontSize: 12, fontWeight: 500,
            }}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
