import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { logoutUser } from '@/lib/api';


type AuthUser = {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
};


function getStoredAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem('sat.auth.user');
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

const navLinks = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
];

const adminNavLinks = [
  {
    href: '/admin',
    label: 'Manage Entities',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
];

export default function Layout({ children, title, subtitle }: LayoutProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredAuthUser());
  }, [router.pathname]);

  useEffect(() => {
    if (router.pathname === '/upload') {
      const projectId = router.query?.project_id;
      if (!projectId || (Array.isArray(projectId) && projectId.length === 0)) {
        void router.replace('/');
      }
    }
  }, [router.pathname, router.query, router]);

  const links = user?.is_admin ? [...navLinks, ...adminNavLinks] : navLinks;

  const onLogout = async () => {
    await logoutUser();
    setUser(null);
    setMobileMenuOpen(false);
    await router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-navy-700 text-white shadow-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo + Brand */}
            <Link href="/" className="flex items-center gap-3 group">
              {/* UNDP-style logo mark */}
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors">
                <svg className="w-5 h-5 text-accent-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-semibold tracking-wide">Stakeholder Analysis</span>
                <span className="hidden md:inline text-xs text-white/50 ml-2">UNDP SDG AI Lab</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center gap-1">
              {links.map(({ href, label, icon }) => {
                const isActive = router.pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {icon}
                    <span>{label}</span>
                  </Link>
                );
              })}
              {user ? (
                <button
                  onClick={() => void onLogout()}
                  className="ml-2 px-3.5 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all duration-150"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  className="ml-2 px-3.5 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all duration-150"
                >
                  Login
                </Link>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="sm:hidden pb-3 border-t border-white/10 mt-1 pt-2 animate-fade-in">
              {links.map(({ href, label, icon }) => {
                const isActive = router.pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {icon}
                    <span>{label}</span>
                  </Link>
                );
              })}
              {user ? (
                <button
                  onClick={() => void onLogout()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Login
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* Page Header */}
      {title && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <h1 className="text-xl font-semibold text-navy-700">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} UNDP SDG AI Lab &mdash; Stakeholder Analysis Tool
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>v1.0</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              <span>Powered by Groq &amp; pgvector</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
