/**
 * Tests for the Graph page (pages/graph.tsx).
 *
 * Covers:
 * - Initial render (document ID input, empty state)
 * - Node loading and graph rendering
 * - Confidence slider
 * - Error state
 * - Empty nodes state
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GraphPage from '../../../pages/graph';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockQuery: Record<string, string> = {};

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/graph',
    query: mockQuery,
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock next/dynamic — render a simple div instead of Cytoscape
jest.mock('next/dynamic', () => {
  return (_importFn: any, _opts?: any) => {
    const MockGraphVisualization = ({ nodes, edges = [], onNodeClick }: any) => (
      <div data-testid="graph-visualization">
        {nodes.map((n: any) => (
          <div key={n.id} data-testid={`node-${n.id}`} onClick={() => onNodeClick?.(n)}>
            {n.label}::{n.data.shape || 'none'}
          </div>
        ))}
        {edges.map((e: any) => (
          <div key={e.id} data-testid={`edge-${e.id}`}>
            {e.label}
          </div>
        ))}
      </div>
    );
    MockGraphVisualization.displayName = 'MockGraphVisualization';
    return MockGraphVisualization;
  };
});

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn().mockReturnValue('test-token'),
  getStoredAuthUser: jest.fn().mockReturnValue({ id: 1, username: 'testuser', is_admin: false }),
  getProjects: jest.fn().mockResolvedValue([]),
  getProject: jest.fn().mockResolvedValue({ id: 'p1', name: 'Test Project' }),
  logoutUser: jest.fn(),
  getProjectReviewCandidates: jest.fn().mockResolvedValue({ results: [], count: 0 }),
  getGlobalEntities: jest.fn().mockResolvedValue({ results: [], count: 0 }),
  getGraphNodes: jest.fn(),
}));

import { getGraphNodes } from '@/lib/api';

const mockGetGraphNodes = getGraphNodes as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGraphNodes.mockReset();
  mockQuery = {};
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const SAMPLE_NODES = [
  {
    id: 'n1',
    label: 'UNDP',
    data: {
      entity_id: 'e1',
      entity_type: 'ORGANIZATION',
      confidence: 0.95,
      document_id: 'doc-1',
      chunk_id: 'c1',
      raw_mentions_count: 3,
    },
  },
  {
    id: 'n2',
    label: 'Alice Smith',
    data: {
      entity_id: 'e2',
      entity_type: 'PERSON',
      confidence: 0.88,
      document_id: 'doc-1',
      chunk_id: 'c1',
      raw_mentions_count: 2,
    },
  },
];

const SAMPLE_EDGES = [
  {
    id: 'r1',
    source: 'n2',
    target: 'n1',
    label: 'WORKS_AT',
    confidence: 0.9,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GraphPage', () => {
  it('renders the document ID input and Load button', () => {
    render(<GraphPage />);

    expect(screen.getByPlaceholderText(/document id/i)).toBeInTheDocument();
    expect(screen.getByText('Load')).toBeInTheDocument();
  });

  it('shows empty state when no document is loaded', () => {
    render(<GraphPage />);
    expect(screen.getByText(/enter a document id/i)).toBeInTheDocument();
  });

  it('loads and displays graph nodes from query param', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetGraphNodes.mockResolvedValueOnce({ nodes: SAMPLE_NODES, edges: [] });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
    });

    expect(screen.getByTestId('node-n1')).toHaveTextContent('UNDP');
    expect(screen.getByTestId('node-n2')).toHaveTextContent('Alice Smith');
    expect(mockGetGraphNodes).toHaveBeenCalledWith('doc-1', undefined);
  });

  it('loads nodes when submitting document ID form', async () => {
    mockGetGraphNodes.mockResolvedValueOnce({ nodes: SAMPLE_NODES, edges: [] });

    render(<GraphPage />);

    const input = screen.getByPlaceholderText(/document id/i);
    fireEvent.change(input, { target: { value: 'doc-xyz' } });
    fireEvent.click(screen.getByText('Load'));

    await waitFor(() => {
      expect(mockGetGraphNodes).toHaveBeenCalledWith('doc-xyz', undefined);
    });
  });

  it('shows error message on API failure', async () => {
    mockQuery = { document_id: 'doc-bad' };
    mockGetGraphNodes.mockRejectedValueOnce(new Error('Failed to load graph data'));

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load graph data')).toBeInTheDocument();
    });
  });

  it('shows empty state when no nodes returned', async () => {
    mockQuery = { document_id: 'doc-empty' };
    mockGetGraphNodes.mockResolvedValueOnce({ nodes: [], edges: [] });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByText(/no graph data available/i)).toBeInTheDocument();
    });
  });

  it('shows node detail panel on node click', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetGraphNodes.mockResolvedValueOnce({ nodes: SAMPLE_NODES, edges: [] });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByTestId('node-n1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('node-n1'));

    await waitFor(() => {
      expect(screen.getByText('Node Detail')).toBeInTheDocument();
    });

    // Detail panel shows node info
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('shows confidence filter when document is loaded', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetGraphNodes.mockResolvedValueOnce({ nodes: SAMPLE_NODES, edges: [] });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByText(/min confidence/i)).toBeInTheDocument();
    });
  });

  it('renders relation edge labels when edges are returned', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetGraphNodes.mockResolvedValueOnce({ nodes: SAMPLE_NODES, edges: SAMPLE_EDGES });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByTestId('edge-r1')).toBeInTheDocument();
    });

    expect(screen.getAllByText('WORKS_AT').length).toBeGreaterThan(0);
  });

  it('passes node shapes from API payload to graph component', async () => {
    const shapedNodes = [
      {
        ...SAMPLE_NODES[0],
        data: { ...SAMPLE_NODES[0].data, shape: 'rectangle' },
      },
      {
        ...SAMPLE_NODES[1],
        data: { ...SAMPLE_NODES[1].data, shape: 'ellipse' },
      },
    ];
    mockQuery = { document_id: 'doc-1' };
    mockGetGraphNodes.mockResolvedValueOnce({ nodes: shapedNodes, edges: [] });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByText('UNDP::rectangle')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith::ellipse')).toBeInTheDocument();
    });
  });

  it('refetches graph data with confidence threshold when slider changes', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetGraphNodes
      .mockResolvedValueOnce({ nodes: SAMPLE_NODES, edges: SAMPLE_EDGES })
      .mockResolvedValueOnce({ nodes: SAMPLE_NODES, edges: SAMPLE_EDGES });

    render(<GraphPage />);

    await waitFor(() => {
      expect(mockGetGraphNodes).toHaveBeenCalledWith('doc-1', undefined);
    });

    const slider = screen.getAllByRole('slider')[0];
    fireEvent.change(slider, { target: { value: '70' } });

    await waitFor(() => {
      expect(mockGetGraphNodes).toHaveBeenCalledWith('doc-1', 0.7);
    });
  });

  it('remains compatible when API returns nodes with no edges field', async () => {
    mockQuery = { document_id: 'doc-compat' };
    mockGetGraphNodes.mockResolvedValueOnce({ nodes: SAMPLE_NODES });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
    });

    expect(screen.getByText('UNDP::none')).toBeInTheDocument();
    expect(screen.queryByTestId('edge-r1')).not.toBeInTheDocument();
  });
});
