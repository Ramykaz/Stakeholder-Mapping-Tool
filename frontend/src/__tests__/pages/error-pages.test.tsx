/**
 * Integration tests for pages/404.tsx and pages/500.tsx
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/link', () => {
  const MockLink = ({ children, href, className }: any) => (
    <a href={href} className={className}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

import Custom404 from '../../../pages/404';
import Custom500 from '../../../pages/500';

describe('404 page', () => {
  test('renders 404 error code', () => {
    render(<Custom404 />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  test('renders "Page not found" heading', () => {
    render(<Custom404 />);
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });

  test('renders descriptive message', () => {
    render(<Custom404 />);
    expect(
      screen.getByText(/The page you requested does not exist/i),
    ).toBeInTheDocument();
  });

  test('renders "Return to home" link pointing to /', () => {
    render(<Custom404 />);
    const link = screen.getByRole('link', { name: /return to home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });
});

describe('500 page', () => {
  test('renders 500 error code', () => {
    render(<Custom500 />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  test('renders "Server error" heading', () => {
    render(<Custom500 />);
    expect(screen.getByRole('heading', { name: /server error/i })).toBeInTheDocument();
  });

  test('renders "try again" message', () => {
    render(<Custom500 />);
    expect(screen.getByText(/Please try again/i)).toBeInTheDocument();
  });

  test('renders "Return to home" link pointing to /', () => {
    render(<Custom500 />);
    const link = screen.getByRole('link', { name: /return to home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });
});
