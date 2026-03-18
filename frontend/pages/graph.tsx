import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import EntitySidePanel from '@/components/EntitySidePanel';
import { generateEntitySummary, getEntityProfile, getGraphNodes, getProjectGraph } from '@/lib/api';
import { computeTwoHopNeighborhood } from '@/lib/graphFocus';
import { CytoscapeNode, CytoscapeEdge } from '@/types';

const GraphVisualization = dynamic(
  () => import('@/components/GraphVisualization'),
  { ssr: false, loading: () => <LoadingSpinner message="Loading graph engine..." /> }
);

export default function GraphPage() {
  type EntityType = CytoscapeNode['data']['entity_type'];

  const router = useRouter();
  const { document_id, project_id } = router.query;
  const activeProjectId = typeof project_id === 'string' ? project_id : '';
  const isProjectMode = Boolean(activeProjectId);

  const [nodes, setNodes] = useState<CytoscapeNode[]>([]);
  const [edges, setEdges] = useState<CytoscapeEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputDocId, setInputDocId] = useState('');
  const [activeDocId, setActiveDocId] = useState('');
  const [selectedNode, setSelectedNode] = useState<CytoscapeNode | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [confidenceMin, setConfidenceMin] = useState<number>(0);
  const [labelSize, setLabelSize] = useState<number>(11);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeEntityTypes, setActiveEntityTypes] = useState<EntityType[]>([]);
  const [activeRelationTypes, setActiveRelationTypes] = useState<string[]>([]);
  const [focusAnchorId, setFocusAnchorId] = useState<string | null>(null);
  const [graphCommand, setGraphCommand] = useState<{ type: 'zoomIn' | 'zoomOut' | 'fit' | 'reset'; nonce: number } | null>(null);

  const relationKey = (edge: CytoscapeEdge) => edge.relation_type || edge.label || 'UNKNOWN';

  const availableEntityTypes = useMemo(
    () => Array.from(new Set(nodes.map((node) => node.data.entity_type))).sort(),
    [nodes],
  );

  const availableRelationTypes = useMemo(
    () => Array.from(new Set(edges.map((edge) => relationKey(edge)))).sort(),
    [edges],
  );

  useEffect(() => {
    if (availableEntityTypes.length === 0) {
      setActiveEntityTypes([]);
      return;
    }
    setActiveEntityTypes((prev) => {
      if (prev.length === 0) {
        return availableEntityTypes;
      }
      const intersection = prev.filter((item) => availableEntityTypes.includes(item));
      return intersection.length ? intersection : availableEntityTypes;
    });
  }, [availableEntityTypes]);

  useEffect(() => {
    if (availableRelationTypes.length === 0) {
      setActiveRelationTypes([]);
      return;
    }
    setActiveRelationTypes((prev) => {
      if (prev.length === 0) {
        return availableRelationTypes;
      }
      const intersection = prev.filter((item) => availableRelationTypes.includes(item));
      return intersection.length ? intersection : availableRelationTypes;
    });
  }, [availableRelationTypes]);

  const filteredGraph = useMemo(() => {
    const filteredNodes = nodes.filter((node) => activeEntityTypes.includes(node.data.entity_type));
    const nodeIds = new Set(filteredNodes.map((node) => node.id));
    const filteredEdges = edges.filter((edge) => {
      const relType = relationKey(edge);
      return activeRelationTypes.includes(relType) && nodeIds.has(edge.source) && nodeIds.has(edge.target);
    });
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [activeEntityTypes, activeRelationTypes, nodes, edges]);

  const focusNodeIds = useMemo(() => {
    if (!focusAnchorId) {
      return [];
    }
    return computeTwoHopNeighborhood(focusAnchorId, filteredGraph.nodes, filteredGraph.edges, 2);
  }, [focusAnchorId, filteredGraph]);

  const searchMatchedNodeIds = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return [];
    }
    return filteredGraph.nodes
      .filter((node) => node.label.toLowerCase().includes(normalized))
      .map((node) => node.id);
  }, [searchTerm, filteredGraph.nodes]);

  const centeredNodeId = searchMatchedNodeIds[0] || null;

  useEffect(() => {
    if (document_id && typeof document_id === 'string') {
      setInputDocId(document_id);
      setActiveDocId(document_id);
    }
  }, [document_id]);

  const fetchNodes = useCallback(async (docId: string) => {
    if (!docId && !isProjectMode) return;
    setLoading(true);
    setError('');
    setSelectedNode(null);
    try {
      const data = activeProjectId
        ? await getProjectGraph(activeProjectId)
        : await getGraphNodes(docId, confidenceMin > 0 ? confidenceMin : undefined);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load graph data');
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, [confidenceMin, activeProjectId, isProjectMode]);

  useEffect(() => {
    if (isProjectMode) {
      void fetchNodes(activeDocId || 'project');
      return;
    }
    if (activeDocId) {
      void fetchNodes(activeDocId);
    }
  }, [activeDocId, fetchNodes, isProjectMode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputDocId.trim();
    if (trimmed) {
      setActiveDocId(trimmed);
      const query = activeProjectId ? `/graph?project_id=${activeProjectId}&document_id=${trimmed}` : `/graph?document_id=${trimmed}`;
      router.replace(query, undefined, { shallow: true });
    }
  };

  const handleNodeClick = useCallback((node: CytoscapeNode, options?: { shiftKey?: boolean }) => {
    if (options?.shiftKey) {
      setFocusAnchorId((current) => (current === node.id ? null : node.id));
      return;
    }
    setSelectedNode(node);
    setSummaryData(null);
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!selectedNode?.id) {
        setSelectedProfile(null);
        return;
      }
      setProfileLoading(true);
      try {
        const profile = await getEntityProfile(selectedNode.id);
        setSelectedProfile(profile);
      } catch {
        setSelectedProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };

    void loadProfile();
  }, [selectedNode?.id]);

  const handleGenerateSummary = useCallback(async (refresh = false) => {
    if (!selectedNode || !activeProjectId) {
      return;
    }
    setSummaryLoading(true);
    try {
      const payload = await generateEntitySummary(selectedNode.id, activeProjectId, refresh);
      setSummaryData(payload);
    } catch (err: any) {
      setSummaryData({
        entity_id: selectedNode.id,
        project_id: activeProjectId,
        summary: null,
        fallback_message: err.message || 'Summary unavailable right now. Try again.',
        retryable: true,
      });
    } finally {
      setSummaryLoading(false);
    }
  }, [activeProjectId, selectedNode]);

  const handleSelectRelated = useCallback((entityId: string) => {
    const target = nodes.find((item) => item.id === entityId);
    if (target) {
      setSelectedNode(target);
      setSummaryData(null);
    }
  }, [nodes]);

  return (
    <Layout title="Stakeholder Graph" subtitle="Interactive network visualization of extracted entities">
      <div className="space-y-5">

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!isProjectMode && (
            <form onSubmit={handleSearch} className="flex gap-2.5 flex-1">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={inputDocId}
                  onChange={(e) => setInputDocId(e.target.value)}
                  placeholder="Enter Document ID (UUID)..."
                  className="input-field !pl-10"
                />
              </div>
              <button
                type="submit"
                disabled={!inputDocId.trim()}
                className="btn-primary text-sm"
              >
                Load
              </button>
            </form>
          )}

          {(activeDocId || isProjectMode) && (
            <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg px-4 py-2 flex-wrap">
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">
                Min confidence
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={confidenceMin * 100}
                onChange={(e) => setConfidenceMin(Number(e.target.value) / 100)}
                className="w-24 accent-primary-500"
                title="Minimum confidence"
              />
              <span className="text-xs font-semibold text-navy-700 tabular-nums w-8">
                {Math.round(confidenceMin * 100)}%
              </span>
              <div className="w-px h-4 bg-gray-200" />
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">
                Label size
              </label>
              <input
                type="range"
                min={7}
                max={20}
                step={1}
                value={labelSize}
                onChange={(e) => setLabelSize(Number(e.target.value))}
                className="w-20 accent-primary-500"
                title="Label size"
              />
              <span className="text-xs font-semibold text-navy-700 tabular-nums w-6">
                {labelSize}
              </span>
              <div className="w-px h-4 bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="btn-ghost text-xs !px-2 !py-1"
                  onClick={() => setGraphCommand({ type: 'zoomOut', nonce: Date.now() })}
                >
                  -
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs !px-2 !py-1"
                  onClick={() => setGraphCommand({ type: 'zoomIn', nonce: Date.now() })}
                >
                  +
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs !px-2 !py-1"
                  onClick={() => setGraphCommand({ type: 'fit', nonce: Date.now() })}
                >
                  Fit
                </button>
              </div>
            </div>
          )}

          {(activeDocId || isProjectMode) && (
            <div className="flex items-start gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3 flex-wrap">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Search</p>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Find node label..."
                  className="input-field !py-1.5 !text-xs min-w-[180px]"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Entity types</p>
                <div className="flex gap-2 flex-wrap">
                  {availableEntityTypes.map((entityType) => (
                    <label key={entityType} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={activeEntityTypes.includes(entityType)}
                        onChange={(e) => {
                          setActiveEntityTypes((current) => {
                            if (e.target.checked) {
                              return Array.from(new Set([...current, entityType]));
                            }
                            return current.filter((item) => item !== entityType);
                          });
                          setFocusAnchorId(null);
                        }}
                      />
                      {entityType}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Relation types</p>
                <div className="flex gap-2 flex-wrap">
                  {availableRelationTypes.map((relType) => (
                    <label key={relType} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={activeRelationTypes.includes(relType)}
                        onChange={(e) => {
                          setActiveRelationTypes((current) => {
                            if (e.target.checked) {
                              return Array.from(new Set([...current, relType]));
                            }
                            return current.filter((item) => item !== relType);
                          });
                          setFocusAnchorId(null);
                        }}
                      />
                      {relType}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {focusAnchorId && (
            <p className="text-xs text-primary-600">
              Focus mode active (2-hop). Shift+click the same node or click background to reset.
            </p>
          )}
        </div>

        {/* No document selected */}
        {!isProjectMode && !activeDocId && !loading && (
          <div className="card text-center py-16 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">Enter a document ID above to visualize its stakeholder graph.</p>
            <p className="text-xs text-gray-400 mt-1.5">Open a project workspace and run extraction first.</p>
          </div>
        )}

        {loading && <LoadingSpinner message="Loading graph data..." />}

        {error && !loading && (
          <ErrorMessage message={error} onRetry={() => fetchNodes(activeDocId)} />
        )}

        {/* Graph + Detail Panel */}
        {(activeDocId || isProjectMode) && !loading && !error && (
          <div className="animate-fade-in">
            {filteredGraph.nodes.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-sm text-gray-500">No graph data available for this scope yet.</p>
                <p className="text-xs text-gray-400 mt-1.5">Run extraction from the project workspace first.</p>
              </div>
            ) : (
              <div className="flex gap-5">
                {/* Graph area */}
                <div className="flex-1 min-w-0">
                  <GraphVisualization
                    nodes={filteredGraph.nodes}
                    edges={filteredGraph.edges}
                    onNodeClick={handleNodeClick}
                    onBackgroundClick={() => setFocusAnchorId(null)}
                    highlightNodeIds={searchMatchedNodeIds}
                    centerNodeId={centeredNodeId}
                    focusNodeIds={focusNodeIds}
                    command={graphCommand}
                    fontSize={labelSize}
                  />
                </div>

                {/* Node detail sidebar */}
                {selectedNode && (
                  <EntitySidePanel
                    node={selectedNode}
                    profile={selectedProfile}
                    loadingProfile={profileLoading}
                    summary={summaryData}
                    loadingSummary={summaryLoading}
                    summaryEnabled={Boolean(activeProjectId)}
                    onClose={() => setSelectedNode(null)}
                    onSelectRelated={handleSelectRelated}
                    onGenerateSummary={handleGenerateSummary}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
