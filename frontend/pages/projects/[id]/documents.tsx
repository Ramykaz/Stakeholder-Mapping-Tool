import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  getProjectExtractionStatus,
  reextractProjectDocument,
  getProjectDocumentEntities,
  getProjectDocumentRelationships,
  getProjectDocumentContext,
  updateProjectEntity,
  deleteProjectDocumentEntity,
  updateProjectDocumentRelationship,
  deleteProjectDocumentRelationship,
  getStoredAuthToken,
  renderLLMErrorMessage,
  ProjectSummary,
  DocumentSummary,
  WebSourceSummary,
  DocumentSummaryWithStats,
  WorkflowStatus,
  DocumentReviewEntity,
  DocumentReviewRelationship,
  ProjectDocumentContext,
} from '@/lib/api';
import { getStatusBadgeClass } from '@/lib/entityTypes';
import { formatFileSize } from '@/lib/uiState';
import Layout from '@/components/Layout';
import EmptyState from '@/components/EmptyState';
import { FileText, FileType, Globe, X } from 'lucide-react';
import ErrorMessage from '@/components/ErrorMessage';

const POLLING_INTERVAL = 3000;
const TERMINAL_STATUSES = ['completed', 'failed'];

function getFileIcon(fmt: string) {
  const color = getFileIconColor(fmt);
  const Icon = fmt === 'docx' ? FileType : FileText;
  return <Icon size={16} strokeWidth={1.75} color={color} />;
}

