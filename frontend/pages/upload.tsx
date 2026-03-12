import React, { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { uploadDocument, extractEntities } from '@/lib/api';

type UploadStep = 'select' | 'uploading' | 'uploaded' | 'extracting' | 'done' | 'error';

const ACCEPTED_FORMATS = '.pdf,.docx,.txt';
const MAX_SIZE_MB = 50;

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string>('');
  const [entitiesCreated, setEntitiesCreated] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  const resetState = () => {
    setStep('select');
    setFile(null);
    setDocumentId('');
    setEntitiesCreated(0);
    setError('');
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
    } catch (err: any) {
      setError(err.message || 'Entity extraction failed');
      setStep('error');
    }
  };

  return (
    <Layout title="Upload Document">
      <div className="max-w-2xl mx-auto">
        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8">
          {['Upload', 'Extract', 'View'].map((label, i) => {
            const stepIndex =
              step === 'select' || step === 'uploading' ? 0 :
              step === 'uploaded' || step === 'extracting' ? 1 : 2;
            const isActive = i <= stepIndex && step !== 'error';
            const isCurrent = i === stepIndex && step !== 'error';
            return (
              <React.Fragment key={label}>
                {i > 0 && (
                  <div className={`h-0.5 w-12 mx-2 ${isActive ? 'bg-primary-500' : 'bg-gray-200'}`} />
                )}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    } ${isCurrent ? 'ring-2 ring-primary-300' : ''}`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-sm font-medium ${isActive ? 'text-primary-700' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Error state */}
        {step === 'error' && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={resetState} />
          </div>
        )}

        {/* Step: Select file */}
        {(step === 'select' || step === 'error') && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragActive
                ? 'border-primary-500 bg-primary-50'
                : file
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            {file ? (
              <div>
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={resetState}
                  className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Change file
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Drag & drop a file here, or click to browse
                </p>
                <p className="text-xs text-gray-400">
                  PDF, DOCX, or TXT — up to {MAX_SIZE_MB} MB
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

            {!file && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Choose File
              </button>
            )}
          </div>
        )}

        {/* Upload button */}
        {step === 'select' && file && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleUpload}
              className="px-8 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              Upload Document
            </button>
          </div>
        )}

        {/* Uploading spinner */}
        {step === 'uploading' && (
          <LoadingSpinner message="Uploading and processing document..." size="lg" />
        )}

        {/* Uploaded — ready to extract */}
        {step === 'uploaded' && (
          <div className="card text-center">
            <div className="inline-flex p-3 rounded-full bg-green-100 mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Document Uploaded</h2>
            <p className="text-sm text-gray-500 mb-1">{file?.name}</p>
            <p className="text-xs text-gray-400 font-mono mb-6">ID: {documentId}</p>
            <button
              onClick={handleExtract}
              className="px-8 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              Extract Entities
            </button>
          </div>
        )}

        {/* Extracting spinner */}
        {step === 'extracting' && (
          <LoadingSpinner message="Extracting entities with Groq Llama 3... This may take a moment." size="lg" />
        )}

        {/* Done — entity extraction complete */}
        {step === 'done' && (
          <div className="card text-center">
            <div className="inline-flex p-3 rounded-full bg-green-100 mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Extraction Complete</h2>
            <p className="text-sm text-gray-600 mb-6">
              Found <strong>{entitiesCreated}</strong> entit{entitiesCreated === 1 ? 'y' : 'ies'} in{' '}
              <span className="font-medium">{file?.name}</span>
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/entities?document_id=${documentId}`)}
                className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                View Entities
              </button>
              <button
                onClick={() => router.push(`/graph?document_id=${documentId}`)}
                className="px-6 py-2.5 bg-white text-primary-700 font-medium rounded-lg border border-primary-300 hover:bg-primary-50 transition-colors"
              >
                View Graph
              </button>
            </div>

            <button
              onClick={resetState}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Upload another document
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
