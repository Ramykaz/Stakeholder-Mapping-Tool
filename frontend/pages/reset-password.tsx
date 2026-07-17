import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { resetPassword } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { uid, token } = router.query as { uid?: string; token?: string };

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strengthColor = (score: number) => {
    if (score <= 1) return 'var(--coral)';
    if (score === 2) return 'var(--amber)';
    if (score === 3) return 'var(--teal)';
    return 'var(--accent)';
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!uid || !token) { setError('Invalid reset link. Please request a new one.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await resetPassword({ uid, token, new_password: password });
      setDone(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Reset link is invalid or has expired.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const pwScore = passwordStrength(password);

  return (
    <>
      <Head><title>Reset Password — UNDP Stakeholder Analysis</title></Head>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--text)', marginBottom: 8 }}>Set a new password</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28, lineHeight: 1.6 }}>
            Choose a strong password for your account.
          </p>

          {done ? (
            <div style={{ background: 'rgba(46,196,165,0.1)', border: '1px solid rgba(46,196,165,0.4)', borderRadius: 8, padding: '16px' }}>
              <p style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 12 }}>
                Password has been reset. You can now sign in with your new password.
              </p>
              <Link href="/login" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                Sign in →
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                  New password
                </label>
                <input
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                {password.length > 0 && (
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--border2)', marginTop: 6 }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${pwScore * 25}%`,
                      background: strengthColor(pwScore),
                      transition: 'width .3s, background .3s',
                    }}/>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && <p style={{ fontSize: 12, color: 'var(--coral)', margin: 0 }}>{error}</p>}

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Saving…' : 'Set password →'}
              </button>

              <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', margin: 0 }}>
                <Link href="/forgot-password" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  Request a new reset link
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
