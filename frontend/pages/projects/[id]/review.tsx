import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getProject,
  getProjectReviewCandidates,
  resolveReviewCandidate,
  getStoredAuthToken,
  ProjectSummary,
  ReviewCandidateList,
} from '@/lib/api';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';

export default function ReviewPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [data, setData] = useState<ReviewCandidateList | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    if (!id) return;
    getProject(id).then(setProject).catch(() => {});
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = () => {
    if (!id) return;
    getProjectReviewCandidates(id)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const resolve = async (candidateId: string, action: 'merge' | 'keep_separate') => {
    setResolving(candidateId);
    try {
      await resolveReviewCandidate(candidateId, action);
      setData(prev => prev ? {
        ...prev,
        pending_count: prev.pending_count - 1,
        results: prev.results.filter(r => r.id !== candidateId),
      } : prev);
    } catch {
      /* ignore */
    } finally {
      setResolving(null);
    }
  };

  return (
    <>
      <Head><title>Review Duplicates — {project?.name ?? ''}</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation workspaceId={id} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar workspaceId={id} />
          <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--text)', marginBottom: 6 }}>
                  Review Duplicates
                </h1>
                <p style={{ color: 'var(--text3)', fontSize: 13 }}>
                  Borderline matches found by the deduplication algorithm. Merge to consolidate, or keep separate.
                </p>
              </div>

              {loading && (
                <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</div>
              )}

              {!loading && data && data.results.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', fontSize: 13 }}>
                  No pending duplicate pairs to review.
                </div>
              )}

              {data && data.results.map(candidate => (
                <div key={candidate.id} style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 20, marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14, marginBottom: 2 }}>
                        {candidate.left_entity.name}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                        {candidate.left_entity.type}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 10px', borderRadius: 8, background: 'var(--bg3)',
                      fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', flexShrink: 0,
                    }}>
                      {Math.round(candidate.similarity_score * 100)}% similar
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14, marginBottom: 2 }}>
                        {candidate.right_entity.name}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
                        {candidate.right_entity.type}
                      </div>
                    </div>
                  </div>

                  {candidate.mention_context && (
                    <div style={{
                      fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 14,
                      padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6,
                      borderLeft: '2px solid var(--border2)', fontStyle: 'italic',
                    }}>
                      &ldquo;{candidate.mention_context}&rdquo;
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => void resolve(candidate.id, 'merge')}
                      disabled={resolving === candidate.id}
                      className="btn-primary"
                      style={{ fontSize: 12, padding: '6px 16px' }}
                    >
                      {resolving === candidate.id ? '…' : 'Merge'}
                    </button>
                    <button
                      onClick={() => void resolve(candidate.id, 'keep_separate')}
                      disabled={resolving === candidate.id}
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '6px 16px' }}
                    >
                      Keep separate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
