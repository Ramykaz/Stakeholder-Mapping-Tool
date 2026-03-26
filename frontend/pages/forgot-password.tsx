import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [debugPath, setDebugPath] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required.'); return; }
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      setSent(true);
      if (res._debug_reset_path) setDebugPath(res._debug_reset_path);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Forgot Password — UNDP Stakeholder Analysis</title></Head>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
            ← Back to sign in
          </Link>

          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--text)', marginBottom: 8 }}>Reset your password</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28, lineHeight: 1.6 }}>
            Enter the email address you registered with and we&apos;ll send you a reset link.
          </p>

          {sent ? (
            <div style={{ background: 'rgba(46,196,165,0.1)', border: '1px solid rgba(46,196,165,0.4)', borderRadius: 8, padding: '16px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--teal)', margin: 0 }}>
                If that email is registered, a reset link has been sent.
              </p>
              {debugPath && (
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, marginBottom: 0, fontFamily: 'var(--mono)' }}>
                  [DEBUG] <Link href={debugPath} style={{ color: 'var(--accent)' }}>{debugPath}</Link>
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@undp.org"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && <p style={{ fontSize: 12, color: 'var(--coral)', margin: 0 }}>{error}</p>}

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
