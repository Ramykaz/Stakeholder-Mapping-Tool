import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { loginUser } from '@/lib/api';
import { FileText, Network, Map } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Register fields
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Read tab from query param
  useEffect(() => {
    if (router.isReady) {
      if (router.query.tab === 'register') setActiveTab('register');
      else setActiveTab('signin');
    }
  }, [router.isReady, router.query.tab]);

  const switchTab = (tab: 'signin' | 'register') => {
    setActiveTab(tab);
    setError('');
    setRegError('');
    void router.replace({ pathname: '/login', query: tab === 'register' ? { tab: 'register' } : {} }, undefined, { shallow: true });
  };

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

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password)     { setError('Password is required.'); return; }
    setLoading(true);
    try {
      await loginUser({ username: email, password });
      await router.push('/projects');
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regEmail.trim())    { setRegError('Email is required.'); return; }
    if (regPassword.length < 8) { setRegError('Password must be at least 8 characters.'); return; }
    setRegLoading(true);
    try {
      const { registerUser } = await import('@/lib/api');
      await registerUser({ username: regEmail, email: regEmail, password: regPassword });
      await router.push('/projects');
    } catch (err: any) {
      setRegError(err.message || 'Registration failed.');
    } finally {
      setRegLoading(false);
    }
  };

  const pwScore = passwordStrength(regPassword);

  return (
    <>
      <Head><title>Sign in — UNDP Stakeholder Analysis</title></Head>
      <div className="auth-screen" style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>

        {/* Left panel */}
        <div className="auth-panel-left" style={{
          flex: '0 0 52%', background: 'var(--bg2)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', padding: '40px 48px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `linear-gradient(rgba(61,111,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(61,111,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
          }}/>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'auto', position: 'relative' }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8">
                <circle cx="8" cy="8" r="2"/>
                <circle cx="8" cy="2.5" r="1.5"/><line x1="8" y1="4" x2="8" y2="6"/>
                <circle cx="13" cy="11" r="1.5"/><line x1="9.2" y1="8.8" x2="11.8" y2="10.2"/>
                <circle cx="3" cy="11" r="1.5"/><line x1="6.8" y1="8.8" x2="4.2" y2="10.2"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: '#fff' }}>
              UNDP Stakeholder Analysis
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
            <h2 className="auth-hero-title" style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px,3vw,40px)', color: '#fff', lineHeight: 1.15, marginBottom: 16 }}>
              Map who matters —{' '}
              <em style={{ color: 'var(--teal)', fontStyle: 'italic' }}>and why they connect</em>
            </h2>
            <p className="auth-hero-copy" style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 400, marginBottom: 40 }}>
              Upload policy documents and let AI extract a living network of stakeholders.
            </p>

            <svg className="auth-hero-graphic" width="280" height="160" viewBox="0 0 280 160" fill="none" style={{ marginBottom: 40, opacity: 0.6 }}>
              <circle cx="140" cy="80" r="14" fill="var(--accent)" opacity="0.9"/>
              <circle cx="60"  cy="40" r="9"  fill="var(--teal)"   opacity="0.8"/>
              <circle cx="220" cy="40" r="9"  fill="var(--purple)" opacity="0.8"/>
              <circle cx="40"  cy="120" r="8" fill="var(--amber)"  opacity="0.7"/>
              <circle cx="240" cy="120" r="8" fill="var(--teal)"   opacity="0.7"/>
              <circle cx="140" cy="140" r="7" fill="var(--coral)"  opacity="0.7"/>
              <line x1="140" y1="80" x2="60"  y2="40"  stroke="var(--border2)" strokeWidth="1.5"/>
              <line x1="140" y1="80" x2="220" y2="40"  stroke="var(--border2)" strokeWidth="1.5"/>
              <line x1="140" y1="80" x2="40"  y2="120" stroke="var(--border2)" strokeWidth="1.5"/>
              <line x1="140" y1="80" x2="240" y2="120" stroke="var(--border2)" strokeWidth="1.5"/>
              <line x1="140" y1="80" x2="140" y2="140" stroke="var(--border2)" strokeWidth="1.5"/>
              <line x1="60"  y1="40" x2="220" y2="40"  stroke="var(--border2)" strokeWidth="1"/>
            </svg>

            <div className="auth-feature-list" style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: FileText, text: 'Upload PDFs, DOCX, TXT, or Markdown files' },
                  { icon: Network, text: 'LLM extracts entities & relationships' },
                  { icon: Map, text: 'Explore an interactive knowledge graph' },
                ].map(f => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><f.icon size={16} strokeWidth={1.75} /></span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="auth-panel-right" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '48px 40px', flexDirection: 'column',
        }}>
          {/* Back link */}
          <div style={{ width: '100%', maxWidth: 420, marginBottom: 20 }}>
            <Link href="/" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              ← Back to home
            </Link>
          </div>

          <div style={{ width: '100%', maxWidth: 420 }}>
            {/* Tab switcher */}
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 3, display: 'flex', marginBottom: 32,
            }}>
              {(['signin', 'register'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 400,
                    border: activeTab === tab ? '1px solid var(--border2)' : '1px solid transparent',
                    background: activeTab === tab ? 'var(--bg3)' : 'transparent',
                    color: activeTab === tab ? 'var(--text)' : 'var(--text2)',
                    cursor: 'pointer', transition: 'all .15s',
                    fontFamily: 'var(--sans)',
                  }}
                >
                  {tab === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            {/* Sign in form */}
            {activeTab === 'signin' && (
              <form onSubmit={onSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="you@undp.org"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>Password</label>
                    <Link href="/forgot-password" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p style={{ fontSize: 12, color: 'var(--coral)', margin: 0 }}>{error}</p>
                )}

                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in →'}
                </button>

                <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', margin: 0 }}>
                  No account?{' '}
                  <button type="button" onClick={() => switchTab('register')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                    Create one free
                  </button>
                </p>
              </form>
            )}

            {/* Register form */}
            {activeTab === 'register' && (
              <form onSubmit={onRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>First name</label>
                    <input placeholder="First" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Last name</label>
                    <input placeholder="Last" value={regLastName} onChange={e => setRegLastName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Work email</label>
                  <input type="email" placeholder="you@undp.org" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>Password</label>
                  <input type="password" placeholder="Min. 8 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
                  {regPassword.length > 0 && (
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

                {regError && (
                  <p style={{ fontSize: 12, color: 'var(--coral)', margin: 0 }}>{regError}</p>
                )}

                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={regLoading}>
                  {regLoading ? 'Creating account…' : 'Create account →'}
                </button>

                <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchTab('signin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, padding: 0 }}>
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
