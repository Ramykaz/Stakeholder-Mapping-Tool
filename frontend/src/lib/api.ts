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

function normalizeErrorMessage(data: any): string {
  if (!data) {
    return 'Unknown error';
  }

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  if (data.error && typeof data.error === 'object') {
    if (typeof data.error.message === 'string') {
      const remediation = Array.isArray(data.error.remediation) && data.error.remediation.length > 0
        ? ` ${String(data.error.remediation[0])}`
        : '';
      return `${data.error.message}${remediation}`.trim();
    }
    if (typeof data.error.detail === 'string') {
      return data.error.detail;
    }
  }

  if (typeof data.message === 'string') {
    return data.message;
  }

  if (typeof data.error === 'string') {
    return data.error;
  }

  const fieldErrors = Object.entries(data)
    .filter(([key]) => !['detail', 'message', 'error', 'code'].includes(key))
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(', ')}`;
      }
      if (typeof value === 'string') {
        return `${key}: ${value}`;
      }
      return null;
    })
    .filter(Boolean) as string[];

  if (fieldErrors.length > 0) {
    return fieldErrors.join(' | ');
  }

  return 'Unknown error';
}

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
      const errorDetail = normalizeErrorMessage(data);
      const errorCode = String(data?.code || data?.error?.code || '').toLowerCase();

      if (errorCode === 'incorrect_password') {
        return Promise.reject(new Error('Incorrect password.'));
      }

      if (errorCode === 'invalid_credentials') {
        return Promise.reject(new Error('Invalid credentials.'));
      }

      if (errorCode === 'provider_rate_limited') {
        return Promise.reject(new Error(errorDetail || 'Provider is rate limited. Switch provider and retry.'));
      }

      const errorMessage =
        status === 404
          ? 'Resource not found'
          : status === 429
            ? (errorDetail || 'Rate limited. Please switch provider and try again later')
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

export function computeNodeSize(degree: number): number {
  const safeDegree = Number.isFinite(degree) ? Math.max(0, degree) : 0;
  const min = 34;
  const max = 92;
  const scaled = min + Math.log2(safeDegree + 1) * 14;
  return Math.max(min, Math.min(max, Math.round(scaled)));
}

export function computeEdgeWidth(confidence: number): number {
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
  const min = 1.5;
  const max = 6;
  return Number((min + (max - min) * safeConfidence).toFixed(2));
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
      id: n.id || n.data.id,
      label: n.label || n.data.label,
      entity_type: n.entity_type || n.data.entity_type,
      degree: n.degree ?? n.data.degree ?? 0,
      style: n.style || { shape: n.data.shape, color: n.data.color || '#9ca3af' },
      data: {
        entity_id: n.data.id,
        entity_type: n.data.entity_type,
        confidence: n.data.confidence,
        document_id: n.data.document_id || documentId,
        chunk_id: n.data.chunk_id || null,
        raw_mentions_count: n.data.raw_mentions_count || 0,
        shape: n.data.shape,
        color: n.data.color || '#9ca3af',
        degree: n.data.degree ?? n.degree ?? 0,
        node_size: computeNodeSize(n.data.degree ?? n.degree ?? 0),
      },
    })),
    edges: (response.data.edges || []).map((e: any) => {
      const edgeData = e.data || e;
      return {
        id: edgeData.id,
        source: edgeData.source,
        target: edgeData.target,
        label: edgeData.label,
        relation_type: edgeData.relation_type,
        confidence: edgeData.confidence,
        color: edgeData.color,
        edge_width: computeEdgeWidth(edgeData.confidence),
      };
    }),
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
  error_message?: string;
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

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  document_count: number;
  entity_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConceptNoteResponse {
  project_id: string;
  content: string;
  attachment?: File | null;
  attachment_url: string | null;
  updated_at: string;
}

export interface GlobalEntityProfile {
  id: string;
  canonical_name: string;
  entity_type: string;
  confidence?: number;
  aliases?: string[];
  relationships?: Array<{
    relation_id: string;
    project_id: string | null;
    source_entity_id: string;
    source_entity_name: string;
    target_entity_id: string;
    target_entity_name: string;
    relation_type: string;
    confidence: number;
    supporting_excerpts: string[];
  }>;
  projects: Array<{ id: string; name: string }>;
}

export interface ContextualSummaryResponse {
  entity_id: string;
  project_id: string;
  summary: string | null;
  source?: 'cache' | 'provider';
  generated_at?: string;
  expires_at?: string;
  fallback_message?: string;
  retryable?: boolean;
  reason?: string;
  source_chunks?: Array<{ document_name: string; snippet: string }>;
}

export async function getDocuments(): Promise<DocumentSummary[]> {
  const response = await apiClient.get('/api/v1/documents/');
  return response.data;
}

export async function getProjects(): Promise<ProjectSummary[]> {
  const response = await apiClient.get('/api/v1/projects/');
  return response.data || [];
}

export async function createProject(payload: {
  name: string;
  description?: string;
  status?: 'active' | 'archived';
}): Promise<ProjectSummary> {
  const response = await apiClient.post('/api/v1/projects/', payload);
  return response.data;
}

export async function getProject(id: string): Promise<ProjectSummary> {
  const response = await apiClient.get(`/api/v1/projects/${id}/`);
  return response.data;
}

export async function updateProject(id: string, payload: Partial<{
  name: string;
  description: string;
  status: 'active' | 'archived';
}>): Promise<ProjectSummary> {
  const response = await apiClient.patch(`/api/v1/projects/${id}/`, payload);
  return response.data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/projects/${id}/`);
}

