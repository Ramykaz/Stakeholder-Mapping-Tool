import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNavigation from './layout/TopNavigation';
import Sidebar from './layout/Sidebar';
import WorkflowStepper from './WorkflowStepper';
import NextStepCard from './NextStepCard';
import { getStoredAuthToken, getProjectWorkflow, WorkflowStatus } from '@/lib/api';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Pass to highlight active project in sidebar */
  workspaceId?: string;
  /** Suppress sidebar for full-screen pages like map */
  hideSidebar?: boolean;
  /** Set true to hide the NextStepCard (e.g. on Export tab) */
  hideNextStep?: boolean;
}

export default function Layout({ children, title, subtitle, workspaceId, hideSidebar, hideNextStep }: LayoutProps) {
  const router = useRouter();
  const activeWorkspaceId = workspaceId ?? (router.query.id as string | undefined);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!getStoredAuthToken());
  }, []);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    if (!activeWorkspaceId || !isAuthenticated) return;
    if (typeof getProjectWorkflow !== 'function') return;
    getProjectWorkflow(activeWorkspaceId)
      .then(setWorkflow)
      .catch(() => {}); // non-blocking
  }, [activeWorkspaceId, isAuthenticated]);

  const nextStep = workflow?.next_step ?? null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TopNavigation workspaceId={activeWorkspaceId} onMenuClick={() => setSidebarOpen(v => !v)} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {isAuthenticated && !hideSidebar && (
          <Sidebar workspaceId={activeWorkspaceId} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        <main className="app-main">
          {/* Workflow stepper — only on project pages */}
          {workflow && activeWorkspaceId && (
            <div style={{ marginBottom: 24 }}>
              <WorkflowStepper workflow={workflow} />
            </div>
          )}

          {(title || subtitle) && (
            <div style={{ marginBottom: 32 }}>
              {title && (
                <h1 className="text-page-title" style={{ color: 'var(--text)', marginBottom: 6 }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p style={{ color: 'var(--text2)', fontSize: 15 }}>{subtitle}</p>
              )}
            </div>
          )}
          <div style={{ flex: 1 }}>
            {children}
          </div>

          {/* Next step card at bottom */}
          {workflow && nextStep && !hideNextStep && (
            <div style={{ marginTop: 32 }}>
              <NextStepCard step={nextStep} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
