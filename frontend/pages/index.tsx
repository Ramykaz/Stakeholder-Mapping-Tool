import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getStoredAuthToken } from '@/lib/api';
import { enterDemoMode, DEMO_PROJECT_ID } from '@/lib/demoData';
import TopNavigation from '@/components/layout/TopNavigation';
import { Compass, ScanSearch, ClipboardList, FileText } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  // T012: If authenticated, redirect to projects dashboard
  useEffect(() => {
    if (getStoredAuthToken()) {
      void router.replace('/projects');
    }
  }, [router]);

  const onViewDemo = () => {
    enterDemoMode();
    void router.push(`/projects/${DEMO_PROJECT_ID}/map`);
  };

  return (
    <>
      <Head>
        <title>UNDP Stakeholder Analysis Tool</title>
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation />

        {/* Hero */}
        <section className="hero-section" style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          padding: '120px 48px 80px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(rgba(61,111,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(61,111,255,0.04) 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 80%)',
          }}/>
          {/* Radial glow */}
          <div style={{
            position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 700, height: 400, pointerEvents: 'none',
            background: 'radial-gradient(ellipse, rgba(61,111,255,0.07) 0%, transparent 70%)',
          }}/>

          {/* Eyebrow */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
            marginBottom: 24, opacity: 0, animation: 'fadeUp .6s .2s forwards',
          }}>
            <div style={{ width: 24, height: 1, background: 'var(--accent)', opacity: 0.4 }}/>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--accent)',
            }}>Evidence-Backed Stakeholder Mapping</span>
            <div style={{ width: 24, height: 1, background: 'var(--accent)', opacity: 0.4 }}/>
          </div>

          {/* H1 */}
          <h1 style={{
            fontFamily: 'var(--serif)', fontSize: 'clamp(42px, 6vw, 68px)',
            color: '#fff', lineHeight: 1.08, maxWidth: 800, margin: '0 auto 24px',
            opacity: 0, animation: 'fadeUp .6s .35s forwards',
          }}>
            Map who matters — and why they connect
          </h1>

          {/* Subheading */}
          <p style={{
            fontSize: 17, color: 'var(--text2)', maxWidth: 520,
            lineHeight: 1.7, margin: '0 auto 40px',
            opacity: 0, animation: 'fadeUp .6s .5s forwards',
          }}>
            Follow the full UNDP workflow: initiative profile, source upload, analyze,
            graph review, SMQ/report generation, stakeholder table, and export.
          </p>

          {/* CTAs */}
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
            opacity: 0, animation: 'fadeUp .6s .65s forwards',
          }}>
            <button onClick={onViewDemo} className="btn-primary btn-primary-lg">
              View live demo
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
            <Link href="/login?tab=register" className="btn-ghost" style={{ padding: '13px 28px', fontSize: 15, borderRadius: 10 }}>
              Get started
            </Link>
          </div>
          <p style={{
            fontSize: 12, color: 'var(--text3)', marginTop: 16,
            opacity: 0, animation: 'fadeUp .6s .7s forwards',
          }}>
            The demo runs on sample data and skips the live backend, so it&apos;s always fast to explore.
          </p>

          {/* Capability pillars */}
          <div className="pillars-grid" style={{ marginTop: 72, opacity: 0, animation: 'fadeUp .6s .8s forwards' }}>
            {[
              { icon: Compass, l: 'Initiative-profile first' },
              { icon: ScanSearch, l: 'Analyze + graph review' },
              { icon: ClipboardList, l: 'SMQ + report workflow' },
              { icon: FileText, l: 'Stakeholder table + export' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ color: 'var(--accent)' }}><s.icon size={26} strokeWidth={1.75} /></div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text3)', letterSpacing: '0.03em' }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features grid */}
        <section style={{ padding: '80px 48px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div className="section-label">Capabilities</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(24px,3vw,38px)', color: '#fff', maxWidth: 500, marginBottom: 48 }}>
            Aligned to the latest UNDP workflow
          </h2>

          <div className="feature-grid" style={{
            display: 'grid',
            gap: 1, background: 'var(--border)', borderRadius: 16, overflow: 'hidden',
          }}>
            {[
              { bg: 'var(--accent-soft)', border: 'var(--border2)', title: 'Initiative-profile setup', body: 'Start each project with structured initiative context so downstream extraction and generation stay focused.' },
              { bg: 'var(--teal-soft)', border: 'var(--border2)', title: 'Document and web ingestion', body: 'Upload PDFs, DOCX, TXT, Markdown, or add web sources through one ingestion pipeline.' },
              { bg: 'var(--purple-soft)', border: 'var(--border2)', title: 'Analyze pipeline', body: 'Run extraction with provider controls, process incrementally, and monitor runs in real time.' },
              { bg: 'var(--amber-soft)', border: 'var(--border2)', title: 'Graph review and correction', body: 'Review entities and relationships with evidence excerpts, then relabel, merge, or remove inline.' },
              { bg: 'var(--coral-soft)', border: 'var(--border2)', title: 'SMQ + report generation', body: 'Generate section-focused SMQ outputs and report content with project evidence grounding.' },
              { bg: 'rgba(255,255,255,0.04)', border: 'var(--border2)', title: 'Stakeholder table and export', body: 'Produce priority tables, personas/workplans, then export deliverables for operations.' },
            ].map(card => (
              <div
                key={card.title}
                style={{ background: 'var(--bg2)', padding: '32px 28px', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, marginBottom: 18,
                  background: card.bg, border: `1px solid ${card.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text2)' }}>
                    <circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="2"/><line x1="12" y1="6" x2="12" y2="9"/>
                    <circle cx="20" cy="18" r="2"/><line x1="14" y1="13" x2="19" y2="17"/>
                    <circle cx="4" cy="18" r="2"/><line x1="10" y1="13" x2="5" y2="17"/>
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{card.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>{card.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" style={{
          padding: '100px 48px', background: 'var(--bg2)',
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="section-label">Process</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(24px,3vw,38px)', color: '#fff', marginBottom: 64 }}>
              How it works today
            </h2>
            <div className="process-grid" style={{ display: 'grid', gap: 14 }}>
              {[
                { n: '01', title: 'Initiative profile', body: 'Define project scope, geography, and objectives to seed the workflow context.' },
                { n: '02', title: 'Upload and process sources', body: 'Add files and web inputs; chunking and embeddings run through ingestion.' },
                { n: '03', title: 'Analyze', body: 'Run entity and relation extraction with provider/model controls and run tracking.' },
                { n: '04', title: 'Graph review', body: 'Inspect evidence-backed entities/relationships and correct issues before generation.' },
                { n: '05', title: 'SMQ + report generation', body: 'Generate section-focused SMQ outputs and narrative report sections.' },
                { n: '06', title: 'Stakeholder table', body: 'Build priority scoring and action-ready stakeholder table outputs.' },
                { n: '07', title: 'Export', body: 'Export report deliverables and stakeholder artifacts for downstream use.' },
              ].map((step) => (
                <div key={step.n} style={{ padding: '18px 18px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--mono)', fontSize: 13,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    border: '1px solid var(--border2)',
                  }}>
                    {step.n}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 16, marginBottom: 8 }}>{step.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>{step.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section style={{ padding: '100px 48px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(26px,4vw,44px)', color: '#fff', maxWidth: 560, margin: '0 auto 16px' }}>
            Ready to run the new stakeholder workflow?
          </h2>
          <p style={{ color: 'var(--text2)', marginBottom: 32 }}>
            From source ingestion to validated insights, all in one workspace.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={onViewDemo} className="btn-primary btn-primary-lg">
              View live demo
            </button>
            <Link href="/login?tab=register" className="btn-ghost" style={{ padding: '13px 28px', fontSize: 15, borderRadius: 10 }}>
              Create a free account
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="site-footer" style={{
          borderTop: '1px solid var(--border)', padding: '28px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--text2)' }}>
              UNDP Stakeholder Analysis Tool
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Built at UNDP SDG AI Lab
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy', 'Terms', 'Docs'].map(l => (
              <a key={l} href="#" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </footer>
      </div>

      <style jsx>{`
        .pillars-grid {
          display: grid;
          gap: 28px;
          width: 100%;
          max-width: 980px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .feature-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .process-grid {
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }

        @media (max-width: 1200px) {
          .process-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 1000px) {
          .feature-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pillars-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .hero-section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          .feature-grid,
          .process-grid,
          .pillars-grid {
            grid-template-columns: 1fr;
          }

          .site-footer {
            flex-direction: column !important;
            align-items: flex-start !important;
            padding: 20px !important;
          }
        }
      `}</style>
    </>
  );
}