export async function getProjectConceptNote(projectId: string): Promise<ConceptNoteResponse> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/concept-note/`);
  return response.data;
}

export async function upsertProjectConceptNote(
  projectId: string,
  payload: { content: string; attachment?: File | null }
): Promise<ConceptNoteResponse> {
  const formData = new FormData();
  formData.append('content', payload.content || '');
  if (payload.attachment) {
    formData.append('attachment', payload.attachment);
  }
  const response = await apiClient.post(`/api/v1/projects/${projectId}/concept-note/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function uploadDocumentToProject(
  projectId: string,
  file: File
): Promise<DocumentSummary> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(`/api/v1/projects/${projectId}/documents/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function getProjectDocuments(projectId: string): Promise<DocumentSummary[]> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/documents/`);
  return response.data || [];
}

export async function deleteProjectDocument(projectId: string, docId: string): Promise<void> {
  await apiClient.delete(`/api/v1/projects/${projectId}/documents/${docId}/`);
}

export async function getProjectDocumentStatus(
  projectId: string,
  docId: string
): Promise<{ id: string; processing_status: string; chunk_count: number | null; entity_count: number; error_message: string }> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/documents/${docId}/status/`);
  return response.data;
}

export async function extractEntitiesForProject(
  projectId: string,
  documentId?: string,
  options?: { provider?: ProviderName; model?: string }
): Promise<{
  status: string;
  project_id: string;
  document_id?: string;
  documents_processed?: number;
  entities_created: number;
  relations_created: number;
  run_id?: string;
  results?: Array<{
    document_id: string;
    entities_created: number;
    relations_created: number;
    run_id?: string;
    fallback_relations_run?: boolean;
  }>;
  fallback_relations_run?: boolean;
  provider?: string;
  model?: string;
}> {
  const payload: Record<string, string> = {};
  if (documentId) payload.document_id = documentId;
  if (options?.provider) payload.provider = options.provider;
  if (options?.model) payload.model = options.model;
  const response = await apiClient.post(`/api/v1/projects/${projectId}/extract-entities/`, payload);
  return response.data;
}

export async function getProjectEntities(projectId: string): Promise<any[]> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/entities/`);
  return response.data.entities || [];
}

