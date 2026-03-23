import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getStoredAuthToken } from '@/lib/api';
import TopNavigation from '@/components/layout/TopNavigation';

export default function Home() {
  const router = useRouter();

  // T012: If authenticated, redirect to projects dashboard
  useEffect(() => {
    if (getStoredAuthToken()) {
      void router.replace('/projects');
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>UNDP Stakeholder Analysis Tool</title>
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation />

        {/* Hero */}
        <section style={{
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
            }}>AI-Powered Stakeholder Mapping</span>
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
            Upload policy documents and let AI extract an interactive network of
            stakeholders — guided by your project context. Built for UNDP analysts
            and program teams.
          </p>

          {/* CTAs */}
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
            opacity: 0, animation: 'fadeUp .6s .65s forwards',
          }}>
            <Link href="/login?tab=register" className="btn-primary btn-primary-lg">
              Get started
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </Link>
            <a href="#how" className="btn-ghost" style={{ padding: '13px 28px', fontSize: 15, borderRadius: 10 }}>
              See how it works
            </a>
          </div>

          {/* Capability pillars */}
          <div style={{
            display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap',
            marginTop: 72, opacity: 0, animation: 'fadeUp .6s .8s forwards',
          }}>
            {[
              { icon: '🗂️', l: 'Multi-document ingestion' },
              { icon: '🔗', l: 'Relation extraction' },
              { icon: '🔍', l: 'Natural-language queries' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 26 }}>{s.icon}</div>
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
            Purpose-built for stakeholder mapping
          </h2>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
            gap: 1, background: 'var(--border)', borderRadius: 16, overflow: 'hidden',
          }}>
            {[
              { bg: 'rgba(61,111,255,0.08)',  border: 'rgba(61,111,255,0.2)',  title: 'Concept-guided extraction',  body: 'Write a concept note and the LLM extracts only contextually relevant entities — not every name in the document.' },
              { bg: 'rgba(46,196,165,0.08)',  border: 'rgba(46,196,165,0.2)',  title: 'Interactive knowledge graph', body: 'Explore a live network of nodes and edges. Filter by entity type, focus on clusters, trace relationship paths.' },
              { bg: 'rgba(155,110,243,0.08)', border: 'rgba(155,110,243,0.2)', title: 'Entity detail profiles',      body: 'Click any node for a full profile: description, all relationships, source documents, and an AI-generated role summary.' },
              { bg: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.2)',  title: 'Natural language queries',    body: "Ask questions in plain English: 'Who funds this ecosystem?' or 'What connects these two organizations?'" },
              { bg: 'rgba(240,97,74,0.08)',   border: 'rgba(240,97,74,0.2)',   title: 'Global entity registry',      body: 'The same entity across projects exists once globally. Relationships are scoped per project — no duplication.' },
              { bg: 'rgba(255,255,255,0.04)', border: 'var(--border2)',         title: 'Multi-document processing',  body: 'Upload PDFs, DOCX, and text files. The graph grows incrementally as each document is processed.' },
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
              From documents to insight in four steps
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 24, left: '12.5%', right: '12.5%',
                height: 1, background: 'var(--border2)', zIndex: 0,
              }}/>
              {[
                { n: '01', title: 'Create a project',    body: 'Name it and write a concept note describing the stakeholder context you care about.' },
                { n: '02', title: 'Write a concept note', body: 'Tell the AI what this project is about and which stakeholder types matter. This guides every extraction.' },
                { n: '03', title: 'Upload documents',     body: 'Drop in PDFs, Word files, or text articles. Any combination of project-relevant files.' },
                { n: '04', title: 'Explore the map',      body: 'Navigate the graph, click nodes for detail, filter by type, and query in natural language.' },
              ].map((step, i) => (
                <div key={step.n} style={{ padding: '0 20px', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--mono)', fontSize: 13,
                    background: i === 0 ? 'var(--accent)' : 'var(--bg2)',
                    color:       i === 0 ? '#fff' : 'var(--text2)',
                    border:      i === 0 ? 'none' : '1px solid var(--border2)',
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
            Ready to map your stakeholder network?
          </h2>
          <p style={{ color: 'var(--text2)', marginBottom: 32 }}>
            Used by UNDP policy analysts and program teams worldwide.
          </p>
          <Link href="/login?tab=register" className="btn-primary btn-primary-lg">
            Create a free account
          </Link>
        </section>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid var(--border)', padding: '28px 48px',
          display: 'flex', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--text2)' }}>
            UNDP Stakeholder Analysis Tool
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 16 }}>
            Built at UNDP SDG AI Lab
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
            {['Privacy', 'Terms', 'Docs'].map(l => (
              <a key={l} href="#" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
}
