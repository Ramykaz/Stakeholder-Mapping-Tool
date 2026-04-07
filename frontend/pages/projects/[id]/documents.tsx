import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getProject,
  getProjectDocuments,
  getProjectDocumentsWithStats,
  getProjectWorkflow,
  getReportStaleness,
  uploadDocumentToProject,
  deleteProjectDocument,
  getProjectWebSources,
  createProjectWebSource,
  deleteProjectWebSource,
  getProjectDocumentStatus,
  getStoredAuthToken,
  renderLLMErrorMessage,
  ProjectSummary,
  DocumentSummary,
  WebSourceSummary,
  DocumentSummaryWithStats,
  WorkflowStatus,
} from '@/lib/api';
import { getStatusBadgeClass } from '@/lib/entityTypes';
import { formatFileSize } from '@/lib/uiState';
import Layout from '@/components/Layout';
import EmptyState from '@/components/EmptyState';
import ErrorMessage from '@/components/ErrorMessage';

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
  const [webSources, setWebSources] = useState<WebSourceSummary[]>([]);
  const [docsWithStats, setDocsWithStats] = useState<DocumentSummaryWithStats[]>([]);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'url' | 'crawl' | 'paste'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlDepth, setCrawlDepth] = useState(1);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [submittingSource, setSubmittingSource] = useState(false);
  const [staleToastVisible, setStaleToastVisible] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    if (!id) return;
    getProject(id).then(setProject).catch(() => {});
    getProjectWorkflow(id).then(setWorkflow).catch(() => {});
    loadDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadDocuments = useCallback(() => {
    if (!id) return;
    getProjectDocuments(id)
      .then(docs => { setDocuments(docs); setLoading(false); })
      .catch(() => { setLoading(false); });
    getProjectDocumentsWithStats(id)
      .then(setDocsWithStats)
      .catch(() => {});
    getProjectWebSources(id)
      .then(setWebSources)
      .catch(() => {});
  }, [id]);

  // Polling: refresh status for non-terminal documents every 3s
  useEffect(() => {
    const hasPendingDocuments = documents.some(d => !TERMINAL_STATUSES.includes(d.processing_status));
    const hasPendingWebSources = webSources.some((s) => s.status === 'queued' || s.status === 'processing');
    const hasPending = hasPendingDocuments || hasPendingWebSources;
    if (!hasPending) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    if (pollingRef.current) return; // already polling
    pollingRef.current = setInterval(async () => {
      if (!id) return;
      if (hasPendingWebSources) {
        loadDocuments();
        return;
      }
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
  }, [documents, webSources, id, loadDocuments]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!id) return;
    setUploading(true);
    setError('');
    let uploadSucceeded = false;
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      try {
        const doc = await uploadDocumentToProject(id, file);
        setDocuments(prev => [doc, ...prev]);
        uploadSucceeded = true;
      } catch (err: any) {
        setError(renderLLMErrorMessage(err, `Document extraction for ${file.name}`));
      }
    }
    setUploading(false);
    // Refresh the full list to get annotated entity counts
    loadDocuments();

    if (uploadSucceeded) {
      try {
        const staleness = await getReportStaleness(id);
        if ((staleness.stale_sections || []).length > 0) {
          setStaleToastVisible(true);
        }
      } catch {
        // non-blocking
      }
    }
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

  const onDeleteWebSource = async (e: React.MouseEvent, webSourceId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this web source? This cannot be undone.')) return;
    try {
      await deleteProjectWebSource(id, webSourceId);
      setWebSources((prev) => prev.filter((source) => source.id !== webSourceId));
      loadDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete web source');
    }
  };

  const submitWebSource = async (payload: {
    source_type: 'url' | 'crawl' | 'paste';
    url?: string;
    crawl_depth?: number;
    raw_text?: string;
    title?: string;
  }) => {
    if (!id) return;
    setSubmittingSource(true);
    setError('');
    try {
      await createProjectWebSource(id, payload);
      setUrlInput('');
      setCrawlUrl('');
      setCrawlDepth(1);
      setPasteTitle('');
      setPasteText('');
      loadDocuments();
    } catch (err: any) {
      setError(err?.message || 'Failed to create web source');
    } finally {
      setSubmittingSource(false);
    }
  };

  const canBuildGraph = documents.some(d => d.processing_status === 'completed');
  const unifiedRows = [
    ...documents.map((doc) => ({ kind: 'document' as const, createdAt: doc.upload_timestamp, document: doc })),
    ...webSources.map((source) => ({ kind: 'websource' as const, createdAt: source.created_at, webSource: source })),
  ].sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  const nextStep = workflow?.next_step ?? null;
  const showReviewGraphAction = nextStep?.number === 4;
  const nextActionLabel = showReviewGraphAction ? 'Review graph →' : 'Run extraction →';
  const nextActionPath = showReviewGraphAction ? `/projects/${id}/map` : `/projects/${id}/analyze`;
  const nextActionDisabled = showReviewGraphAction ? !canBuildGraph : !canBuildGraph;

  return (
    <>
      <Head><title>Documents — {project?.name ?? 'Upload'}</title></Head>
      <Layout title="Documents" subtitle="Upload PDFs, Word files, or text documents for entity extraction">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

              {/* Error */}
              {error && (
                <div style={{ marginBottom: 16 }}>
                  <ErrorMessage message={error} onRetry={() => setError('')} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                  ['upload', 'Upload file'],
                  ['url', 'URL'],
                  ['crawl', 'Crawl site'],
                  ['paste', 'Paste text'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className="btn-ghost"
                    style={activeInputTab === value ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                    onClick={() => setActiveInputTab(value as 'upload' | 'url' | 'crawl' | 'paste')}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Upload tab */}
              {activeInputTab === 'upload' && (
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
                  PDF, DOCX, TXT, MD — up to 50 MB each · drag &amp; drop or click to browse
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  style={{ display: 'none' }}
                  onChange={onFileChange}
                />
              </div>
              )}

              {/* URL tab */}
              {activeInputTab === 'url' && (
                <div className="card" style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Add a single webpage URL</div>
                  <input
                    className="input-field"
                    placeholder="https://example.org/article"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-primary"
                      disabled={submittingSource || !urlInput.trim()}
                      onClick={() => void submitWebSource({ source_type: 'url', url: urlInput.trim() })}
                    >
                      {submittingSource ? 'Submitting…' : 'Add URL'}
                    </button>
                  </div>
                </div>
              )}

              {/* Crawl tab */}
              {activeInputTab === 'crawl' && (
                <div className="card" style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Crawl a site root (max depth 2, capped pages)</div>
                  <input
                    className="input-field"
                    placeholder="https://example.org"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                  />
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Depth</span>
                    <select className="input-field" value={crawlDepth} onChange={(e) => setCrawlDepth(Number(e.target.value))}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-primary"
                      disabled={submittingSource || !crawlUrl.trim()}
                      onClick={() => void submitWebSource({ source_type: 'crawl', url: crawlUrl.trim(), crawl_depth: crawlDepth })}
                    >
                      {submittingSource ? 'Submitting…' : 'Start Crawl'}
                    </button>
                  </div>
                </div>
              )}

              {/* Paste tab */}
              {activeInputTab === 'paste' && (
                <div className="card" style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Paste text content directly</div>
                  <input
                    className="input-field"
                    placeholder="Title"
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                  />
                  <textarea
                    className="input-field"
                    style={{ minHeight: 160, marginTop: 8 }}
                    placeholder="Paste text to ingest"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-primary"
                      disabled={submittingSource || !pasteTitle.trim() || !pasteText.trim()}
                      onClick={() => void submitWebSource({ source_type: 'paste', title: pasteTitle.trim(), raw_text: pasteText })}
                    >
                      {submittingSource ? 'Submitting…' : 'Add Pasted Text'}
                    </button>
                  </div>
                </div>
              )}

              {/* Document list */}
              {loading && (
                <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  Loading documents…
                </div>
              )}

              {!loading && unifiedRows.length === 0 && (
                <div style={{ marginBottom: 24 }}>
                  <EmptyState
                    icon="📄"
                    title="No sources yet"
                    description="Upload files, add URLs, crawl a site, or paste text to get started."
                    compact
                  />
                </div>
              )}

              {unifiedRows.map((row) => {
                if (row.kind === 'websource') {
                  const source = row.webSource;
                  return (
                    <div key={source.id} style={{ marginBottom: 8 }}>
                      <div style={{
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '12px 16px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        ...(source.status === 'error'
                          ? { borderColor: 'rgba(245, 158, 11, 0.4)', background: 'var(--amber-soft)' }
                          : {}),
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                          background: 'var(--accent-soft)',
                        }}>
                          🌐
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                            {source.title || source.url || 'Web Source'}
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span>{source.source_type.toUpperCase()}</span>
                            {source.url && <span>{source.url}</span>}
                            {source.page_count > 0 && <span>{source.page_count} pages</span>}
                            {source.character_count > 0 && <span>{formatFileSize(source.character_count)} text</span>}
                          </div>
                          {source.status === 'error' && (
                            <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
                              {source.error_message || 'Web ingestion failed.'}
                            </div>
                          )}
                        </div>

                        <span className={`badge ${getStatusBadgeClass(
                          source.status === 'processed' ? 'processed' :
                          source.status === 'error' ? 'error' :
                          'pending'
                        )}`}>
                          {source.status}
                        </span>

                        <button
                          onClick={(e) => void onDeleteWebSource(e, source.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, fontSize: 14 }}
                        >✕</button>
                      </div>
                    </div>
                  );
                }

                const doc = row.document;
                const stats = docsWithStats.find(d => d.id === doc.id)?.stats;
                const isExpanded = expandedDocId === doc.id;
                return (
                  <div key={doc.id} style={{ marginBottom: 8 }}>
                    <div style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      ...(doc.processing_status === 'failed'
                        ? { borderColor: 'rgba(245, 158, 11, 0.4)', background: 'var(--amber-soft)' }
                        : {}),
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
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span>{doc.file_format?.toUpperCase()}</span>
                          {stats && (
                            <>
                              <span style={{ padding: '1px 6px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10 }}>
                                {stats.entity_count} entities
                              </span>
                              <span style={{ padding: '1px 6px', borderRadius: 4, background: 'var(--bg3)', color: 'var(--text3)', fontSize: 10 }}>
                                {stats.relation_count} relations
                              </span>
                              <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(46,196,165,0.12)', color: 'var(--teal)', fontSize: 10 }}>
                                H:{stats.confidence_distribution.high} M:{stats.confidence_distribution.medium} L:{stats.confidence_distribution.low}
                              </span>
                            </>
                          )}
                          {!stats && doc.processing_status === 'completed' && doc.entity_count > 0 &&
                            <span>{doc.entity_count} entities extracted</span>}
                        </div>
                        {doc.processing_status === 'failed' && (
                          <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
                            {doc.error_message || 'Extraction failed.'} Delete and re-upload this file to retry.
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

                      {/* Expand toggle */}
                      {stats && stats.top_entities.length > 0 && (
                        <button
                          onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: 4 }}
                          title={isExpanded ? 'Collapse' : 'Show top entities'}
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={e => void onDelete(e, doc.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, fontSize: 14 }}
                      >✕</button>
                    </div>

                    {/* Expanded top entities */}
                    {isExpanded && stats && stats.top_entities.length > 0 && (
                      <div style={{
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        borderTop: 'none', borderRadius: '0 0 8px 8px',
                        padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>TOP ENTITIES</div>
                        {stats.top_entities.map((e: any) => (
                          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--text)', fontWeight: 500, flex: 1 }}>{e.name}</span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg2)', color: 'var(--text3)' }}>{e.type}</span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', minWidth: 32, textAlign: 'right' }}>{Math.round(e.confidence * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bottom CTA */}
              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => void router.push(`/projects/${id}/intake`)}
                  className="btn-ghost"
                >
                  ← Back to initiative profile
                </button>
                <button
                  onClick={() => void router.push(nextActionPath)}
                  className="btn-primary btn-primary-lg"
                  disabled={nextActionDisabled}
                >
                  {nextActionLabel}
                </button>
              </div>

              {staleToastVisible && (
                <div
                  style={{
                    position: 'fixed',
                    right: 20,
                    bottom: 20,
                    maxWidth: 360,
                    background: '#FFFBEB',
                    border: '1px solid #F59E0B',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
                    <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>
                      Your report was generated before this document was added.
                      <button
                        onClick={() => void router.push(`/projects/${id}/report`)}
                        style={{
                          marginLeft: 6,
                          background: 'none',
                          border: 'none',
                          color: '#007A87',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                          fontSize: 12,
                        }}
                      >
                        View report →
                      </button>
                    </div>
                    <button
                      onClick={() => setStaleToastVisible(false)}
                      style={{ background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', fontSize: 14, padding: 0 }}
                      aria-label="Dismiss notification"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

        </div>
      </Layout>
    </>
  );
}
