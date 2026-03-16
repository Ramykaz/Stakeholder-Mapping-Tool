// API client for NER endpoints.

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes — NER extraction over many chunks can take several minutes
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with non-2xx status
      const status = error.response.status;
      const data = error.response.data as any;

      console.error(`API Error [${status}]:`, data);

      // Return user-friendly error message
      const errorDetail = data?.detail || data?.message || 'Unknown error';
      const errorMessage =
        status === 404
          ? 'Resource not found'
          : status === 429
            ? 'Rate limited. Please try again later'
            : status === 500
              ? 'Server error. Please try again'
              : errorDetail;

      return Promise.reject(new Error(errorMessage));
    } else if (error.request) {
      // Request made but no response
      console.error('No response from server:', error.request);
      return Promise.reject(new Error('Network error. Please check your connection'));
    } else {
      // Error in request setup
      console.error('Error:', error.message);
      return Promise.reject(new Error('An error occurred'));
    }
  }
);

/**
 * Upload a document to the backend.
 * @param file - File to upload
 * @returns Promise resolving to { document_id }
 */
export async function uploadDocument(file: File): Promise<{
  id: string;
  filename: string;
  file_format: string;
  upload_timestamp: string;
  processing_status: string;
  chunk_count: number | null;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/api/v1/documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

/**
 * Extract entities from a document.
 * @param documentId - UUID of document
 * @returns Promise resolving to { entities_created: number }
 */
export async function extractEntities(
  documentId: string,
  options?: { provider?: 'groq' | 'openai'; model?: string }
): Promise<{
  status?: string;
  document_id?: string;
  entities_created: number;
  total_chunks?: number;
  processed_chunks?: number;
  rate_limited_chunks?: number;
  skipped_chunks?: number;
  partial?: boolean;
  run_id?: string;
  provider?: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  tokens_cached?: number;
  cost_usd?: string;
  message?: string;
}> {
  const payload: Record<string, string> = {};
  if (options?.provider) payload.provider = options.provider;
  if (options?.model) payload.model = options.model;
  const response = await apiClient.post(
    `/api/v1/documents/${documentId}/extract-entities/`,
    payload
  );

  return response.data;
}

/**
 * Get entities for a document.
 * @param documentId - UUID of document
 * @param filters - Optional filters (entity_type, confidence_min)
 * @returns Promise resolving to Entity[]
 */
export async function getEntities(
  documentId: string,
  filters?: { entity_type?: string; confidence_min?: number }
): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters?.entity_type) params.append('entity_type', filters.entity_type);
  if (filters?.confidence_min) params.append('confidence_min', String(filters.confidence_min));

  const response = await apiClient.get(
    `/api/v1/documents/${documentId}/entities/`,
    { params: Object.fromEntries(params) }
  );

  return response.data.entities || [];
}

/**
 * Get graph nodes and edges for a document (Cytoscape.js format).
 * @param documentId - UUID of document
 * @param confidenceMin - Optional minimum confidence filter (0.0-1.0)
 * @returns Promise resolving to {nodes, edges}
 */
export async function getGraphNodes(
  documentId: string,
  confidenceMin?: number
): Promise<{ nodes: any[]; edges: any[] }> {
  const params = new URLSearchParams({
    document_id: documentId,
  });
  if (confidenceMin !== undefined) {
    params.append('confidence_min', String(confidenceMin));
  }

  const response = await apiClient.get(`/api/v1/graph/`, { params: Object.fromEntries(params) });

  return {
    nodes: (response.data.nodes || []).map((n: any) => ({
      id: n.data.id,
      label: n.data.label,
      data: {
        entity_id: n.data.id,
        entity_type: n.data.entity_type,
        confidence: n.data.confidence,
        document_id: n.data.document_id || documentId,
        chunk_id: n.data.chunk_id || null,
        raw_mentions_count: n.data.raw_mentions_count || 0,
        shape: n.data.shape,
      },
    })),
    edges: (response.data.edges || []).map((e: any) => ({
      id: e.data.id,
      source: e.data.source,
      target: e.data.target,
      label: e.data.label,
      confidence: e.data.confidence,
    })),
  };
}

/**
 * List all uploaded documents (most recent first).
 */
export interface DocumentSummary {
  id: string;
  filename: string;
  file_format: string;
  upload_timestamp: string;
  processing_status: string;
  chunk_count: number | null;
  entity_count: number;
  relation_count?: number;
  last_run: {
    provider: string;
    model: string;
    duration_seconds: number | null;
    run_at: string;
    relations_created?: number;
  } | null;
}

export interface NERRunSummary {
  id: string;
  document_id: string;
  provider: string;
  model: string;
  status: string;
  tokens_input: number;
  tokens_output: number;
  tokens_cached: number;
  cost_usd: string;
  created_at: string;
}

export async function getDocuments(): Promise<DocumentSummary[]> {
  const response = await apiClient.get('/api/v1/documents/');
  return response.data;
}

/**
 * Extract both entities and relations from a document.
 * @param documentId - UUID of document
 * @param options - Optional provider and model configuration
 * @returns Promise resolving to extraction metadata
 */
export async function extractEntitiesRelations(
  documentId: string,
  options?: { provider?: 'groq' | 'openai'; model?: string }
): Promise<{
  status?: string;
  document_id?: string;
  entities_created: number;
  relations_created: number;
  run_id?: string;
  provider?: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  tokens_cached?: number;
  cost_usd?: string;
  message?: string;
}> {
  const payload: Record<string, string> = {};
  if (options?.provider) payload.provider = options.provider;
  if (options?.model) payload.model = options.model;
  const response = await apiClient.post(
    `/api/v1/documents/${documentId}/extract-entities-relations/`,
    payload
  );

  return response.data;
}

/**
 * Extract ONLY relations from a document that already has entities extracted.
 */
export async function extractRelations(
  documentId: string,
  options?: { provider?: 'groq' | 'openai'; model?: string }
): Promise<{
  status?: string;
  document_id?: string;
  relations_created: number;
  run_id?: string;
  provider?: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  tokens_cached?: number;
  cost_usd?: string;
  duration_seconds?: number;
}> {
  const payload: Record<string, string> = {};
  if (options?.provider) payload.provider = options.provider;
  if (options?.model) payload.model = options.model;
  const response = await apiClient.post(
    `/api/v1/documents/${documentId}/extract-relations/`,
    payload
  );
  return response.data;
}

/**
 * Get relations for a document.
 * @param documentId - UUID of document
 * @returns Promise resolving to Relation[]
 */
export async function getRelations(documentId: string): Promise<any[]> {
  const response = await apiClient.get(`/api/v1/documents/${documentId}/relations/`);
  return response.data || [];
}

/**
 * Delete a document and all its associated data (chunks, entities, runs).
 */
export async function deleteDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/api/v1/documents/${documentId}/`);
}

/**
 * Poll extraction progress for a document during an active extraction run.
 * Returns {in_progress, current, total}.
 */
export async function getExtractionProgress(
  documentId: string
): Promise<{ in_progress: boolean; current: number; total: number }> {
  const response = await apiClient.get(
    `/api/v1/documents/${documentId}/extraction-progress/`
  );
  return response.data;
}

export async function getDocumentRuns(documentId: string): Promise<NERRunSummary[]> {
  const response = await apiClient.get(`/api/v1/documents/${documentId}/runs/`);
  return response.data.runs || [];
}

export default apiClient;
