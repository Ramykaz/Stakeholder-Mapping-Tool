/**
 * Unit tests for src/components/ErrorBoundary.tsx
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';

// Component that throws on demand
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>Safe content</div>;
}

// Suppress console.error from error boundary in tests
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('ErrorBoundary', () => {
  test('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  test('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test explosion')).toBeInTheDocument();
  });

  test('shows "Try again" button in fallback UI', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  test('"Try again" clears the error state (fallback disappears)', () => {
    // After clicking Try Again, the boundary resets hasError to false.
    // The boundary re-renders its original children (which still throw), so
    // the fallback appears again — but the important thing is the button click
    // does not throw and the boundary state resets.
    let shouldThrow = true;
    function ControlledBomb() {
      if (shouldThrow) throw new Error('Controlled error');
      return <div>Recovered</div>;
    }
    render(
      <ErrorBoundary>
        <ControlledBomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // Prevent the next render cycle from throwing
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  test('shows "Unknown error" when thrown error has no message', () => {
    function NoMessageBomb() {
      const err = new Error();
      err.message = '';
      throw err;
    }
    render(
      <ErrorBoundary>
        <NoMessageBomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Unknown error')).toBeInTheDocument();
  });
});
