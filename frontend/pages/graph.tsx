import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { getGraphNodes } from '@/lib/api';
import { CytoscapeNode } from '@/types';

// Dynamic import — Cytoscape uses window/DOM, can't render on server
const GraphVisualization = dynamic(
  () => import('@/components/GraphVisualization'),
  { ssr: false, loading: () => <LoadingSpinner message="Loading graph engine..." /> }
);

export default function GraphPage() {
  const router = useRouter();
  const { document_id } = router.query;

  const [nodes, setNodes] = useState<CytoscapeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputDocId, setInputDocId] = useState('');
  const [activeDocId, setActiveDocId] = useState('');
  const [selectedNode, setSelectedNode] = useState<CytoscapeNode | null>(null);
  const [confidenceMin, setConfidenceMin] = useState<number>(0);

  // Sync query param
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
      setNodes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load graph data');
      setNodes([]);
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
    <Layout title="Stakeholder Graph">
      <div className="space-y-6">
        {/* Document ID input + confidence filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex gap-3 flex-1">
            <input
              type="text"
              value={inputDocId}
              onChange={(e) => setInputDocId(e.target.value)}
              placeholder="Enter Document ID (UUID)..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <button
              type="submit"
              disabled={!inputDocId.trim()}
              className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Load
            </button>
          </form>

          {activeDocId && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">
                Min confidence:
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={confidenceMin * 100}
                onChange={(e) => setConfidenceMin(Number(e.target.value) / 100)}
                className="w-24"
              />
              <span className="text-xs text-gray-600 w-8">{Math.round(confidenceMin * 100)}%</span>
            </div>
          )}
        </div>

        {/* No document selected */}
        {!activeDocId && !loading && (
          <div className="card text-center py-16">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-gray-500">Enter a document ID above to visualize its stakeholder graph.</p>
            <p className="text-sm text-gray-400 mt-1">
              Or <Link href="/upload" className="text-primary-600 hover:underline">upload a document</Link> first.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSpinner message="Loading graph data..." />}

        {/* Error */}
        {error && !loading && (
          <ErrorMessage message={error} onRetry={() => fetchNodes(activeDocId)} />
        )}

        {/* Graph */}
        {activeDocId && !loading && !error && (
          <>
            {nodes.length === 0 ? (
              <div className="card text-center py-10">
                <p className="text-gray-500">No entities found for this document.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try <Link href="/upload" className="text-primary-600 hover:underline">extracting entities</Link> first.
                </p>
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Main graph area */}
                <div className="flex-1 min-w-0">
                  <GraphVisualization nodes={nodes} onNodeClick={handleNodeClick} />
                </div>

                {/* Node detail panel (appears when a node is clicked) */}
                {selectedNode && (
                  <div className="w-72 flex-shrink-0">
                    <div className="card sticky top-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">Node Detail</h3>
                        <button
                          onClick={() => setSelectedNode(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500">Name</p>
                          <p className="font-medium text-gray-900">{selectedNode.label}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Type</p>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            selectedNode.data.entity_type === 'PERSON' ? 'badge-person' :
                            selectedNode.data.entity_type === 'ORGANIZATION' ? 'badge-organization' :
                            selectedNode.data.entity_type === 'LOCATION' ? 'badge-location' :
                            'badge-role'
                          }`}>
                            {selectedNode.data.entity_type}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Confidence</p>
                          <p className="font-medium text-gray-900">{Math.round(selectedNode.data.confidence * 100)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Raw Mentions</p>
                          <p className="font-medium text-gray-900">{selectedNode.data.raw_mentions_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Entity ID</p>
                          <p className="text-xs font-mono text-gray-500 break-all">{selectedNode.data.entity_id}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => router.push(`/entities?document_id=${activeDocId}`)}
                          className="w-full px-4 py-2 text-sm text-primary-700 bg-primary-50 rounded-md hover:bg-primary-100 font-medium transition-colors"
                        >
                          View in Entity Table
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
