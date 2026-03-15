import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { uploadDocument, extractEntities, extractEntitiesRelations, extractRelations, getDocuments, deleteDocument, getExtractionProgress, DocumentSummary } from '@/lib/api';

const GROQ_DEFAULT_MODEL = 'llama-3.1-8b-instant';
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-5-mini', 'gpt-5-nano'] as const;

type UploadStep = 'select' | 'uploading' | 'uploaded' | 'extracting' | 'done' | 'error';

const ACCEPTED_FORMATS = '.pdf,.docx,.txt';
const MAX_SIZE_MB = 50;
const STORAGE_KEY = 'sat_upload_state';

const STEPS = ['Upload', 'Extract', 'View'] as const;

// Persistable subset of upload state (no File object — can't serialize that)
interface PersistedState {
  step: UploadStep;
  documentId: string;
  fileName: string;
  fileSize: number;
  entitiesCreated: number;
  timestamp: number;
}

interface ExtractionMetadata {
  provider?: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  tokens_cached?: number;
  cost_usd?: string;
}

const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: PersistedState = JSON.parse(raw);
    // Expire after 1 hour
    if (Date.now() - state.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

function clearPersistedState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore persisted state on mount
  const persisted = useRef(loadPersistedState());

  const [step, setStep] = useState<UploadStep>(() => {
    const p = persisted.current;
    // Only restore meaningful states (not transient uploading/extracting)
    if (p && (p.step === 'uploaded' || p.step === 'done')) return p.step;
    return 'select';
  });
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string>(() => persisted.current?.documentId || '');
  const [fileName, setFileName] = useState<string>(() => persisted.current?.fileName || '');
  const [fileSize, setFileSize] = useState<number>(() => persisted.current?.fileSize || 0);
  const [entitiesCreated, setEntitiesCreated] = useState<number>(() => persisted.current?.entitiesCreated || 0);
  const [relationsCreated, setRelationsCreated] = useState<number>(0);
  const [extractionMode, setExtractionMode] = useState<'entities' | 'entities-relations'>('entities');
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [provider, setProvider] = useState<'groq' | 'openai'>('groq');
  const [openaiModel, setOpenaiModel] = useState<(typeof OPENAI_MODELS)[number]>('gpt-5-mini');
  const [extractionMeta, setExtractionMeta] = useState<ExtractionMetadata | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowExtractingId, setRowExtractingId] = useState<string | null>(null);
  const [rowExtractMode, setRowExtractMode] = useState<'entities' | 'relations' | 'entities-relations' | null>(null);
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);

  // Fetch document history on mount and after successful upload/extraction
  const fetchDocuments = useCallback(async () => {
    try {
      setDocsLoading(true);
      const docs = await getDocuments();
      setDocuments(docs);
    } catch {
      // Silent fail — document list is non-critical
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Persist state on key changes
  const persistState = useCallback((s: UploadStep, docId: string, fName: string, fSize: number, entities: number) => {
    if (s === 'uploaded' || s === 'done') {
      savePersistedState({ step: s, documentId: docId, fileName: fName, fileSize: fSize, entitiesCreated: entities, timestamp: Date.now() });
    }
  }, []);

  const resetState = () => {
    setStep('select');
    setFile(null);
    setFileName('');
    setFileSize(0);
    setDocumentId('');
    setEntitiesCreated(0);
    setRelationsCreated(0);
    setExtractionMeta(null);
    setError('');
    clearPersistedState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateFile = (f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(ext || '')) {
      return 'Unsupported format. Please upload a PDF, DOCX, or TXT file.';
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB} MB.`;
    }
    if (f.size === 0) {
      return 'File is empty.';
    }
    return null;
  };

  const handleFileSelect = (f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      setStep('error');
      return;
    }
    setFile(f);
    setFileName(f.name);
    setFileSize(f.size);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStep('uploading');
    setError('');
    try {
      const result = await uploadDocument(file);
      setDocumentId(result.id);
      setStep('uploaded');
      persistState('uploaded', result.id, fileName, fileSize, 0);
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setStep('error');
    }
  };

  const handleExtract = async (mode?: string) => {
    if (!documentId) return;
    const activeMode = mode ?? extractionMode;
    setStep('extracting');
    setError('');
    setChunkProgress(null);

    // Poll for chunk progress every 1.5 s while extraction runs in parallel
    const progressInterval = setInterval(async () => {
      try {
        const p = await getExtractionProgress(documentId);
        if (p.in_progress && p.total > 0) {
          setChunkProgress({ current: p.current, total: p.total });
        }
      } catch { /* silent */ }
    }, 1500);

    try {
      const model = provider === 'openai' ? openaiModel : GROQ_DEFAULT_MODEL;
      if (activeMode === 'entities-relations') {
        // Extract both entities and relations
        const result = await extractEntitiesRelations(documentId, { provider, model });
        clearInterval(progressInterval);
        setChunkProgress(null);
        setEntitiesCreated(result.entities_created);
        setRelationsCreated(result.relations_created);
        setExtractionMeta({
          provider: result.provider || provider,
          model: result.model || model,
          tokens_input: result.tokens_input,
          tokens_output: result.tokens_output,
          tokens_cached: result.tokens_cached,
          cost_usd: result.cost_usd,
        });
      } else {
        // Extract entities only
        const result = await extractEntities(documentId, { provider, model });
        clearInterval(progressInterval);
        setChunkProgress(null);
        setEntitiesCreated(result.entities_created);
        setRelationsCreated(0);
        setExtractionMeta({
          provider: result.provider || provider,
          model: result.model || model,
          tokens_input: result.tokens_input,
          tokens_output: result.tokens_output,
          tokens_cached: result.tokens_cached,
          cost_usd: result.cost_usd,
        });
      }
      setStep('done');
      persistState('done', documentId, fileName, fileSize, entitiesCreated);
      fetchDocuments();
    } catch (err: any) {
      clearInterval(progressInterval);
      setChunkProgress(null);
      setError(err.message || 'Entity extraction failed');
      setStep('error');
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Delete this document and all its extracted data? This cannot be undone.')) return;
    setDeletingId(docId);
    try {
      await deleteDocument(docId);
      // If deleting the currently-loaded document, reset the upload flow
      if (docId === documentId) resetState();
      await fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Delete failed. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRowExtract = async (docId: string, mode: 'entities' | 'relations' | 'entities-relations') => {
    setRowExtractingId(docId);
    setRowExtractMode(mode);
    try {
      const model = provider === 'openai' ? openaiModel : GROQ_DEFAULT_MODEL;
      if (mode === 'entities') {
        await extractEntities(docId, { provider, model });
      } else if (mode === 'relations') {
        await extractRelations(docId, { provider, model });
      } else {
        await extractEntitiesRelations(docId, { provider, model });
      }
      await fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Extraction failed. Please try again.');
    } finally {
      setRowExtractingId(null);
      setRowExtractMode(null);
    }
  };

  const stepIndex =
    step === 'select' || step === 'uploading' ? 0 :
    step === 'uploaded' || step === 'extracting' ? 1 : 2;

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'docx') return '📝';
    return '📃';
  };

  return (
    <Layout title="Upload Document" subtitle="Upload and process documents for stakeholder extraction">
      <div className="max-w-2xl mx-auto">

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((label, i) => {
            const isCompleted = i < stepIndex && step !== 'error';
            const isActive = i === stepIndex && step !== 'error';
            const isPending = i > stepIndex || step === 'error';
            return (
              <React.Fragment key={label}>
                {i > 0 && (
                  <div className={`h-px w-16 mx-1 transition-colors duration-300 ${
                    isCompleted ? 'bg-primary-500' : 'bg-gray-200'
                  }`} />
                )}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                      isCompleted
                        ? 'bg-primary-500 text-white'
                        : isActive
                          ? 'bg-primary-500 text-white ring-4 ring-primary-100'
                          : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className={`text-sm font-medium ${
                    isCompleted || isActive ? 'text-navy-700' : 'text-gray-400'
                  }`}>
                    {label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Error State */}
        {step === 'error' && (
          <div className="mb-6 animate-fade-in">
            <ErrorMessage message={error} onRetry={resetState} />
          </div>
        )}

        {/* Step: Select File */}
        {(step === 'select' || step === 'error') && (
          <div className="animate-slide-up">
            <div
              className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer ${
                dragActive
                  ? 'border-primary-400 bg-primary-50/50'
                  : file
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => !file && !fileName && fileInputRef.current?.click()}
            >
              {(file || fileName) ? (
                <div className="animate-fade-in">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">
                    {getFileIcon(fileName)}
                  </div>
                  <p className="text-sm font-semibold text-navy-700">{fileName}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatFileSize(fileSize)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); resetState(); }}
                    className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                  >
                    Remove and choose another
                  </button>
                </div>
              ) : (
                <div>
                  <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-navy-700">
                    Drop your file here, or <span className="text-primary-500 underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    PDF, DOCX, or TXT &mdash; up to {MAX_SIZE_MB} MB
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FORMATS}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
              />
            </div>

            {/* Upload button */}
            {file && (
              <div className="mt-5 flex justify-center animate-fade-in">
                <button onClick={handleUpload} className="btn-primary px-8 py-3 text-sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Document
                </button>
              </div>
            )}
          </div>
        )}

        {/* Uploading spinner */}
        {step === 'uploading' && (
          <LoadingSpinner message="Uploading and processing document..." size="lg" />
        )}

        {/* Uploaded — ready to extract */}
        {step === 'uploaded' && (
          <div className="card text-center animate-slide-up">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-navy-700 mb-1">Document Uploaded</h2>
            <p className="text-sm text-gray-500">{fileName}</p>
            <p className="text-xs text-gray-400 font-mono mt-1 mb-6 bg-gray-50 inline-block px-3 py-1 rounded-md">
              {documentId}
            </p>
            <div className="max-w-md mx-auto mb-5 text-left">
              <label htmlFor="provider-select" className="text-xs text-gray-500 font-medium uppercase tracking-wider">Provider</label>
              <select
                id="provider-select"
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'groq' | 'openai')}
                className="mt-1 mb-3 input-field"
              >
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
              </select>

              {provider === 'openai' && (
                <>
                  <label htmlFor="openai-model-select" className="text-xs text-gray-500 font-medium uppercase tracking-wider">OpenAI Model</label>
                  <select
                    id="openai-model-select"
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value as (typeof OPENAI_MODELS)[number])}
                    className="mt-1 input-field"
                  >
                    {OPENAI_MODELS.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setExtractionMode('entities');
                  handleExtract('entities');
                }}
                className="btn-secondary text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Extract Entities
              </button>
              <button
                onClick={() => {
                  setExtractionMode('entities-relations');
                  handleExtract('entities-relations');
                }}
                className="btn-primary text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Extract Entities + Relations
              </button>
            </div>
            <button
              onClick={resetState}
              className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              &larr; Upload a different document
            </button>
          </div>
        )}

        {/* Extracting spinner */}
        {step === 'extracting' && (
          <div className="animate-slide-up">
            <LoadingSpinner message={`Extracting ${extractionMode === 'entities-relations' ? 'entities and relations' : 'entities'} with ${provider === 'openai' ? `OpenAI ${openaiModel}` : 'Groq llama-3.1-8b-instant'}...`} size="lg" />
            {chunkProgress && chunkProgress.total > 0 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">
                  Chunk{' '}
                  <span className="font-semibold text-navy-700">{chunkProgress.current}</span>
                  {' '}of{' '}
                  <span className="font-semibold text-navy-700">{chunkProgress.total}</span>
                  {' '}processed
                </p>
                <div className="mt-2 max-w-xs mx-auto h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((chunkProgress.current / chunkProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Done — entity extraction complete */}
        {step === 'done' && (
          <div className="card text-center animate-slide-up">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-navy-700 mb-1">Extraction Complete</h2>
            <p className="text-sm text-gray-500 mb-6">
              Found <span className="font-semibold text-navy-700">{entitiesCreated}</span> entit{entitiesCreated === 1 ? 'y' : 'ies'}
              {relationsCreated > 0 && (
                <> and <span className="font-semibold text-navy-700">{relationsCreated}</span> relation{relationsCreated === 1 ? '' : 's'}</>
              )}
              {' '}in <span className="font-medium">{fileName}</span>
            </p>

            {extractionMeta && (
              <div className="max-w-md mx-auto mb-6 text-left border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Run Metadata</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Provider:</span> {extractionMeta.provider || 'N/A'}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Model:</span> {extractionMeta.model || 'N/A'}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Input tokens:</span> {extractionMeta.tokens_input ?? 'N/A'}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Output tokens:</span> {extractionMeta.tokens_output ?? 'N/A'}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Cached tokens:</span> {extractionMeta.tokens_cached ?? 'N/A'}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Cost (USD):</span> {extractionMeta.cost_usd ?? 'N/A'}</p>
                <p className="text-xs text-gray-500 mt-2">If usage is unavailable from the provider, token and cost fields display <span className="font-medium">N/A</span>.</p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/entities?document_id=${documentId}`)}
                className="btn-primary text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View Entities
              </button>
              <button
                onClick={() => router.push(`/graph?document_id=${documentId}`)}
                className="btn-secondary text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                View Graph
              </button>
            </div>

            <button
              onClick={resetState}
              className="mt-5 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              Upload another document
            </button>
          </div>
        )}
      </div>

      {/* Recent Documents */}
      {documents.length > 0 && (
        <div className="mt-10 max-w-3xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-navy-700 uppercase tracking-wider">Recent Documents</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Extract using:</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'groq' | 'openai')}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600"
              >
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
              </select>
              {provider === 'openai' && (
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value as (typeof OPENAI_MODELS)[number])}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600"
                >
                  {OPENAI_MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="card !p-0 divide-y divide-gray-100 overflow-hidden">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
                {/* File icon */}
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-base">
                  {doc.file_format === 'pdf' ? '📄' : doc.file_format === 'docx' ? '📝' : '📃'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-700 truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(doc.upload_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {doc.chunk_count != null && <span className="ml-2">&middot; {doc.chunk_count} chunks</span>}
                    {doc.entity_count > 0 && <span className="ml-2">&middot; {doc.entity_count} entities</span>}
                    {doc.relation_count != null && doc.relation_count > 0 && <span className="ml-2">&middot; {doc.relation_count} relations</span>}
                  </p>
                  {doc.last_run && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="font-medium text-gray-500">{doc.last_run.model}</span>
                      {doc.last_run.duration_seconds != null && (
                        <span className="ml-2">&middot; {doc.last_run.duration_seconds < 60
                          ? `${doc.last_run.duration_seconds.toFixed(1)}s`
                          : `${Math.floor(doc.last_run.duration_seconds / 60)}m ${Math.round(doc.last_run.duration_seconds % 60)}s`
                        }</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  doc.processing_status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                  doc.processing_status === 'failed' ? 'bg-red-50 text-red-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {doc.processing_status}
                </span>

                {/* Inline extract actions */}
                {doc.processing_status === 'completed' && rowExtractingId !== doc.id && (
                  <div className="flex-shrink-0 flex gap-1">
                    {doc.entity_count === 0 && (
                      <>
                        <button
                          onClick={() => handleRowExtract(doc.id, 'entities')}
                          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors whitespace-nowrap"
                        >
                          Entities
                        </button>
                        <button
                          onClick={() => handleRowExtract(doc.id, 'entities-relations')}
                          className="text-xs px-2 py-1 rounded bg-primary-50 hover:bg-primary-100 text-primary-700 transition-colors whitespace-nowrap"
                        >
                          Entities + Relations
                        </button>
                      </>
                    )}
                    {doc.entity_count > 0 && (!doc.relation_count || doc.relation_count === 0) && (
                      <button
                        onClick={() => handleRowExtract(doc.id, 'relations')}
                        className="text-xs px-2 py-1 rounded bg-primary-50 hover:bg-primary-100 text-primary-700 transition-colors whitespace-nowrap"
                      >
                        Extract Relations
                      </button>
                    )}
                  </div>
                )}
                {rowExtractingId === doc.id && (
                  <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-gray-500">
                    <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="whitespace-nowrap">
                      {rowExtractMode === 'relations' ? 'Extracting relations...' : 'Extracting...'}
                    </span>
                  </div>
                )}

                {/* Action links */}
                <div className="flex-shrink-0 flex gap-1.5">
                  <Link
                    href={`/entities?document_id=${doc.id}`}
                    className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="View entities"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Link>
                  <Link
                    href={`/graph?document_id=${doc.id}`}
                    className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="View graph"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Delete document"
                  >
                    {deletingId === doc.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
