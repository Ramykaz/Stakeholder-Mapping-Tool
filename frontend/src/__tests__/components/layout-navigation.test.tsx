import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const routerState: any = {
  pathname: '/projects/p1/map',
  query: { id: 'p1' },
  push: jest.fn(),
  replace: jest.fn(),
  events: { on: jest.fn(), off: jest.fn() },
};

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn(() => 'token'),
  getStoredAuthUser: jest.fn(() => ({ id: 1, username: 'admin', is_admin: true })),
  logoutUser: jest.fn().mockResolvedValue(undefined),
  getProjects: jest.fn().mockResolvedValue([
    { id: 'p1', name: 'Alpha', status: 'active', entity_count: 3 },
  ]),
  getProjectReviewCandidates: jest.fn().mockResolvedValue({ pending_count: 0 }),
  getProject: jest.fn().mockResolvedValue({ id: 'p1', provider: 'groq', model: 'llama3-8b-8192' }),
  deleteProject: jest.fn().mockResolvedValue(undefined),
}));

import Sidebar from '@/components/layout/Sidebar';
import TopNavigation from '@/components/layout/TopNavigation';
import Layout from '@/components/layout/Layout';

describe('Layout navigation coverage', () => {
  test('Sidebar renders project list and project name', async () => {
    render(<Sidebar workspaceId="p1" />);
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
  });

  test('TopNavigation renders app title for authenticated user', async () => {
    render(<TopNavigation workspaceId="p1" />);
    expect(screen.getByText(/UNDP Stakeholder Analysis/i)).toBeInTheDocument();
  });

  test('Layout shell renders children and navigation wrappers', async () => {
    render(
      <Layout>
        <div>Child Content</div>
      </Layout>,
    );

    expect(screen.getByText('Child Content')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/UNDP Stakeholder Analysis/i)).toBeInTheDocument();
    });
  });
});
