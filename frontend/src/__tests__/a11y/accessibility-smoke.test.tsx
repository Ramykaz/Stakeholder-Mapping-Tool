import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import ErrorMessage from '@/components/ErrorMessage';

expect.extend(toHaveNoViolations);

describe('Accessibility smoke coverage', () => {
  test('LoadingSpinner has no obvious a11y violations', async () => {
    const { container } = render(<LoadingSpinner message="Loading content" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('EmptyState has no obvious a11y violations', async () => {
    const { container } = render(
      <EmptyState
        title="No data"
        description="Nothing is available yet"
        actionLabel="Create"
        onAction={() => {}}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('ErrorMessage has no obvious a11y violations', async () => {
    const { container } = render(<ErrorMessage message="Something failed" onRetry={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
