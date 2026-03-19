import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getProjects, createProject, deleteProject,
  getStoredAuthToken, ProjectSummary,
} from '@/lib/api';
import { getStatusBadgeClass } from '@/lib/entityTypes';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';
import EmptyState from '@/components/EmptyState';
import ErrorMessage from '@/components/ErrorMessage';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ProjectsDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalDesc, setModalDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!getStoredAuthToken()) {
      void router.replace('/login');
      return;
    }
    loadProjects();
    if (router.query.create === '1') {
      setShowModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.create]);

  const loadProjects = () => {
    setLoading(true);
    setError('');
    getProjects()
      .then(setProjects)
      .catch(err => setError(err.message || 'Failed to load projects'))
      .finally(() => setLoading(false));
  };

  const onCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const project = await createProject({ name: modalName.trim(), description: modalDesc.trim() });
      setShowModal(false);
      setModalName('');
      setModalDesc('');
      // Navigate to setup page for new project
      await router.push(`/projects/${project.id}/setup`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const onDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    }
  };

  return (
    <>
      <Head><title>Projects — UNDP Stakeholder Analysis</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: '#fff' }}>Your projects</h1>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                + New Project
              </button>
            </div>
            <p style={{ color: 'var(--text2)', marginBottom: 32 }}>
              Each project is an independent stakeholder map guided by its own concept note.
            </p>

            {/* Loading */}
            {loading && (
              <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading projects…</div>
            )}

            {/* Error */}
            {error && !loading && (
              <div style={{ marginBottom: 24 }}>
                <ErrorMessage message={error} onRetry={loadProjects} />
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && projects.length === 0 && (
              <div style={{ maxWidth: 480, margin: '80px auto' }}>
                <EmptyState
                  icon="🗂️"
                  title="No projects yet"
                  description="Create your first project to start mapping stakeholder relationships from your documents."
                  actionLabel="Create your first project"
                  onAction={() => setShowModal(true)}
                />
              </div>
            )}

            {/* Project cards grid */}
            {!loading && projects.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
              }}>
                {projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => void router.push(`/projects/${project.id}/map`)}
                    style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 14, padding: '22px 24px', cursor: 'pointer',
                      transition: 'border-color .15s', position: 'relative',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className={`badge ${getStatusBadgeClass(project.status)}`}>
                        {project.status}
                      </span>
                      <button
                        onClick={e => void onDeleteProject(e, project.id)}
                        className="card-menu-btn"
                        style={{
                          background: 'transparent', border: 'none', color: 'var(--text3)',
                          cursor: 'pointer', padding: 4, opacity: 0, transition: 'opacity .15s',
                          fontSize: 16,
                        }}
                      >⋮</button>
                    </div>

                    {/* Project name */}
                    <div style={{
                      fontFamily: 'var(--serif)', fontSize: 20, color: '#fff',
                      margin: '12px 0 6px', lineHeight: 1.2,
                    }}>
                      {project.name}
                    </div>

                    {/* Description */}
                    <div style={{
                      fontSize: 13, color: 'var(--text2)', marginBottom: 16,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    } as React.CSSProperties}>
                      {project.description || 'No description'}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', marginBottom: 12 }}/>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {project.entity_count ?? 0} entities · {project.document_count ?? 0} docs
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {formatDate(project.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* New Project modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 16, padding: 32, width: '90%', maxWidth: 480,
            animation: 'fadeUp .3s forwards',
          }}>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, color: '#fff', marginBottom: 24 }}>
              Create a new project
            </h3>
            <form onSubmit={e => void onCreateProject(e)}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                  Project name *
                </label>
                <input
                  placeholder="e.g. AI for Good Uzbekistan Hackathon"
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                  Description (optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief description of what this project is about"
                  value={modalDesc}
                  onChange={e => setModalDesc(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
              {createError && (
                <p style={{ fontSize: 12, color: 'var(--coral)', marginBottom: 12 }}>{createError}</p>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary" disabled={!modalName.trim() || creating}>
                  {creating ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
