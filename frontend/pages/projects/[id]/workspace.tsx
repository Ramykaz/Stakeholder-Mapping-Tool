import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import {
  DocumentSummary,
  deleteDocument,
  extractEntitiesForProject,
  generateEntitySummary,
  getEntityProfile,
  getProject,
  getProjectConceptNote,
  getDocuments,
  getProjectGraph,
  uploadDocumentToProject,
} from '@/lib/api';
import { CytoscapeEdge, CytoscapeNode } from '@/types';

export default function ProjectWorkspacePage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : '';
  const GROQ_MODEL = 'llama-3.1-8b-instant';
  const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-5-mini', 'gpt-5-nano'] as const;
  const AZURE_OPENAI_MODELS = ['gpt-5-mini'] as const;
  const GEMINI_MODELS = ['gemini-1.5-pro', 'gemini-1.5-flash'] as const;
  type Provider = 'groq' | 'openai' | 'azure_openai' | 'gemini';
  type EntityType = CytoscapeNode['data']['entity_type'];

  const [projectName, setProjectName] = useState('Project Workspace');
  const [conceptPreview, setConceptPreview] = useState('');
  const [documents, setDocuments] = useState<(DocumentSummary & { project_id?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>('groq');
  const [openaiModel, setOpenaiModel] = useState<(typeof OPENAI_MODELS)[number]>('gpt-5-mini');
  const [azureModel, setAzureModel] = useState<(typeof AZURE_OPENAI_MODELS)[number]>('gpt-5-mini');
  const [geminiModel, setGeminiModel] = useState<(typeof GEMINI_MODELS)[number]>('gemini-1.5-pro');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'assistant' | 'user'; text: string }>>([
    { role: 'assistant', text: 'Workspace ready. Upload a file, select a document on the left, then run extraction.' },
  ]);
  const [graphNodes, setGraphNodes] = useState<CytoscapeNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<CytoscapeEdge[]>([]);

  const relationKey = (edge: CytoscapeEdge) => edge.relation_type || edge.label || 'UNKNOWN';

  const workspaceAvailableEntityTypes = useMemo<EntityType[]>(
    () => Array.from(new Set(graphNodes.map((node: CytoscapeNode) => node.data.entity_type))).sort(),
    [graphNodes],
  );

  const workspaceAvailableRelationTypes = useMemo(
    () => Array.from(new Set(graphEdges.map((edge: CytoscapeEdge) => relationKey(edge)))).sort(),
    [graphEdges],
  );

  const reload = useCallback(async () => {
    if (!projectId) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [project, concept, docs] = await Promise.all([
        getProject(projectId),
        getProjectConceptNote(projectId).catch(() => ({ content: '' } as any)),
        getDocuments(),
      ]);
      setProjectName(project.name || 'Project Workspace');
      setConceptPreview((concept?.content || '').trim());
      const projectDocs = (docs || []).filter((row: any) => row.project_id === projectId);
      setDocuments(projectDocs);
      const graph = await getProjectGraph(projectId).catch(() => ({ nodes: [], edges: [] }));
      setGraphNodes(graph.nodes || []);
      setGraphEdges(graph.edges || []);
      setSelectedDocId((prev) => {
        if (prev && projectDocs.some((doc: any) => doc.id === prev)) {
          return prev;
        }
        return projectDocs[0]?.id || null;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load workspace');
      setDocuments([]);
      setSelectedDocId(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onUpload = async (file: File | null) => {
    if (!projectId || !file) {
      return;
    }
    setUploading(true);
    setError('');
    try {
      await uploadDocumentToProject(projectId, file);
      await reload();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (docId: string) => {
    if (!window.confirm('Delete this document and extracted records?')) {
      return;
    }
    setActiveDoc(docId);
    setError('');
    try {
      await deleteDocument(docId);
      if (selectedDocId === docId) {
        setSelectedDocId(null);
      }
      await reload();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setActiveDoc(null);
    }
  };

  const onExtract = async (docId: string) => {
    if (!projectId) {
      return;
    }
    setActiveDoc(docId);
    setError('');
    try {
      const model = provider === 'openai'
        ? openaiModel
        : provider === 'azure_openai'
          ? azureModel
          : provider === 'gemini'
            ? geminiModel
            : GROQ_MODEL;
      const result = await extractEntitiesForProject(projectId, docId, { provider, model });
      await reload();
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Extraction done for selected document. Entities: ${result.entities_created || 0}, relations: ${result.relations_created || 0}. Provider: ${result.provider || provider}.`,
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Extraction failed');
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Extraction failed: ${err.message || 'Unknown error'}`,
        },
      ]);
    } finally {
      setActiveDoc(null);
    }
  };

  const onExtractAll = async () => {
    if (!projectId || documents.length === 0) {
      return;
    }
    setActiveDoc('all');
    setError('');
    try {
      const model = provider === 'openai'
        ? openaiModel
        : provider === 'azure_openai'
          ? azureModel
          : provider === 'gemini'
            ? geminiModel
            : GROQ_MODEL;
      const result = await extractEntitiesForProject(projectId, undefined, { provider, model });
      await reload();
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Project-wide extraction done. Documents: ${result.documents_processed || documents.length}, entities: ${result.entities_created || 0}, relations: ${result.relations_created || 0}.`,
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Project extraction failed');
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Project extraction failed: ${err.message || 'Unknown error'}`,
        },
      ]);
    } finally {
      setActiveDoc(null);
    }
  };

  const handleChatSubmit = async () => {
    const prompt = chatInput.trim();
    if (!prompt) {
      return;
    }

    setChatMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    setChatInput('');

    const normalized = prompt.toLowerCase();
    if (normalized.includes('extract all')) {
      if (!projectId || documents.length === 0) {
        setChatMessages((prev) => [...prev, { role: 'assistant', text: 'No documents available for extraction yet.' }]);
        return;
      }

      setChatMessages((prev) => [...prev, { role: 'assistant', text: 'Running extraction on all project documents…' }]);
      await onExtractAll();
      setChatMessages((prev) => [...prev, { role: 'assistant', text: 'Extraction complete. You can open Entities or Graph now.' }]);
      return;
    }

    if (normalized.includes('extract selected')) {
      if (!selectedDocId) {
        setChatMessages((prev) => [...prev, { role: 'assistant', text: 'No selected document. Pick one from the left sidebar first.' }]);
        return;
      }
      await onExtract(selectedDocId);
      return;
    }

    if (normalized.includes('open graph')) {
      await router.push(`/graph?project_id=${projectId}`);
      return;
    }

    if (normalized.includes('open relations')) {
      const target = selectedDocId
        ? `/relations?project_id=${projectId}&document_id=${selectedDocId}`
        : `/relations?project_id=${projectId}`;
      await router.push(target);
      return;
    }

    if (normalized.includes('open entities')) {
      await router.push(`/entities?project_id=${projectId}`);
      return;
    }

    if (normalized.includes('settings')) {
      await router.push(`/projects/${projectId}/settings`);
      return;
    }

    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: 'Try: "extract selected", "extract all documents", "open relations", "open graph", "open entities", or "settings".',
      },
    ]);
  };

  const selectedModel = provider === 'openai'
    ? openaiModel
    : provider === 'azure_openai'
      ? azureModel
      : provider === 'gemini'
        ? geminiModel
        : GROQ_MODEL;

  const selectedDoc = documents.find((doc) => doc.id === selectedDocId) || null;

  return (
    <Layout title={projectName} subtitle="Project workspace">
      {/* Map navigation link */}
      {projectId && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => void router.push(`/projects/${projectId}/map`)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'var(--mono)' }}
          >
            ← Graph Map
          </button>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>·</span>
          <button
            onClick={() => void router.push(`/projects/${projectId}/documents`)}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'var(--mono)' }}
          >
            Documents
          </button>
        </div>
      )}
      <div className="h-[calc(100vh-160px)] min-h-[620px] flex gap-4">
        <aside className="group card w-16 hover:w-80 transition-all duration-200 overflow-hidden flex flex-col">
          <p className="text-xs uppercase tracking-wider text-gray-500 mt-1 mb-3">Docs</p>
          <div className="space-y-2 overflow-auto pr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-500">No documents uploaded.</p>
            ) : (
              documents.map((doc) => {
                const selected = doc.id === selectedDocId;
                return (
                  <button
                    key={doc.id}
                    className={`w-full text-left rounded-lg border px-3 py-2 ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}
                    onClick={() => setSelectedDocId(doc.id)}
                  >
                    <p className="text-sm font-medium text-navy-700 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500 mt-1">{doc.entity_count || 0} entities · {doc.relation_count || 0} relations</p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex-1 grid lg:grid-cols-[1.6fr_1fr] gap-4 min-w-0">
          <section className="card flex flex-col min-h-0">
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-100">
              <input
                type="file"
                className="input-field max-w-xs"
                title="Project document upload"
                accept=".pdf,.docx,.txt"
                onChange={(e) => void onUpload(e.target.files?.[0] || null)}
                disabled={uploading}
              />
              <select
                className="input-field max-w-[140px]"
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                title="LLM provider"
              >
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="azure_openai">Azure OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
              <select
                className="input-field max-w-[170px]"
                value={selectedModel}
                onChange={(e) => {
                  if (provider === 'openai') {
                    setOpenaiModel(e.target.value as (typeof OPENAI_MODELS)[number]);
                    return;
                  }
                  if (provider === 'azure_openai') {
                    setAzureModel(e.target.value as (typeof AZURE_OPENAI_MODELS)[number]);
                    return;
                  }
                  if (provider === 'gemini') {
                    setGeminiModel(e.target.value as (typeof GEMINI_MODELS)[number]);
                  }
                }}
                title="Model"
              >
                {provider === 'groq' ? (
                  <option value={GROQ_MODEL}>{GROQ_MODEL}</option>
                ) : provider === 'openai' ? (
                  OPENAI_MODELS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))
                ) : provider === 'azure_openai' ? (
                  AZURE_OPENAI_MODELS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))
                ) : (
                  GEMINI_MODELS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))
                )}
              </select>
              <button
                className="btn-primary text-sm"
                onClick={() => selectedDocId && void onExtract(selectedDocId)}
                disabled={!selectedDocId || !!activeDoc}
              >
                {activeDoc ? 'Extracting…' : 'Extract Entities + Relations'}
              </button>
              <button
                className="btn-ghost text-sm"
                onClick={() => void onExtractAll()}
                disabled={documents.length === 0 || !!activeDoc}
              >
                {activeDoc === 'all' ? 'Extracting All…' : 'Extract All Docs'}
              </button>
            </div>

            {error && <p className="text-sm text-red-600 pt-3">{error}</p>}

            <div className="flex-1 overflow-auto py-4 space-y-3">
              {chatMessages.map((message, idx) => (
                <div
                  key={`${message.role}-${idx}`}
                  className={`rounded-lg px-3 py-2 text-sm max-w-[92%] ${
                    message.role === 'assistant'
                      ? 'bg-gray-100 text-gray-700'
                      : 'ml-auto bg-primary-500 text-white'
                  }`}
                >
                  {message.text}
                </div>
              ))}
            </div>

            <div className="pt-3 mt-2 border-t border-gray-100 flex gap-2">
              <input
                className="input-field"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Try: extract selected, extract all documents, open graph"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleChatSubmit();
                  }
                }}
              />
              <button className="btn-primary text-sm" onClick={() => void handleChatSubmit()}>Send</button>
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-navy-700 uppercase tracking-wider">Project Context</h2>
              <p className="text-sm text-gray-600 mt-2">
                {conceptPreview ? `${conceptPreview.slice(0, 280)}${conceptPreview.length > 280 ? '…' : ''}` : 'No concept note yet. Add one in settings.'}
              </p>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-navy-700">Selected Document</h3>
              {selectedDoc ? (
                <div className="mt-2 text-sm text-gray-700 space-y-2">
                  <p className="font-medium break-all">{selectedDoc.filename}</p>
                  <p>{selectedDoc.entity_count || 0} entities · {selectedDoc.relation_count || 0} relations</p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/entities?project_id=${projectId}&document_id=${selectedDoc.id}`} className="btn-ghost text-xs">Entities</Link>
                    <Link href={`/relations?project_id=${projectId}&document_id=${selectedDoc.id}`} className="btn-ghost text-xs">Relations</Link>
                    <Link href={`/graph?project_id=${projectId}&document_id=${selectedDoc.id}`} className="btn-ghost text-xs">Graph</Link>
                    <button
                      className="btn-ghost text-xs text-red-600"
                      onClick={() => void onDelete(selectedDoc.id)}
                      disabled={activeDoc === selectedDoc.id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-2">Select a document from the left panel.</p>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
              <Link href={projectId ? `/projects/${projectId}/settings` : '/projects'} className="btn-ghost text-sm">Project Settings</Link>
              <button className="btn-ghost text-sm" onClick={() => void reload()}>Refresh</button>
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-3">
              <h3 className="text-sm font-semibold text-navy-700">Analysis Views</h3>
              <p className="text-sm text-gray-600">
                Open dedicated views for the full project graph and relationship table.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/graph?project_id=${projectId}`} className="btn-ghost text-sm">Open Full Graph</Link>
                <Link href={`/relations?project_id=${projectId}`} className="btn-ghost text-sm">Open Relations Table</Link>
                <Link href={`/entities?project_id=${projectId}`} className="btn-ghost text-sm">Open Entities</Link>
              </div>
              <p className="text-xs text-gray-500">
                Current graph scope: {graphNodes.length} entities · {graphEdges.length} relations · {workspaceAvailableEntityTypes.length} entity types · {workspaceAvailableRelationTypes.length} relation types.
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
