import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const routerState: any = {
  pathname: '/',
  query: {},
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

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/components/layout/TopNavigation', () => function MockTopNav() {
  return <div data-testid="top-nav" />;
});

jest.mock('@/components/layout/Sidebar', () => function MockSidebar() {
  return <div data-testid="sidebar" />;
});

jest.mock('@/components/Layout', () => function MockLayout({ children, title }: any) {
  return (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  );
});

jest.mock('@/components/LoadingSpinner', () => function MockSpinner({ message }: any) {
  return <div>{message || 'Loading'}</div>;
});

jest.mock('@/components/ErrorMessage', () => function MockErrorMessage({ message, onRetry }: any) {
  return (
    <div>
      <span>{message}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
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
  getProjectGraph: jest.fn(),
  getRelations: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

import {
  getStoredAuthToken,
  getStoredAuthUser,
  adminGetStats,
  getProjectGraph,
  getRelations,
  forgotPassword,
  resetPassword,
} from '@/lib/api';

import HomePage from '../../../pages/index';
import AdminPage from '../../../pages/admin';
import RelationsPage from '../../../pages/relations';
import ForgotPasswordPage from '../../../pages/forgot-password';
import ResetPasswordPage from '../../../pages/reset-password';
import LegacyRegisterPage from '../../../pages/register';

const mockGetStoredAuthToken = getStoredAuthToken as jest.Mock;
const mockGetStoredAuthUser = getStoredAuthUser as jest.Mock;
const mockAdminGetStats = adminGetStats as jest.Mock;
const mockGetProjectGraph = getProjectGraph as jest.Mock;
const mockGetRelations = getRelations as jest.Mock;
const mockForgotPassword = forgotPassword as jest.Mock;
const mockResetPassword = resetPassword as jest.Mock;

describe('Missing pages smoke coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routerState.pathname = '/';
    routerState.query = {};
    mockGetStoredAuthToken.mockReturnValue(null);
    mockGetStoredAuthUser.mockReturnValue({ id: 1, username: 'admin', is_admin: true });
    mockAdminGetStats.mockResolvedValue({
      users: 12,
      active_users: 8,
      admin_users: 1,
      projects: 3,
      documents: 10,
      entities: 22,
      flagged_entities: 0,
      relations: 31,
    });
    mockGetProjectGraph.mockResolvedValue({ nodes: [], edges: [] });
    mockGetRelations.mockResolvedValue([]);
    mockForgotPassword.mockResolvedValue({ _debug_reset_path: '/reset?uid=u&token=t' });
    mockResetPassword.mockResolvedValue({ ok: true });
  });

  it('renders home page and redirects authenticated users', async () => {
    mockGetStoredAuthToken.mockReturnValue('token');
    render(<HomePage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/projects');
    });
    expect(screen.getByText(/Map who matters/i)).toBeInTheDocument();
  });

  it('renders admin access denied state for non-admin users', async () => {
    routerState.pathname = '/admin';
    mockGetStoredAuthToken.mockReturnValue('token');
    mockGetStoredAuthUser.mockReturnValue({ id: 2, username: 'user', is_admin: false });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText(/Admin access required/i)).toBeInTheDocument();
    });
  });

  it('renders relations page and loads document relations', async () => {
    routerState.pathname = '/relations';
    routerState.query = {};
    mockGetRelations.mockResolvedValue([
      {
        id: 'r1',
        source_entity_name: 'UNDP',
        target_entity_name: 'Nairobi',
        label: 'WORKS_IN',
        confidence: 0.91,
        created_at: new Date().toISOString(),
      },
    ]);

    render(<RelationsPage />);

    const input = screen.getByPlaceholderText(/Enter Document ID/i);
    fireEvent.change(input, { target: { value: 'doc-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Load/i }));

    await waitFor(() => {
      expect(mockGetRelations).toHaveBeenCalledWith('doc-123');
    });
    expect(screen.getByText('UNDP')).toBeInTheDocument();
  });

  it('handles forgot password validation and success flow', async () => {
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText(/you@undp.org/i), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('button', { name: /Send reset link/i }).closest('form') as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/you@undp.org/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send reset link/i }));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('user@example.com');
    });
    expect(screen.getByText(/If that email is registered/i)).toBeInTheDocument();
  });

  it('handles reset password mismatch and success flow', async () => {
    routerState.pathname = '/reset-password';
    routerState.query = { uid: 'abc', token: 'def' };

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText(/Min. 8 characters/i), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByPlaceholderText(/Repeat password/i), { target: { value: 'Mismatch1!' } });
    fireEvent.click(screen.getByRole('button', { name: /Set password/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Repeat password/i), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: /Set password/i }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({ uid: 'abc', token: 'def', new_password: 'Password1!' });
    });
    expect(screen.getByText(/Password has been reset/i)).toBeInTheDocument();
  });

  it('redirects legacy register route to login', async () => {
    routerState.pathname = '/register';
    render(<LegacyRegisterPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
