import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { getEntities } from '@/lib/api';
import { Entity } from '@/types';

const ENTITY_TYPES = ['ALL', 'PERSON', 'ORGANIZATION', 'LOCATION', 'ROLE'] as const;

const badgeClass: Record<string, string> = {
  PERSON: 'badge-person',
  ORGANIZATION: 'badge-organization',
  LOCATION: 'badge-location',
  ROLE: 'badge-role',
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? 'bg-green-500' :
    pct >= 60 ? 'bg-yellow-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`confidence-bar ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8">{pct}%</span>
    </div>
  );
}

export default function EntitiesPage() {
  const router = useRouter();
  const { document_id } = router.query;

  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [inputDocId, setInputDocId] = useState('');
  const [activeDocId, setActiveDocId] = useState('');

  // Sync query param
  useEffect(() => {
    if (document_id && typeof document_id === 'string') {
      setInputDocId(document_id);
      setActiveDocId(document_id);
    }
  }, [document_id]);

  const fetchEntities = useCallback(async (docId: string) => {
    if (!docId) return;
    setLoading(true);
    setError('');
    try {
      const filters = filterType !== 'ALL' ? { entity_type: filterType } : undefined;
      const data = await getEntities(docId, filters);
      setEntities(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load entities');
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  // Fetch when activeDocId or filter changes
  useEffect(() => {
    if (activeDocId) {
      fetchEntities(activeDocId);
    }
  }, [activeDocId, fetchEntities]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputDocId.trim();
    if (trimmed) {
      setActiveDocId(trimmed);
      router.replace(`/entities?document_id=${trimmed}`, undefined, { shallow: true });
    }
  };

  const filteredEntities = entities;

  // Entity type summary
  const summary = entities.reduce((acc, e) => {
    acc[e.entity_type] = (acc[e.entity_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout title="Entity Explorer">
      <div className="space-y-6">
        {/* Document ID input */}
        <form onSubmit={handleSearch} className="flex gap-3">
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

        {/* No document selected */}
        {!activeDocId && !loading && (
          <div className="card text-center py-12">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">Enter a document ID above, or <Link href="/upload" className="text-primary-600 hover:underline">upload a document</Link> first.</p>
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSpinner message="Loading entities..." />}

        {/* Error */}
        {error && !loading && (
          <ErrorMessage message={error} onRetry={() => fetchEntities(activeDocId)} />
        )}

        {/* Results */}
        {activeDocId && !loading && !error && (
          <>
            {/* Summary stats */}
            {entities.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['PERSON', 'ORGANIZATION', 'LOCATION', 'ROLE'] as const).map((type) => (
                  <div key={type} className="card !p-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass[type]} mb-2`}>
                      {type}
                    </span>
                    <p className="text-2xl font-bold text-gray-900">{summary[type] || 0}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Filter:</span>
              {ENTITY_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterType === type
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type === 'ALL' ? 'All' : type}
                </button>
              ))}
            </div>

            {/* Entity table */}
            {filteredEntities.length === 0 ? (
              <div className="card text-center py-10">
                <p className="text-gray-500">No entities found for this document.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try <a href={`/upload`} className="text-primary-600 hover:underline">extracting entities</a> first.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Confidence</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Mentions</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Raw Mentions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredEntities.map((entity) => (
                        <tr key={entity.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {entity.canonical_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass[entity.entity_type] || ''}`}>
                              {entity.entity_type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ConfidenceBar value={entity.confidence} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {entity.raw_mentions?.length || 0}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                            {entity.raw_mentions?.join(', ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Total count */}
            {filteredEntities.length > 0 && (
              <p className="text-xs text-gray-400 text-right">
                Showing {filteredEntities.length} entit{filteredEntities.length === 1 ? 'y' : 'ies'}
              </p>
            )}

            {/* Link to graph */}
            {entities.length > 0 && (
              <div className="text-center">
                <button
                  onClick={() => router.push(`/graph?document_id=${activeDocId}`)}
                  className="px-6 py-2.5 bg-white text-primary-700 font-medium rounded-lg border border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  View as Graph →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
