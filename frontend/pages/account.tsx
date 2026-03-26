import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  getStoredAuthToken,
  getStoredAuthUser,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  AuthUser,
} from '@/lib/api';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  // Profile fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const detail = err?.response?.data?.detail || 'Failed to update profile.';
      setProfileError(detail);
    } finally {
      setProfileLoading(false);
    }
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
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to change password.';
      setPwError(detail);
    } finally {
      setPwLoading(false);
    }
  };

  const card = {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '24px',
    marginBottom: 24,
  } as React.CSSProperties;

  const sectionLabel = {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--text3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 16,
  };

  return (
    <>
      <Head><title>My Account — UNDP Stakeholder Analysis</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>

              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--text)', marginBottom: 32 }}>
                My Account
              </h1>

              {/* Profile info card */}
              <div style={card}>
                <div style={sectionLabel}>Profile</div>
                <form onSubmit={onUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                      Username
                    </label>
                    <input
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@undp.org"
                    />
                  </div>

                  {user && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      <span>Role: <span style={{ color: user.is_admin ? 'var(--accent)' : 'var(--text2)' }}>{user.is_admin ? 'Admin' : 'User'}</span></span>
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

              {/* Change password card */}
              <div style={card}>
                <div style={sectionLabel}>Change Password</div>
                <form onSubmit={onChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                      Current password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                      New password
                    </label>
                    <input
                      type="password"
                      placeholder="Min. 8 characters"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat new password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      required
                    />
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

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
