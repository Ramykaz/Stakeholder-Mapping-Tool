export type LLMProvider = 'groq' | 'openai';
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
  raw_mentions: string[];
  confidence: number;
  chunk_id: string | null;
  document_id: string;
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
