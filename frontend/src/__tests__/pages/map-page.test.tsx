import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MapPage from '../../../pages/projects/[id]/map';

const mockPush = jest.fn();
const mockReplace = jest.fn();

const routerState: any = {
  query: { id: 'proj-1' },
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
  return () => {
    const MockGraph = ({ nodes, onNodeClick, command }: any) => (
      <div data-testid="mock-map-graph">
        <div data-testid="command">{command?.type || 'none'}</div>
        {(nodes || []).map((node: any) => (
          <button key={node.id} data-testid={`node-${node.id}`} onClick={() => onNodeClick?.(node)}>
            {node.label}
          </button>
        ))}
      </div>
    );
    MockGraph.displayName = 'MockMapGraph';
    return MockGraph;
  };
});

jest.mock('@/components/layout/TopNavigation', () => function MockTopNavigation() {
  return <div data-testid="top-nav" />;
});

jest.mock('@/components/layout/Sidebar', () => function MockSidebar() {
  return <div data-testid="sidebar" />;
});

jest.mock('@/components/EmptyState', () => function MockEmptyState({ title }: any) {
  return <div>{title}</div>;
});

jest.mock('@/lib/api', () => ({
  getProject: jest.fn(),
  getProjectGraph: jest.fn(),
  getEntityProfile: jest.fn(),
  generateEntitySummary: jest.fn(),
  queryProjectGraph: jest.fn(),
  flagEntity: jest.fn(),
  flagProjectOrphanStakeholders: jest.fn(),
  getProjectFlaggedCount: jest.fn(),
  getStoredAuthToken: jest.fn(),
  downloadProjectExport: jest.fn(),
}));

import {
  getProject,
  getProjectGraph,
  getEntityProfile,
  generateEntitySummary,
  queryProjectGraph,
  flagProjectOrphanStakeholders,
  getProjectFlaggedCount,
  getStoredAuthToken,
  downloadProjectExport,
} from '@/lib/api';

const mockGetProject = getProject as jest.Mock;
const mockGetProjectGraph = getProjectGraph as jest.Mock;
const mockGetEntityProfile = getEntityProfile as jest.Mock;
const mockGenerateEntitySummary = generateEntitySummary as jest.Mock;
const mockQueryProjectGraph = queryProjectGraph as jest.Mock;
const mockFlagOrphans = flagProjectOrphanStakeholders as jest.Mock;
const mockGetFlaggedCount = getProjectFlaggedCount as jest.Mock;
const mockGetStoredAuthToken = getStoredAuthToken as jest.Mock;
const mockDownloadProjectExport = downloadProjectExport as jest.Mock;

describe('Map page interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetStoredAuthToken.mockReturnValue('token');
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Coverage Project' });
    mockFlagOrphans.mockResolvedValue({});
    mockGetFlaggedCount.mockResolvedValue(0);
    mockGetProjectGraph.mockResolvedValue({
      nodes: [
        {
          id: 'n1',
          label: 'UNDP',
          data: {
            entity_id: 'n1',
            entity_type: 'ORGANIZATION',
            confidence: 0.95,
            degree: 1,
            node_size: 44,
            color: '#3d6fff',
          },
        },
        {
          id: 'n2',
          label: 'WHO',
          data: {
            entity_id: 'n2',
            entity_type: 'ORGANIZATION',
            confidence: 0.92,
            degree: 1,
            node_size: 42,
            color: '#2ec4a5',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', label: 'PARTNERS_WITH', confidence: 0.8 },
      ],
    });
    mockGetEntityProfile.mockResolvedValue({
      aliases: ['United Nations Development Programme'],
      relationships: [
        { relation_id: 'r1', relation_type: 'PARTNERS_WITH', target_entity_id: 'n2' },
      ],
    });
    mockGenerateEntitySummary.mockResolvedValue({ summary: 'UNDP coordinates initiatives.' });
    mockQueryProjectGraph.mockResolvedValue({
      answer: 'UNDP partners with WHO.',
      is_nl_query: true,
      entity_ids: ['n1', 'n2'],
    });
    mockDownloadProjectExport.mockResolvedValue(undefined);
  });

  test('opens entity panel and generates contextual summary', async () => {
    render(<MapPage />);

    const nodeBtn = await screen.findByTestId('node-n1');
    fireEvent.click(nodeBtn);

    const generateBtn = await screen.findByRole('button', { name: 'Generate' });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockGenerateEntitySummary).toHaveBeenCalledWith('n1', 'proj-1', false);
      expect(screen.getByText('UNDP coordinates initiatives.')).toBeInTheDocument();
    });
  });

  test('runs NL query and renders answer panel', async () => {
    render(<MapPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask about entities/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/ask about entities/i), {
      target: { value: 'Who partners with UNDP?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(mockQueryProjectGraph).toHaveBeenCalledWith('proj-1', 'Who partners with UNDP?');
      expect(screen.getByText('UNDP partners with WHO.')).toBeInTheDocument();
    });
  });

  test('exports entities CSV from banner action', async () => {
    render(<MapPage />);

    const exportBtn = await screen.findByRole('button', { name: 'Entities CSV' });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockDownloadProjectExport).toHaveBeenCalledWith('proj-1', 'entities');
    });
  });
});
