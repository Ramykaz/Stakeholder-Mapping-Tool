import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getStoredAuthToken,
  getStoredAuthUser,
  adminGetStats,
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
  getGlobalEntities,
  flagEntity,
  AdminStats,
  AdminUserRecord,
  GlobalEntitySummary,
} from '@/lib/api';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';
import EntityLabelsPanel from '@/components/admin/EntityLabelsPanel';
import RelationshipTypesPanel from '@/components/admin/RelationshipTypesPanel';
import {
  EntityLabelConfig,
  RelationshipTypeConfig,
  getEntityLabels,
  createEntityLabel,
  updateEntityLabel,
  deleteEntityLabel,
  getRelationshipTypes,
  createRelationshipType,
  updateRelationshipType,
  deleteRelationshipType,
} from '@/lib/api';

type Tab = 'stats' | 'users' | 'entities' | 'taxonomy';

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stats');
  const [accessDenied, setAccessDenied] = useState(false);

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Global entities
  const [entities, setEntities] = useState<GlobalEntitySummary[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entityPage, setEntityPage] = useState(1);
  const [entitySearch, setEntitySearch] = useState('');
  const ENTITY_PAGE_SIZE = 20;

  // Taxonomy
  const [labels, setLabels] = useState<EntityLabelConfig[]>([]);
  const [relTypes, setRelTypes] = useState<RelationshipTypeConfig[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState('');

  useEffect(() => {
    const token = getStoredAuthToken();
    const user = getStoredAuthUser();
    if (!token) { void router.replace('/login'); return; }
    if (!user?.is_admin) { setAccessDenied(true); return; }
    void loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = async () => {
    setStatsLoading(true);
    try { setStats(await adminGetStats()); } catch {} finally { setStatsLoading(false); }
  };

  const loadUsers = useCallback(async (page = 1, search = '') => {
    setUsersLoading(true);
    try {
      const res = await adminListUsers({ page, search });
      setUsers(res.results);
      setUserCount(res.count);
      setUserPage(page);
    } catch {} finally { setUsersLoading(false); }
  }, []);

  const loadEntities = useCallback(async (page = 1, search = '') => {
    setEntitiesLoading(true);
    try {
      const res = await getGlobalEntities({ page, search, page_size: ENTITY_PAGE_SIZE });
      setEntities(res.results);
      setEntityPage(page);
    } catch {} finally { setEntitiesLoading(false); }
  }, []);

  const loadTaxonomy = useCallback(async () => {
    setTaxLoading(true);
    setTaxError('');
    try {
      const [l, r] = await Promise.all([getEntityLabels(), getRelationshipTypes()]);
      setLabels(l);
      setRelTypes(r);
    } catch { setTaxError('Failed to load taxonomy.'); } finally { setTaxLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'users') void loadUsers(1, userSearch);
    if (tab === 'entities') void loadEntities(1, entitySearch);
    if (tab === 'taxonomy') void loadTaxonomy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onUserSearch = (v: string) => {
    setUserSearch(v);
    void loadUsers(1, v);
  };

  const toggleAdmin = async (u: AdminUserRecord) => {
    await adminUpdateUser(u.id, { is_admin: !u.is_admin });
    void loadUsers(userPage, userSearch);
  };

  const toggleActive = async (u: AdminUserRecord) => {
    await adminUpdateUser(u.id, { is_active: !u.is_active });
    void loadUsers(userPage, userSearch);
  };

  const deleteUser = async (u: AdminUserRecord) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    await adminDeleteUser(u.id);
    void loadUsers(userPage, userSearch);
    void loadStats();
  };

  const taxWrap = async (fn: () => Promise<void>) => {
    setTaxError('');
    try { await fn(); await loadTaxonomy(); } catch { setTaxError('Action failed.'); }
  };

  if (accessDenied) {
    return (
      <>
        <Head><title>Admin — Access Denied</title></Head>
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h1 style={{ fontFamily: 'var(--serif)', color: 'var(--text)', marginBottom: 8 }}>Admin access required</h1>
            <p style={{ color: 'var(--text3)', marginBottom: 24 }}>You do not have permission to view this page.</p>
            <button className="btn-ghost" onClick={() => void router.push('/projects')}>← Back to projects</button>
          </div>
        </div>
      </>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stats', label: 'System Overview' },
    { key: 'users', label: 'User Management' },
    { key: 'entities', label: 'Global Entities' },
    { key: 'taxonomy', label: 'Taxonomy' },
  ];

  const pill = (color: string, text: string) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 10, fontFamily: 'var(--mono)',
      background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>{text}</span>
  );

  return (
    <>
      <Head><title>Admin Dashboard — UNDP Stakeholder Analysis</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
            <div style={{ maxWidth: 960, margin: '0 auto' }}>

              {/* Page header */}
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>Admin Dashboard</h1>
                <p style={{ fontSize: 13, color: 'var(--text3)' }}>System management and oversight</p>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                {tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      padding: '8px 16px', border: 'none', borderRadius: '6px 6px 0 0',
                      background: tab === t.key ? 'var(--bg2)' : 'transparent',
                      color: tab === t.key ? 'var(--text)' : 'var(--text3)',
                      fontSize: 13, cursor: 'pointer',
                      borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'all .15s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Stats tab ── */}
              {tab === 'stats' && (
                <div>
                  {statsLoading && <p style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</p>}
                  {stats && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
                        {[
                          { label: 'Total Users', value: stats.users, color: '#3d6fff' },
                          { label: 'Active Users', value: stats.active_users, color: '#2ec4a5' },
                          { label: 'Admin Users', value: stats.admin_users, color: '#9b6ef3' },
                          { label: 'Projects', value: stats.projects, color: '#f5a623' },
                          { label: 'Documents', value: stats.documents, color: '#f5a623' },
                          { label: 'Entities', value: stats.entities, color: '#2ec4a5' },
                          { label: 'Flagged Entities', value: stats.flagged_entities, color: '#f0614a' },
                          { label: 'Relations', value: stats.relations, color: '#3d6fff' },
                        ].map(s => (
                          <div key={s.label} style={{
                            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                            padding: '16px', textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: 'var(--mono)', marginBottom: 4 }}>
                              {s.value.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {s.label}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => void loadStats()}>
                        Refresh stats
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── Users tab ── */}
              {tab === 'users' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                      {userCount} user{userCount !== 1 ? 's' : ''}
                    </div>
                    <input
                      placeholder="Search by name or email…"
                      value={userSearch}
                      onChange={e => onUserSearch(e.target.value)}
                      style={{ width: 240, fontSize: 12 }}
                    />
                  </div>

                  {usersLoading ? (
                    <p style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</p>
                  ) : (
                    <>
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              {['Username', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                                <th key={h} style={{
                                  padding: '10px 14px', textAlign: 'left',
                                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)',
                                  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400,
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>{u.username}</td>
                                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 12 }}>{u.email}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  {u.is_admin ? pill('#9b6ef3', 'admin') : pill('#7b8299', 'user')}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {u.is_active ? pill('#2ec4a5', 'active') : pill('#f0614a', 'disabled')}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                                  {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      className="btn-ghost"
                                      style={{ fontSize: 11, padding: '3px 8px' }}
                                      onClick={() => void toggleAdmin(u)}
                                    >
                                      {u.is_admin ? 'Remove admin' : 'Make admin'}
                                    </button>
                                    <button
                                      className="btn-ghost"
                                      style={{ fontSize: 11, padding: '3px 8px' }}
                                      onClick={() => void toggleActive(u)}
                                    >
                                      {u.is_active ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                      style={{
                                        fontSize: 11, padding: '3px 8px', border: '1px solid rgba(240,97,74,0.4)',
                                        background: 'none', color: 'var(--coral)', borderRadius: 5, cursor: 'pointer',
                                      }}
                                      onClick={() => void deleteUser(u)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {userCount > 50 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button className="btn-ghost" style={{ fontSize: 12 }} disabled={userPage === 1} onClick={() => void loadUsers(userPage - 1, userSearch)}>← Prev</button>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Page {userPage}</span>
                          <button className="btn-ghost" style={{ fontSize: 12 }} disabled={userPage * 50 >= userCount} onClick={() => void loadUsers(userPage + 1, userSearch)}>Next →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Global Entities tab ── */}
              {tab === 'entities' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
                      Review and curate entities across all projects
                    </p>
                    <input
                      placeholder="Search entities…"
                      value={entitySearch}
                      onChange={e => { setEntitySearch(e.target.value); void loadEntities(1, e.target.value); }}
                      style={{ width: 220, fontSize: 12 }}
                    />
                  </div>

                  {entitiesLoading ? (
                    <p style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</p>
                  ) : (
                    <>
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              {['Name', 'Type', 'Projects', 'Documents', 'Confidence'].map(h => (
                                <th key={h} style={{
                                  padding: '10px 14px', textAlign: 'left',
                                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)',
                                  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400,
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {entities.map(e => (
                              <tr
                                key={e.id}
                                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                onClick={() => void router.push(`/entities`)}
                              >
                                <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>{e.canonical_name}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{e.entity_type}</span>
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 12 }}>{e.project_count}</td>
                                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 12 }}>{e.document_count}</td>
                                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                                  {e.confidence_min !== undefined && e.confidence_max !== undefined
                                    ? `${Math.round(e.confidence_min * 100)}–${Math.round(e.confidence_max * 100)}%`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button className="btn-ghost" style={{ fontSize: 12 }} disabled={entityPage === 1} onClick={() => void loadEntities(entityPage - 1, entitySearch)}>← Prev</button>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Page {entityPage}</span>
                        <button className="btn-ghost" style={{ fontSize: 12 }} disabled={entities.length < ENTITY_PAGE_SIZE} onClick={() => void loadEntities(entityPage + 1, entitySearch)}>Next →</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Taxonomy tab ── */}
              {tab === 'taxonomy' && (
                <div>
                  {taxError && <p style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 16 }}>{taxError}</p>}
                  {taxLoading ? (
                    <p style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</p>
                  ) : (
                    <div className="space-y-6">
                      <EntityLabelsPanel
                        labels={labels}
                        onCreate={(payload) => taxWrap(async () => { await createEntityLabel(payload); })}
                        onUpdate={(id, payload) => taxWrap(async () => { await updateEntityLabel(id, payload); })}
                        onDelete={(id) => taxWrap(async () => { await deleteEntityLabel(id); })}
                      />
                      <RelationshipTypesPanel
                        types={relTypes}
                        onCreate={(payload) => taxWrap(async () => { await createRelationshipType(payload); })}
                        onUpdate={(id, payload) => taxWrap(async () => { await updateRelationshipType(id, payload); })}
                        onDelete={(id) => taxWrap(async () => { await deleteRelationshipType(id); })}
                      />
                      <p style={{ fontSize: 11, color: 'var(--text3)' }}>Changes apply to the next extraction run.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
