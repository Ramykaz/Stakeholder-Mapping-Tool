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
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#1a1a1a' }}>Something went wrong</h2>
          <p style={{ color: '#555', maxWidth: 480, margin: '0 auto 1rem' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null, eventId: null })}
              style={{
                padding: '0.5rem 1.25rem',
                background: '#006eb5',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1.25rem',
                background: 'transparent',
                color: '#006eb5',
                border: '1px solid #006eb5',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Reload page
            </button>
          </div>
          {this.state.eventId && (
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#999' }}>
              Error ID: {this.state.eventId}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
