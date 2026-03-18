import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { getRelations } from '@/lib/api';
import { Relation } from '@/types';

export default function RelationsPage() {
  const router = useRouter();
  const { document_id } = router.query;

  const [relations, setRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputDocId, setInputDocId] = useState('');
  const [activeDocId, setActiveDocId] = useState('');

  useEffect(() => {
    if (document_id && typeof document_id === 'string') {
      setInputDocId(document_id);
      setActiveDocId(document_id);
    }
  }, [document_id]);

  const fetchRelations = useCallback(async (docId: string) => {
    if (!docId) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getRelations(docId);
      setRelations(data as Relation[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load relations');
      setRelations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeDocId) {
      void fetchRelations(activeDocId);
    }
  }, [activeDocId, fetchRelations]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputDocId.trim();
    if (trimmed) {
      setActiveDocId(trimmed);
      void router.replace(`/relations?document_id=${trimmed}`, undefined, { shallow: true });
    }
  };

  return (
    <Layout title="Relations" subtitle="View extracted relationship triplets for a document">
      <div className="space-y-5">
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

        {!activeDocId && !loading && (
          <div className="card text-center py-14 animate-fade-in">
            <p className="text-sm text-gray-500">Enter a document ID above, or{' '}
              <Link href="/upload" className="text-primary-500 hover:text-primary-600 font-medium underline underline-offset-2">upload a document</Link> first.
            </p>
          </div>
        )}

        {loading && <LoadingSpinner message="Loading relations..." />}

        {error && !loading && (
          <ErrorMessage message={error} onRetry={() => void fetchRelations(activeDocId)} />
        )}

        {activeDocId && !loading && !error && (
          <div className="animate-fade-in">
            {relations.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-sm text-gray-500">No relations found for this document.</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  Run <span className="font-medium">Extract Entities + Relations</span> from Upload or Workspace first.
                </p>
              </div>
            ) : (
              <div className="card !p-0 overflow-hidden border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-navy-700 uppercase tracking-wider">Relation Triplets</h2>
                  <span className="text-xs text-gray-500">{relations.length} relation{relations.length === 1 ? '' : 's'}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2 text-left">Source</th>
                        <th className="px-4 py-2 text-left">Label</th>
                        <th className="px-4 py-2 text-left">Target</th>
                        <th className="px-4 py-2 text-left">Confidence</th>
                        <th className="px-4 py-2 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {relations.map((relation) => (
                        <tr key={relation.id} className="hover:bg-gray-50/70">
                          <td className="px-4 py-2 text-navy-700 font-medium">{relation.source_entity_name}</td>
                          <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">{relation.label}</span></td>
                          <td className="px-4 py-2 text-navy-700 font-medium">{relation.target_entity_name}</td>
                          <td className="px-4 py-2 text-gray-600">{Math.round((relation.confidence || 0) * 100)}%</td>
                          <td className="px-4 py-2 text-gray-500">{new Date(relation.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
