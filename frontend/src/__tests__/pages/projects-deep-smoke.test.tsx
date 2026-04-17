import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const routerState: any = {
  pathname: '/projects/[id]/documents',
  query: { id: 'proj-1' },
  push: mockPush,
  replace: mockReplace,
  events: { on: jest.fn(), off: jest.fn() },
};

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('next/dynamic', () => {
  return (_importer: any, _options: any) => {
    const MockDynamic = () => <div data-testid="dynamic-graph" />;
    return MockDynamic;
  };
});

jest.mock('@/components/layout/TopNavigation', () => function MockTopNav() {
  return <div data-testid="top-nav" />;
});

jest.mock('@/components/layout/Sidebar', () => function MockSidebar() {
  return <div data-testid="sidebar" />;
});

jest.mock('@/components/Layout', () => function MockLayout({ children, title, subtitle }: any) {
  return (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  );
});

jest.mock('@/components/EmptyState', () => function MockEmptyState({ title, description }: any) {
  return (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
});

jest.mock('@/components/ErrorMessage', () => function MockErrorMessage({ message }: any) {
  return <div>{message}</div>;
});

jest.mock('@/components/GuidancePanel', () => function MockGuidancePanel() {
  return <div data-testid="guidance-panel" />;
});

jest.mock('@/components/SMQSection', () => function MockSMQSection({ section }: any) {
  return <div>SMQ: {section?.title || section?.section_title || section?.section_number}</div>;
});

jest.mock('react-dom', () => {
  const original = jest.requireActual('react-dom');
  return {
    ...original,
    createPortal: (node: any) => node,
  };
});

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn(),
  renderLLMErrorMessage: jest.fn((err: any, ctx?: string) => `${ctx || 'Error'}: ${String(err?.message || err || '')}`),

  getProject: jest.fn(),
  getProjectDocuments: jest.fn(),
  getProjectDocumentsWithStats: jest.fn(),
  getProjectWorkflow: jest.fn(),
  getProjectWorkflow: jest.fn(),
  getReportStaleness: jest.fn(),
  uploadDocumentToProject: jest.fn(),
  deleteProjectDocument: jest.fn(),
  getProjectWebSources: jest.fn(),
  createProjectWebSource: jest.fn(),
  deleteProjectWebSource: jest.fn(),
  getProjectDocumentStatus: jest.fn(),
  getProjectExtractionStatus: jest.fn(),
  reextractProjectDocument: jest.fn(),
  getProjectDocumentEntities: jest.fn(),
  getProjectDocumentRelationships: jest.fn(),
  getProjectDocumentContext: jest.fn(),
  updateProjectEntity: jest.fn(),
  deleteProjectDocumentEntity: jest.fn(),
  updateProjectDocumentRelationship: jest.fn(),
  deleteProjectDocumentRelationship: jest.fn(),

  getProjectGraph: jest.fn(),
  getEntityProfile: jest.fn(),
  generateEntitySummary: jest.fn(),
  queryProjectGraph: jest.fn(),
  flagEntity: jest.fn(),
  flagProjectOrphanStakeholders: jest.fn(),
  getProjectFlaggedCount: jest.fn(),
  downloadProjectExport: jest.fn(),

  getProjectProviders: jest.fn(),
  updateProjectProvider: jest.fn(),
  updateProject: jest.fn(),
  upsertProjectConceptNote: jest.fn(),
  getProjectConceptNote: jest.fn(),
  testLLMConnection: jest.fn(),
  deleteProject: jest.fn(),

  getProjectReviewCandidates: jest.fn(),
  resolveReviewCandidate: jest.fn(),

  getSMQTemplate: jest.fn(),
  getProjectSMQ: jest.fn(),

  createProject: jest.fn(),
  getProjectIntake: jest.fn(),
}));

import {
  createProject,
  getProject,
  getProjectConceptNote,
  getProjectDocuments,
  getProjectDocumentsWithStats,
  getProjectWorkflow,
  getProjectExtractionStatus,
  getProjectFlaggedCount,
  getProjectGraph,
  getProjectProviders,
  getProjectReviewCandidates,
  getProjectSMQ,
  getProjectWebSources,
  getReportStaleness,
  getSMQTemplate,
  getStoredAuthToken,
  getProjectIntake,
  resolveReviewCandidate,
  updateProject,
  upsertProjectConceptNote,
} from '@/lib/api';

import DocumentsPage from '../../../pages/projects/[id]/documents';
import MapPage from '../../../pages/projects/[id]/map';
import ProjectSettingsPage from '../../../pages/projects/[id]/settings';
import ReviewPage from '../../../pages/projects/[id]/review';
import SetupPage from '../../../pages/projects/[id]/setup';
import ProjectSMQPage from '../../../pages/projects/[id]/smq';
import NewProjectPage from '../../../pages/projects/new';

