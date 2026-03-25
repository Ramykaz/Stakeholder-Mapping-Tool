import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getProject,
  getEntityProfile,
  generateEntitySummary,
  flagEntity,
  getEntityTimeline,
  getStoredAuthToken,
  ProjectSummary,
  GlobalEntityProfile,
  ContextualSummaryResponse,
  TimelineEntry,
} from '@/lib/api';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';
import ErrorMessage from '@/components/ErrorMessage';

const TYPE_COLORS: Record<string, string> = {
  PERSON:       '#2ec4a5',
  ORGANIZATION: '#3d6fff',
  GOVERNMENT:   '#3d6fff',
  LOCATION:     '#f5a623',
  ROLE:         '#7b8299',
  EVENT:        '#9b6ef3',
  PROJECT:      '#9b6ef3',
  POLICY:       '#9b6ef3',
  CONCEPT:      '#f0614a',
  THEME:        '#f0614a',
};

export default function EntityDetailPage() {
  const router = useRouter();
  const { id, entityId } = router.query as { id: string; entityId: string };

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [profile, setProfile] = useState<GlobalEntityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ContextualSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isFlagged, setIsFlagged] = useState(false);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    if (!id || !entityId) return;
    getProject(id).then(setProject).catch(() => {});
    getEntityProfile(entityId)
      .then(data => {
        setProfile(data);
        setIsFlagged((data as any).is_flagged ?? false);
        setLoading(false);
      })
      .catch(() => { setError('Entity not found or access denied.'); setLoading(false); });
    getEntityTimeline(entityId, id)
      .then(data => setTimeline(data.timeline || []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, entityId]);

  const handleGenerateSummary = (refresh = false) => {
    if (!entityId || !id) return;
    setLoadingSummary(true);
    generateEntitySummary(entityId, id, refresh)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  };

  const typeColor = profile ? (TYPE_COLORS[profile.entity_type] || '#7b8299') : '#7b8299';
  const confidencePercent = profile ? Math.round((profile.confidence || 0) * 100) : 0;

  return (
    <>
      <Head><title>{(profile as any)?.canonical_name ?? 'Entity'} — {project?.name ?? ''}</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation workspaceId={id} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar workspaceId={id} />
          <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>

              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                <button onClick={() => void router.push(`/projects/${id}/map`)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 0 }}>
                  ← Map
                </button>
                <span>/</span>
                <span>Entity Detail</span>
              </div>

              {loading && (
                <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading entity…</div>
              )}

              {error && !loading && (
                <ErrorMessage message={error} />
              )}

              {profile && !loading && (
                <>
                  {/* Entity header */}
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                        background: `${typeColor}22`, border: `2px solid ${typeColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--mono)', fontSize: 16, color: typeColor, fontWeight: 700,
                      }}>
                        {(profile.canonical_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--text)', marginBottom: 6, lineHeight: 1.2 }}>
                          {profile.canonical_name}
                        </h1>
                        <span style={{
                          display: 'inline-block', padding: '3px 12px', borderRadius: 20,
                          fontFamily: 'var(--mono)', fontSize: 11,
                          background: `${typeColor}22`, color: typeColor,
                          border: `1px solid ${typeColor}44`,
                        }}>
                          {profile.entity_type}
                        </span>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', minWidth: 70 }}>Confidence</div>
                      <div style={{ flex: 1, maxWidth: 200, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${confidencePercent}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{confidencePercent}%</span>
                    </div>
                  </div>

                  {/* Cards grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

                    {/* Aliases */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Aliases</div>
                      {(profile.aliases || []).length === 0 ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12 }}>No aliases</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(profile.aliases || []).map((alias, i) => (
                            <span key={i} style={{ padding: '2px 10px', borderRadius: 4, background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, border: '1px solid var(--border)' }}>
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Projects */}
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Projects</div>
                      {(profile.projects || []).length === 0 ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12 }}>Not linked to any project</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(profile.projects || []).map(p => (
                            <button
                              key={p.id}
                              onClick={() => void router.push(`/projects/${p.id}/map`)}
                              style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, padding: 0 }}
                            >
                              {p.name} →
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contextual summary */}
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contextual Summary</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleGenerateSummary(false)} className="btn-ghost" style={{ fontSize: 11 }} disabled={loadingSummary}>
                          {loadingSummary ? '…' : 'Generate'}
                        </button>
                        {summary && (
                          <button onClick={() => handleGenerateSummary(true)} className="btn-ghost" style={{ fontSize: 11 }} disabled={loadingSummary}>
                            Refresh
                          </button>
                        )}
                      </div>
                    </div>
                    {summary?.summary ? (
                      <>
                        <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7, marginBottom: summary.source_chunks?.length ? 12 : 0 }}>{summary.summary}</p>
                        {summary.source_chunks && summary.source_chunks.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Sources</div>
                            {summary.source_chunks.map((chunk, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', whiteSpace: 'nowrap', paddingTop: 1 }}>{chunk.document_name}</span>
                                <span style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4, fontStyle: 'italic' }}>&ldquo;{chunk.snippet}&rdquo;</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : summary?.fallback_message ? (
                      <p style={{ color: 'var(--amber)', fontSize: 13 }}>{summary.fallback_message}</p>
                    ) : (
                      <p style={{ color: 'var(--text3)', fontSize: 13 }}>Click Generate to create a contextual summary for this entity in the scope of the current project.</p>
                    )}
                  </div>

                  {/* Relationships */}
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                      Relationships ({(profile.relationships || []).length})
                    </div>
                    {(profile.relationships || []).length === 0 ? (
                      <div style={{ color: 'var(--text3)', fontSize: 13 }}>No relationships found in this project scope.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(profile.relationships || []).map(rel => {
                          const isSource = rel.source_entity_name === profile.canonical_name;
                          const otherName = isSource ? (rel.target_entity_name || rel.target_entity_id) : (rel.source_entity_name || rel.source_entity_id);
                          const otherId  = isSource ? rel.target_entity_id : rel.source_entity_id;
                          return (
                            <div
                              key={rel.relation_id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                                background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)',
                              }}
                            >
                              {!isSource && (
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>←</span>
                              )}
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 500, minWidth: 100 }}>
                                {rel.relation_type}
                              </span>
                              <span style={{ color: 'var(--text3)', fontSize: 11 }}>{isSource ? '→' : '←'}</span>
                              <button
                                onClick={() => void router.push(`/projects/${id}/entities/${otherId}`)}
                                style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, padding: 0, flex: 1, textAlign: 'left' }}
                              >
                                {otherName}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                      Document Timeline
                    </div>
                    {timeline.length === 0 ? (
                      <div style={{ color: 'var(--text3)', fontSize: 13 }}>No document mentions found.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {timeline.map((entry, i) => (
                          <div key={i} style={{ borderLeft: '2px solid var(--border2)', paddingLeft: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <button
                                onClick={() => void router.push(`/projects/${id}/documents`)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 500 }}
                              >
                                {entry.document_name}
                              </button>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                                {new Date(entry.uploaded_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, fontStyle: 'italic' }}>
                              &ldquo;{entry.context_snippet}&rdquo;
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Unflag button */}
                  {isFlagged && (
                    <div style={{ background: 'rgba(240,97,74,0.08)', border: '1px solid rgba(240,97,74,0.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--coral, #f0614a)' }}>This entity is flagged and hidden from the graph.</span>
                      <button
                        onClick={async () => {
                          await flagEntity(entityId, false);
                          setIsFlagged(false);
                          void router.push(`/projects/${id}/map`);
                        }}
                        style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
                      >
                        Unflag entity
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
