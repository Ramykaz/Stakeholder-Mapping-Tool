/**
 * Tests for the Entities page (pages/entities.tsx).
 *
 * Covers:
 * - Initial render (document ID input, empty state)
 * - Entity table after loading
 * - Entity type filter buttons
 * - Error state with retry
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntitiesPage from '../../../pages/entities';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockQuery: Record<string, string> = {};

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/entities',
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

jest.mock('@/lib/api', () => ({
  getEntities: jest.fn(),
}));

import { getEntities } from '@/lib/api';

const mockGetEntities = getEntities as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = {};
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const SAMPLE_ENTITIES = [
  {
    id: 'e1',
    canonical_name: 'Alice Johnson',
    entity_type: 'PERSON',
    confidence: 0.92,
    raw_mentions: ['Alice', 'A. Johnson'],
    chunk_id: 'c1',
    document_id: 'doc-1',
    created_at: '2026-03-10T00:00:00Z',
  },
  {
    id: 'e2',
    canonical_name: 'UNDP',
    entity_type: 'ORGANIZATION',
    confidence: 0.98,
    raw_mentions: ['UNDP', 'United Nations Development Programme'],
    chunk_id: 'c1',
    document_id: 'doc-1',
    created_at: '2026-03-10T00:00:00Z',
  },
  {
    id: 'e3',
    canonical_name: 'New York',
    entity_type: 'LOCATION',
    confidence: 0.85,
    raw_mentions: ['New York', 'NYC'],
    chunk_id: 'c2',
    document_id: 'doc-1',
    created_at: '2026-03-10T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('EntitiesPage', () => {
  it('renders the document ID input and Load button', () => {
    render(<EntitiesPage />);

    expect(screen.getByPlaceholderText(/document id/i)).toBeInTheDocument();
    expect(screen.getByText('Load')).toBeInTheDocument();
  });

  it('shows empty state when no document is loaded', () => {
    render(<EntitiesPage />);
    expect(screen.getByText(/enter a document id/i)).toBeInTheDocument();
  });

  it('loads and displays entities from query param', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetEntities.mockResolvedValueOnce(SAMPLE_ENTITIES);

    render(<EntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    expect(screen.getByText('UNDP')).toBeInTheDocument();
    expect(screen.getByText('New York')).toBeInTheDocument();
    expect(mockGetEntities).toHaveBeenCalledWith('doc-1', undefined);
  });

  it('shows entity type summary cards', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetEntities.mockResolvedValueOnce(SAMPLE_ENTITIES);

    render(<EntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Summary cards should show counts — multiple elements per type (card + filter + table)
    expect(screen.getAllByText('PERSON').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ORGANIZATION').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('LOCATION').length).toBeGreaterThanOrEqual(1);
  });

  it('renders filter buttons for entity types', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetEntities.mockResolvedValue(SAMPLE_ENTITIES);

    render(<EntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    // Filter buttons
    expect(screen.getByText('All')).toBeInTheDocument();
    // The entity type buttons in the filter bar
    const personButtons = screen.getAllByText('PERSON');
    expect(personButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('loads entities when submitting document ID form', async () => {
    mockGetEntities.mockResolvedValueOnce(SAMPLE_ENTITIES);

    render(<EntitiesPage />);

    const input = screen.getByPlaceholderText(/document id/i);
    fireEvent.change(input, { target: { value: 'doc-xyz' } });
    fireEvent.click(screen.getByText('Load'));

    await waitFor(() => {
      expect(mockGetEntities).toHaveBeenCalledWith('doc-xyz', undefined);
    });
  });

  it('shows error message on API failure', async () => {
    mockQuery = { document_id: 'doc-bad' };
    mockGetEntities.mockRejectedValueOnce(new Error('Failed to load entities'));

    render(<EntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load entities')).toBeInTheDocument();
    });
  });

  it('shows empty table message when no entities found', async () => {
    mockQuery = { document_id: 'doc-empty' };
    mockGetEntities.mockResolvedValueOnce([]);

    render(<EntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText(/no entities found/i)).toBeInTheDocument();
    });
  });

  it('shows View as Graph button when entities exist', async () => {
    mockQuery = { document_id: 'doc-1' };
    mockGetEntities.mockResolvedValueOnce(SAMPLE_ENTITIES);

    render(<EntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText(/view as graph/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/view as graph/i));
    expect(mockPush).toHaveBeenCalledWith('/graph?document_id=doc-1');
  });
});
