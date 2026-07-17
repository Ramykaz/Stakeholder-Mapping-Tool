import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getProject,
  getProjectConceptNote,
  upsertProjectConceptNote,
  getStoredAuthToken,
  ProjectSummary,
} from '@/lib/api';
import TopNavigation from '@/components/layout/TopNavigation';
import Sidebar from '@/components/layout/Sidebar';
import ErrorMessage from '@/components/ErrorMessage';

const STEPS = ['Concept Note', 'Upload Documents', 'Build Graph'];

export default function SetupPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [conceptNote, setConceptNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) { void router.replace('/login'); return; }
    if (!id) return;
    // Redirect to the current Initiative Profile page (concept note is superseded by InitiativeProfile)
    void router.replace(`/projects/${id}/intake`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doSave = async (text: string) => {
    if (!id) return;
    setSaving(true);
    setSaved(false);
    try {
      await upsertProjectConceptNote(id, { content: text });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* silent — autosave failures don't block UX */
    } finally {
      setSaving(false);
    }
  };

  const onConceptNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setConceptNote(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSave(text), 1000);
  };

  const onSaveAndContinue = async () => {
    if (!id) return;
    await doSave(conceptNote);
    void router.push(`/projects/${id}/documents`);
  };

  const onSkip = () => void router.push(`/projects/${id}/documents`);

  return (
    <>
      <Head><title>Concept Note — {project?.name ?? 'Setup'}</title></Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <TopNavigation workspaceId={id} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar workspaceId={id} />
          <main style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>

              {/* Progress indicator */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
                {STEPS.map((label, i) => (
                  <React.Fragment key={label}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--mono)', fontSize: 12,
                        background: i === 0 ? 'var(--accent)' : 'transparent',
                        color: i === 0 ? '#fff' : 'var(--text2)',
                        border: i > 0 ? '1px solid var(--border2)' : 'none',
                      }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: 11, color: i === 0 ? 'var(--text)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 8px', marginBottom: 20 }}/>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Header */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: '#fff' }}>
                    Concept Note
                  </h1>
                  {saving && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>Saving…</span>
                  )}
                  {saved && !saving && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--teal)' }}>Saved ✓</span>
                  )}
                </div>
                <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
                  Describe the stakeholder landscape you want to map. This guides every AI extraction.{' '}
                  <span style={{ color: 'var(--text3)' }}>You can return here to update it at any time.</span>
                </p>
              </div>

              {error && (
                <div style={{ marginBottom: 16 }}>
                  <ErrorMessage message={error} />
                </div>
              )}

              {/* Textarea */}
              <textarea
                value={conceptNote}
                onChange={onConceptNoteChange}
                rows={12}
                placeholder={`Describe your project objectives and the stakeholder landscape you want to map.\n\nExample: "This project maps the stakeholder ecosystem for the AI for Good Uzbekistan Hackathon (March 2025). We are interested in: organizations involved in AI and tech policy, government ministries, international development organizations, and individual experts in the region."`}
                style={{ resize: 'vertical', minHeight: 240, lineHeight: 1.6 }}
              />

              {/* Character count */}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 6 }}>
                {conceptNote.length} chars
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 32 }}>
                <button onClick={onSkip} className="btn-ghost">
                  Skip for now
                </button>
                <button
                  onClick={() => void onSaveAndContinue()}
                  className="btn-primary"
                  disabled={saving}
                >
                  Save &amp; continue →
                </button>
              </div>

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
