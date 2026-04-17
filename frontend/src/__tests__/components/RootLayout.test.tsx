/**
 * Unit tests for src/components/Layout.tsx (root Layout with workflow stepper)
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { id: 'proj-1' }, pathname: '/', push: mockPush }),
}));

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn(() => null),
  getProjectWorkflow: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/components/layout/TopNavigation', () =>
  function MockTopNav() {
    return <nav data-testid="top-nav" />;
  },
);

jest.mock('@/components/layout/Sidebar', () =>
  function MockSidebar() {
    return <aside data-testid="sidebar" />;
  },
);

jest.mock('@/components/WorkflowStepper', () =>
  function MockStepper({ workflow }: any) {
    return <div data-testid="stepper" data-step={workflow?.current_step} />;
  },
);

jest.mock('@/components/NextStepCard', () =>
  function MockNextStep({ step }: any) {
    return <div data-testid="next-step">{step?.label}</div>;
  },
);

import Layout from '@/components/Layout';
import { getStoredAuthToken, getProjectWorkflow } from '@/lib/api';

const mockedGetToken = getStoredAuthToken as jest.Mock;
const mockedGetWorkflow = getProjectWorkflow as jest.Mock;

describe('Layout (root)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetWorkflow.mockResolvedValue(null);
  });

  test('renders children', () => {
    mockedGetToken.mockReturnValue(null);
    render(<Layout><p>hello world</p></Layout>);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  test('renders title when provided', () => {
    mockedGetToken.mockReturnValue(null);
    render(<Layout title="Project Dashboard"><span /></Layout>);
    expect(screen.getByRole('heading', { name: /Project Dashboard/i })).toBeInTheDocument();
  });

  test('renders subtitle when provided', () => {
    mockedGetToken.mockReturnValue(null);
    render(<Layout subtitle="Stakeholder analysis"><span /></Layout>);
    expect(screen.getByText('Stakeholder analysis')).toBeInTheDocument();
  });

  test('does not render title heading when title is omitted', () => {
    mockedGetToken.mockReturnValue(null);
    render(<Layout><span /></Layout>);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  test('shows sidebar when authenticated', () => {
    mockedGetToken.mockReturnValue('tok');
    render(<Layout><span /></Layout>);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  test('hides sidebar when hideSidebar=true', () => {
    mockedGetToken.mockReturnValue('tok');
    render(<Layout hideSidebar><span /></Layout>);
    expect(screen.queryByTestId('sidebar')).toBeNull();
  });

  test('does not render stepper when workflow is null', async () => {
    mockedGetToken.mockReturnValue('tok');
    mockedGetWorkflow.mockResolvedValue(null);
    render(<Layout workspaceId="p1"><span /></Layout>);
    await waitFor(() => {});
    expect(screen.queryByTestId('stepper')).toBeNull();
  });

  test('renders stepper when workflow data is returned', async () => {
    mockedGetToken.mockReturnValue('tok');
    const workflow = { current_step: 2, steps: [], next_step: null };
    mockedGetWorkflow.mockResolvedValue(workflow);
    render(<Layout workspaceId="p1"><span /></Layout>);
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toBeInTheDocument();
    });
  });

  test('renders NextStepCard when workflow has a next_step', async () => {
    mockedGetToken.mockReturnValue('tok');
    const workflow = {
      current_step: 1,
      steps: [],
      next_step: { label: 'Upload Documents', url: '/projects/p1/documents', number: 2 },
    };
    mockedGetWorkflow.mockResolvedValue(workflow);
    render(<Layout workspaceId="p1"><span /></Layout>);
    await waitFor(() => {
      expect(screen.getByTestId('next-step')).toBeInTheDocument();
      expect(screen.getByText('Upload Documents')).toBeInTheDocument();
    });
  });

  test('hides NextStepCard when hideNextStep=true', async () => {
    mockedGetToken.mockReturnValue('tok');
    const workflow = {
      current_step: 1,
      steps: [],
      next_step: { label: 'Upload Documents', url: '/p', number: 2 },
    };
    mockedGetWorkflow.mockResolvedValue(workflow);
    render(<Layout workspaceId="p1" hideNextStep><span /></Layout>);
    await waitFor(() => {});
    expect(screen.queryByTestId('next-step')).toBeNull();
  });
});
