import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { deleteProject, getProject, getProjectConceptNote, getProjectProviders, updateProjectProvider, updateProject, upsertProjectConceptNote, ProjectProviders, ProviderOption } from '@/lib/api';

export default function ProjectSettingsPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [providerData, setProviderData] = useState<ProjectProviders | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId)
      .then((p) => {
        setName(p.name);
        setDescription(p.description || '');
      })
      .catch(() => {
        setName('');
        setDescription('');
      });
    getProjectConceptNote(projectId).then((note) => setContent(note.content || '')).catch(() => setContent(''));
    getProjectProviders(projectId)
      .then(d => {
        setProviderData(d);
        setSelectedProvider(d.current_provider || '');
        setSelectedModel(d.current_model || '');
      })
      .catch(() => {});
  }, [projectId]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    setMessage('');
    try {
      await updateProject(projectId, { name: name.trim(), description: description.trim() });
      await upsertProjectConceptNote(projectId, { content, attachment });
      setMessage('Saved');
    } catch (err: any) {
      setMessage(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    if (!window.confirm('Delete this project and all associated documents/entities?')) {
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await deleteProject(projectId);
      await router.push('/');
    } catch (err: any) {
      setMessage(err.message || 'Project deletion failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Project Settings" subtitle={name || 'Concept note configuration'}>
      <div className="max-w-2xl card space-y-4">
        <input
          type="text"
          className="input-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
        />
        <textarea
          className="input-field min-h-[100px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Project description"
        />
        <textarea
          className="input-field min-h-[180px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Update concept note"
        />
        <input
          type="file"
          className="input-field"
          title="Concept note attachment"
          onChange={(e) => setAttachment(e.target.files?.[0] || null)}
        />
        {message && <p className="text-sm text-gray-600">{message}</p>}
        <div className="flex items-center gap-3">
          <button onClick={() => void handleSave()} disabled={saving} className="btn-primary w-fit">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={() => void handleDeleteProject()} disabled={saving} className="btn-ghost text-red-600 w-fit">
            Delete Project
          </button>
        </div>
      </div>

      {/* LLM Provider selection */}
      {providerData && (
        <div className="max-w-2xl card space-y-4 mt-4">
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)' }}>LLM Provider</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            Select which LLM provider and model to use for extraction, summaries, and queries in this project.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>PROVIDER</label>
              <select
                value={selectedProvider}
                onChange={e => {
                  setSelectedProvider(e.target.value);
                  const prov = providerData.providers.find((p: ProviderOption) => p.name === e.target.value);
                  setSelectedModel(prov?.models?.[0] || '');
                }}
                style={{ height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', padding: '0 10px', fontSize: 13 }}
              >
                {providerData.providers.map((p: ProviderOption) => (
                  <option key={p.name} value={p.name} disabled={!p.available}>
                    {p.name}{!p.available ? ' (not configured)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>MODEL</label>
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', padding: '0 10px', fontSize: 13 }}
              >
                {(providerData.providers.find((p: ProviderOption) => p.name === selectedProvider)?.models || []).map((m: string) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <button
              onClick={async () => {
                if (!projectId) return;
                setSavingProvider(true);
                try {
                  await updateProjectProvider(projectId, selectedProvider, selectedModel);
                  setMessage('Provider saved');
                } catch {
                  setMessage('Failed to save provider');
                } finally {
                  setSavingProvider(false);
                }
              }}
              disabled={savingProvider}
              className="btn-primary"
              style={{ height: 36, fontSize: 13 }}
            >
              {savingProvider ? 'Saving…' : 'Save Provider'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
