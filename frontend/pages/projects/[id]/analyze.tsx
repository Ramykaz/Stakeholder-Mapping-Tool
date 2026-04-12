import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getProject, getProjectDocuments, extractEntitiesForProject,
  getProjectEntities, getProjectGraph, getStoredAuthToken,
  getProjectExtractionStatus, stopProjectExtraction,
  ProjectSummary, DocumentSummary, ProjectExtractionStatus,
} from '@/lib/api';
import Layout from '@/components/Layout';

const POLLING_INTERVAL = 3000;

const TYPE_COLORS: Record<string, string> = {
  PERSON: '#2ec4a5', ORGANIZATION: '#3d6fff', GOVERNMENT: '#3d6fff',
  LOCATION: '#f5a623', ROLE: '#7b8299', EVENT: '#9b6ef3',
  PROJECT: '#9b6ef3', POLICY: '#9b6ef3', CONCEPT: '#f0614a',
};

export default function AnalyzePage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [extractResult, setExtractResult] = useState<{ entities_created: number; relations_created: number } | null>(null);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState<'entities' | 'relations'>('entities');
  const [projectExtractionStatus, setProjectExtractionStatus] = useState<ProjectExtractionStatus | null>(null);
  const [stoppingExtraction, setStoppingExtraction] = useState(false);

  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getProject(id),
      getProjectDocuments(id),
    ]).then(([proj, docs]) => {
      setProject(proj);
      setDocuments(docs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    if (!id) return;
    loadData();
    // Also try to load any already-extracted entities
    getProjectEntities(id).then(ents => {
      if (ents.length > 0) { setEntities(ents); setExtracted(true); }
    }).catch(() => {});
    getProjectGraph(id).then(({ edges: e }) => { if (e.length > 0) setEdges(e); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    const loadStatus = async () => {
      try {
        const status = await getProjectExtractionStatus(id);
        if (!isMounted) return;
        setProjectExtractionStatus(status);

        if (status.status === 'running' || status.cancel_requested) {
          const latestDocs = await getProjectDocuments(id);
          if (!isMounted) return;
          setDocuments(latestDocs);
        }

        if (status.status === 'completed' || status.status === 'cancelled') {
          const [latestDocs, ents, graph] = await Promise.all([
            getProjectDocuments(id),
            getProjectEntities(id),
            getProjectGraph(id),
          ]);
          if (!isMounted) return;
          setDocuments(latestDocs);
          setEntities(ents);
          setEdges(graph.edges);
          setExtracted(ents.length > 0);
          setExtracting(false);
        }
      } catch {
        // non-blocking
      }
    };

    void loadStatus();
    const timer = setInterval(loadStatus, POLLING_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [id]);

  const handleExtract = async () => {
    if (!id) return;
    setExtracting(true);
    setError('');
    try {
      const result = await extractEntitiesForProject(id, undefined, { provider: 'groq' });
      setExtractResult({
        entities_created: result.entities_created ?? 0,
        relations_created: result.relations_created ?? 0,
      });
      setExtracted(true);
      // Load results
      const [ents, { edges: e }] = await Promise.all([
        getProjectEntities(id),
        getProjectGraph(id),
      ]);
      setEntities(ents);
      setEdges(e);
    } catch (err: any) {
      setError(err.message || 'Extraction failed. Make sure a Groq API key is configured.');
    } finally {
      setExtracting(false);
    }
  };

  const handleStopExtraction = async () => {
    if (!id) return;
    setStoppingExtraction(true);
    setError('');
    try {
      await stopProjectExtraction(id);
      const status = await getProjectExtractionStatus(id);
      setProjectExtractionStatus(status);
    } catch (err: any) {
      setError(err.message || 'Failed to stop analysis.');
    } finally {
      setStoppingExtraction(false);
    }
  };

  const completedDocs = documents.filter(d => d.processing_status === 'completed');
  const newDocs = completedDocs.filter((doc) => !doc.extracted_at);
  const extractingDocs = documents.filter((doc) => doc.extraction_state === 'extracting');
  const hasBackgroundExtraction = extractingDocs.length > 0;
  const isProjectRunning = projectExtractionStatus?.status === 'running';
  const isAnalyzing = extracting || hasBackgroundExtraction || isProjectRunning;
  const canExtract = newDocs.length > 0 && !extracting;

  useEffect(() => {
    if (!id || !hasBackgroundExtraction) return;

    const timer = setInterval(async () => {
      try {
        const latestDocs = await getProjectDocuments(id);
        setDocuments(latestDocs);

        const stillExtracting = latestDocs.some((doc) => doc.extraction_state === 'extracting');
        if (!stillExtracting) {
          const [ents, { edges: e }] = await Promise.all([
            getProjectEntities(id),
            getProjectGraph(id),
          ]);
          setEntities(ents);
          setEdges(e);
          setExtracted(ents.length > 0);
          setExtracting(false);
        }
      } catch {
        // non-blocking polling error
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(timer);
  }, [id, hasBackgroundExtraction]);

  return (
    <>
      <Head><title>Analyze — {project?.name ?? ''}</title></Head>
      <Layout title="Analyze documents" subtitle="Extract entities and relationships from your uploaded documents using AI">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

              {/* Document summary */}
              {!loading && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Documents ready for analysis</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--teal)' }}>{completedDocs.length}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>processed</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--text)' }}>{documents.length}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>total</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Extraction card */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                      Extract Entities &amp; Relationships
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                      AI will scan your documents and identify stakeholders, organizations, locations, and the relationships between them.
                    </p>
                  </div>
                  <button
                    onClick={handleExtract}
                    className="btn-primary"
                    disabled={!canExtract || hasBackgroundExtraction}
                    style={{ flexShrink: 0, padding: '10px 20px' }}
                  >
                    {isAnalyzing
                      ? 'Analyzing…'
                      : canExtract
                        ? `Analyze ${newDocs.length} new document${newDocs.length === 1 ? '' : 's'}`
                        : 'No new documents'}
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                  Incremental mode: this button runs batch analysis only for documents not extracted yet. For single-document actions, use <strong>Analyze now</strong> (first run) or <strong>Re-extract</strong> (rerun) on the Documents page.
                </div>

                {isAnalyzing && (
                  <div style={{ padding: '12px 16px', background: 'var(--accent-soft)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.5s infinite' }}/>
                    <span style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                      {isProjectRunning && projectExtractionStatus?.documents_total
                        ? `Analyzing ${projectExtractionStatus.documents_processed ?? 0}/${projectExtractionStatus.documents_total} documents...`
                        : hasBackgroundExtraction
                        ? `Analyzing in progress for ${extractingDocs.length} document${extractingDocs.length === 1 ? '' : 's'}…`
                        : 'Processing… this may take a minute'}
                    </span>
                    <button
                      onClick={handleStopExtraction}
                      className="btn-ghost"
                      style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }}
                      disabled={stoppingExtraction || !isAnalyzing}
                    >
                      {stoppingExtraction ? 'Stopping…' : 'Stop analysis'}
                    </button>
                  </div>
                )}

                {extractResult && !isAnalyzing && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div style={{ padding: '12px 16px', background: 'rgba(46,196,165,0.1)', borderRadius: 8, border: '1px solid rgba(46,196,165,0.2)', textAlign: 'center', minWidth: 100 }}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--teal)' }}>{extractResult.entities_created}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>entities extracted</div>
                    </div>
                    <div style={{ padding: '12px 16px', background: 'rgba(61,111,255,0.1)', borderRadius: 8, border: '1px solid rgba(61,111,255,0.2)', textAlign: 'center', minWidth: 100 }}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--accent)' }}>{extractResult.relations_created}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>relations found</div>
                    </div>
                  </div>
                )}

                {error && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--coral-soft)', borderRadius: 8, color: 'var(--coral)', fontSize: 13 }}>
                    {error}
                  </div>
                )}

                {completedDocs.length === 0 && !loading && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>
                    No processed documents found.{' '}
                    <button onClick={() => void router.push(`/projects/${id}/documents`)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 13 }}>
                      Upload documents first →
                    </button>
                  </div>
                )}

                {completedDocs.length > 0 && !canExtract && !isAnalyzing && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                    All processed documents are already extracted. Add new documents, or open Documents to run per-document <strong>Analyze now</strong>/<strong>Re-extract</strong>.
                  </div>
                )}

                {!isAnalyzing && completedDocs.length > 0 && newDocs.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--teal)', marginTop: 8 }}>
                    Analysis completed for all processed documents.
                  </div>
                )}
              </div>

              {/* Results section */}
              {extracted && entities.length > 0 && (
                <>
                  {/* View toggle */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button
                      onClick={() => setActiveView('entities')}
                      style={{
                        padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: activeView === 'entities' ? 'var(--accent)' : 'var(--bg2)',
                        color: activeView === 'entities' ? '#fff' : 'var(--text2)',
                        fontSize: 13, fontWeight: activeView === 'entities' ? 500 : 400,
                      }}
                    >
                      Entities ({entities.length})
                    </button>
                    <button
                      onClick={() => setActiveView('relations')}
                      style={{
                        padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: activeView === 'relations' ? 'var(--accent)' : 'var(--bg2)',
                        color: activeView === 'relations' ? '#fff' : 'var(--text2)',
                        fontSize: 13, fontWeight: activeView === 'relations' ? 500 : 400,
                      }}
                    >
                      Relations ({edges.length})
                    </button>
                  </div>

                  {/* Entities table */}
                  {activeView === 'entities' && (
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 90px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                        {['Name', 'Type', 'Confidence', 'Mentions'].map(h => (
                          <div key={h} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                        ))}
                      </div>
                      {entities.slice(0, 50).map((ent: any) => {
                        const color = TYPE_COLORS[ent.entity_type] || '#7b8299';
                        const conf = Math.round((ent.confidence || 0) * 100);
                        return (
                          <div
                            key={ent.id}
                            onClick={() => void router.push(`/projects/${id}/entities/${ent.id}`)}
                            style={{
                              display: 'grid', gridTemplateColumns: '1fr 120px 120px 90px',
                              padding: '10px 16px', borderBottom: '1px solid var(--border)',
                              cursor: 'pointer', transition: 'background .1s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                              {ent.canonical_name || ent.name || ent.label}
                            </div>
                            <div>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4,
                                background: `${color}22`, color, fontSize: 11, fontFamily: 'var(--mono)',
                              }}>
                                {ent.entity_type}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${conf}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }}/>
                              </div>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', minWidth: 28 }}>{conf}%</span>
                            </div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
                              {Array.isArray(ent.raw_mentions) ? ent.raw_mentions.length : 0}
                            </div>
                          </div>
                        );
                      })}
                      {entities.length > 50 && (
                        <div style={{ padding: '10px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                          Showing 50 of {entities.length} entities. View graph for full exploration.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Relations table */}
                  {activeView === 'relations' && (
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr 80px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                        {['Source', 'Relation', 'Target', 'Confidence'].map(h => (
                          <div key={h} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                        ))}
                      </div>
                      {edges.length === 0 ? (
                        <div style={{ padding: '20px 16px', color: 'var(--text3)', fontSize: 13 }}>
                          No relations found. Try running extraction again.
                        </div>
                      ) : edges.slice(0, 50).map((edge: any, i: number) => {
                        const srcNode = entities.find((e: any) => e.id === edge.source);
                        const tgtNode = entities.find((e: any) => e.id === edge.target);
                        const conf = Math.round((edge.confidence || 0) * 100);
                        return (
                          <div
                            key={edge.id || i}
                            style={{
                              display: 'grid', gridTemplateColumns: '1fr 140px 1fr 80px',
                              padding: '10px 16px', borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                              {srcNode?.canonical_name || srcNode?.label || edge.source}
                            </div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>
                              {edge.label || edge.relation_type}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                              {tgtNode?.canonical_name || tgtNode?.label || edge.target}
                            </div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                              {conf}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* CTAs */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => void router.push(`/projects/${id}/documents`)}
                  className="btn-ghost"
                >
                  ← Back to documents
                </button>
                <button
                  onClick={() => void router.push(`/projects/${id}/map`)}
                  className="btn-primary btn-primary-lg"
                  disabled={!extracted && entities.length === 0}
                >
                  View graph map →
                </button>
              </div>

        </div>
      </Layout>
    </>
  );
}
