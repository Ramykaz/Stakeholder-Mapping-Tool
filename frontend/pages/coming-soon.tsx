import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Construction } from 'lucide-react';

const FEATURE_LABELS: Record<string, string> = {
  login: 'Signing in',
  register: 'Creating an account',
  projects: 'Loading your projects',
  documents: 'Document analysis',
  graph: 'The knowledge graph',
  report: 'Report generation',
};

export default function ComingSoon() {
  const router = useRouter();
  const featureKey = typeof router.query.feature === 'string' ? router.query.feature : undefined;
  const featureLabel = featureKey ? FEATURE_LABELS[featureKey] ?? featureKey : undefined;

  return (
    <>
      <Head>
        <title>Coming Soon — UNDP Stakeholder Analysis Tool</title>
      </Head>
      <main className="error-page-root">
        <section className="error-page-card" style={{ maxWidth: 440, padding: '0 24px' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'var(--amber-soft)', color: 'var(--amber)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Construction size={32} strokeWidth={1.5} />
          </div>

          <div className="section-label" style={{ justifyContent: 'center' }}>
            <span>Coming soon</span>
          </div>

          <h1 className="error-page-title" style={{ fontSize: 28, marginTop: 12 }}>
            {featureLabel ? `${featureLabel} is coming soon` : 'This feature is coming soon'}
          </h1>

          <p className="error-page-message" style={{ maxWidth: 380, margin: '0 auto 28px' }}>
            We&apos;re putting the finishing touches on this. Please check back shortly.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn-primary">
              Back to home
            </Link>
            <button className="btn-ghost" onClick={() => router.reload()}>
              Try again
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
