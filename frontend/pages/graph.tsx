import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { getGraphNodes } from '@/lib/api';
import { CytoscapeNode, CytoscapeEdge } from '@/types';

const GraphVisualization = dynamic(
  () => import('@/components/GraphVisualization'),
  { ssr: false, loading: () => <LoadingSpinner message="Loading graph engine..." /> }
);

const BADGE_STYLES: Record<string, string> = {
  PERSON: 'badge-person',
  ORGANIZATION: 'badge-organization',
  LOCATION: 'badge-location',
  ROLE: 'badge-role',
};

export default function GraphPage() {
  const router = useRouter();
  const { document_id } = router.query;

  const [nodes, setNodes] = useState<CytoscapeNode[]>([]);
  const [edges, setEdges] = useState<CytoscapeEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputDocId, setInputDocId] = useState('');
  const [activeDocId, setActiveDocId] = useState('');
  const [selectedNode, setSelectedNode] = useState<CytoscapeNode | null>(null);
  const [confidenceMin, setConfidenceMin] = useState<number>(0);
  const [labelSize, setLabelSize] = useState<number>(11);

  useEffect(() => {
    if (document_id && typeof document_id === 'string') {
      setInputDocId(document_id);
      setActiveDocId(document_id);
    }
  }, [document_id]);

  const fetchNodes = useCallback(async (docId: string) => {
    if (!docId) return;
    setLoading(true);
    setError('');
    setSelectedNode(null);
    try {
      const data = await getGraphNodes(docId, confidenceMin > 0 ? confidenceMin : undefined);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load graph data');
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, [confidenceMin]);

  useEffect(() => {
    if (activeDocId) {
      fetchNodes(activeDocId);
    }
  }, [activeDocId, fetchNodes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputDocId.trim();
    if (trimmed) {
      setActiveDocId(trimmed);
      router.replace(`/graph?document_id=${trimmed}`, undefined, { shallow: true });
    }
  };

  const handleNodeClick = useCallback((node: CytoscapeNode) => {
    setSelectedNode(node);
  }, []);

  return (
    <Layout title="Stakeholder Graph" subtitle="Interactive network visualization of extracted entities">
      <div className="space-y-5">

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
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

          {activeDocId && (
            <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg px-4 py-2">
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
              />
              <span className="text-xs font-semibold text-navy-700 tabular-nums w-6">
                {labelSize}
              </span>
            </div>
          )}
        </div>

        {/* No document selected */}
        {!activeDocId && !loading && (
          <div className="card text-center py-16 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">Enter a document ID above to visualize its stakeholder graph.</p>
            <p className="text-xs text-gray-400 mt-1.5">
              Or <Link href="/upload" className="text-primary-500 hover:text-primary-600 font-medium underline underline-offset-2">upload a document</Link> first.
            </p>
          </div>
        )}

        {loading && <LoadingSpinner message="Loading graph data..." />}

        {error && !loading && (
          <ErrorMessage message={error} onRetry={() => fetchNodes(activeDocId)} />
        )}

        {/* Graph + Detail Panel */}
        {activeDocId && !loading && !error && (
          <div className="animate-fade-in">
            {nodes.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-sm text-gray-500">No entities found for this document.</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  Try <Link href="/upload" className="text-primary-500 hover:text-primary-600 font-medium underline underline-offset-2">extracting entities</Link> first.
                </p>
              </div>
            ) : (
              <div className="flex gap-5">
                {/* Graph area */}
                <div className="flex-1 min-w-0">
                  <GraphVisualization nodes={nodes} edges={edges} onNodeClick={handleNodeClick} fontSize={labelSize} />
                </div>

                {/* Node detail sidebar */}
                {selectedNode && (
                  <div className="w-72 flex-shrink-0 animate-slide-up">
                    <div className="card sticky top-20 !p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Node Detail</h3>
                        <button
                          onClick={() => setSelectedNode(null)}
                          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Name</p>
                          <p className="font-semibold text-navy-700">{selectedNode.label}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Type</p>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            BADGE_STYLES[selectedNode.data.entity_type] || ''
                          }`}>
                            {selectedNode.data.entity_type}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Confidence</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  Math.round(selectedNode.data.confidence * 100) >= 80 ? 'bg-emerald-500' :
                                  Math.round(selectedNode.data.confidence * 100) >= 60 ? 'bg-amber-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${Math.round(selectedNode.data.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-navy-700 tabular-nums">
                              {Math.round(selectedNode.data.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Mentions</p>
                          <p className="text-sm font-medium text-navy-700">{selectedNode.data.raw_mentions_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Entity ID</p>
                          <p className="text-xs font-mono text-gray-400 break-all bg-gray-50 px-2 py-1 rounded">
                            {selectedNode.data.entity_id}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => router.push(`/entities?document_id=${activeDocId}`)}
                          className="btn-secondary w-full text-xs"
                        >
                          View in Entity Table
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
