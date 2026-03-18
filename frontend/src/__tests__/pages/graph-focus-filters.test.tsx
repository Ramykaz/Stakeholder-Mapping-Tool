import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GraphPage from '../../../pages/graph';

let mockQuery: Record<string, string> = {};

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/graph',
    query: mockQuery,
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('next/dynamic', () => {
  return () => {
    const MockGraphVisualization = ({ nodes, onNodeClick, onBackgroundClick, highlightNodeIds, centerNodeId }: any) => (
      <div>
        <button data-testid="background" onClick={() => onBackgroundClick?.()}>bg</button>
        <div data-testid="hits">{(highlightNodeIds || []).join(',')}</div>
        <div data-testid="center">{centerNodeId || ''}</div>
        {(nodes || []).map((n: any) => (
          <button
            key={n.id}
            data-testid={`node-${n.id}`}
            onClick={(e) => onNodeClick?.(n, { shiftKey: (e as any).shiftKey })}
          >
            {n.label}
          </button>
        ))}
      </div>
    );
    MockGraphVisualization.displayName = 'MockGraphVisualization';
    return MockGraphVisualization;
  };
});

jest.mock('@/lib/api', () => ({
  getGraphNodes: jest.fn(),
  getProjectGraph: jest.fn(),
  getEntityProfile: jest.fn(),
  generateEntitySummary: jest.fn(),
}));

import { getGraphNodes } from '@/lib/api';

const mockGetGraphNodes = getGraphNodes as jest.Mock;

describe('Graph focus/filter/search interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = { document_id: 'doc-focus' };
  });

  it('applies client-side filters and search highlighting', async () => {
    mockGetGraphNodes.mockResolvedValueOnce({
      nodes: [
        {
          id: 'n1',
          label: 'UNDP',
          data: { entity_id: 'n1', entity_type: 'ORGANIZATION', confidence: 0.95, document_id: 'doc-focus', chunk_id: null, raw_mentions_count: 1 },
        },
        {
          id: 'n2',
          label: 'Alice Smith',
          data: { entity_id: 'n2', entity_type: 'PERSON', confidence: 0.91, document_id: 'doc-focus', chunk_id: null, raw_mentions_count: 1 },
        },
      ],
      edges: [
        { id: 'e1', source: 'n2', target: 'n1', label: 'WORKS_WITH', confidence: 0.78 },
      ],
    });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('node-n1')).not.toBeNull();
      expect(screen.queryByTestId('node-n2')).not.toBeNull();
    });

    const personCheckbox = screen.getByLabelText('PERSON') as HTMLInputElement;
    fireEvent.click(personCheckbox);

    await waitFor(() => {
      expect(screen.queryByTestId('node-n2')).toBeNull();
      expect(screen.queryByTestId('node-n1')).not.toBeNull();
    });

    fireEvent.change(screen.getByPlaceholderText('Find node label...'), { target: { value: 'undp' } });

    await waitFor(() => {
      expect(screen.getByTestId('hits').textContent).toContain('n1');
      expect(screen.getByTestId('center').textContent).toContain('n1');
    });
  });

  it('activates and resets focus mode using shift-click and background click', async () => {
    mockGetGraphNodes.mockResolvedValueOnce({
      nodes: [
        {
          id: 'n1',
          label: 'UNDP',
          data: { entity_id: 'n1', entity_type: 'ORGANIZATION', confidence: 0.95, document_id: 'doc-focus', chunk_id: null, raw_mentions_count: 1 },
        },
      ],
      edges: [],
    });

    render(<GraphPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('node-n1')).not.toBeNull();
    });

    fireEvent.click(screen.getByTestId('node-n1'), { shiftKey: true });

    await waitFor(() => {
      expect(screen.getByText(/focus mode active/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('background'));

    await waitFor(() => {
      expect(screen.queryByText(/focus mode active/i)).toBeNull();
    });
  });
});
