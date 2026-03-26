/**
 * Tests for the Global Entities page (pages/entities.tsx).
 *
 * Covers:
 * - Initial render with loading state
 * - Entity list rendering after load
 * - Entity type filter buttons
 * - Navigation to entity profile on click
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GlobalEntitiesPage from '../../../pages/entities';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/entities',
    query: {},
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

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn().mockReturnValue('test-token'),
  getStoredAuthUser: jest.fn().mockReturnValue({ id: 1, username: 'testuser', is_admin: false }),
  getProjects: jest.fn().mockResolvedValue([]),
  getProject: jest.fn().mockResolvedValue({ id: 'p1', name: 'Test Project' }),
  logoutUser: jest.fn(),
  getProjectReviewCandidates: jest.fn().mockResolvedValue({ results: [], count: 0 }),
  getGlobalEntities: jest.fn(),
}));

import { getGlobalEntities } from '@/lib/api';
const mockGetGlobalEntities = getGlobalEntities as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const SAMPLE_ENTITIES = [
  {
    id: 'e1',
    canonical_name: 'Alice Johnson',
    entity_type: 'PERSON',
    project_count: 2,
    document_count: 4,
    confidence_min: 0.85,
    confidence_max: 0.95,
  },
  {
    id: 'e2',
    canonical_name: 'UNDP',
    entity_type: 'ORGANIZATION',
    project_count: 5,
    document_count: 12,
    confidence_min: 0.9,
    confidence_max: 0.99,
  },
  {
    id: 'e3',
    canonical_name: 'Nairobi',
    entity_type: 'LOCATION',
    project_count: 1,
    document_count: 3,
    confidence_min: 0.8,
    confidence_max: 0.88,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GlobalEntitiesPage', () => {
  it('renders entity list after loading', async () => {
    mockGetGlobalEntities.mockResolvedValueOnce({ results: SAMPLE_ENTITIES, count: 3 });

    render(<GlobalEntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeTruthy();
    });

    expect(screen.getByText('UNDP')).toBeTruthy();
    expect(screen.getByText('Nairobi')).toBeTruthy();
  });

  it('shows empty state when no entities found', async () => {
    mockGetGlobalEntities.mockResolvedValueOnce({ results: [], count: 0 });

    render(<GlobalEntitiesPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading')).toBeFalsy();
    });

    // No entity names should be shown
    expect(screen.queryByText('Alice Johnson')).toBeFalsy();
  });

  it('renders entity type filter dropdown', async () => {
    mockGetGlobalEntities.mockResolvedValue({ results: SAMPLE_ENTITIES, count: 3 });

    render(<GlobalEntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeTruthy();
    });

    // Filter is a select with an "All types" default option
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
    expect(screen.getByText('All types')).toBeTruthy();
  });

  it('filters entities by type when select changes', async () => {
    mockGetGlobalEntities.mockResolvedValue({ results: SAMPLE_ENTITIES, count: 3 });

    render(<GlobalEntitiesPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeTruthy();
    });

    // Change the select to filter by PERSON
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'PERSON' } });

    await waitFor(() => {
      expect(mockGetGlobalEntities).toHaveBeenCalledTimes(2);
    });
  });
});
