import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { getEntities, getProjectEntities, getDocumentRuns, getEntityReviewCandidates, resolveEntityReviewCandidate } from '@/lib/api';
import { Entity, NERRun, EntityReviewCandidate } from '@/types';

const ENTITY_TYPES = ['ALL', 'PERSON', 'ORGANIZATION', 'LOCATION', 'ROLE'] as const;

const BADGE_STYLES: Record<string, { badge: string; dot: string; icon: string }> = {
  PERSON: {
    badge: 'badge-person',
    dot: 'bg-blue-500',
    icon: '👤',
  },
  ORGANIZATION: {
    badge: 'badge-organization',
    dot: 'bg-violet-500',
    icon: '🏢',
  },
  LOCATION: {
    badge: 'badge-location',
    dot: 'bg-emerald-500',
    icon: '📍',
  },
  ROLE: {
    badge: 'badge-role',
    dot: 'bg-amber-500',
    icon: '💼',
  },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`confidence-bar ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-500 tabular-nums w-8">{pct}%</span>
    </div>
  );
}

export default function EntitiesPage() {
  const router = useRouter();
  const { document_id, project_id } = router.query;
  const activeProjectId = typeof project_id === 'string' ? project_id : '';

  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [inputDocId, setInputDocId] = useState('');
  const [activeDocId, setActiveDocId] = useState('');
  const [runs, setRuns] = useState<NERRun[]>([]);
  const [reviewCandidates, setReviewCandidates] = useState<EntityReviewCandidate[]>([]);
  const [resolvingCandidateId, setResolvingCandidateId] = useState<string | null>(null);

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
      const [entityData, runData, candidateData] = await Promise.all([
        activeProjectId ? getProjectEntities(activeProjectId) : getEntities(docId, filters),
        getDocumentRuns(docId),
        getEntityReviewCandidates(docId),
      ]);
      setEntities(entityData);
      setRuns(runData as NERRun[]);
      setReviewCandidates(candidateData as EntityReviewCandidate[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load entities');
      setEntities([]);
      setRuns([]);
      setReviewCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, activeProjectId]);

  const handleResolveCandidate = async (candidateId: string, action: 'merge' | 'keep_separate') => {
    if (!activeDocId) return;
    setResolvingCandidateId(candidateId);
    setError('');
    try {
      await resolveEntityReviewCandidate(activeDocId, candidateId, { action });
      await fetchEntities(activeDocId);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve review candidate');
    } finally {
      setResolvingCandidateId(null);
    }
  };

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
      const query = activeProjectId ? `/entities?project_id=${activeProjectId}&document_id=${trimmed}` : `/entities?document_id=${trimmed}`;
      router.replace(query, undefined, { shallow: true });
    }
  };

  const filteredEntities = entities;

  const summary = entities.reduce((acc, e) => {
    acc[e.entity_type] = (acc[e.entity_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalEntities = entities.length;

  return (
    <Layout title="Entity Explorer" subtitle="Browse and filter extracted stakeholder entities">
      <div className="space-y-5">

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2.5">
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

        {/* No document selected */}
        {!activeDocId && !loading && (
          <div className="card text-center py-14 animate-fade-in">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">Enter a document ID above, or{' '}
              <Link href="/upload" className="text-primary-500 hover:text-primary-600 font-medium underline underline-offset-2">upload a document</Link> first.
            </p>
          </div>
        )}

        {loading && <LoadingSpinner message="Loading entities..." />}

        {error && !loading && (
          <ErrorMessage message={error} onRetry={() => fetchEntities(activeDocId)} />
        )}

        {/* Results */}
        {activeDocId && !loading && !error && (
          <div className="animate-fade-in">
            {reviewCandidates.length > 0 && (
              <div className="card mb-5 border-amber-200 bg-amber-50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-amber-900 uppercase tracking-wider">Review Needed</h2>
                  <span className="text-xs text-amber-800">{reviewCandidates.length} candidate{reviewCandidates.length === 1 ? '' : 's'}</span>
                </div>
                <div className="space-y-2.5">
                  {reviewCandidates.map((candidate) => (
                    <div key={candidate.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{candidate.left_entity_name}</span>
                        {' vs '}
                        <span className="font-medium">{candidate.right_entity_name}</span>
                        <span className="ml-2 text-xs text-gray-500">({Math.round(candidate.similarity_score * 100)}%)</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleResolveCandidate(candidate.id, 'merge')}
                          disabled={resolvingCandidateId === candidate.id}
                          className="btn-primary text-xs !px-3 !py-1"
                        >
                          Merge
                        </button>
                        <button
                          onClick={() => handleResolveCandidate(candidate.id, 'keep_separate')}
                          disabled={resolvingCandidateId === candidate.id}
                          className="btn-secondary text-xs !px-3 !py-1"
                        >
                          Keep Separate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-navy-700 uppercase tracking-wider">Extraction Runs</h2>
                <span className="text-xs text-gray-500">{runs.length} run{runs.length === 1 ? '' : 's'}</span>
              </div>

              {runs.length === 0 ? (
                <p className="text-sm text-gray-500">No extraction runs recorded for this document yet. Start an extraction from Upload to compare LLM providers and models here.</p>
              ) : (
                <div className="space-y-2">
                  {runs.map((run) => (
                    <div key={run.id} className="border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
                        <span><span className="font-medium">Provider:</span> {run.provider}</span>
                        <span><span className="font-medium">Model:</span> {run.model}</span>
                        <span><span className="font-medium">Status:</span> {run.status}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                        <span>Input: {run.tokens_input ?? 0}</span>
                        <span>Output: {run.tokens_output ?? 0}</span>
                        <span>Cached: {run.tokens_cached ?? 0}</span>
                        <span>Cost: {run.cost_usd ?? '0.000000'} USD</span>
                        <span>Created: {new Date(run.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">This run is stored independently, so re-running extraction does not overwrite previous provider/model results.</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary Stats */}
            {totalEntities > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                {/* Total card */}
                <div className="stat-card col-span-2 sm:col-span-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total</p>
                  <p className="text-3xl font-bold text-navy-700">{totalEntities}</p>
                </div>
                {/* Per-type cards */}
                {(['PERSON', 'ORGANIZATION', 'LOCATION', 'ROLE'] as const).map((type) => {
                  const style = BADGE_STYLES[type];
                  return (
                    <div key={type} className="stat-card">
                      <div className="flex items-center justify-center gap-1.5 mb-1.5">
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{type}</span>
                      </div>
                      <p className="text-2xl font-bold text-navy-700">{summary[type] || 0}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                {ENTITY_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                      filterType === type
                        ? 'bg-navy-700 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'ALL' ? 'All' : type}
                  </button>
                ))}
              </div>

              {entities.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/relations?document_id=${activeDocId}`)}
                    className="btn-secondary text-xs !px-3.5 !py-1.5"
                  >
                    View Relations
                  </button>
                  <button
                    onClick={() => router.push(`/graph?document_id=${activeDocId}`)}
                    className="btn-secondary text-xs !px-3.5 !py-1.5"
                  >
                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    View Graph
                  </button>
                </div>
              )}
            </div>

            {/* Entity Table */}
            {filteredEntities.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-sm text-gray-500">No entities found for this document.</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  Try{' '}
                  <Link href="/upload" className="text-primary-500 hover:text-primary-600 font-medium underline underline-offset-2">extracting entities</Link> first.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Confidence</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mentions</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Raw Text</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredEntities.map((entity) => {
                        const style = BADGE_STYLES[entity.entity_type];
                        return (
                          <tr key={entity.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-medium text-navy-700">{entity.canonical_name}</span>
                              {entity.aliases && entity.aliases.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Aliases: {entity.aliases.join(', ')}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style?.badge || ''}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${style?.dot || 'bg-gray-400'}`} />
                                {entity.entity_type}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <ConfidenceBar value={entity.confidence} />
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                                {entity.mention_count_dedup ?? entity.raw_mentions?.length ?? 0}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="text-xs text-gray-400 max-w-xs truncate">
                                {entity.raw_mentions?.join(', ') || '—'}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            {filteredEntities.length > 0 && (
              <p className="text-xs text-gray-400 text-right mt-3">
                Showing {filteredEntities.length} entit{filteredEntities.length === 1 ? 'y' : 'ies'}
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
