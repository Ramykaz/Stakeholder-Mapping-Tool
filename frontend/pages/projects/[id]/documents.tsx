import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getProject,
  getProjectDocuments,
  uploadDocumentToProject,
  deleteProjectDocument,
  getProjectDocumentStatus,
  getStoredAuthToken,
  ProjectSummary,
  DocumentSummary,
} from '@/lib/api';
import { getStatusBadgeClass } from '@/lib/entityTypes';
import { formatFileSize } from '@/lib/uiState';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';
import EmptyState from '@/components/EmptyState';
import ErrorMessage from '@/components/ErrorMessage';

const STEPS = ['Concept Note', 'Upload Documents', 'Analyze & Explore'];
const POLLING_INTERVAL = 3000;
const TERMINAL_STATUSES = ['completed', 'failed'];

function getFileIcon(fmt: string) {
  if (fmt === 'pdf')  return '📄';
  if (fmt === 'docx') return '📘';
  return '📝';
}

function getFileIconBg(fmt: string) {
  if (fmt === 'pdf')  return 'var(--coral-soft)';
  if (fmt === 'docx') return 'var(--accent-soft)';
  return 'var(--amber-soft)';
}

export default function DocumentsPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    if (!id) return;
    getProject(id).then(setProject).catch(() => {});
    loadDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadDocuments = useCallback(() => {
    if (!id) return;
    getProjectDocuments(id)
      .then(docs => { setDocuments(docs); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [id]);

  // Polling: refresh status for non-terminal documents every 3s
  useEffect(() => {
    const hasPending = documents.some(d => !TERMINAL_STATUSES.includes(d.processing_status));
    if (!hasPending) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    if (pollingRef.current) return; // already polling
    pollingRef.current = setInterval(async () => {
      if (!id) return;
      const pending = documents.filter(d => !TERMINAL_STATUSES.includes(d.processing_status));
      const updates = await Promise.allSettled(
        pending.map(d => getProjectDocumentStatus(id, d.id))
      );
      setDocuments(prev => prev.map(doc => {
        const update = updates[pending.findIndex(p => p.id === doc.id)];
        if (update?.status === 'fulfilled') {
          return { ...doc, ...update.value };
        }
        return doc;
      }));
    }, POLLING_INTERVAL);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [documents, id]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!id) return;
    setUploading(true);
    setError('');
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      try {
        const doc = await uploadDocumentToProject(id, file);
        setDocuments(prev => [doc, ...prev]);
      } catch (err: any) {
        setError(err.message || `Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    // Refresh the full list to get annotated entity counts
    loadDocuments();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) void uploadFiles(e.target.files);
    e.target.value = '';
  };

  const onDelete = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await deleteProjectDocument(id, docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const canBuildGraph = documents.some(d => d.processing_status === 'completed');

  return (
    <>
      <Head><title>Documents — {project?.name ?? 'Upload'}</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation workspaceId={id} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar workspaceId={id} />
          <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>

              {/* Progress indicator */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
                {STEPS.map((label, i) => (
                  <React.Fragment key={label}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--mono)', fontSize: 12,
                        background: i === 0 ? 'var(--teal)' : i === 1 ? 'var(--accent)' : 'transparent',
                        color: i < 2 ? '#fff' : 'var(--text2)',
                        border: i >= 2 ? '1px solid var(--border2)' : 'none',
                      }}>
                        {i === 0 ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: 11, color: i === 1 ? 'var(--text)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 8px', marginBottom: 20 }}/>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, color: '#fff', marginBottom: 4 }}>
                  Upload documents
                </h1>
                <p style={{ color: 'var(--text2)', fontSize: 13 }}>
                  Add PDFs, Word files, or text documents. Each is processed to extract stakeholder entities.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div style={{ marginBottom: 16 }}>
                  <ErrorMessage message={error} onRetry={() => setError('')} />
                </div>
              )}

              {/* Dropzone */}
              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border2)'}`,
                  borderRadius: 14,
                  padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color .2s, background .2s', marginBottom: 24,
                  background: dragOver || uploading ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, margin: '0 auto 12px',
                  background: 'var(--accent-soft)', border: '1px solid rgba(61,111,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
                  {uploading ? 'Uploading…' : 'Upload project documents'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  PDF, DOCX, TXT — up to 50 MB each · drag &amp; drop or click to browse
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={onFileChange}
                />
              </div>

              {/* Document list */}
              {loading && (
                <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  Loading documents…
                </div>
              )}

              {!loading && documents.length === 0 && (
                <div style={{ marginBottom: 24 }}>
                  <EmptyState
                    icon="📄"
                    title="No documents yet"
                    description="Upload a PDF, DOCX, or TXT file above to get started."
                    compact
                  />
                </div>
              )}

              {documents.map(doc => (
                <div key={doc.id} style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
                }}>
                  {/* File type icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    background: getFileIconBg(doc.file_format),
                  }}>
                    {getFileIcon(doc.file_format)}
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                      {doc.filename}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                      {doc.file_format?.toUpperCase()}
                      {doc.processing_status === 'completed' && doc.entity_count > 0 &&
                        ` · ${doc.entity_count} entities extracted`}
                      {doc.processing_status === 'completed' && doc.chunk_count &&
                        ` · ${doc.chunk_count} chunks`}
                    </div>
                    {/* Error message */}
                    {doc.processing_status === 'failed' && doc.error_message && (
                      <div style={{ fontSize: 11, color: 'var(--coral)', marginTop: 4 }}>
                        {doc.error_message}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`badge ${getStatusBadgeClass(
                    doc.processing_status === 'completed' ? 'processed' :
                    doc.processing_status === 'failed'    ? 'error' :
                    'pending'
                  )}`}>
                    {doc.processing_status === 'pending' ? (
                      <span style={{ animation: 'pulse 1.5s infinite' }}>processing</span>
                    ) : doc.processing_status}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={e => void onDelete(e, doc.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, fontSize: 14 }}
                  >✕</button>
                </div>
              ))}

              {/* Bottom CTA */}
              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => void router.push(`/projects/${id}/setup`)}
                  className="btn-ghost"
                >
                  ← Back to concept note
                </button>
                <button
                  onClick={() => void router.push(`/projects/${id}/analyze`)}
                  className="btn-primary btn-primary-lg"
                  disabled={!canBuildGraph}
                >
                  Analyze documents →
                </button>
              </div>

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