const mockCreateProject = createProject as jest.Mock;
const mockGetProject = getProject as jest.Mock;
const mockGetProjectConceptNote = getProjectConceptNote as jest.Mock;
const mockGetProjectDocuments = getProjectDocuments as jest.Mock;
const mockGetProjectDocumentsWithStats = getProjectDocumentsWithStats as jest.Mock;
const mockGetProjectWorkflow = getProjectWorkflow as jest.Mock;
const mockGetProjectExtractionStatus = getProjectExtractionStatus as jest.Mock;
const mockGetProjectFlaggedCount = getProjectFlaggedCount as jest.Mock;
const mockGetProjectGraph = getProjectGraph as jest.Mock;
const mockGetProjectProviders = getProjectProviders as jest.Mock;
const mockGetProjectReviewCandidates = getProjectReviewCandidates as jest.Mock;
const mockGetProjectSMQ = getProjectSMQ as jest.Mock;
const mockGetProjectWebSources = getProjectWebSources as jest.Mock;
const mockGetReportStaleness = getReportStaleness as jest.Mock;
const mockGetSMQTemplate = getSMQTemplate as jest.Mock;
const mockGetStoredAuthToken = getStoredAuthToken as jest.Mock;
const mockGetProjectIntake = getProjectIntake as jest.Mock;
const mockResolveReviewCandidate = resolveReviewCandidate as jest.Mock;
const mockUpdateProject = updateProject as jest.Mock;
const mockUpsertProjectConceptNote = upsertProjectConceptNote as jest.Mock;

describe('Deep projects pages smoke coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routerState.pathname = '/projects/[id]/documents';
    routerState.query = { id: 'proj-1' };

    mockGetStoredAuthToken.mockReturnValue('token');
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Coverage Project', description: '' });
    mockGetProjectDocuments.mockResolvedValue([{ id: 'doc-1', filename: 'notes.txt', file_format: 'txt', processing_status: 'completed', extraction_state: 'done', created_at: new Date().toISOString() }]);
    mockGetProjectDocumentsWithStats.mockResolvedValue([]);
    mockGetProjectWorkflow.mockResolvedValue({ current_step: 2, steps: [] });
    mockGetProjectWebSources.mockResolvedValue([]);
    mockGetProjectExtractionStatus.mockResolvedValue({ status: 'idle' });
    mockGetReportStaleness.mockResolvedValue({ stale_sections: [] });

    mockGetProjectGraph.mockResolvedValue({ nodes: [{ id: 'n1', data: { label: 'UNDP', entity_type: 'ORG', degree: 1, node_size: 40 } }], edges: [] });
    mockGetProjectFlaggedCount.mockResolvedValue(0);

    mockGetProjectConceptNote.mockResolvedValue({ content: 'Existing concept note' });
    mockGetProjectProviders.mockResolvedValue({
      current_provider: 'groq',
      current_model: 'llama3-8b-8192',
      providers: [{ name: 'groq', available: true, models: ['llama3-8b-8192'] }],
    });
    mockUpdateProject.mockResolvedValue({ id: 'proj-1' });
    mockUpsertProjectConceptNote.mockResolvedValue({ content: 'saved' });

    mockGetProjectReviewCandidates.mockResolvedValue({
      pending_count: 1,
      results: [{
        id: 'cand-1',
        similarity_score: 0.91,
        left_entity: { name: 'UNDP', type: 'ORG' },
        right_entity: { name: 'United Nations Development Programme', type: 'ORG' },
        mention_context: 'UNDP appears in multiple sections.',
      }],
    });
    mockResolveReviewCandidate.mockResolvedValue({ ok: true });

    mockGetSMQTemplate.mockResolvedValue({ sections: [{ id: 'sec-1', order: 1, section_number: 1, title: 'Context' }] });
    mockGetProjectSMQ.mockResolvedValue({ answers: [] });
    mockGetProjectIntake.mockResolvedValue({ initiative_name: 'Initiative A' });

    mockCreateProject.mockResolvedValue({ id: 'proj-created' });
  });

  it('renders documents page and loads project documents', async () => {
    routerState.pathname = '/projects/[id]/documents';
    render(<DocumentsPage />);

    await waitFor(() => {
      expect(mockGetProjectDocuments).toHaveBeenCalledWith('proj-1');
    });
    expect(screen.getAllByText(/Coverage Project/i).length).toBeGreaterThan(0);
  });

  it('renders map page and loads graph', async () => {
    routerState.pathname = '/projects/[id]/map';
    render(<MapPage />);

    await waitFor(() => {
      expect(mockGetProjectGraph).toHaveBeenCalledWith('proj-1');
    });
    expect(screen.getAllByText(/Coverage Project/i).length).toBeGreaterThan(0);
  });

  it('renders settings page and saves updates', async () => {
    routerState.pathname = '/projects/[id]/settings';
    render(<ProjectSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalled();
      expect(mockUpsertProjectConceptNote).toHaveBeenCalled();
    });
  });

  it('renders review page and resolves candidate', async () => {
    routerState.pathname = '/projects/[id]/review';
    render(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/UNDP/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Merge/i }));
    await waitFor(() => {
      expect(mockResolveReviewCandidate).toHaveBeenCalledWith('cand-1', 'merge');
    });
  });

  it('setup page redirects to intake route', async () => {
    routerState.pathname = '/projects/[id]/setup';
    render(<SetupPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/projects/proj-1/intake');
    });
  });

  it('renders smq page and shows first section', async () => {
    routerState.pathname = '/projects/[id]/smq';
    render(<ProjectSMQPage />);

    await waitFor(() => {
      expect(screen.getByText(/Section 1 of 1/i)).toBeInTheDocument();
    });
  });

  it('new project wizard creates project and navigates to workspace', async () => {
    routerState.pathname = '/projects/new';
    routerState.query = {};

    render(<NewProjectPage />);

    fireEvent.change(screen.getByPlaceholderText(/Enter project name/i), { target: { value: 'Fresh Project' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Describe the project/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Describe the project/i), { target: { value: 'Description text' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Paste concept note text/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Paste concept note text/i), { target: { value: 'Concept content' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create Project/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/projects/proj-created/workspace');
    });
  });
});
