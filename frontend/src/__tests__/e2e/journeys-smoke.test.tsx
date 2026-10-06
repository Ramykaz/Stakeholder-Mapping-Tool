import React from 'react';

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    query: {},
    push: jest.fn(),
    replace: jest.fn(),
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('next/dynamic', () => {
  return () => {
    const MockDynamic = () => <div data-testid="dynamic-component" />;
    return MockDynamic;
  };
});

jest.mock('@/components/layout/TopNavigation', () => function MockTopNav() { return <div />; });
jest.mock('@/components/layout/Sidebar', () => function MockSidebar() { return <div />; });

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn(() => 'token'),
  getStoredAuthUser: jest.fn(() => ({ id: 1, username: 'demo', is_admin: true })),
  logoutUser: jest.fn().mockResolvedValue(undefined),
  getProjects: jest.fn().mockResolvedValue([]),
  getProject: jest.fn().mockResolvedValue({ id: 'p1', name: 'Demo', description: '' }),
  getProjectDocuments: jest.fn().mockResolvedValue([]),
  getProjectGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
  getProjectReviewCandidates: jest.fn().mockResolvedValue({ pending_count: 0, results: [] }),
  getProjectWorkflow: jest.fn().mockResolvedValue({ current_step: 1, steps: [], next_step: null }),
  getProjectSMQ: jest.fn().mockResolvedValue({ answers: [] }),
  getSMQTemplate: jest.fn().mockResolvedValue({ sections: [] }),
  createProject: jest.fn().mockResolvedValue({ id: 'p-new' }),
  forgotPassword: jest.fn().mockResolvedValue({ detail: 'ok' }),
  resetPassword: jest.fn().mockResolvedValue({ detail: 'ok' }),
  getRelations: jest.fn().mockResolvedValue([]),
  getReportStaleness: jest.fn().mockResolvedValue({ stale_sections: [] }),
  updateProject: jest.fn().mockResolvedValue({ id: 'p1' }),
  upsertProjectConceptNote: jest.fn().mockResolvedValue({ content: 'ok' }),
  getProjectConceptNote: jest.fn().mockResolvedValue({ content: '' }),
  getProjectProviders: jest.fn().mockResolvedValue({ providers: [], current_provider: '', current_model: '' }),
  renderLLMErrorMessage: jest.fn((e: any) => String(e?.message || e || 'error')),
}));

describe('Frontend journey smoke (E2E-style)', () => {
  test.each([
    ['login + auth navigation', '../../../pages/login'],
    ['create project + onboarding', '../../../pages/projects/index'],
    ['document upload flow', '../../../pages/projects/[id]/documents'],
    ['graph interaction flow', '../../../pages/projects/[id]/map'],
    ['report generation flow', '../../../pages/projects/[id]/report'],
    ['workplan/export flow', '../../../pages/projects/[id]/workspace'],
    ['persona + stakeholders flow', '../../../pages/projects/[id]/stakeholders'],
    ['admin access flow', '../../../pages/admin'],
  ])('loads journey module: %s', async (_label, modulePath) => {
    const mod = await import(modulePath as string);
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });
});
