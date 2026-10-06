import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import {
  getProject,
  getProjectEntityDetail,
  generateEntitySummary,
  flagEntity,
  getEntityTimeline,
  getStoredAuthToken,
  ProjectSummary,
  ProjectEntityDetail,
  ContextualSummaryResponse,
  TimelineEntry,
} from '@/lib/api';

interface ExternalRef {
  title: string;
  extract: string;
  thumbnail?: { source: string };
  url?: string;
  source: string;
}
import Layout from '@/components/Layout';
import ErrorMessage from '@/components/ErrorMessage';
import EntityStakeholderAnalysis from '@/components/EntityStakeholderAnalysis';
import { buildEntityNeighborhood } from '@/lib/entityNeighborhood';
import { normalizeLlmText } from '@/lib/llmText';
import { getEntityColor } from '@/lib/entityTypes';
import { CytoscapeEdge, CytoscapeNode } from '@/types';

const GraphVisualization = dynamic(
  () => import('@/components/GraphVisualization'),
  {
    ssr: false,
    loading: () => (
      <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading mini-graph…</div>
    ),
  }
);

export default function EntityDetailPage() {
  const router = useRouter();
  const { id, entityId } = router.query as { id: string; entityId: string };

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [profile, setProfile] = useState<ProjectEntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ContextualSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isFlagged, setIsFlagged] = useState(false);
  const [extRef, setExtRef] = useState<ExternalRef | null>(null);
  const [extRefLoading, setExtRefLoading] = useState(false);
  const [extRefNotFound, setExtRefNotFound] = useState(false);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    if (!id || !entityId) return;
    getProject(id).then(setProject).catch(() => {});
    getProjectEntityDetail(id, entityId)
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

  // Build a contextual search query using entity name + project name + entity type hints
  const buildContextQuery = (entityName: string, entityType: string, projectName: string) => {
    // Strip generic project words to get meaningful domain keywords
    const projectKeywords = projectName
      .replace(/\b(project|analysis|tool|system|platform|initiative|programme|program)\b/gi, '')
      .trim();
    // For generic entity types that would produce useless Wikipedia articles, add more context
    const genericTypes = ['CONCEPT', 'THEME', 'ROLE', 'POLICY'];
    if (genericTypes.includes(entityType)) {
      return `${entityName} ${projectKeywords}`.trim();
    }
    return `${entityName} ${projectKeywords}`.trim();
  };

  const handleExtRefSearch = async () => {
    if (!profile || !project) return;
    setExtRefLoading(true);
    setExtRefNotFound(false);
    setExtRef(null);

    const contextQuery = buildContextQuery(profile.canonical_name, profile.entity_type, project.name);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(contextQuery)}&srlimit=3&format=json&origin=*`;

    try {
      // Step 1: search Wikipedia with contextual query to find best-matching article
      const searchRes = await fetch(searchUrl);
      let articleTitle: string | null = null;

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const hits: Array<{ title: string; snippet: string }> = searchData?.query?.search ?? [];
        // Pick the first hit whose title or snippet overlaps with the entity name
        const nameLower = profile.canonical_name.toLowerCase();
        const best = hits.find(h => h.title.toLowerCase().includes(nameLower) || nameLower.includes(h.title.toLowerCase())) ?? hits[0];
        if (best) articleTitle = best.title;
      }

      // Step 2: fetch summary for the matched article
      if (articleTitle) {
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle.replace(/\s+/g, '_'))}`);
        if (summaryRes.ok) {
          const data = await summaryRes.json();
          // Reject if the summary describes a generic concept unrelated to the context
          // (detect by checking if entity name appears in the extract or title)
          const nameLower = profile.canonical_name.toLowerCase();
          const extractLower = (data.extract || '').toLowerCase();
          const titleLower = (data.title || '').toLowerCase();
          const isRelevant = titleLower.includes(nameLower) || nameLower.includes(titleLower) || extractLower.includes(nameLower);
          if (isRelevant) {
            setExtRef({
              title: data.title,
              extract: data.extract,
              thumbnail: data.thumbnail,
              url: data.content_urls?.desktop?.page,
              source: 'Wikipedia',
            });
            return;
          }
        }
      }

      // Step 3: fallback — try Wikidata for structured entity lookup
      const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(profile.canonical_name)}&language=en&limit=1&format=json&origin=*`;
      const wdRes = await fetch(wikidataUrl);
      if (wdRes.ok) {
        const wdData = await wdRes.json();
        const wdHit = wdData?.search?.[0];
        if (wdHit?.description) {
          setExtRef({
            title: wdHit.label || profile.canonical_name,
            extract: wdHit.description,
            url: `https://www.wikidata.org/wiki/${wdHit.id}`,
            source: 'Wikidata',
          });
          return;
        }
      }

      setExtRefNotFound(true);
    } catch {
      setExtRefNotFound(true);
    } finally {
      setExtRefLoading(false);
    }
  };

  // Influence metrics derived from relationships
  const outDegree = profile ? (profile.relationships || []).filter(r => r.source_entity_name === profile.canonical_name).length : 0;
  const inDegree  = profile ? (profile.relationships || []).filter(r => r.target_entity_name === profile.canonical_name).length : 0;
  const totalDegree = outDegree + inDegree;
  const mentionCount = timeline.length;
  const influenceScore = totalDegree > 0 ? Math.min(100, Math.round((outDegree / Math.max(totalDegree, 1)) * 100)) : 0;

  const typeColor = getEntityColor(profile?.entity_type || '');
  const confidencePercent = profile ? Math.round((profile.confidence || 0) * 100) : 0;
  const neighborhood = useMemo(
    () => (profile ? buildEntityNeighborhood(profile) : { nodes: [], edges: [] }),
    [profile],
  );

  const miniGraphData = useMemo(() => {
    const degreeMap = new Map<string, number>();
    neighborhood.nodes.forEach((node) => degreeMap.set(node.id, 0));
    neighborhood.edges.forEach((edge) => {
      degreeMap.set(edge.sourceId, (degreeMap.get(edge.sourceId) ?? 0) + 1);
      degreeMap.set(edge.targetId, (degreeMap.get(edge.targetId) ?? 0) + 1);
    });

    const nodes: CytoscapeNode[] = neighborhood.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      entity_type: (node.entityType || 'ROLE') as any,
      data: {
        entity_id: node.id,
        entity_type: (node.entityType || 'ROLE') as any,
        confidence: node.isCenter ? (profile?.confidence || 0.9) : 0.8,
        document_id: '',
        chunk_id: null,
        raw_mentions_count: 0,
        degree: degreeMap.get(node.id) ?? 0,
        node_size: node.isCenter ? 64 : 46,
      },
      degree: degreeMap.get(node.id) ?? 0,
    }));

    const edges: CytoscapeEdge[] = neighborhood.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      label: edge.label,
      relation_type: edge.label,
      confidence: 0.8,
      edge_width: 2,
    }));

    return { nodes, edges };
  }, [neighborhood, profile?.confidence]);

  return (
    <>
      <Head><title>{(profile as any)?.canonical_name ?? 'Entity'} — {project?.name ?? ''}</title></Head>
      <Layout>
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

                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 24 }}>
                    <EntityStakeholderAnalysis
                      projectId={id}
                      stakeholderPriority={profile.stakeholder_priority || null}
                      persona={profile.persona || null}
                      appearsInReportSections={profile.appears_in_report_sections || []}
                      hasStakeholderTable={!!profile.has_stakeholder_table}
                    />
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
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                          {summary.source && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                              Source: {summary.source}
                            </span>
                          )}
                          {summary.source_chunks?.length ? (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                              Evidence snippets: {summary.source_chunks.length}
                            </span>
                          ) : null}
                        </div>
                        <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7, marginBottom: summary.source_chunks?.length ? 12 : 0 }}>{normalizeLlmText(summary.summary)}</p>
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
                      Mini-Graph (1 hop)
                    </div>
                    {miniGraphData.nodes.length <= 1 ? (
                      <div style={{ color: 'var(--text3)', fontSize: 13 }}>No connections extracted from documents yet.</div>
                    ) : (
                      <GraphVisualization
                        nodes={miniGraphData.nodes}
                        edges={miniGraphData.edges}
                        onNodeClick={(node) => {
                          if (node.id !== String(entityId)) {
                            void router.push(`/projects/${id}/entities/${node.id}`);
                          }
                        }}
                        height={320}
                        showControls={false}
                        showFilterPanel={false}
                        showLegend={false}
                        centerNodeId={String(entityId)}
                      />
                    )}
                  </div>

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

                  {/* Influence & Engagement Metrics */}
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                      Influence & Engagement
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                      {[
                        { label: 'Total Connections', value: totalDegree, color: '#3d6fff' },
                        { label: 'Outgoing Links', value: outDegree, color: '#2ec4a5' },
                        { label: 'Incoming Links', value: inDegree, color: '#9b6ef3' },
                        { label: 'Doc Mentions', value: mentionCount, color: '#f5a623' },
                      ].map(m => (
                        <div key={m.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: m.color, fontFamily: 'var(--mono)', marginBottom: 2 }}>{m.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                    {totalDegree > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
                          <span>Outgoing influence</span>
                          <span>{influenceScore}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2 }}>
                          <div style={{ width: `${influenceScore}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* External Cross-Reference */}
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        External Reference
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 11 }}
                          onClick={() => void handleExtRefSearch()}
                          disabled={extRefLoading}
                        >
                          {extRefLoading ? '…' : extRef ? 'Refresh' : 'Look up'}
                        </button>
                        {project && (
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(profile.canonical_name + ' ' + project.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost"
                            style={{ fontSize: 11 }}
                          >
                            Search web →
                          </a>
                        )}
                      </div>
                    </div>
                    {extRef ? (
                      <div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          {extRef.thumbnail?.source && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={extRef.thumbnail.source} alt={extRef.title} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{extRef.title}</div>
                              <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{extRef.source}</span>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
                              {extRef.extract.length > 400 ? extRef.extract.slice(0, 400) + '…' : extRef.extract}
                            </p>
                          </div>
                        </div>
                        {extRef.url && (
                          <a
                            href={extRef.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-block', marginTop: 10, fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                          >
                            View source ({extRef.source}) →
                          </a>
                        )}
                      </div>
                    ) : extRefNotFound ? (
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 8px' }}>No relevant external reference found for &ldquo;{profile.canonical_name}&rdquo; in this context.</p>
                        {project && (
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(profile.canonical_name + ' ' + project.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                          >
                            Try a web search →
                          </a>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Click &ldquo;Look up&rdquo; to search for contextual external references for this entity.</p>
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
      </Layout>
    </>
  );
}
