import React, { ReactNode } from 'react';
import { useRouter } from 'next/router';
import TopNavigation from './TopNavigation';
import Sidebar from './Sidebar';
import { getStoredAuthToken } from '../../lib/api';

export interface LayoutProps {
  children: ReactNode;
  hideSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, hideSidebar }) => {
  const router = useRouter();
  const isAuthenticated = !!getStoredAuthToken();
  const workspaceId = router.query.id as string | undefined;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TopNavigation workspaceId={workspaceId} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {isAuthenticated && !hideSidebar && (
          <Sidebar workspaceId={workspaceId} />
        )}
        <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