export async function getProjectGraph(projectId: string): Promise<{ nodes: any[]; edges: any[] }> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/graph/`);
  return {
    nodes: (response.data.nodes || []).map((n: any) => ({
      id: n.id || n.data.id,
      label: n.label || n.data.label,
      entity_type: n.entity_type || n.data.entity_type,
      degree: n.degree ?? n.data.degree ?? 0,
      style: n.style || { shape: n.data.shape, color: n.data.color || '#9ca3af' },
      data: {
        entity_id: n.data.id,
        entity_type: n.data.entity_type,
        confidence: n.data.confidence,
        document_id: n.data.document_id || '',
        chunk_id: n.data.chunk_id || null,
        raw_mentions_count: n.data.raw_mentions_count || 0,
        shape: n.data.shape,
        color: n.data.color || '#9ca3af',
        degree: n.data.degree ?? n.degree ?? 0,
        node_size: computeNodeSize(n.data.degree ?? n.degree ?? 0),
      },
    })),
    edges: (response.data.edges || []).map((e: any) => {
      const edgeData = e.data || e;
      return {
        id: edgeData.id,
        source: edgeData.source,
        target: edgeData.target,
        label: edgeData.label,
        relation_type: edgeData.relation_type,
        confidence: edgeData.confidence,
        color: edgeData.color,
        edge_width: computeEdgeWidth(edgeData.confidence),
      };
    }),
  };
}

export async function getGlobalEntityProfile(entityId: string): Promise<GlobalEntityProfile> {
  const response = await apiClient.get(`/api/v1/entities/${entityId}/`);
  return response.data;
}

export async function getEntityProfile(entityId: string): Promise<GlobalEntityProfile> {
  const response = await apiClient.get(`/api/v1/entities/${entityId}/profile/`);
  return response.data;
}

export async function generateEntitySummary(
  entityId: string,
  projectId: string,
  refresh = false
): Promise<ContextualSummaryResponse> {
  const response = await apiClient.post(`/api/v1/entities/${entityId}/summary/`, {
    project_id: projectId,
    refresh,
  });
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
  console.info('[AUTH] register request', { username: payload.username, email: payload.email });
  const response = await apiClient.post('/api/v1/auth/register/', payload);
  const data = response.data as { token: string; user: AuthUser };
  setStoredAuth(data.token, data.user);
  console.info('[AUTH] register success', { userId: data.user.id, isAdmin: data.user.is_admin });
  return data;
}

export async function loginUser(payload: {
  username: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  console.info('[AUTH] login request', { username: payload.username });
  const response = await apiClient.post('/api/v1/auth/login/', payload);
  const data = response.data as { token: string; user: AuthUser };
  setStoredAuth(data.token, data.user);
  console.info('[AUTH] login success', { userId: data.user.id, isAdmin: data.user.is_admin });
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

export async function queryProjectGraph(
  projectId: string,
  query: string
): Promise<{ query: string; answer: string | null; is_nl_query: boolean; entity_ids: string[]; count: number }> {
  const response = await apiClient.post(`/api/v1/projects/${projectId}/query/`, { query });
  return response.data;
}

// ── Per-document stats ────────────────────────────────────────────────────────

export interface DocumentStats {
  entity_count: number;
  relation_count: number;
  confidence_distribution: { high: number; medium: number; low: number };
  top_entities: Array<{ id: string; name: string; type: string; confidence: number }>;
}

export interface DocumentSummaryWithStats extends DocumentSummary {
  stats: DocumentStats | null;
}

export async function getProjectDocumentsWithStats(projectId: string): Promise<DocumentSummaryWithStats[]> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/documents/?include_stats=true`);
  return response.data || [];
}

// ── Entity flagging ───────────────────────────────────────────────────────────

export async function flagEntity(
  entityId: string,
  isFlagged: boolean
): Promise<{ id: string; canonical_name: string; is_flagged: boolean }> {
  const response = await apiClient.post(`/api/v1/entities/${entityId}/flag/`, { is_flagged: isFlagged });
  return response.data;
}

export async function getProjectFlaggedCount(projectId: string): Promise<number> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/entities/?is_flagged=true`);
  return (response.data.entities || []).length;
}

// ── Dedup review queue ────────────────────────────────────────────────────────

export interface ReviewCandidate {
  id: string;
  left_entity: { id: string; name: string; type: string };
  right_entity: { id: string; name: string; type: string };
  similarity_score: number;
  mention_context: string;
  status: 'pending' | 'merged' | 'kept_separate' | 'resolved_stale';
}

export interface ReviewCandidateList {
  count: number;
  pending_count: number;
  results: ReviewCandidate[];
}

export async function getProjectReviewCandidates(projectId: string): Promise<ReviewCandidateList> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/review/`);
  return response.data;
}

export async function resolveReviewCandidate(
  candidateId: string,
  action: 'merge' | 'keep_separate'
): Promise<{ id: string; status: string; canonical_entity?: { id: string; name: string }; resolved_at: string }> {
  const response = await apiClient.post(`/api/v1/review-candidates/${candidateId}/resolve/`, { action });
  return response.data;
}

// ── Entity timeline ───────────────────────────────────────────────────────────

export interface TimelineEntry {
  document_id: string;
  document_name: string;
  uploaded_at: string;
  context_snippet: string;
}

