import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from '../../../pages/admin';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    pathname: '/admin',
    query: {},
  }),
}));

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/components/layout/TopNavigation', () => function MockTopNavigation() {
  return <div data-testid="top-nav" />;
});

jest.mock('@/components/layout/Sidebar', () => function MockSidebar() {
  return <div data-testid="sidebar" />;
});

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn(),
  getStoredAuthUser: jest.fn(),
  adminGetStats: jest.fn(),
  adminListUsers: jest.fn(),
  adminUpdateUser: jest.fn(),
  adminDeleteUser: jest.fn(),
  adminGetAllProjects: jest.fn(),
  adminGetActivity: jest.fn(),
}));

import {
  getStoredAuthToken,
  getStoredAuthUser,
  adminGetStats,
  adminListUsers,
  adminUpdateUser,
} from '@/lib/api';

const mockGetToken = getStoredAuthToken as jest.Mock;
const mockGetUser = getStoredAuthUser as jest.Mock;
const mockGetStats = adminGetStats as jest.Mock;
const mockListUsers = adminListUsers as jest.Mock;
const mockUpdateUser = adminUpdateUser as jest.Mock;

describe('Admin page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockReturnValue('token');
    mockGetUser.mockReturnValue({ id: 1, username: 'admin', is_admin: true });
    mockGetStats.mockResolvedValue({
      users: 10,
      active_users: 8,
      admin_users: 1,
      projects: 3,
      documents: 12,
      entities: 22,
      flagged_entities: 2,
      relations: 19,
    });
    mockListUsers.mockResolvedValue({
      count: 1,
      results: [
        {
          id: 2,
          username: 'member1',
          email: 'member1@example.com',
          is_admin: false,
          is_active: true,
          date_joined: '2026-01-01T00:00:00Z',
        },
      ],
    });
    mockUpdateUser.mockResolvedValue({});
  });

  test('redirects to login when token is missing', async () => {
    mockGetToken.mockReturnValue(null);
    render(<AdminPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  test('shows access-denied screen for non-admin user', async () => {
    mockGetUser.mockReturnValue({ id: 2, username: 'regular', is_admin: false });
    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin access required')).toBeInTheDocument();
      expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
    });

    // Dashboard content must not render
    expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
  });

  test('back-to-projects button is present in access-denied state', async () => {
    mockGetUser.mockReturnValue({ id: 3, username: 'regular2', is_admin: false });
    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to projects/i })).toBeInTheDocument();
    });
  });

  test('back-to-projects button navigates to /projects', async () => {
    mockGetUser.mockReturnValue({ id: 4, username: 'regular3', is_admin: false });
    render(<AdminPage />);

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /back to projects/i });
      fireEvent.click(btn);
    });

    expect(mockPush).toHaveBeenCalledWith('/projects');
  });

  test('renders stats tab and refreshes overview', async () => {
    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh stats' }));
    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalledTimes(2);
    });
  });

  test('loads users tab and toggles admin role', async () => {
    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'User Management' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'User Management' }));

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledWith({ page: 1, search: '' });
      expect(screen.getByText('member1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Make admin' }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(2, { is_admin: true });
    });
  });
});
