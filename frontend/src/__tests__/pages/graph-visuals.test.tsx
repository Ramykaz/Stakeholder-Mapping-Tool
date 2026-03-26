import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GraphPage from '../../../pages/graph';

let mockQuery: Record<string, string> = {};

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/graph',
    query: mockQuery,
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockGraphComponent = jest.fn(({ nodes, edges, command }: any) => (
  <div data-testid="graph-visualization">
    <div data-testid="node-size">{nodes?.[0]?.data?.node_size}</div>
    <div data-testid="edge-width">{edges?.[0]?.edge_width}</div>
    <div data-testid="shape">{nodes?.[0]?.style?.shape}</div>
    <div data-testid="color">{nodes?.[0]?.style?.color}</div>
    <div data-testid="command">{command?.type || 'none'}</div>
  </div>
));

jest.mock('next/dynamic', () => {
  return () => {
    const MockDynamic = (props: any) => mockGraphComponent(props);
    MockDynamic.displayName = 'MockDynamicGraph';
    return MockDynamic;
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
  getProjectGraph: jest.fn(),
  getEntityProfile: jest.fn(),
  generateEntitySummary: jest.fn(),
}));

import { getGraphNodes } from '@/lib/api';

const mockGetGraphNodes = getGraphNodes as jest.Mock;

describe('Graph visuals encoding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = { document_id: 'doc-visual' };
  });

  it('passes style and scaling fields through to the graph renderer', async () => {
    mockGetGraphNodes.mockResolvedValueOnce({
      nodes: [
        {
          id: 'n1',
          label: 'UNDP',
          style: { shape: 'rectangle', color: '#2563eb' },
          data: {
            entity_id: 'n1',
            entity_type: 'ORGANIZATION',
            confidence: 0.93,
            document_id: 'doc-visual',
            chunk_id: null,
            raw_mentions_count: 3,
            node_size: 72,
          },
        },
        {
          id: 'n2',
          label: 'Ministry of Finance',
          style: { shape: 'rectangle', color: '#8b5cf6' },
          data: {
            entity_id: 'n2',
            entity_type: 'ORGANIZATION',
            confidence: 0.89,
            document_id: 'doc-visual',
            chunk_id: null,
            raw_mentions_count: 2,
            node_size: 64,
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          label: 'FUNDS',
          confidence: 0.81,
          edge_width: 5.2,
        },
      ],
    });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('graph-visualization')).not.toBeNull();
    });

    expect(screen.getByTestId('shape').textContent).toContain('rectangle');
    expect(screen.getByTestId('color').textContent).toContain('#2563eb');
    expect(screen.getByTestId('node-size').textContent).toContain('72');

    await waitFor(() => {
      expect(screen.getByTestId('edge-width').textContent).toContain('5.2');
    });
  });

  it('sends zoom commands from page controls', async () => {
    mockGetGraphNodes.mockResolvedValueOnce({
      nodes: [
        {
          id: 'n1',
          label: 'UNDP',
          style: { shape: 'rectangle', color: '#2563eb' },
          data: {
            entity_id: 'n1',
            entity_type: 'ORGANIZATION',
            confidence: 0.93,
            document_id: 'doc-visual',
            chunk_id: null,
            raw_mentions_count: 3,
            node_size: 72,
          },
        },
      ],
      edges: [],
    });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('graph-visualization')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: '+' }));

    await waitFor(() => {
      expect(screen.getByTestId('command').textContent).toContain('zoomIn');
    });
  });
});
