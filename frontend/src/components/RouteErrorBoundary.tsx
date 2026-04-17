import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  label?: string;
  /** When true, renders a compact inline error rather than a full-page fallback. */
  inline?: boolean;
}

/**
 * Lightweight error boundary for individual page sections.
 * Isolates failures so a broken graph or side-panel does not crash the full page.
 */
export default function RouteErrorBoundary({ children, label, inline }: RouteErrorBoundaryProps) {
  if (inline) {
    return (
      <InlineErrorBoundary label={label}>
        {children}
      </InlineErrorBoundary>
    );
  }
  return <ErrorBoundary label={label}>{children}</ErrorBoundary>;
}

class InlineErrorBoundary extends React.Component<
  { children: ReactNode; label?: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[RouteErrorBoundary:${this.props.label || 'section'}]`, error, info);
    try {
      const { captureException } = require('@sentry/nextjs');
      captureException(error, { extra: { componentStack: info.componentStack, label: this.props.label } });
    } catch {
      // Sentry not available
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">This section failed to load.</p>
          <button
            className="mt-2 text-xs underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
