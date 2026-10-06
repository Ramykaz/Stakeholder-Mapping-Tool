import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  getStoredAuthToken,
  getStoredAuthUser,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  getUserFlaggedEntities,
  flagEntity,
  AuthUser,
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
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';
import EntityLabelsPanel from '@/components/admin/EntityLabelsPanel';
import RelationshipTypesPanel from '@/components/admin/RelationshipTypesPanel';

type Tab = 'profile' | 'security' | 'preferences' | 'taxonomy' | 'flagged';

const PREF_EMAIL_NOTIFICATIONS = 'pref_email_notifications';
const PREF_SHOW_CONFIDENCE = 'pref_show_confidence';

export default function AccountPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('profile');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.asPath]);

  // Profile
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Preferences (localStorage)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [showConfidenceScores, setShowConfidenceScores] = useState(true);

  // Taxonomy
  const [labels, setLabels] = useState<EntityLabelConfig[]>([]);
  const [relTypes, setRelTypes] = useState<RelationshipTypeConfig[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState('');

  // My flagged entities
  const [flaggedEntities, setFlaggedEntities] = useState<any[]>([]);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [flaggedLoading, setFlaggedLoading] = useState(false);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    const stored = getStoredAuthUser();
    if (stored) {
      setUser(stored);
      setUsername(stored.username);
      setEmail(stored.email);
    }
    getCurrentUser().then(u => {
      setUser(u);
      setUsername(u.username);
      setEmail(u.email);
    }).catch(() => {});

    const storedEmailNotif = localStorage.getItem(PREF_EMAIL_NOTIFICATIONS);
    const storedShowConf = localStorage.getItem(PREF_SHOW_CONFIDENCE);
    if (storedEmailNotif !== null) setEmailNotifications(storedEmailNotif === 'true');
    if (storedShowConf !== null) setShowConfidenceScores(storedShowConf === 'true');
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const loadFlagged = useCallback(async () => {
    setFlaggedLoading(true);
    try {
      const res = await getUserFlaggedEntities();
      setFlaggedEntities(res.flagged_entities);
      setFlaggedCount(res.count);
    } catch {} finally { setFlaggedLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'taxonomy') void loadTaxonomy();
    if (tab === 'flagged') void loadFlagged();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMsg('');
    setProfileLoading(true);
    try {
      const updated = await updateUserProfile({ username, email });
      setUser(updated);
      setProfileMsg('Profile updated successfully.');
    } catch (err: any) {
      setProfileError(err?.response?.data?.detail || 'Failed to update profile.');
    } finally { setProfileLoading(false); }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwMsg('');
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('New passwords do not match.'); return; }
    setPwLoading(true);
    try {
      await changePassword({ current_password: currentPw, new_password: newPw });
      setPwMsg('Password changed successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwError(err?.response?.data?.detail || 'Failed to change password.');
    } finally { setPwLoading(false); }
  };

  const taxWrap = async (fn: () => Promise<void>) => {
    setTaxError('');
    try { await fn(); await loadTaxonomy(); } catch { setTaxError('Action failed.'); }
  };

  const onUnflag = async (entityId: string) => {
    try {
      await flagEntity(entityId, false);
      void loadFlagged();
    } catch {}
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security' },
    { key: 'preferences', label: 'Preferences' },
    { key: 'taxonomy', label: 'My Taxonomy' },
    { key: 'flagged', label: `My Flagged Entities${flaggedCount > 0 ? ` (${flaggedCount})` : ''}` },
  ];

  const card: React.CSSProperties = {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 24,
    marginBottom: 24,
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left',
    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400,
  };

  return (
    <>
      <Head><title>My Account — UNDP Stakeholder Analysis</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation onMenuClick={() => setSidebarOpen(v => !v)} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="app-main">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>

              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--text)', marginBottom: 28 }}>
                My Account
              </h1>

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

              {/* ── Profile ── */}
              {tab === 'profile' && (
                <div style={card}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                    Profile Information
                  </div>
                  <form onSubmit={onUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Username</label>
                      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@undp.org" />
                    </div>
                    {user && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        Role: <span style={{ color: user.is_admin ? 'var(--accent)' : 'var(--text2)' }}>{user.is_admin ? 'Admin' : 'User'}</span>
                      </div>
                    )}
                    {profileError && <p style={{ fontSize: 12, color: 'var(--coral)', margin: 0 }}>{profileError}</p>}
                    {profileMsg && <p style={{ fontSize: 12, color: 'var(--teal)', margin: 0 }}>{profileMsg}</p>}
                    <div>
                      <button type="submit" className="btn-primary" disabled={profileLoading}>
                        {profileLoading ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Security ── */}
              {tab === 'security' && (
                <div style={card}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                    Change Password
                  </div>
                  <form onSubmit={onChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Current password</label>
                      <input type="password" placeholder="••••••••" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>New password</label>
                      <input type="password" placeholder="Min. 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Confirm new password</label>
                      <input type="password" placeholder="Repeat new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
                    </div>
                    {pwError && <p style={{ fontSize: 12, color: 'var(--coral)', margin: 0 }}>{pwError}</p>}
                    {pwMsg && <p style={{ fontSize: 12, color: 'var(--teal)', margin: 0 }}>{pwMsg}</p>}
                    <div>
                      <button type="submit" className="btn-ghost" disabled={pwLoading}>
                        {pwLoading ? 'Updating…' : 'Update password'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Preferences ── */}
              {tab === 'preferences' && (
                <div style={card}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Display Preferences
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, marginTop: 0 }}>
                    These preferences are stored locally in your browser.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={e => { setEmailNotifications(e.target.checked); localStorage.setItem(PREF_EMAIL_NOTIFICATIONS, String(e.target.checked)); }}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Email notifications for extraction completion</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Receive a notification when document processing finishes</div>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showConfidenceScores}
                        onChange={e => { setShowConfidenceScores(e.target.checked); localStorage.setItem(PREF_SHOW_CONFIDENCE, String(e.target.checked)); }}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Show confidence scores in graph</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Display entity confidence percentages as node labels in the relationship graph</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* ── My Taxonomy ── */}
              {tab === 'taxonomy' && (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>
                    Entity type labels, colors, and relationship type categories used across all projects.
                  </p>
                  {!user?.is_admin && (
                    <p style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 16 }}>
                      Viewing in read-only mode. Contact an admin to modify taxonomy settings.
                    </p>
                  )}
                  {user?.is_admin && (
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                      Changes apply globally to all projects and future extraction runs.
                    </p>
                  )}
                  {taxError && <p style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 16 }}>{taxError}</p>}
                  {taxLoading ? (
                    <p style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</p>
                  ) : (
                    <div className="space-y-6">
                      <EntityLabelsPanel
                        labels={labels}
                        readOnly={!user?.is_admin}
                        onCreate={(payload) => taxWrap(async () => { await createEntityLabel(payload); })}
                        onUpdate={(id, payload) => taxWrap(async () => { await updateEntityLabel(id, payload); await loadTaxonomy(); })}
                        onDelete={(id) => taxWrap(async () => { await deleteEntityLabel(id); })}
                      />
                      <RelationshipTypesPanel
                        types={relTypes}
                        readOnly={!user?.is_admin}
                        onCreate={(payload) => taxWrap(async () => { await createRelationshipType(payload); })}
                        onUpdate={(id, payload) => taxWrap(async () => { await updateRelationshipType(id, payload); await loadTaxonomy(); })}
                        onDelete={(id) => taxWrap(async () => { await deleteRelationshipType(id); })}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── My Flagged Entities ── */}
              {tab === 'flagged' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
                      Entities you have flagged as incorrect or irrelevant. Unflag to restore them to the graph.
                    </p>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => void loadFlagged()}>
                      Refresh
                    </button>
                  </div>

                  {flaggedLoading ? (
                    <p style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</p>
                  ) : flaggedEntities.length === 0 ? (
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 32, textAlign: 'center' }}>
                      <p style={{ color: 'var(--text3)', fontSize: 13, margin: 0 }}>You have not flagged any entities.</p>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {['Entity Name', 'Type', 'Project', 'Document', 'Actions'].map(h => (
                              <th key={h} style={thStyle}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {flaggedEntities.map((e: any) => (
                            <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>
                                <button
                                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0, textAlign: 'left' }}
                                  onClick={() => void router.push(`/projects/${e.project_id}/entities/${e.id}`)}
                                >
                                  {e.canonical_name}
                                </button>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{e.entity_type}</span>
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>
                                {e.project_name || '—'}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>
                                {e.document_name || '—'}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <button
                                  className="btn-ghost"
                                  style={{ fontSize: 11, padding: '3px 8px' }}
                                  onClick={() => void onUnflag(e.id)}
                                >
                                  Unflag
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
