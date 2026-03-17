// API client for NER endpoints.

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export type ProviderName = 'groq' | 'openai' | 'azure_openai' | 'gemini';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
}

export interface EntityLabelConfig {
  id: string;
  name: string;
  description: string;
  node_shape: string;
  color: string;
  active: boolean;
  display_order: number;
}

export interface RelationshipTypeConfig {
  id: string;
  name: string;
  description: string;
  directional: boolean;
  color: string;
  active: boolean;
  display_order: number;
}

export interface EntityReviewCandidate {
  id: string;
  document: string;
  left_entity: string;
  left_entity_name: string;
  right_entity: string;
  right_entity_name: string;
  entity_type: string;
  similarity_score: number;
  status: 'pending' | 'merged' | 'kept_separate' | 'resolved_stale';
  resolved_by: number | null;
  resolved_by_username: string | null;
  resolved_at: string | null;
  created_at: string;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes — NER extraction over many chunks can take several minutes
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_TOKEN_KEY = 'sat.auth.token';
const AUTH_USER_KEY = 'sat.auth.user';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getStoredAuthToken(): string | null {
  if (!isBrowser()) {
    return null;
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredAuthUser(): AuthUser | null {
  if (!isBrowser()) {
    return null;
  }
  const raw = window.localStorage.getItem(AUTH_USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function setStoredAuth(token: string, user: AuthUser): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredAuthToken();
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
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
  options?: { provider?: ProviderName; model?: string }
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
  options?: { provider?: ProviderName; model?: string }
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
  options?: { provider?: ProviderName; model?: string }
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

export async function getEntityReviewCandidates(documentId: string): Promise<EntityReviewCandidate[]> {
  const response = await apiClient.get(`/api/v1/documents/${documentId}/entities/review-candidates/`);
  return response.data.candidates || [];
}

export async function resolveEntityReviewCandidate(
  documentId: string,
  candidateId: string,
  payload: { action: 'merge' | 'keep_separate'; target_entity_id?: string }
): Promise<{ status: string; action: string; candidate_id: string }> {
  const response = await apiClient.post(
    `/api/v1/documents/${documentId}/entities/review-candidates/${candidateId}/resolve/`,
    payload
  );
  return response.data;
}

export async function getEntityLabels(): Promise<EntityLabelConfig[]> {
  const response = await apiClient.get('/api/v1/admin/entity-labels/');
  return response.data || [];
}

export async function createEntityLabel(payload: Omit<EntityLabelConfig, 'id'>): Promise<EntityLabelConfig> {
  const response = await apiClient.post('/api/v1/admin/entity-labels/', payload);
  return response.data;
}

export async function updateEntityLabel(
  id: string,
  payload: Partial<Omit<EntityLabelConfig, 'id'>>
): Promise<EntityLabelConfig> {
  const response = await apiClient.patch(`/api/v1/admin/entity-labels/${id}/`, payload);
  return response.data;
}

export async function deleteEntityLabel(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/admin/entity-labels/${id}/`);
}

export async function getRelationshipTypes(): Promise<RelationshipTypeConfig[]> {
  const response = await apiClient.get('/api/v1/admin/relationship-types/');
  return response.data || [];
}

export async function createRelationshipType(
  payload: Omit<RelationshipTypeConfig, 'id'>
): Promise<RelationshipTypeConfig> {
  const response = await apiClient.post('/api/v1/admin/relationship-types/', payload);
  return response.data;
}

export async function updateRelationshipType(
  id: string,
  payload: Partial<Omit<RelationshipTypeConfig, 'id'>>
): Promise<RelationshipTypeConfig> {
  const response = await apiClient.patch(`/api/v1/admin/relationship-types/${id}/`, payload);
  return response.data;
}

export async function deleteRelationshipType(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/admin/relationship-types/${id}/`);
}

export async function registerUser(payload: {
  username: string;
  email?: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const response = await apiClient.post('/api/v1/auth/register/', payload);
  const data = response.data as { token: string; user: AuthUser };
  setStoredAuth(data.token, data.user);
  return data;
}

export async function loginUser(payload: {
  username: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const response = await apiClient.post('/api/v1/auth/login/', payload);
  const data = response.data as { token: string; user: AuthUser };
  setStoredAuth(data.token, data.user);
  return data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get('/api/v1/auth/me/');
  const data = response.data as { user: AuthUser };
  if (data.user) {
    const token = getStoredAuthToken();
    if (token) {
      setStoredAuth(token, data.user);
    }
  }
  return data.user;
}

export async function logoutUser(): Promise<void> {
  try {
    await apiClient.post('/api/v1/auth/logout/', {});
  } finally {
    clearStoredAuth();
  }
}

export default apiClient;
