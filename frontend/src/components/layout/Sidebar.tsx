import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getProjects, getStoredAuthToken, getStoredAuthUser, ProjectSummary } from '../../lib/api';

export interface SidebarProps {
  workspaceId?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ workspaceId }) => {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const isAuthenticated = !!getStoredAuthToken();
  const user = getStoredAuthUser();

  useEffect(() => {
    if (isAuthenticated) {
      getProjects().then(setProjects).catch(() => setProjects([]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  const activeProjectId = workspaceId ?? (router.query.id as string | undefined);
  const isActive = (id: string) => id === activeProjectId;

  const navigateToProject = (id: string) => {
    void router.push(`/projects/${id}/map`);
  };

  const onNewProject = () => {
    void router.push('/projects?create=1');
  };

  const onSettings = () => {
    if (user?.is_admin) {
      void router.push('/admin');
    } else {
      void router.push('/projects');
    }
  };

  // Sub-pages for the active project
  const projectSubPages = activeProjectId ? [
    { label: 'Documents', path: `/projects/${activeProjectId}/documents` },
    { label: 'Analyze', path: `/projects/${activeProjectId}/analyze` },
    { label: 'Graph Map', path: `/projects/${activeProjectId}/map` },
  ] : [];

  return (
    <aside style={{
      width: 220,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Top section */}
      <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10,
        }}>Projects</div>
        <button
          onClick={onNewProject}
          className="btn-primary"
          style={{ width: '100%', padding: '7px 12px', fontSize: 12, justifyContent: 'center' }}
        >
          + New Project
        </button>
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {projects.map(project => (
          <div key={project.id}>
            <div
              onClick={() => navigateToProject(project.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                margin: '2px 8px',
                border: isActive(project.id) ? '1px solid rgba(61,111,255,0.25)' : '1px solid transparent',
                background: isActive(project.id) ? 'var(--accent-soft)' : 'transparent',
                transition: 'background .15s',
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: project.status === 'active' ? 'var(--teal)'
                          : project.status === 'archived' ? 'var(--text3)'
                          : 'var(--amber)',
              }}/>
              <span style={{
                fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {project.name}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                {project.entity_count ?? 0}
              </span>
            </div>
            {/* Sub-pages for active project */}
            {isActive(project.id) && projectSubPages.map(sub => (
              <div
                key={sub.path}
                onClick={() => void router.push(sub.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '5px 10px 5px 28px', borderRadius: 6, cursor: 'pointer',
                  margin: '1px 8px',
                  background: router.asPath === sub.path ? 'rgba(255,255,255,0.04)' : 'transparent',
                  color: router.asPath === sub.path ? 'var(--accent)' : 'var(--text3)',
                  fontSize: 12,
                  transition: 'color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = router.asPath === sub.path ? 'var(--accent)' : 'var(--text3)'; }}
              >
                {sub.label}
              </div>
            ))}
          </div>
        ))}

        {projects.length === 0 && (
          <div style={{
            padding: '20px 12px',
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', textAlign: 'center',
          }}>
            No projects yet
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div style={{ marginTop: 'auto', padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        {[
          { label: 'Projects', action: () => void router.push('/projects') },
          { label: user?.is_admin ? 'Admin Settings' : 'Account', action: onSettings },
        ].map(item => (
          <div
            key={item.label}
            onClick={item.action}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text2)',
              transition: 'color .15s, background .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text2)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