export async function getEntityTimeline(
  entityId: string,
  projectId: string
): Promise<{ entity_id: string; project_id: string; timeline: TimelineEntry[] }> {
  const response = await apiClient.get(`/api/v1/entities/${entityId}/timeline/`, {
    params: { project_id: projectId },
  });
  return response.data;
}

// ── Global entity list ────────────────────────────────────────────────────────

export interface GlobalEntitySummary {
  id: string;
  canonical_name: string;
  entity_type: string;
  project_count: number;
  document_count: number;
  confidence_min: number;
  confidence_max: number;
  representative_id: string | null;
  representative_project_id: string | null;
}

export async function getGlobalEntities(params?: {
  page?: number;
  page_size?: number;
  type?: string;
  search?: string;
}): Promise<{ count: number; next: string | null; previous: string | null; results: GlobalEntitySummary[] }> {
  const response = await apiClient.get('/api/v1/entities/', { params });
  return response.data;
}

// ── LLM provider selection ────────────────────────────────────────────────────

export interface ProviderOption {
  name: string;
  available: boolean;
  models: string[];
}

export interface ProjectProviders {
  current_provider: string;
  current_model: string;
  providers: ProviderOption[];
}

export async function getProjectProviders(projectId: string): Promise<ProjectProviders> {
  const response = await apiClient.get(`/api/v1/projects/${projectId}/providers/`);
  return response.data;
}

export async function updateProjectProvider(
  projectId: string,
  provider: string,
  model: string
): Promise<ProjectSummary> {
  const response = await apiClient.patch(`/api/v1/projects/${projectId}/`, { provider, model });
  return response.data;
}

// ── Auth: profile, password, forgot/reset ─────────────────────────────────────

export async function updateUserProfile(payload: { username?: string; email?: string }): Promise<AuthUser> {
  const response = await apiClient.patch('/api/v1/auth/me/', payload);
  const data = response.data as { user: AuthUser };
  const token = getStoredAuthToken();
  if (token && data.user) setStoredAuth(token, data.user);
  return data.user;
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const response = await apiClient.post('/api/v1/auth/change-password/', payload);
  const data = response.data as { token: string; user: AuthUser };
  if (data.token && data.user) setStoredAuth(data.token, data.user);
  return data;
}

export async function forgotPassword(email: string): Promise<{ detail: string; _debug_reset_path?: string }> {
  const response = await apiClient.post('/api/v1/auth/forgot-password/', { email });
  return response.data;
}

export async function resetPassword(payload: {
  uid: string;
  token: string;
  new_password: string;
}): Promise<{ detail: string }> {
  const response = await apiClient.post('/api/v1/auth/reset-password/', payload);
  return response.data;
}

// ── Admin API ─────────────────────────────────────────────────────────────────

export interface AdminUserRecord {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  date_joined: string | null;
}

export interface AdminUserList {
  count: number;
  page: number;
  results: AdminUserRecord[];
}

export interface AdminStats {
  users: number;
  active_users: number;
  admin_users: number;
  projects: number;
  documents: number;
  entities: number;
  flagged_entities: number;
  relations: number;
}

export async function adminListUsers(params?: { page?: number; search?: string }): Promise<AdminUserList> {
  const response = await apiClient.get('/api/v1/auth/admin/users/', { params });
  return response.data;
}

export async function adminUpdateUser(
  userId: number,
  payload: { is_admin?: boolean; is_active?: boolean }
): Promise<AdminUserRecord> {
  const response = await apiClient.patch(`/api/v1/auth/admin/users/${userId}/`, payload);
  return (response.data as { user: AdminUserRecord }).user;
}

export async function adminDeleteUser(userId: number): Promise<void> {
  await apiClient.delete(`/api/v1/auth/admin/users/${userId}/`);
}

export async function adminGetStats(): Promise<AdminStats> {
  const response = await apiClient.get('/api/v1/auth/admin/stats/');
  return response.data;
}

// ── Export helpers ────────────────────────────────────────────────────────────

export async function downloadProjectExport(
  projectId: string,
  type: 'entities' | 'relations' | 'report-docx' | 'report-pdf'
): Promise<void> {
  const map: Record<string, string> = {
    entities: 'entities.csv',
    relations: 'relations.csv',
    'report-docx': 'report.docx',
    'report-pdf': 'report.pdf',
  };
  const url = `/api/v1/projects/${projectId}/export/${map[type]}`;
  const response = await apiClient.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data as BlobPart]);
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `export_${type}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export default apiClient;
