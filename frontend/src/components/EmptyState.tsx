import React from 'react';
import { FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  /** Icon to display — a lucide-react element (or any ReactNode) */
  icon?: React.ReactNode;
  /** Primary heading */
  title: string;
  /** Explanatory sub-text */
  description?: string;
  /** Primary CTA label */
  actionLabel?: string;
  /** Primary CTA handler */
  onAction?: () => void;
  /** Secondary CTA label */
  secondaryLabel?: string;
  /** Secondary CTA handler */
  onSecondary?: () => void;
  /** Compact mode (reduced padding, smaller text) */
  compact?: boolean;
}

/**
 * Reusable dark-theme empty-state component.
 * Used across all rewired pages when no data is available.
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
}: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: compact ? '24px 20px' : '48px 32px',
      border: '1px solid var(--border)',
      borderRadius: compact ? 10 : 14,
      background: 'var(--bg2)',
    }}>
      <div style={{ marginBottom: compact ? 10 : 16, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}>
        {icon ?? <FolderOpen size={compact ? 28 : 40} strokeWidth={1.5} />}
      </div>

      <h3 style={{
        fontFamily: 'var(--serif)',
        fontSize: compact ? 17 : 20,
        color: 'var(--text)',
        marginBottom: description ? 8 : 0,
      }}>
        {title}
      </h3>

      {description && (
        <p style={{
          color: 'var(--text2)',
          fontSize: compact ? 12 : 13,
          lineHeight: 1.6,
          maxWidth: 360,
          margin: '0 auto',
          marginBottom: (actionLabel || secondaryLabel) ? 20 : 0,
        }}>
          {description}
        </p>
      )}

      {(actionLabel || secondaryLabel) && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {actionLabel && onAction && (
            <button onClick={onAction} className="btn-primary" style={{ fontSize: compact ? 12 : 13 }}>
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button onClick={onSecondary} className="btn-ghost" style={{ fontSize: compact ? 12 : 13 }}>
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
