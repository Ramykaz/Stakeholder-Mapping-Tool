import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EntityDetailPage from '../../../pages/projects/[id]/entities/[entityId]';

const mockPush = jest.fn();
const mockReplace = jest.fn();

const routerState: any = {
  query: { id: 'proj-1', entityId: 'ent-1' },
  push: mockPush,
  replace: mockReplace,
};

jest.mock('next/router', () => ({
  useRouter: () => routerState,
}));

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('next/dynamic', () => {
  return (_importer: any, _options: any) => {
    return function MockGraph(props: any) {
      return <div data-testid="mini-graph">Mini Graph</div>;
    };
  };
});

jest.mock('@/components/Layout', () => function MockLayout({ children }: any) {
  return <div>{children}</div>;
});

jest.mock('@/components/ErrorMessage', () => function MockError({ message }: any) {
  return <div>{message}</div>;
});

jest.mock('@/components/EntityStakeholderAnalysis', () => function MockESA() {
  return <div data-testid="stakeholder-analysis" />;
});

jest.mock('@/lib/api', () => ({
  getProject: jest.fn(),
  getProjectEntityDetail: jest.fn(),
  generateEntitySummary: jest.fn(),
  flagEntity: jest.fn(),
  getEntityTimeline: jest.fn(),
  getStoredAuthToken: jest.fn(),
}));

import {
  getProject,
  getProjectEntityDetail,
  generateEntitySummary,
  flagEntity,
  getEntityTimeline,
  getStoredAuthToken,
} from '@/lib/api';

const mockGetProject = getProject as jest.Mock;
const mockGetEntityDetail = getProjectEntityDetail as jest.Mock;
const mockGenerateSummary = generateEntitySummary as jest.Mock;
const mockFlagEntity = flagEntity as jest.Mock;
const mockGetTimeline = getEntityTimeline as jest.Mock;
const mockGetToken = getStoredAuthToken as jest.Mock;

describe('Entity detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routerState.query = { id: 'proj-1', entityId: 'ent-1' };

    mockGetToken.mockReturnValue('token');
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Coverage Project' });
    mockGetEntityDetail.mockResolvedValue({
      id: 'ent-1',
      canonical_name: 'UNDP',
      entity_type: 'ORGANIZATION',
      confidence: 0.93,
      aliases: ['UN Development Programme'],
      projects: [{ id: 'proj-1', name: 'Coverage Project' }],
      relationships: [
        {
          relation_id: 'rel-1',
          source_entity_id: 'ent-1',
          source_entity_name: 'UNDP',
          source_entity_type: 'ORGANIZATION',
          target_entity_id: 'ent-2',
          target_entity_name: 'WHO',
          target_entity_type: 'ORGANIZATION',
          relation_type: 'PARTNERS_WITH',
          confidence: 0.85,
          supporting_excerpts: [],
          project_id: 'proj-1',
        },
      ],
      has_stakeholder_table: true,
      stakeholder_priority: null,
      persona: null,
      appears_in_report_sections: [],
      is_flagged: true,
    });
    mockGetTimeline.mockResolvedValue({
      timeline: [
        {
          document_name: 'doc-1.pdf',
          uploaded_at: '2026-01-10T00:00:00Z',
          context_snippet: 'UNDP appears in this paragraph.',
        },
      ],
    });
    mockGenerateSummary.mockResolvedValue({
      entity_id: 'ent-1',
      project_id: 'proj-1',
      summary: 'UNDP coordinates development initiatives.',
      source: 'provider',
      source_chunks: [
        { document_name: 'doc-1.pdf', snippet: 'UNDP leads implementation.' },
      ],
    });
    mockFlagEntity.mockResolvedValue({});

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: { search: [{ title: 'United Nations Development Programme', snippet: 'UNDP agency' }] },
      }),
    });
  });

  test('redirects to login when auth token is missing', async () => {
    mockGetToken.mockReturnValue(null);

    render(<EntityDetailPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('renders core entity details and relationship navigation', async () => {
    render(<EntityDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('UNDP')).toBeInTheDocument();
      expect(screen.getByText('ORGANIZATION')).toBeInTheDocument();
      expect(screen.getByText(/PARTNERS_WITH/i)).toBeInTheDocument();
      expect(screen.getByTestId('mini-graph')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'WHO' }));
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/entities/ent-2');
  });

  test('generates summary and displays source snippets', async () => {
    render(<EntityDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledWith('ent-1', 'proj-1', false);
      expect(screen.getByText(/UNDP coordinates development initiatives/i)).toBeInTheDocument();
      expect(screen.getByText(/UNDP leads implementation/i)).toBeInTheDocument();
    });
  });

  test('unflag button calls flag API and navigates back to map', async () => {
    render(<EntityDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unflag entity/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Unflag entity/i }));

    await waitFor(() => {
      expect(mockFlagEntity).toHaveBeenCalledWith('ent-1', false);
      expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/map');
    });
  });
});
