import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import {
  getProject,
  getProjectGraph,
  getEntityProfile,
  generateEntitySummary,
  queryProjectGraph,
  getStoredAuthToken,
  ProjectSummary,
  GlobalEntityProfile,
  ContextualSummaryResponse,
} from '@/lib/api';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';
import EmptyState from '@/components/EmptyState';
import { CytoscapeNode, CytoscapeEdge } from '@/types';

const GraphVisualization = dynamic(
  () => import('@/components/GraphVisualization'),
  { ssr: false, loading: () => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading graph…</div> }
);

type Tab = 'graph' | 'entities';

export default function MapPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [nodes, setNodes] = useState<CytoscapeNode[]>([]);
  const [edges, setEdges] = useState<CytoscapeEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('graph');

  // Entity side panel
  const [selectedNode, setSelectedNode] = useState<CytoscapeNode | null>(null);
  const [profile, setProfile] = useState<GlobalEntityProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [summary, setSummary] = useState<ContextualSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [nodeHistory, setNodeHistory] = useState<CytoscapeNode[]>([]);
  const [centerNodeId, setCenterNodeId] = useState<string | null>(null);

  // Graph controls
  const [graphCommand, setGraphCommand] = useState<{ type: 'zoomIn' | 'zoomOut' | 'fit' | 'reset'; nonce: number } | null>(null);
  const [highlightNodeIds, setHighlightNodeIds] = useState<string[]>([]);
  const [focusNodeIds, setFocusNodeIds] = useState<string[]>([]);

  // NL query
  const [queryInput, setQueryInput] = useState('');
  const [queryResult, setQueryResult] = useState<{ answer: string; entity_ids: string[] } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const queryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    if (!id) return;
    getProject(id)
      .then(setProject)
      .catch(() => {});
    getProjectGraph(id)
      .then(({ nodes: n, edges: e }) => {
        setNodes(n);
        setEdges(e);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load graph. Make sure documents are processed and entities extracted.');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleNodeClick = useCallback((node: CytoscapeNode) => {
    setSelectedNode(prev => {
      if (prev) setNodeHistory(h => [...h, prev]);
      return node;
    });
    setSummary(null);
    setLoadingProfile(true);
    getEntityProfile(node.id)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
    setCenterNodeId(node.id);
  }, []);

  const handleBackNode = useCallback(() => {
    const prev = nodeHistory[nodeHistory.length - 1];
    if (!prev) return;
    setNodeHistory(h => h.slice(0, -1));
    setSelectedNode(prev);
    setSummary(null);
    setLoadingProfile(true);
    getEntityProfile(prev.id)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, [nodeHistory]);

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
    setProfile(null);
    setSummary(null);
    setNodeHistory([]);
    setHighlightNodeIds([]);
    setFocusNodeIds([]);
  }, []);

  const handleSelectRelated = useCallback((entityId: string) => {
    const relatedNode = nodes.find(n => n.id === entityId);
    if (!relatedNode) return;
    handleNodeClick(relatedNode);
  }, [nodes, handleNodeClick]);

  const handleGenerateSummary = useCallback((refresh = false) => {
    if (!selectedNode || !id) return;
    setLoadingSummary(true);
    generateEntitySummary(selectedNode.id, id, refresh)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, [selectedNode, id]);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || !id) return;
    setQueryLoading(true);
    setQueryResult(null);
    setHighlightNodeIds([]);
    setFocusNodeIds([]);
    try {
      const result = await queryProjectGraph(id, queryInput.trim());
      setQueryResult(result);
      setHighlightNodeIds(result.entity_ids);
      if (result.entity_ids.length > 0) setFocusNodeIds(result.entity_ids);
    } catch {
      setQueryResult({ answer: 'Query failed. Please try again.', entity_ids: [] });
    } finally {
      setQueryLoading(false);
    }
  };

  const clearQuery = () => {
    setQueryInput('');
    setQueryResult(null);
    setHighlightNodeIds([]);
    setFocusNodeIds([]);
  };

  const cmd = (type: 'zoomIn' | 'zoomOut' | 'fit' | 'reset') =>
    setGraphCommand({ type, nonce: Date.now() });

  return (
    <>
      <Head><title>Map — {project?.name ?? 'Graph'}</title></Head>
      <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopNavigation workspaceId={id} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar workspaceId={id} />
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Project banner */}
            <div style={{
              height: 54, flexShrink: 0,
              background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project?.name ?? 'Loading…'}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                  {nodes.length} entities · {edges.length} relations
                </div>
              </div>
              <button
                onClick={() => void router.push(`/projects/${id}/analyze`)}
                className="btn-ghost"
                style={{ fontSize: 12 }}
              >
                ← Analysis
              </button>
            </div>

            {/* Tab bar */}
            <div style={{
              height: 44, flexShrink: 0,
              background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', padding: '0 24px', gap: 4,
            }}>
              {(['graph', 'entities'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 12,
                    background: tab === t ? 'var(--accent-soft)' : 'transparent',
                    color: tab === t ? 'var(--accent)' : 'var(--text3)',
                    fontWeight: tab === t ? 500 : 400,
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Canvas area */}
            {tab === 'graph' && (
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

                {/* Loading overlay */}
                {loading && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg)',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>Loading graph…</div>
                    </div>
                  </div>
                )}

                {/* Error overlay */}
                {error && !loading && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg)', padding: 40,
                  }}>
                    <div style={{ maxWidth: 420 }}>
                      <EmptyState
                        icon="📊"
                        title="No graph yet"
                        description={error}
                        actionLabel="Go to workspace to extract →"
                        onAction={() => void router.push(`/projects/${id}/workspace`)}
                      />
                    </div>
                  </div>
                )}

                {/* Cytoscape graph */}
                {!loading && !error && (
                  <GraphVisualization
                    nodes={nodes}
                    edges={edges}
                    onNodeClick={handleNodeClick}
                    onBackgroundClick={handleClosePanel}
                    highlightNodeIds={highlightNodeIds}
                    focusNodeIds={focusNodeIds}
                    centerNodeId={centerNodeId}
                    command={graphCommand}
                  />
                )}

                {/* Toolbar overlay (top-left) */}
                {!loading && !error && (
                  <div style={{
                    position: 'absolute', top: 16, left: 16, zIndex: 5,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    {[
                      { label: '+', title: 'Zoom in',     type: 'zoomIn'  as const },
                      { label: '−', title: 'Zoom out',    type: 'zoomOut' as const },
                      { label: '⊡', title: 'Fit view',    type: 'fit'     as const },
                      { label: '↺', title: 'Reset layout',type: 'reset'   as const },
                    ].map(({ label, title, type }) => (
                      <button
                        key={type}
                        onClick={() => cmd(type)}
                        title={title}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: 'var(--bg2)', border: '1px solid var(--border)',
                          color: 'var(--text2)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 400,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Entity side panel (right overlay) */}
                {selectedNode && (
                  <div style={{
                    position: 'absolute', top: 16, right: 16, bottom: 80, zIndex: 5,
                    width: 300, overflowY: 'auto',
                    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
                    display: 'flex', flexDirection: 'column',
                  }}>
                    {/* Panel header */}
                    <div style={{
                      padding: '12px 14px', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                    }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Entity Detail
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {nodeHistory.length > 0 && (
                          <button onClick={handleBackNode} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
                            ←
                          </button>
                        )}
                        <button onClick={handleClosePanel} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, fontSize: 14 }}>
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Panel content */}
                    <div style={{ padding: '14px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                      {/* Name */}
                      <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Name</div>
                        <div style={{ fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{selectedNode.label}</div>
                      </div>

                      {/* Type badge */}
                      <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Type</div>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                          fontFamily: 'var(--mono)', fontSize: 11,
                          background: `${selectedNode.data.color || '#3d6fff'}22`,
                          color: selectedNode.data.color || '#3d6fff',
                          border: `1px solid ${selectedNode.data.color || '#3d6fff'}44`,
                        }}>
                          {selectedNode.data.entity_type}
                        </span>
                      </div>

                      {/* Confidence */}
                      <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Confidence</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round((selectedNode.data.confidence || 0) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', minWidth: 32 }}>
                            {Math.round((selectedNode.data.confidence || 0) * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Aliases */}
                      {profile?.aliases && profile.aliases.length > 0 && (
                        <div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Aliases</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {profile.aliases.map((alias, i) => (
                              <span key={i} style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg3)', color: 'var(--text2)', fontSize: 11, border: '1px solid var(--border)' }}>
                                {alias}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>Summary</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleGenerateSummary(false)} className="btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} disabled={loadingSummary}>
                              {loadingSummary ? '…' : 'Generate'}
                            </button>
                          </div>
                        </div>
                        {summary?.summary ? (
                          <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.6 }}>{summary.summary}</p>
                        ) : summary?.fallback_message ? (
                          <p style={{ color: 'var(--amber)', fontSize: 12 }}>{summary.fallback_message}</p>
                        ) : (
                          <p style={{ color: 'var(--text3)', fontSize: 12 }}>Click Generate to create a summary.</p>
                        )}
                      </div>

                      {/* Relationships */}
                      {loadingProfile ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12 }}>Loading…</div>
                      ) : profile?.relationships && profile.relationships.length > 0 ? (
                        <div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Relationships</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {profile.relationships.slice(0, 8).map((rel) => (
                              <button
                                key={rel.relation_id}
                                onClick={() => handleSelectRelated(rel.target_entity_id)}
                                style={{
                                  width: '100%', textAlign: 'left', fontSize: 11,
                                  padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                                  background: 'var(--bg3)', border: '1px solid var(--border)',
                                  color: 'var(--text2)', display: 'flex', gap: 6,
                                }}
                              >
                                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{rel.relation_type}</span>
                                <span style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {rel.target_entity_id}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* View full detail link */}
                      <button
                        onClick={() => void router.push(`/projects/${id}/entities/${selectedNode.id}`)}
                        className="btn-ghost"
                        style={{ fontSize: 12, width: '100%' }}
                      >
                        View full entity detail →
                      </button>
                    </div>
                  </div>
                )}

                {/* NL Query bar (bottom center) */}
                {!loading && !error && (
                  <div style={{
                    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 5, width: 'min(560px, calc(100% - 360px))',
                  }}>
                    {/* Query result bubble */}
                    {queryResult && (
                      <div style={{
                        marginBottom: 8, padding: '10px 14px', borderRadius: 10,
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                      }}>
                        <span>{queryResult.answer}</span>
                        <button onClick={clearQuery} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0, fontSize: 16 }}>×</button>
                      </div>
                    )}

                    {/* Query input */}
                    <form onSubmit={e => void handleQuery(e)} style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          ref={queryInputRef}
                          value={queryInput}
                          onChange={e => setQueryInput(e.target.value)}
                          placeholder={'Ask about entities\u2026 e.g. \u201cWho works at UNDP?\u201d'}
                          style={{
                            width: '100%', height: 40, borderRadius: 10,
                            background: 'var(--bg2)', border: '1px solid var(--border2)',
                            color: 'var(--text)', padding: '0 14px', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                        {queryInput && (
                          <button
                            type="button"
                            onClick={clearQuery}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ height: 40, padding: '0 16px', fontSize: 13, flexShrink: 0 }}
                        disabled={queryLoading || !queryInput.trim()}
                      >
                        {queryLoading ? '…' : 'Search'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* Entities tab */}
            {tab === 'entities' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
                <div style={{ maxWidth: 800, margin: '0 auto' }}>
                  <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--text)', marginBottom: 20 }}>
                    All Entities
                  </h2>
                  {loading ? (
                    <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</div>
                  ) : nodes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                      No entities yet. Run extraction in the workspace.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {nodes.map(node => (
                        <div
                          key={node.id}
                          onClick={() => { setTab('graph'); handleNodeClick(node); }}
                          style={{
                            padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                            background: 'var(--bg2)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'border-color .15s',
                          }}
                        >
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: node.data.color || '#7b8299',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {node.label}
                            </div>
                          </div>
                          <span style={{
                            fontFamily: 'var(--mono)', fontSize: 10,
                            padding: '2px 8px', borderRadius: 4,
                            background: `${node.data.color || '#7b8299'}22`,
                            color: node.data.color || '#7b8299',
                          }}>
                            {node.data.entity_type}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); void router.push(`/projects/${id}/entities/${node.id}`); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}
                          >
                            Detail →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
