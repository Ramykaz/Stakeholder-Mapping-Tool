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
  adminGetAllProjects,
  adminGetActivity,
  AdminStats,
  AdminUserRecord,
} from '@/lib/api';
import { Lock } from 'lucide-react';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';

type Tab = 'stats' | 'users' | 'projects' | 'activity' | 'config';

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stats');
  const [accessDenied, setAccessDenied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.asPath]);

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // All projects (admin view)
  const [projects, setProjects] = useState<any[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [projectPage, setProjectPage] = useState(1);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Activity log
  const [activity, setActivity] = useState<any[]>([]);
  const [activityCount, setActivityCount] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);

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

  const loadProjects = useCallback(async (page = 1, search = '') => {
    setProjectsLoading(true);
    try {
      const res = await adminGetAllProjects({ page, search });
      setProjects(res.results);
      setProjectCount(res.count);
      setProjectPage(page);
    } catch {} finally { setProjectsLoading(false); }
  }, []);

  const loadActivity = useCallback(async (page = 1) => {
    setActivityLoading(true);
    try {
      const res = await adminGetActivity({ page });
      setActivity(res.results);
      setActivityCount(res.count);
      setActivityPage(page);
    } catch {} finally { setActivityLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'users') void loadUsers(1, userSearch);
    if (tab === 'projects') void loadProjects(1, projectSearch);
    if (tab === 'activity') void loadActivity(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  if (accessDenied) {
    return (
      <>
        <Head><title>Admin — Access Denied</title></Head>
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text3)', marginBottom: 16 }}><Lock size={44} strokeWidth={1.5} /></div>
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
    { key: 'projects', label: 'All Projects' },
    { key: 'activity', label: 'Extraction Activity' },
    { key: 'config', label: 'System Config' },
  ];

  const pill = (color: string, text: string) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 10, fontFamily: 'var(--mono)',
      background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>{text}</span>
  );

  const statusColor = (s: string) => {
    if (s === 'completed') return '#2ec4a5';
    if (s === 'failed') return '#f0614a';
    if (s === 'running') return '#3d6fff';
    return '#7b8299';
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left',
    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400,
  };

  return (
    <>
      <Head><title>Admin Dashboard — UNDP Stakeholder Analysis</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation onMenuClick={() => setSidebarOpen(v => !v)} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="app-main">
            <div style={{ maxWidth: 1020, margin: '0 auto' }}>

              {/* Page header */}
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--text)', marginBottom: 4 }}>Admin Dashboard</h1>
                <p style={{ fontSize: 13, color: 'var(--text3)' }}>System-wide oversight and management</p>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
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

              {/* ── System Overview ── */}
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

              {/* ── User Management ── */}
              {tab === 'users' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                      {userCount} user{userCount !== 1 ? 's' : ''}
                    </div>
                    <input
                      placeholder="Search by name or email…"
                      value={userSearch}
                      onChange={e => { setUserSearch(e.target.value); void loadUsers(1, e.target.value); }}
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
                                <th key={h} style={thStyle}>{h}</th>
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

              {/* ── All Projects ── */}
              {tab === 'projects' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                      {projectCount} project{projectCount !== 1 ? 's' : ''} across all users
                    </div>
                    <input
                      placeholder="Search by name or owner…"
                      value={projectSearch}
                      onChange={e => { setProjectSearch(e.target.value); void loadProjects(1, e.target.value); }}
                      style={{ width: 240, fontSize: 12 }}
                    />
                  </div>

                  {projectsLoading ? (
                    <p style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</p>
                  ) : projects.length === 0 ? (
                    <p style={{ color: 'var(--text3)', fontSize: 13 }}>No projects found.</p>
                  ) : (
                    <>
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              {['Project Name', 'Owner', 'Documents', 'Entities', 'Created', 'Last Updated'].map(h => (
                                <th key={h} style={thStyle}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {projects.map((p: any) => (
                              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>
                                  {p.name}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{p.owner_username || '—'}</div>
                                  {p.owner_email && (
                                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.owner_email}</div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                                  {p.document_count ?? '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                                  {p.entity_count ?? '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                                  {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {projectCount > 25 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button className="btn-ghost" style={{ fontSize: 12 }} disabled={projectPage === 1} onClick={() => void loadProjects(projectPage - 1, projectSearch)}>← Prev</button>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Page {projectPage}</span>
                          <button className="btn-ghost" style={{ fontSize: 12 }} disabled={projects.length < 25} onClick={() => void loadProjects(projectPage + 1, projectSearch)}>Next →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Extraction Activity ── */}
              {tab === 'activity' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
                      Recent extraction runs across all users and projects
                    </p>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => void loadActivity(activityPage)}>
                      Refresh
                    </button>
                  </div>

                  {activityLoading ? (
                    <p style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</p>
                  ) : activity.length === 0 ? (
                    <p style={{ color: 'var(--text3)', fontSize: 13 }}>No extraction activity found.</p>
                  ) : (
                    <>
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              {['Document', 'Project', 'Owner', 'Provider', 'Model', 'Status', 'Cost', 'Date'].map(h => (
                                <th key={h} style={thStyle}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activity.map((run: any) => (
                              <tr key={run.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {run.document_name || '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {run.project_name || '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>
                                  {run.owner_username || '—'}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                                    {run.provider || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                                    {run.model || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {pill(statusColor(run.status || ''), run.status || 'unknown')}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                                  {run.cost_usd != null && Number(run.cost_usd) > 0 ? `$${Number(run.cost_usd).toFixed(4)}` : '—'}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                                  {run.created_at ? new Date(run.created_at).toLocaleString() : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {activityCount > 50 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button className="btn-ghost" style={{ fontSize: 12 }} disabled={activityPage === 1} onClick={() => void loadActivity(activityPage - 1)}>← Prev</button>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Page {activityPage}</span>
                          <button className="btn-ghost" style={{ fontSize: 12 }} disabled={activity.length < 50} onClick={() => void loadActivity(activityPage + 1)}>Next →</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── System Config ── */}
              {tab === 'config' && (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
                    Read-only system configuration. These values are set via environment variables on the server.
                  </p>
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                      LLM Configuration
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Default Provider</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px' }}>
                          {process.env.NEXT_PUBLIC_NER_DEFAULT_PROVIDER || 'configured via NER_DEFAULT_PROVIDER env var'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Default Model</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px' }}>
                          {process.env.NEXT_PUBLIC_NER_DEFAULT_MODEL || 'configured via NER_DEFAULT_MODEL env var'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                      Available Providers
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {['groq', 'openai', 'azure_openai', 'gemini'].map(p => (
                        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', width: 120 }}>{p}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                            API key required via environment variable
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                    To change these values, update environment variables on the backend server and restart the service.
                    Project-level provider overrides can be configured on each project&apos;s settings page.
                  </p>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
