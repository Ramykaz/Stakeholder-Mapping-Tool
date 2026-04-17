import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReviewPage from '../../../pages/projects/[id]/review';

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

jest.mock('@/components/Layout', () => function MockLayout({ children }: any) {
  return <div>{children}</div>;
});

jest.mock('@/lib/api', () => ({
  getProject: jest.fn(),
  getProjectReviewCandidates: jest.fn(),
  resolveReviewCandidate: jest.fn(),
  getStoredAuthToken: jest.fn(),
}));

import {
  getProject,
  getProjectReviewCandidates,
  resolveReviewCandidate,
  getStoredAuthToken,
} from '@/lib/api';

const mockGetProject = getProject as jest.Mock;
const mockGetCandidates = getProjectReviewCandidates as jest.Mock;
const mockResolveCandidate = resolveReviewCandidate as jest.Mock;
const mockGetToken = getStoredAuthToken as jest.Mock;

describe('Review page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routerState.query = { id: 'proj-1' };

    mockGetToken.mockReturnValue('token');
    mockGetProject.mockResolvedValue({ id: 'proj-1', name: 'Coverage Project' });
    mockGetCandidates.mockResolvedValue({
      pending_count: 1,
      results: [
        {
          id: 'cand-1',
          similarity_score: 0.92,
          left_entity: { name: 'UNDP', type: 'ORGANIZATION' },
          right_entity: { name: 'United Nations Development Programme', type: 'ORGANIZATION' },
          mention_context: 'UNDP is referenced in multiple policy sections.',
        },
      ],
    });
    mockResolveCandidate.mockResolvedValue({ ok: true });
  });

  test('redirects to login when auth token is missing', async () => {
    mockGetToken.mockReturnValue(null);

    render(<ReviewPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('shows empty state when there are no pending candidates', async () => {
    mockGetCandidates.mockResolvedValue({ pending_count: 0, results: [] });

    render(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/No pending duplicate pairs to review/i)).toBeInTheDocument();
    });
  });

  test('merge action resolves candidate and removes it from list', async () => {
    render(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText('UNDP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    await waitFor(() => {
      expect(mockResolveCandidate).toHaveBeenCalledWith('cand-1', 'merge');
      expect(screen.queryByText('UNDP')).not.toBeInTheDocument();
    });
  });

  test('keep separate action sends keep_separate resolution', async () => {
    render(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Keep separate' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Keep separate' }));

    await waitFor(() => {
      expect(mockResolveCandidate).toHaveBeenCalledWith('cand-1', 'keep_separate');
    });
  });

  test('failed resolution keeps candidate visible', async () => {
    mockResolveCandidate.mockRejectedValueOnce(new Error('network'));

    render(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText('UNDP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    await waitFor(() => {
      expect(mockResolveCandidate).toHaveBeenCalledWith('cand-1', 'merge');
      expect(screen.getByText('UNDP')).toBeInTheDocument();
    });
  });
});
