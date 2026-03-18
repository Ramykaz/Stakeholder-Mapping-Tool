export type LLMProvider = 'groq' | 'openai' | 'azure_openai' | 'gemini';
export type OpenAIModel = 'gpt-5-mini' | 'gpt-5-nano';

export interface ExtractionRequestOptions {
  provider: LLMProvider;
  model?: string;
}

// Type definitions for NER frontend.
// Entity object from API
export interface Entity {
  id: string;
  entity_type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'ROLE';
  canonical_name: string;
  normalized_name?: string;
  aliases?: string[];
  parent_entity?: { id: string; canonical_name: string } | null;
  parent_entity_id?: string | null;
  needs_review?: boolean;
  mention_count_dedup?: number;
  raw_mentions: string[];
  confidence: number;
  chunk_id: string | null;
  document_id: string;
  created_at: string;
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

// Document metadata
export interface Document {
  id: string;
  filename: string;
  format: 'pdf' | 'docx' | 'txt';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  entities_count?: number;
}

// Relation triplet from API
export interface Relation {
  id: string;
  document_id: string;
  run_id: string;
  source_entity_id: string;
  source_entity_name: string;
  target_entity_id: string;
  target_entity_name: string;
  label: string;
  confidence: number;
  created_at: string;
}

// Cytoscape.js node format
export interface CytoscapeNode {
  id: string;
  label: string; // canonical_name
  data: {
    entity_id: string;
    entity_type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'ROLE';
    confidence: number;
    document_id: string;
    chunk_id: string | null;
    raw_mentions_count: number;
    shape?: 'ellipse' | 'rectangle' | 'diamond' | 'hexagon';
  };
}

// Cytoscape.js edge format
export interface CytoscapeEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence: number;
}

// Graph response
export interface GraphResponse {
  document_id: string;
  nodes: CytoscapeNode[];
  edges?: CytoscapeEdge[];
  total_nodes: number;
  total_edges?: number;
}

// API error response
export interface ApiErrorResponse {
  error: string;
  detail: string;
}

// Extraction response
export interface ExtractionResponse {
  status: string;
  document_id: string;
  entities_created: number;
  run_id?: string;
  provider?: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  tokens_cached?: number;
  cost_usd?: string;
  message: string;
}

// Document entities response
export interface DocumentEntitiesResponse {
  document_id: string;
  entities: Entity[];
  total_count: number;
}

export interface NERRun {
  id: string;
  document_id: string;
  provider: string;
  model: string;
  status: 'pending' | 'completed' | 'failed';
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
  attachment_url: string | null;
  updated_at: string;
}

export interface GlobalEntityProfile {
  id: string;
  canonical_name: string;
  entity_type: string;
  projects: Array<{ id: string; name: string }>;
}
