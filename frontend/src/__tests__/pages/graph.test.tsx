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
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// Mock next/dynamic — render a simple div instead of Cytoscape
jest.mock('next/dynamic', () => {
  return (_importFn: any, _opts?: any) => {
    const MockGraphVisualization = ({ nodes, onNodeClick }: any) => (
      <div data-testid="graph-visualization">
        {nodes.map((n: any) => (
          <div key={n.id} data-testid={`node-${n.id}`} onClick={() => onNodeClick?.(n)}>
            {n.label}
          </div>
        ))}
      </div>
    );
    MockGraphVisualization.displayName = 'MockGraphVisualization';
    return MockGraphVisualization;
  };
});

jest.mock('@/lib/api', () => ({
  getGraphNodes: jest.fn(),
}));

import { getGraphNodes } from '@/lib/api';

const mockGetGraphNodes = getGraphNodes as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
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
    mockGetGraphNodes.mockResolvedValueOnce(SAMPLE_NODES);

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
    });

    expect(screen.getByText('UNDP')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(mockGetGraphNodes).toHaveBeenCalledWith('doc-1', undefined);
  });

  it('loads nodes when submitting document ID form', async () => {
    mockGetGraphNodes.mockResolvedValueOnce(SAMPLE_NODES);

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
    mockGetGraphNodes.mockResolvedValueOnce([]);

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByText(/no entities found/i)).toBeInTheDocument();
    });
  });

  it('shows node detail panel on node click', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetGraphNodes.mockResolvedValueOnce(SAMPLE_NODES);

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
    mockGetGraphNodes.mockResolvedValueOnce(SAMPLE_NODES);

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.getByText(/min confidence/i)).toBeInTheDocument();
    });
  });
});