function getFileIconColor(fmt: string) {
  if (fmt === 'pdf')  return 'var(--coral)';
  if (fmt === 'docx') return 'var(--accent)';
  return 'var(--amber)';
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
  const [reviewTabByDoc, setReviewTabByDoc] = useState<Record<string, 'entities' | 'relationships'>>({});
  const [reviewLoadingByDoc, setReviewLoadingByDoc] = useState<Record<string, boolean>>({});
  const [reviewEntitiesByDoc, setReviewEntitiesByDoc] = useState<Record<string, DocumentReviewEntity[]>>({});
  const [reviewRelationshipsByDoc, setReviewRelationshipsByDoc] = useState<Record<string, DocumentReviewRelationship[]>>({});
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editingEntityName, setEditingEntityName] = useState('');
  const [editingEntityType, setEditingEntityType] = useState('');
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [editingRelationshipType, setEditingRelationshipType] = useState('');
  const [contextLoadingRelId, setContextLoadingRelId] = useState<string | null>(null);
  const [contextLoadingEntityId, setContextLoadingEntityId] = useState<string | null>(null);
  const [openRelationshipContext, setOpenRelationshipContext] = useState<{
    relationship: DocumentReviewRelationship;
    context: ProjectDocumentContext;
  } | null>(null);
  const [openEntityContext, setOpenEntityContext] = useState<{
    entity: DocumentReviewEntity;
    context: ProjectDocumentContext;
  } | null>(null);
  const [analyzingByDoc, setAnalyzingByDoc] = useState<Record<string, boolean>>({});
  const [analyzeResultByDoc, setAnalyzeResultByDoc] = useState<Record<string, 'success' | 'error'>>({});
  const [projectExtractionRunning, setProjectExtractionRunning] = useState(false);
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
    const hasPendingDocuments = documents.some(
      d => !TERMINAL_STATUSES.includes(d.processing_status) || d.extraction_state === 'extracting'
    );
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
      const pending = documents.filter(
        d => !TERMINAL_STATUSES.includes(d.processing_status) || d.extraction_state === 'extracting'
      );
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

  useEffect(() => {
    if (!id) return;

    let alive = true;
    const pollProjectExtraction = async () => {
      try {
        const state = await getProjectExtractionStatus(id);
        if (!alive) return;
        const running = state.status === 'running';
        setProjectExtractionRunning(running);
        if (running || state.status === 'completed' || state.status === 'cancelled') {
          loadDocuments();
        }
      } catch {
        // non-blocking
      }
    };

    void pollProjectExtraction();
    const timer = setInterval(pollProjectExtraction, POLLING_INTERVAL);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, loadDocuments]);

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

  const loadDocumentReview = useCallback(async (docId: string, force = false) => {
    if (!id) return;
    if (!force && reviewEntitiesByDoc[docId] && reviewRelationshipsByDoc[docId]) return;
    setReviewLoadingByDoc((prev) => ({ ...prev, [docId]: true }));
    try {
      const [entities, relationships] = await Promise.all([
        getProjectDocumentEntities(id, docId),
        getProjectDocumentRelationships(id, docId),
      ]);
      setReviewEntitiesByDoc((prev) => ({ ...prev, [docId]: entities }));
      setReviewRelationshipsByDoc((prev) => ({ ...prev, [docId]: relationships }));
    } catch (err: any) {
      setError(err?.message || 'Failed to load document review data');
    } finally {
      setReviewLoadingByDoc((prev) => ({ ...prev, [docId]: false }));
    }
  }, [id, reviewEntitiesByDoc, reviewRelationshipsByDoc]);

  const canBuildGraph = documents.some(d => d.processing_status === 'completed');
  const newDocsCount = documents.filter((doc) => !doc.extracted_at).length;
  const unifiedRows = useMemo(() => {
    return [
      ...documents.map((doc) => ({ kind: 'document' as const, createdAt: doc.upload_timestamp, document: doc })),
      ...webSources.map((source) => ({ kind: 'websource' as const, createdAt: source.created_at, webSource: source })),
    ].sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, [documents, webSources]);
  const statsByDocId = useMemo(() => {
    return docsWithStats.reduce<Record<string, DocumentSummaryWithStats['stats']>>((acc, item) => {
      acc[item.id] = item.stats;
      return acc;
    }, {});
  }, [docsWithStats]);
  const nextStep = workflow?.next_step ?? null;
  const showReviewGraphAction = nextStep?.number === 4;
  const nextActionLabel = showReviewGraphAction ? 'Review graph →' : `Extract ${newDocsCount} new document${newDocsCount === 1 ? '' : 's'} →`;
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
                    icon={<FileText size={28} strokeWidth={1.5} />}
                    title="No sources yet"
                    description="Upload files, add URLs, crawl a site, or paste text to get started."
                    compact
                  />
                </div>
              )}

              {!loading && unifiedRows.length > 0 && (
                <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
                  Incremental extraction guide: <strong>Analyze now</strong> = first-time extraction for one document. <strong>Re-extract</strong> = run extraction again for a document already extracted.
                  {projectExtractionRunning ? ' Project analysis is currently running in background.' : ''}
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
                          color: 'var(--accent)',
                        }}>
                          <Globe size={16} strokeWidth={1.75} />
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
                          style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, display: 'inline-flex' }}
                        ><X size={14} strokeWidth={1.75} /></button>
                      </div>
                    </div>
                  );
                }

                const doc = row.document;
                const stats = statsByDocId[doc.id];
                const isExpanded = expandedDocId === doc.id;
                const extractedAtLabel = doc.extracted_at ? new Date(doc.extracted_at).toLocaleString() : null;
                const hasBeenExtracted = Boolean(doc.extracted_at);
                const canAnalyzeThisDoc = doc.processing_status === 'completed';
                const isAnalyzingDoc = Boolean(analyzingByDoc[doc.id]) || doc.extraction_state === 'extracting';
                const analyzeResult = analyzeResultByDoc[doc.id];
                const analyzeButtonLabel = isAnalyzingDoc
                  ? 'Analyzing…'
                  : hasBeenExtracted
                    ? 'Re-extract'
                    : 'Analyze now';
                const analyzeButtonTitle = hasBeenExtracted
                  ? 'Re-run extraction for this document'
                  : 'Run first-time extraction for this document only';

                const onAnalyzeDocument = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setAnalyzingByDoc((prev) => ({ ...prev, [doc.id]: true }));
                  setAnalyzeResultByDoc((prev) => {
                    const next = { ...prev };
                    delete next[doc.id];
                    return next;
                  });
                  setDocuments((prev) => prev.map((item) => (
                    item.id === doc.id
                      ? { ...item, processing_status: 'pending', extraction_state: 'extracting' }
                      : item
                  )));
                  try {
                    await reextractProjectDocument(id, doc.id);
                    setAnalyzeResultByDoc((prev) => ({ ...prev, [doc.id]: 'success' }));
                    loadDocuments();
                  } catch (err: any) {
                    setAnalyzeResultByDoc((prev) => ({ ...prev, [doc.id]: 'error' }));
                    setError(err?.message || 'Failed to analyze document');
                  } finally {
                    setAnalyzingByDoc((prev) => ({ ...prev, [doc.id]: false }));
                  }
                };

                const onToggleReview = async () => {
                  const nextExpanded = isExpanded ? null : doc.id;
                  setExpandedDocId(nextExpanded);
                  if (nextExpanded) {
                    setReviewTabByDoc((prev) => ({ ...prev, [doc.id]: prev[doc.id] || 'entities' }));
                    await loadDocumentReview(doc.id);
                  }
                };

                const entities = reviewEntitiesByDoc[doc.id] || [];
                const relationships = reviewRelationshipsByDoc[doc.id] || [];
                const activeTab = reviewTabByDoc[doc.id] || 'entities';

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
                          {doc.extraction_state && (
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: 'var(--bg3)', color: 'var(--text3)', fontSize: 10 }}>
                              {doc.extraction_state === 'extracted' ? 'completed' : doc.extraction_state}
                            </span>
                          )}
                          {isAnalyzingDoc && (
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 10 }}>
                              analyzing
                            </span>
                          )}
                          {!isAnalyzingDoc && analyzeResult === 'success' && (
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(46,196,165,0.12)', color: 'var(--teal)', fontSize: 10 }}>
                              updated
                            </span>
                          )}
                          {extractedAtLabel && (
                            <span style={{ fontSize: 10 }}>extracted {extractedAtLabel}</span>
                          )}
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
                        {isAnalyzingDoc ? (
                          <span style={{ animation: 'pulse 1.5s infinite' }}>analyzing</span>
                        ) : doc.processing_status === 'pending' ? (
                          <span style={{ animation: 'pulse 1.5s infinite' }}>processing</span>
                        ) : doc.processing_status}
                      </span>

                      {doc.processing_status === 'completed' && (
                        <button
                          onClick={() => void onToggleReview()}
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title={isExpanded ? 'Hide review' : 'Open review'}
                        >
                          {isExpanded ? 'Hide Review' : 'Review'}
                        </button>
                      )}

                      {canAnalyzeThisDoc && (
                        <button
                          onClick={(e) => void onAnalyzeDocument(e)}
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title={analyzeButtonTitle}
                          disabled={isAnalyzingDoc}
                        >
                          {analyzeButtonLabel}
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={e => void onDelete(e, doc.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, display: 'inline-flex' }}
                      ><X size={14} strokeWidth={1.75} /></button>
                    </div>

                    {/* Expanded review */}
                    {isExpanded && (
                      <div style={{
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        borderTop: 'none', borderRadius: '0 0 8px 8px',
                        padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10,
                      }}>
                        {stats && stats.top_entities.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>TOP ENTITIES</div>
                            {stats.top_entities.map((e: any) => (
                              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                <span style={{ color: 'var(--text)', fontWeight: 500, flex: 1 }}>{e.name}</span>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg2)', color: 'var(--text3)' }}>{e.type}</span>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', minWidth: 32, textAlign: 'right' }}>{Math.round(e.confidence * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn-ghost"
                            style={activeTab === 'entities' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                            onClick={() => setReviewTabByDoc((prev) => ({ ...prev, [doc.id]: 'entities' }))}
                          >
                            Entities ({entities.length})
                          </button>
                          <button
                            className="btn-ghost"
                            style={activeTab === 'relationships' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                            onClick={() => setReviewTabByDoc((prev) => ({ ...prev, [doc.id]: 'relationships' }))}
                          >
                            Relationships ({relationships.length})
                          </button>
                        </div>

                        {reviewLoadingByDoc[doc.id] && (
                          <div style={{ color: 'var(--text3)', fontSize: 12 }}>Loading review data…</div>
                        )}

                        {!reviewLoadingByDoc[doc.id] && activeTab === 'entities' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {entities.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 12 }}>No entities for this document.</div>}
                            {entities.map((entity) => {
                              const isEditing = editingEntityId === entity.entity_id;
                              return (
                                <div key={entity.entity_id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--bg2)' }}>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {isEditing ? (
                                      <>
                                        <input className="input-field" style={{ flex: 1, minWidth: 160 }} value={editingEntityName} onChange={(e) => setEditingEntityName(e.target.value)} />
                                        <input className="input-field" style={{ width: 130 }} value={editingEntityType} onChange={(e) => setEditingEntityType(e.target.value.toUpperCase())} />
                                        <button
                                          className="btn-ghost"
                                          onClick={async () => {
                                            try {
                                              await updateProjectEntity(id, entity.entity_id, {
                                                canonical_name: editingEntityName.trim(),
                                                entity_type: editingEntityType.trim().toUpperCase(),
                                              });
                                              setEditingEntityId(null);
                                              await loadDocumentReview(doc.id, true);
                                              loadDocuments();
                                            } catch (err: any) {
                                              setError(err?.message || 'Failed to update entity');
                                            }
                                          }}
                                        >Save</button>
                                        <button className="btn-ghost" onClick={() => setEditingEntityId(null)}>Cancel</button>
                                      </>
                                    ) : (
                                      <>
                                        <span style={{ flex: 1, color: 'var(--text)', fontSize: 12, fontWeight: 500 }}>{entity.canonical_name}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{entity.entity_type}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{Math.round(entity.confidence_score * 100)}%</span>
                                        <button
                                          className="btn-ghost"
                                          onClick={() => {
                                            setEditingEntityId(entity.entity_id);
                                            setEditingEntityName(entity.canonical_name);
                                            setEditingEntityType(entity.entity_type);
                                          }}
                                        >Edit</button>
                                        <button
                                          className="btn-ghost"
                                          onClick={async () => {
                                            if (!confirm('Delete this entity mention from the document?')) return;
                                            try {
                                              await deleteProjectDocumentEntity(id, doc.id, entity.entity_id);
                                              await loadDocumentReview(doc.id, true);
                                              loadDocuments();
                                            } catch (err: any) {
                                              setError(err?.message || 'Failed to delete entity');
                                            }
                                          }}
                                        >Delete</button>
                                        <button
                                          className="btn-ghost"
                                          disabled={contextLoadingEntityId === entity.entity_id}
                                          onClick={async () => {
                                            try {
                                              setContextLoadingEntityId(entity.entity_id);
                                              const context = await getProjectDocumentContext(id, doc.id, [entity.canonical_name]);
                                              setOpenEntityContext({ entity, context });
                                            } catch (err: any) {
                                              setError(err?.message || 'Failed to load entity context');
                                            } finally {
                                              setContextLoadingEntityId(null);
                                            }
                                          }}
                                        >
                                          {contextLoadingEntityId === entity.entity_id ? 'Loading…' : 'View context'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 11, fontStyle: 'italic' }}>
                                    {entity.excerpt || 'No excerpt available.'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!reviewLoadingByDoc[doc.id] && activeTab === 'relationships' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {relationships.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 12 }}>No relationships for this document.</div>}
                            {relationships.map((relationship) => {
                              const isEditing = editingRelationshipId === relationship.rel_id;
                              return (
                                <div key={relationship.rel_id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--bg2)' }}>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text)', fontSize: 12, flex: 1 }}>{relationship.source_entity_name}</span>
                                    {isEditing ? (
                                      <>
                                        <input className="input-field" style={{ width: 180 }} value={editingRelationshipType} onChange={(e) => setEditingRelationshipType(e.target.value)} />
                                        <button
                                          className="btn-ghost"
                                          onClick={async () => {
                                            try {
                                              await updateProjectDocumentRelationship(id, doc.id, relationship.rel_id, editingRelationshipType.trim());
                                              setEditingRelationshipId(null);
                                              await loadDocumentReview(doc.id, true);
                                              loadDocuments();
                                            } catch (err: any) {
                                              setError(err?.message || 'Failed to update relationship');
                                            }
                                          }}
                                        >Save</button>
                                        <button className="btn-ghost" onClick={() => setEditingRelationshipId(null)}>Cancel</button>
                                      </>
                                    ) : (
                                      <>
                                        <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{relationship.relationship_type}</span>
                                        <span style={{ color: 'var(--text)', fontSize: 12, flex: 1 }}>{relationship.target_entity_name}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{Math.round(relationship.confidence * 100)}%</span>
                                        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                                          {relationship.is_bidirectional ? '↔ two-way' : '→ one-way'}
                                        </span>
                                        <button
                                          className="btn-ghost"
                                          onClick={() => {
                                            setEditingRelationshipId(relationship.rel_id);
                                            setEditingRelationshipType(relationship.relationship_type);
                                          }}
                                        >Edit</button>
                                        <button
                                          className="btn-ghost"
                                          onClick={async () => {
                                            if (!confirm('Delete this relationship from the document?')) return;
                                            try {
                                              await deleteProjectDocumentRelationship(id, doc.id, relationship.rel_id);
                                              await loadDocumentReview(doc.id, true);
                                              loadDocuments();
                                            } catch (err: any) {
                                              setError(err?.message || 'Failed to delete relationship');
                                            }
                                          }}
                                        >Delete</button>
                                        <button
                                          className="btn-ghost"
                                          disabled={contextLoadingRelId === relationship.rel_id}
                                          onClick={async () => {
                                            try {
                                              setContextLoadingRelId(relationship.rel_id);
                                              const contextDocId = relationship.source_document_id || doc.id;
                                              const context = await getProjectDocumentContext(id, contextDocId, [
                                                relationship.source_entity_name,
                                                relationship.target_entity_name,
                                                relationship.relationship_type,
                                              ]);
                                              setOpenRelationshipContext({ relationship, context });
                                            } catch (err: any) {
                                              setError(err?.message || 'Failed to load relationship context');
                                            } finally {
                                              setContextLoadingRelId(null);
                                            }
                                          }}
                                        >
                                          {contextLoadingRelId === relationship.rel_id ? 'Loading…' : 'View context'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  <div style={{ marginTop: 4, color: 'var(--text3)', fontSize: 11, fontFamily: 'var(--mono)' }}>
                                    {relationship.direction || `${relationship.source_entity_name} → ${relationship.target_entity_name}`}
                                    {relationship.source_document_name ? ` · source: ${relationship.source_document_name}` : ''}
                                  </div>
                                  <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 11, fontStyle: 'italic' }}>
                                    {relationship.excerpt || 'No excerpt available.'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
                    background: 'var(--amber-soft)',
                    border: '1px solid var(--amber)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--amber)', lineHeight: 1.4 }}>
                      Your report was generated before this document was added.
                      <button
                        onClick={() => void router.push(`/projects/${id}/report`)}
                        style={{
                          marginLeft: 6,
                          background: 'none',
                          border: 'none',
                          color: 'var(--teal)',
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
                      style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                      aria-label="Dismiss notification"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              )}

              {openRelationshipContext && (
                <div
                  onClick={() => setOpenRelationshipContext(null)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.55)',
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                  }}
                >
                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      width: 'min(980px, 95vw)',
                      maxHeight: '90vh',
                      overflow: 'auto',
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                          Verify relationship: {openRelationshipContext.relationship.source_entity_name} → {openRelationshipContext.relationship.target_entity_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                          {openRelationshipContext.context.filename} · {openRelationshipContext.relationship.is_bidirectional ? 'two-way connection (↔)' : 'one-way connection (→)'}
                        </div>
                      </div>
                      <button className="btn-ghost" onClick={() => setOpenRelationshipContext(null)}>Close</button>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>EVIDENCE SNIPPETS</div>
                      {openRelationshipContext.context.snippets.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>No focused snippets were found. Review the full document text below.</div>
                      )}
                      {openRelationshipContext.context.snippets.map((snippet, index) => (
                        <div key={`${snippet.start}-${snippet.end}-${index}`} style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg3)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
                            chars {snippet.start}–{snippet.end}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{snippet.text}</div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>FULL CLEANED DOCUMENT TEXT</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                        source: {openRelationshipContext.context.text_source || 'none'}
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg3)', maxHeight: 380, overflow: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                          {openRelationshipContext.context.cleaned_text || 'No cleaned text available.'}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {openEntityContext && (
                <div
                  onClick={() => setOpenEntityContext(null)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.55)',
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                  }}
                >
                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      width: 'min(980px, 95vw)',
                      maxHeight: '90vh',
                      overflow: 'auto',
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                          Verify entity mention: {openEntityContext.entity.canonical_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                          {openEntityContext.context.filename}
                        </div>
                      </div>
                      <button className="btn-ghost" onClick={() => setOpenEntityContext(null)}>Close</button>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>EVIDENCE SNIPPETS</div>
                      {openEntityContext.context.snippets.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>No focused snippets were found. Review the full document text below.</div>
                      )}
                      {openEntityContext.context.snippets.map((snippet, index) => (
                        <div key={`${snippet.start}-${snippet.end}-${index}`} style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg3)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
                            chars {snippet.start}–{snippet.end}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{snippet.text}</div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>FULL CLEANED DOCUMENT TEXT</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                        source: {openEntityContext.context.text_source || 'none'}
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg3)', maxHeight: 380, overflow: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                          {openEntityContext.context.cleaned_text || 'No cleaned text available.'}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

        </div>
      </Layout>
    </>
  );
}
