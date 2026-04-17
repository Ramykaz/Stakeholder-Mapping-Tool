/**
 * Extended accessibility tests for interactive components.
 *
 * Every component here renders into a real DOM with axe-core assertions.
 * Only the base/idle state is tested — this is a compliance smoke check.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// ── Router / Next.js mocks ────────────────────────────────────────────────────
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/',
    query: { id: 'proj-1' },
    push: jest.fn(),
    replace: jest.fn(),
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// ── API mocks ─────────────────────────────────────────────────────────────────
jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn(() => 'test-token'),
  getStoredAuthUser: jest.fn(() => ({ id: 1, username: 'demo', email: 'a@b.com', is_admin: false })),
  getReportExportStatus: jest.fn(() => Promise.resolve({
    can_export: true,
    complete_sections: 2,
    total_sections: 4,
    has_stakeholder_table: true,
    has_personas: false,
    has_workplan: false,
    section_statuses: [],
  })),
  downloadReportPdf: jest.fn(),
  downloadReportDocx: jest.fn(),
  renderLLMErrorMessage: jest.fn(() => 'error'),
  getProjectGuidance: jest.fn(() => Promise.resolve([])),
  createProjectGuidance: jest.fn(),
  deleteProjectGuidance: jest.fn(),
  updateProjectGuidance: jest.fn(),
  reorderProjectGuidance: jest.fn(),
  saveProjectSMQAnswer: jest.fn(),
  generateProjectSMQAnswer: jest.fn(),
  getProjectIntake: jest.fn(() => Promise.resolve(null)),
  getProjectContextPreview: jest.fn(() => Promise.resolve({ preview: '' })),
  upsertProjectIntake: jest.fn(),
  logoutUser: jest.fn(),
  getProjects: jest.fn(() => Promise.resolve([])),
  getProjectWorkflow: jest.fn(() => Promise.resolve(null)),
  getProjectPersonas: jest.fn(() => Promise.resolve([])),
  getProjectWorkplan: jest.fn(() => Promise.resolve([])),
  generatePersonas: jest.fn(),
  generateWorkplan: jest.fn(),
  exportPersonasWorkplanDocx: jest.fn(),
  exportPersonasWorkplanPdf: jest.fn(),
  exportStakeholderPriorityPdf: jest.fn(),
  exportStakeholderPriorityCsv: jest.fn(),
  getProjectStakeholderPriority: jest.fn(() => Promise.resolve({ rows: [] })),
  generateProjectStakeholderNotes: jest.fn(),
  getProjectReviewCandidates: jest.fn(() => Promise.resolve({ results: [], pending_count: 0, count: 0 })),
  getProject: jest.fn(() => Promise.resolve(null)),
}));

// ── D3 mock — prevents canvas/SVG mutation side-effects in jsdom ──────────────
jest.mock('d3', () => {
  const chain = () => {
    const proxy: any = new Proxy({}, {
      get: (_t, _k) => () => proxy,
    });
    return proxy;
  };
  return {
    forceSimulation: chain,
    forceManyBody: chain,
    forceLink: chain,
    forceCenter: chain,
    forceCollide: chain,
    forceX: chain,
    forceY: chain,
    select: chain,
    zoom: chain,
    drag: chain,
    scaleLinear: () => ({ domain: () => ({ range: () => () => 1 }) }),
    schemeTableau10: [],
    zoomIdentity: {
      k: 1, x: 0, y: 0,
      translate: jest.fn().mockReturnThis(),
      scale: jest.fn().mockReturnThis(),
      rescaleX: jest.fn(),
      rescaleY: jest.fn(),
    },
  };
});

// ── jsdom polyfills ───────────────────────────────────────────────────────────
// ResizeObserver is not implemented in jsdom; stub it so GraphVisualization mounts.
(global as any).ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// ── Component imports ─────────────────────────────────────────────────────────
import Sidebar from '@/components/layout/Sidebar';
import TopNavigation from '@/components/layout/TopNavigation';
import GraphVisualization from '@/components/GraphVisualization';
import ExportTab from '@/components/ExportTab';
import WorkflowStepper from '@/components/WorkflowStepper';
import NextStepCard from '@/components/NextStepCard';
import WorkplanAccordion from '@/components/WorkplanAccordion';
import SMQSection from '@/components/SMQSection';
import GuidancePanel from '@/components/GuidancePanel';
import IntakeForm from '@/components/IntakeForm';
import StakeholderPriorityTable from '@/components/StakeholderPriorityTable';

const workflow = {
  current_step: 2,
  steps: [
    { number: 1, label: 'Setup', url: '/projects/p1/setup', complete: true },
    { number: 2, label: 'Documents', url: '/projects/p1/documents', complete: false },
    { number: 3, label: 'Analyze', url: '/projects/p1/analyze', complete: false },
  ],
  next_step: { number: 3, label: 'Analyze', url: '/projects/p1/analyze' },
};

describe('Accessibility — interactive components', () => {
  test('ExportTab has no obvious a11y violations in loading state', async () => {
    const { container } = render(<ExportTab projectId="proj-1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('WorkflowStepper has no obvious a11y violations', async () => {
    const { container } = render(<WorkflowStepper workflow={workflow as any} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('NextStepCard has no obvious a11y violations', async () => {
    const { container } = render(
      <NextStepCard
        step={{ number: 3, label: 'Analyze', url: '/projects/p1/analyze' } as any}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('WorkplanAccordion has no obvious a11y violations with empty state', async () => {
    const { container } = render(<WorkplanAccordion components={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('WorkplanAccordion has no obvious a11y violations with data', async () => {
    const components = [
      {
        id: 'wc1',
        title: 'Community Outreach',
        order: 0,
        project: 'proj-1',
        tasks: [
          {
            id: 't1',
            task_description: 'Run community workshops',
            suggested_owner: 'Comms',
            timeline: 'Q1',
            kpis: 'Attendance',
            dependencies: '',
            related_entity: null,
            order: 0,
            component: 'wc1',
          },
        ],
      },
    ];
    const { container } = render(<WorkplanAccordion components={components as any} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('SMQSection has no obvious a11y violations in view state', async () => {
    const section = {
      id: 'sec-1',
      section_number: 1,
      title: 'Context',
      question_prompts: 'Who are the stakeholders?',
    };
    const answer = {
      id: 'ans-1',
      section: 'sec-1',
      answer_text: 'Key stakeholders include...',
      status: 'done',
      updated_at: '',
    };
    const { container } = render(
      <SMQSection
        projectId="proj-1"
        section={section as any}
        answer={answer as any}
        onAnswerUpdate={jest.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('GuidancePanel has no obvious a11y violations in empty state', async () => {
    const { container } = render(<GuidancePanel projectId="proj-1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('IntakeForm has no obvious a11y violations in loading state', async () => {
    const { container } = render(
      <IntakeForm projectId="proj-1" onSaved={jest.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('StakeholderPriorityTable has no obvious a11y violations in loading state', async () => {
    const { container } = render(
      <StakeholderPriorityTable projectId="proj-1" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('Sidebar has no obvious a11y violations in unauthenticated state', async () => {
    const { container } = render(<Sidebar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('TopNavigation has no obvious a11y violations in default state', async () => {
    const { container } = render(<TopNavigation />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('GraphVisualization has no obvious a11y violations with empty data', async () => {
    const { container } = render(
      <GraphVisualization nodes={[]} edges={[]} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('GraphVisualization has no obvious a11y violations with node data', async () => {
    const nodes = [
      { id: 'n1', label: 'UNDP', data: { entity_type: 'Organization', degree: 2, confidence: 0.9, node_size: 44, color: '#6c8ebf' }, degree: 2 },
      { id: 'n2', label: 'Alice', data: { entity_type: 'Person', degree: 1, confidence: 0.8, node_size: 36, color: '#82b366' }, degree: 1 },
    ] as any;
    const edges = [
      { id: 'e1', source: 'n1', target: 'n2', data: { label: 'funds', weight: 1 } },
    ] as any;
    const { container } = render(
      <GraphVisualization nodes={nodes} edges={edges} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
