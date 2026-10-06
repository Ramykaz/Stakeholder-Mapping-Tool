import React, { ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in fallback UI and sent to Sentry for easier grouping. */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);

    // Report to Sentry (no-op when Sentry is not initialised).
    try {
      const eventId = Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
          boundaryLabel: this.props.label || 'root',
        },
      });
      this.setState({ eventId });
    } catch {
      // Never let Sentry itself crash the boundary handler.
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-page-root">
          <section className="error-page-card">
            <p className="error-page-code">Error</p>
            <h1 className="error-page-title">Something went wrong</h1>
            <p className="error-page-message" style={{ maxWidth: 480, margin: '0 auto 20px' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null, eventId: null })}
                className="btn-primary"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-ghost"
              >
                Reload page
              </button>
            </div>
            {this.state.eventId && (
              <p style={{ marginTop: 16, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                Error ID: {this.state.eventId}
              </p>
            )}
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
