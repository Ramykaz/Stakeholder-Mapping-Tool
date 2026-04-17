import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SetupPage from '../../../pages/projects/[id]/setup';

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

jest.mock('@/components/layout/TopNavigation', () => function MockTopNav() {
  return <div data-testid="top-nav" />;
});

jest.mock('@/components/layout/Sidebar', () => function MockSidebar() {
  return <div data-testid="sidebar" />;
});

jest.mock('@/components/ErrorMessage', () => function MockErrorMessage({ message }: any) {
  return <div>{message}</div>;
});

jest.mock('@/lib/api', () => ({
  getProject: jest.fn(),
  getProjectConceptNote: jest.fn(),
  upsertProjectConceptNote: jest.fn(),
  getStoredAuthToken: jest.fn(),
}));

import {
  upsertProjectConceptNote,
  getStoredAuthToken,
} from '@/lib/api';

const mockUpsertConcept = upsertProjectConceptNote as jest.Mock;
const mockGetToken = getStoredAuthToken as jest.Mock;

describe('Setup page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    routerState.query = { id: 'proj-1' };

    mockGetToken.mockReturnValue('token');
    mockUpsertConcept.mockResolvedValue({ id: 'note-1', content: 'saved' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('redirects to login when auth token is missing', async () => {
    mockGetToken.mockReturnValue(null);

    render(<SetupPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('redirects to intake when project id exists', async () => {
    render(<SetupPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/projects/proj-1/intake');
    });
  });

  test('autosaves concept note after debounce interval', async () => {
    render(<SetupPage />);

    fireEvent.change(
      screen.getByPlaceholderText(/Describe your project objectives/i),
      { target: { value: 'This is updated concept note text.' } },
    );

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockUpsertConcept).toHaveBeenCalledWith('proj-1', {
        content: 'This is updated concept note text.',
      });
    });
  });

  test('save and continue saves then navigates to documents page', async () => {
    render(<SetupPage />);

    fireEvent.change(
      screen.getByPlaceholderText(/Describe your project objectives/i),
      { target: { value: 'Ready to continue.' } },
    );

    fireEvent.click(screen.getByRole('button', { name: /Save & continue/i }));

    await waitFor(() => {
      expect(mockUpsertConcept).toHaveBeenCalledWith('proj-1', {
        content: 'Ready to continue.',
      });
      expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/documents');
    });
  });

  test('skip action navigates directly to documents page', async () => {
    render(<SetupPage />);

    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/documents');
    });
  });
});
