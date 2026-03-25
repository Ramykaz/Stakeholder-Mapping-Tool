import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getProjects, deleteProject, getProjectReviewCandidates, getProject, getStoredAuthToken, getStoredAuthUser, ProjectSummary } from '../../lib/api';

export interface SidebarProps {
  workspaceId?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ workspaceId }) => {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const isAuthenticated = !!getStoredAuthToken();
  const user = getStoredAuthUser();

  // Dropdown state
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Delete modal state
  const [deleteModalProject, setDeleteModalProject] = useState<ProjectSummary | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadProjects = () => {
    getProjects().then(setProjects).catch(() => setProjects([]));
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownOpenId && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpenId]);

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

  const handleOpenDropdown = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDropdownOpenId(prev => prev === projectId ? null : projectId);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: ProjectSummary) => {
    e.stopPropagation();
    setDropdownOpenId(null);
    setDeleteModalProject(project);
    setDeleteConfirmInput('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalProject) return;
    setDeleting(true);
    try {
      await deleteProject(deleteModalProject.id);
      setDeleteModalProject(null);
      setDeleteConfirmInput('');
      loadProjects();
      // If we were viewing the deleted project, redirect
      if (activeProjectId === deleteModalProject.id) {
        void router.push('/projects');
      }
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const [reviewCount, setReviewCount] = useState(0);
  const [activeProvider, setActiveProvider] = useState('');

  useEffect(() => {
    if (activeProjectId && isAuthenticated) {
      getProjectReviewCandidates(activeProjectId)
        .then(d => setReviewCount(d.pending_count ?? 0))
        .catch(() => {});
      getProject(activeProjectId)
        .then(p => {
          const prov = (p as any).provider || '';
          const mod = (p as any).model || '';
          setActiveProvider(prov ? `${prov}${mod ? ` / ${mod}` : ''}` : '');
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // Sub-pages for the active project
  const projectSubPages = activeProjectId ? [
    { label: 'Edit concept note', path: `/projects/${activeProjectId}/setup` },
    { label: 'Documents', path: `/projects/${activeProjectId}/documents` },
    { label: 'Analyze', path: `/projects/${activeProjectId}/analyze` },
    { label: 'Graph Map', path: `/projects/${activeProjectId}/map` },
    {
      label: `Review duplicates${reviewCount > 0 ? ` (${reviewCount})` : ''}`,
      path: `/projects/${activeProjectId}/review`,
    },
  ] : [];

  return (
    <>
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
            <div key={project.id} style={{ position: 'relative' }}>
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
                {/* Three-dot menu button */}
                <button
                  onClick={e => handleOpenDropdown(e, project.id)}
                  title="Project options"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', padding: '0 2px', fontSize: 16,
                    lineHeight: 1, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ⋯
                </button>
              </div>

              {/* Dropdown menu */}
              {dropdownOpenId === project.id && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: 'absolute', top: '100%', right: 16, zIndex: 100,
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    minWidth: 120, overflow: 'hidden',
                  }}
                >
                  <div
                    onClick={() => { setDropdownOpenId(null); void router.push(`/projects/${project.id}/settings`); }}
                    style={{
                      padding: '8px 14px', fontSize: 13, color: 'var(--text)',
                      cursor: 'pointer', transition: 'background .1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    Edit
                  </div>
                  <div
                    onClick={e => handleDeleteClick(e, project)}
                    style={{
                      padding: '8px 14px', fontSize: 13, color: 'var(--coral, #f0614a)',
                      cursor: 'pointer', transition: 'background .1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,97,74,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    Delete
                  </div>
                </div>
              )}

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
              {/* Active LLM provider */}
              {isActive(project.id) && activeProvider && (
                <div style={{
                  padding: '3px 10px 5px 28px', margin: '0 8px',
                  fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  LLM: {activeProvider}
                </div>
              )}
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
            { label: 'Entities', action: () => void router.push('/entities') },
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

      {/* Delete confirmation modal */}
      {deleteModalProject && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => { if (!deleting) { setDeleteModalProject(null); setDeleteConfirmInput(''); } }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '28px 28px 24px',
              width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>
              Delete project?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
              This will permanently delete <strong style={{ color: 'var(--text)' }}>{deleteModalProject.name}</strong> and all its documents, entities, and relations. This action cannot be undone.
            </p>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
                Type <strong style={{ color: 'var(--text2)' }}>{deleteModalProject.name}</strong> to confirm
              </label>
              <input
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                placeholder={deleteModalProject.name}
                autoFocus
                style={{
                  width: '100%', height: 38, borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--border2)',
                  color: 'var(--text)', padding: '0 12px', fontSize: 13,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => { setDeleteModalProject(null); setDeleteConfirmInput(''); }}
                className="btn-ghost"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={deleteConfirmInput !== deleteModalProject.name || deleting}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: deleteConfirmInput === deleteModalProject.name ? 'var(--coral, #f0614a)' : 'var(--bg3)',
                  color: deleteConfirmInput === deleteModalProject.name ? '#fff' : 'var(--text3)',
                  fontSize: 13, fontWeight: 500, transition: 'background .15s',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
