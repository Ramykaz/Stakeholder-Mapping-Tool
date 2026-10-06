import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getGlobalEntities, getStoredAuthToken, GlobalEntitySummary } from '@/lib/api';
import { getEntityColor } from '@/lib/entityTypes';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';

export default function GlobalEntitiesPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<GlobalEntitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const load = () => {
    setLoading(true);
    getGlobalEntities(typeFilter ? { type: typeFilter } : undefined)
      .then(data => { setEntities(data.results || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const ENTITY_TYPES = ['PERSON', 'ORGANIZATION', 'LOCATION', 'ROLE'];

  return (
    <>
      <Head><title>All Entities</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation onMenuClick={() => setSidebarOpen(v => !v)} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="app-main">
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--text)', marginBottom: 6 }}>
                    All Entities
                  </h1>
                  <p style={{ color: 'var(--text2)', fontSize: 13 }}>
                    Entities across all your projects, sorted by cross-project frequency.
                  </p>
                </div>
                <select
                  aria-label="Entity type filter"
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  style={{
                    height: 36, borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg2)', color: 'var(--text)', padding: '0 10px',
                    fontFamily: 'var(--mono)', fontSize: 12,
                  }}
                >
                  <option value="">All types</option>
                  {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {loading && (
                <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</div>
              )}

              {!loading && entities.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', fontSize: 13 }}>
                  No entities found. Extract entities from your project documents first.
                </div>
              )}

              {entities.length > 0 && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 80px 100px', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase' }}>
                    <span>Name</span>
                    <span>Type</span>
                    <span style={{ textAlign: 'center' }}>Projects</span>
                    <span style={{ textAlign: 'center' }}>Documents</span>
                    <span>Confidence</span>
                  </div>
                  {entities.map((e, i) => {
                    const color = getEntityColor(e.entity_type);
                    return (
                      <div
                        key={i}
                        onClick={() => e.representative_id && e.representative_project_id &&
                          void router.push(`/projects/${e.representative_project_id}/entities/${e.representative_id}`)
                        }
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 110px 80px 80px 100px',
                          gap: 12, padding: '10px 16px', cursor: e.representative_id ? 'pointer' : 'default',
                          borderBottom: i < entities.length - 1 ? '1px solid var(--border)' : 'none',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--accent-soft)'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.canonical_name}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '2px 8px', borderRadius: 4,
                          background: `${color}22`, color, border: `1px solid ${color}44`,
                          fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap',
                        }}>
                          {e.entity_type}
                        </span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                          {e.project_count}
                        </span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                          {e.document_count}
                        </span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>
                          {Math.round((e.confidence_min ?? 0) * 100)}–{Math.round((e.confidence_max ?? 0) * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
