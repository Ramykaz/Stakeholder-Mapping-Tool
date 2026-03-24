import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getProjects, createProject, deleteProject, updateProject,
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

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalDesc, setModalDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Card dropdown
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Edit modal
  const [editProject, setEditProject] = useState<ProjectSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Delete modal
  const [deleteProject_, setDeleteProject_] = useState<ProjectSummary | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownOpenId && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpenId]);

  const openEditModal = (e: React.MouseEvent, project: ProjectSummary) => {
    e.stopPropagation();
    setDropdownOpenId(null);
    setEditProject(project);
    setEditName(project.name);
    setEditDesc(project.description || '');
    setSaveError('');
  };

  const handleSaveEdit = async () => {
    if (!editProject) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateProject(editProject.id, { name: editName.trim(), description: editDesc.trim() });
      setProjects(prev => prev.map(p =>
        p.id === editProject.id ? { ...p, name: editName.trim(), description: editDesc.trim() } : p,
      ));
      setEditProject(null);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (e: React.MouseEvent, project: ProjectSummary) => {
    e.stopPropagation();
    setDropdownOpenId(null);
    setDeleteProject_(project);
    setDeleteInput('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteProject_) return;
    setDeleting(true);
    try {
      await deleteProject(deleteProject_.id);
      setProjects(prev => prev.filter(p => p.id !== deleteProject_.id));
      setDeleteProject_(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
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
                      {/* Three-dot menu */}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setDropdownOpenId(prev => prev === project.id ? null : project.id); }}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--text3)',
                            cursor: 'pointer', padding: '4px 6px', fontSize: 18, lineHeight: 1,
                            borderRadius: 6, transition: 'background .1s, color .1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)'; }}
                        >⋮</button>
                        {dropdownOpenId === project.id && (
                          <div
                            ref={dropdownRef}
                            onClick={e => e.stopPropagation()}
                            style={{
                              position: 'absolute', top: '100%', right: 0, zIndex: 100,
                              background: 'var(--bg2)', border: '1px solid var(--border)',
                              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                              minWidth: 120, overflow: 'hidden', marginTop: 4,
                            }}
                          >
                            <div
                              onClick={e => openEditModal(e, project)}
                              style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              Edit
                            </div>
                            <div
                              onClick={e => openDeleteModal(e, project)}
                              style={{ padding: '9px 14px', fontSize: 13, color: 'var(--coral, #f0614a)', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,97,74,0.1)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              Delete
                            </div>
                          </div>
                        )}
                      </div>
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

      {/* Edit Project modal */}
      {editProject && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => { if (!saving) setEditProject(null); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 32, width: '90%', maxWidth: 480 }}
          >
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, color: '#fff', marginBottom: 24 }}>Edit project</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                Project name *
              </label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                autoFocus
                placeholder="Project name"
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                Description (optional)
              </label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Brief description of what this project is about"
                style={{ resize: 'vertical' }}
              />
            </div>
            {saveError && <p style={{ fontSize: 12, color: 'var(--coral)', marginBottom: 12 }}>{saveError}</p>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditProject(null)} className="btn-ghost" disabled={saving}>Cancel</button>
              <button
                onClick={() => void handleSaveEdit()}
                className="btn-primary"
                disabled={!editName.trim() || saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteProject_ && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => { if (!deleting) { setDeleteProject_(null); setDeleteInput(''); } }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 28px 24px', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          >
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>Delete project?</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
              This will permanently delete <strong style={{ color: 'var(--text)' }}>{deleteProject_.name}</strong> and all its documents, entities, and relations. This cannot be undone.
            </p>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
                Type <strong style={{ color: 'var(--text2)' }}>{deleteProject_.name}</strong> to confirm
              </label>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder={deleteProject_.name}
                autoFocus
                style={{ width: '100%', height: 38, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text)', padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => { setDeleteProject_(null); setDeleteInput(''); }} className="btn-ghost" disabled={deleting}>Cancel</button>
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={deleteInput !== deleteProject_.name || deleting}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: deleteInput === deleteProject_.name ? 'var(--coral, #f0614a)' : 'var(--bg3)',
                  color: deleteInput === deleteProject_.name ? '#fff' : 'var(--text3)',
                  fontSize: 13, fontWeight: 500,
                }}
              >
                {deleting ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}

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
