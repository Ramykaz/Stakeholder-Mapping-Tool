import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { uploadDocument, extractEntities, getDocuments, DocumentSummary } from '@/lib/api';

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
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

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

  const handleExtract = async () => {
    if (!documentId) return;
    setStep('extracting');
    setError('');
    try {
      const result = await extractEntities(documentId);
      setEntitiesCreated(result.entities_created);
      setStep('done');
      persistState('done', documentId, fileName, fileSize, result.entities_created);
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Entity extraction failed');
      setStep('error');
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
            <div>
              <button onClick={handleExtract} className="btn-primary px-8 py-3 text-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Extract Entities
              </button>
            </div>
          </div>
        )}

        {/* Extracting spinner */}
        {step === 'extracting' && (
          <LoadingSpinner message="Extracting entities with Groq Llama 3... This may take a moment." size="lg" />
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
              Found <span className="font-semibold text-navy-700">{entitiesCreated}</span> entit{entitiesCreated === 1 ? 'y' : 'ies'} in{' '}
              <span className="font-medium">{fileName}</span>
            </p>

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
          <h2 className="text-sm font-semibold text-navy-700 uppercase tracking-wider mb-3">Recent Documents</h2>
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
                  </p>
                </div>

                {/* Status badge */}
                <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  doc.processing_status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                  doc.processing_status === 'failed' ? 'bg-red-50 text-red-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {doc.processing_status}
                </span>

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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
