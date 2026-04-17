/**
 * Unit tests for src/components/layout/Layout.tsx
 *
 * This is the minimal layout wrapper (TopNavigation + Sidebar + main).
 * The root src/components/Layout.tsx adds workflow/stepper logic on top.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/router', () => ({
  useRouter: () => ({ query: {}, pathname: '/', push: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn(() => null),
}));

jest.mock('@/components/layout/TopNavigation', () =>
  function MockTopNav() {
    return <nav data-testid="top-nav" />;
  },
);

jest.mock('@/components/layout/Sidebar', () =>
  function MockSidebar({ workspaceId }: { workspaceId?: string }) {
    return <aside data-testid="sidebar" data-workspace={workspaceId} />;
  },
);

import LayoutWrapper from '@/components/layout/Layout';
import { getStoredAuthToken } from '@/lib/api';

const mockedGetToken = getStoredAuthToken as jest.Mock;

describe('layout/Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders children inside main', () => {
    mockedGetToken.mockReturnValue(null);
    render(
      <LayoutWrapper>
        <p>page content</p>
      </LayoutWrapper>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  test('renders top navigation unconditionally', () => {
    mockedGetToken.mockReturnValue(null);
    render(<LayoutWrapper><span /></LayoutWrapper>);
    expect(screen.getByTestId('top-nav')).toBeInTheDocument();
  });

  test('shows sidebar when user is authenticated', () => {
    mockedGetToken.mockReturnValue('token-abc');
    render(<LayoutWrapper><span /></LayoutWrapper>);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  test('hides sidebar when user is not authenticated', () => {
    mockedGetToken.mockReturnValue(null);
    render(<LayoutWrapper><span /></LayoutWrapper>);
    expect(screen.queryByTestId('sidebar')).toBeNull();
  });

  test('hides sidebar when hideSidebar prop is true even if authenticated', () => {
    mockedGetToken.mockReturnValue('token-abc');
    render(<LayoutWrapper hideSidebar><span /></LayoutWrapper>);
    expect(screen.queryByTestId('sidebar')).toBeNull();
  });
});
