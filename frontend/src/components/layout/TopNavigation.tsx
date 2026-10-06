import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getStoredAuthToken, getStoredAuthUser, logoutUser, getProjects, AuthUser } from '../../lib/api';
import { isDemoModeActive, exitDemoMode } from '../../lib/demoData';

export interface TopNavigationProps {
  workspaceId?: string;
  /** Shown only on mobile — toggles the off-canvas sidebar */
  onMenuClick?: () => void;
}

const TopNavigation: React.FC<TopNavigationProps> = ({ workspaceId, onMenuClick }) => {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; type: 'project' }>>([]);
  const [isDark, setIsDark] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsDemo(isDemoModeActive());
  }, [router.pathname]);

  const onExitDemo = async () => {
    exitDemoMode();
    await router.push('/');
  };

  // Load saved theme on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const dark = saved !== 'light';
    setIsDark(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const theme = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  useEffect(() => {
    const token = getStoredAuthToken();
    const storedUser = getStoredAuthUser();
    setIsAuthenticated(!!token);
    setUser(storedUser);
  }, [router.pathname]);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);

  // Search projects client-side
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    getProjects().then(projects => {
      const q = searchQuery.toLowerCase();
      const matches = projects
        .filter(p => p.name.toLowerCase().includes(q))
        .slice(0, 6)
        .map(p => ({ id: p.id, name: p.name, type: 'project' as const }));
      setSearchResults(matches);
    }).catch(() => {});
  }, [searchQuery]);

  const userInitials = user
    ? ((user.username || user.email || '??').slice(0, 2)).toUpperCase()
    : '??';

  const onLogout = async () => {
    setShowUserMenu(false);
    await logoutUser();
    setUser(null);
    setIsAuthenticated(false);
    await router.push('/login');
  };

  return (
    <header className="app-header" style={{
      height: 52,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      {/* Hamburger — mobile only */}
      {isAuthenticated && (
        <button
          className="hamburger-btn"
          onClick={() => onMenuClick?.()}
          aria-label="Toggle navigation menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}

      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8">
            <circle cx="8" cy="8" r="2"/>
            <circle cx="8" cy="2.5" r="1.5"/><line x1="8" y1="4" x2="8" y2="6"/>
            <circle cx="13" cy="11" r="1.5"/><line x1="9.2" y1="8.8" x2="11.8" y2="10.2"/>
            <circle cx="3" cy="11" r="1.5"/><line x1="6.8" y1="8.8" x2="4.2" y2="10.2"/>
          </svg>
        </div>
        <span className="nav-logo-text" style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          UNDP Stakeholder Analysis
        </span>
      </Link>

      {isDemo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          padding: '4px 10px', borderRadius: 20,
          background: 'var(--amber-soft)', border: '1px solid var(--amber)',
        }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.04em', color: 'var(--amber)', whiteSpace: 'nowrap',
          }}>
            DEMO — sample data
          </span>
          <button
            onClick={() => void onExitDemo()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 11, color: 'var(--amber)', textDecoration: 'underline', whiteSpace: 'nowrap',
            }}
          >
            Exit
          </button>
        </div>
      )}

      {/* Search pill (authenticated only) */}
      {isAuthenticated && (
        <div ref={searchRef} className="nav-search" style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
          <div
            onClick={() => setSearchOpen(true)}
            style={{
              borderRadius: 20, border: '1px solid var(--border2)',
              background: 'var(--bg2)', display: 'flex', alignItems: 'center',
              gap: 8, padding: '7px 14px', cursor: 'text',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--text3)" strokeWidth="1.8">
              <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
            </svg>
            {searchOpen ? (
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search projects…"
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'var(--mono)',
                }}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }}
              />
            ) : (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                Search projects…
              </span>
            )}
          </div>
          {/* Search results dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
              overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {searchResults.map(r => (
                <div
                  key={r.id}
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); void router.push(`/projects/${r.id}/map`); }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--text3)" strokeWidth="1.8">
                    <rect x="2" y="2" width="12" height="12" rx="2"/>
                  </svg>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{r.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>project</span>
                </div>
              ))}
            </div>
          )}
          {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '12px 14px', zIndex: 200, fontSize: 13, color: 'var(--text3)',
            }}>
              No projects matching &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)',
            background: 'var(--bg3)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text2)', transition: 'border-color .15s, color .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)'; }}
        >
          {isDark ? (
            /* Sun icon */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            /* Moon icon */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {isAuthenticated ? (
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setShowUserMenu(v => !v)}
              style={{
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: 12, color: '#fff', fontWeight: 500,
                flexShrink: 0,
              }}
              title="Account menu"
            >
              {userInitials}
            </div>
            {/* User dropdown */}
            {showUserMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8,
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                minWidth: 220, overflow: 'hidden', zIndex: 200,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {/* User info */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                    {user?.username || user?.email || 'User'}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                    {user?.email || ''}
                  </div>
                  {user?.is_admin && (
                    <div style={{
                      marginTop: 6, display: 'inline-block',
                      padding: '2px 8px', borderRadius: 4,
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                      fontFamily: 'var(--mono)', fontSize: 10,
                    }}>
                      admin
                    </div>
                  )}
                </div>
                {/* Menu items */}
                <div style={{ padding: '4px' }}>
                  <button
                    onClick={() => { setShowUserMenu(false); void router.push('/projects'); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: 'var(--text2)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text2)'; }}
                  >
                    My Projects
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); void router.push('/account'); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: 'var(--text2)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text2)'; }}
                  >
                    My Account
                  </button>
                  {user?.is_admin && (
                    <button
                      onClick={() => { setShowUserMenu(false); void router.push('/admin'); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 6,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, color: 'var(--text2)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text2)'; }}
                    >
                      Admin Panel
                    </button>
                  )}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <button
                    onClick={() => void onLogout()}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: 'var(--coral)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--coral-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link href="/login" className="btn-ghost" style={{ fontSize: 13 }}>Sign in</Link>
            <Link href="/login?tab=register" className="btn-primary" style={{ fontSize: 13 }}>Get started</Link>
          </>
        )}
      </div>
    </header>
  );
};

export default TopNavigation;
