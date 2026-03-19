import React, { ReactNode } from 'react';
import { useRouter } from 'next/router';
import TopNavigation from './layout/TopNavigation';
import Sidebar from './layout/Sidebar';
import { getStoredAuthToken } from '@/lib/api';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Pass to highlight active project in sidebar */
  workspaceId?: string;
  /** Suppress sidebar for full-screen pages like map */
  hideSidebar?: boolean;
}

export default function Layout({ children, title, subtitle, workspaceId, hideSidebar }: LayoutProps) {
  const router = useRouter();
  const isAuthenticated = !!getStoredAuthToken();

  // Extract workspaceId from route if not passed explicitly
  const activeWorkspaceId = workspaceId ?? (router.query.id as string | undefined);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TopNavigation workspaceId={activeWorkspaceId} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {isAuthenticated && !hideSidebar && (
          <Sidebar workspaceId={activeWorkspaceId} />
        )}
        <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
          {(title || subtitle) && (
            <div style={{ marginBottom: 32 }}>
              {title && (
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: '#fff', marginBottom: 4 }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p style={{ color: 'var(--text2)', fontSize: 14 }}>{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
