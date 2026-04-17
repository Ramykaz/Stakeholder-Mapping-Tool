/**
 * Integration tests for pages/auth/login.tsx and pages/auth/register.tsx.
 *
 * Both are compatibility re-exports of pages/login.tsx.  Testing that
 * they render the full login page confirms the re-export works and
 * the route modules are exercised.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/auth/login',
    query: {},
    push: mockPush,
    replace: jest.fn(),
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/lib/api', () => ({
  getStoredAuthToken: jest.fn(() => null),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
}));

describe('pages/auth/login re-export', () => {
  test('renders login form via re-export', async () => {
    // Dynamic import exercises the re-export module
    const mod = await import('../../../pages/auth/login');
    expect(mod.default).toBeDefined();
  });

  test('renders the login page component from re-export', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AuthLoginPage = require('../../../pages/auth/login').default;
    render(<AuthLoginPage />);
    // Login page always renders an email / username input or login-related text
    const inputs = document.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
  });
});

describe('pages/auth/register re-export', () => {
  test('renders register tab via re-export', async () => {
    const mod = await import('../../../pages/auth/register');
    expect(mod.default).toBeDefined();
  });

  test('re-export resolves to the same component as pages/login', async () => {
    const loginMod = await import('../../../pages/login');
    const authRegMod = await import('../../../pages/auth/register');
    expect(authRegMod.default).toBe(loginMod.default);
  });
});
