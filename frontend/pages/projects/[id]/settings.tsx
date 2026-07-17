import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import GuidancePanel from '@/components/GuidancePanel';
import { deleteProject, getProject, getProjectConceptNote, getProjectProviders, updateProjectProvider, updateProject, upsertProjectConceptNote, ProjectProviders, ProviderOption, testLLMConnection, LLMConnectionTestResponse } from '@/lib/api';

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
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<LLMConnectionTestResponse | null>(null);
  const [connectionError, setConnectionError] = useState('');

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

  const runConnectionTest = async () => {
    if (!selectedProvider || !selectedModel) return;
    setTestingConnection(true);
    setConnectionError('');
    try {
      const result = await testLLMConnection(selectedProvider, selectedModel);
      setConnectionResult(result);
      if (result.status === 'ok') {
        setMessage(`Connection OK (${result.latency_ms} ms)`);
      } else {
        setMessage(result.error_message || 'Connection test failed');
      }
    } catch (err: any) {
      setConnectionResult(null);
      setConnectionError(err.message || 'Connection test failed');
      setMessage(err.message || 'Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const providerEnvHint = (() => {
    if (selectedProvider === 'azure_openai') {
      return 'Requires: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION';
    }
    if (selectedProvider === 'openai') return 'Requires: OPENAI_API_KEY';
    if (selectedProvider === 'gemini') return 'Requires: GEMINI_API_KEY';
    return 'Requires: GROQ_API_KEY';
  })();

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
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--text)' }}>LLM Provider</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            Select which LLM provider and model to use for extraction, summaries, and queries in this project.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label htmlFor="provider-select" style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>PROVIDER</label>
              <select
                id="provider-select"
                title="Provider"
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
              <label htmlFor="model-select" style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>MODEL</label>
              <select
                id="model-select"
                title="Model"
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
                  setMessage('Provider saved. Testing connection…');
                  await runConnectionTest();
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
            <button
              onClick={() => void runConnectionTest()}
              disabled={testingConnection || !selectedProvider || !selectedModel}
              className="btn-ghost"
              style={{ height: 36, fontSize: 13 }}
            >
              {testingConnection ? 'Testing…' : 'Test connection'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
            {providerEnvHint}
          </p>
          {connectionResult && (
            <p style={{ fontSize: 12, color: connectionResult.status === 'ok' ? 'var(--teal)' : 'var(--coral)' }}>
              {connectionResult.status === 'ok'
                ? `Connection successful (${connectionResult.latency_ms} ms)`
                : (connectionResult.error_message || 'Connection test failed')}
            </p>
          )}
          {!connectionResult && connectionError && (
            <p style={{ fontSize: 12, color: 'var(--coral)' }}>{connectionError}</p>
          )}
        </div>
      )}

      {projectId ? <GuidancePanel projectId={projectId} /> : null}
    </Layout>
  );
}
