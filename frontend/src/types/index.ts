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
  };
}

// Graph response
export interface GraphResponse {
  document_id: string;
  nodes: CytoscapeNode[];
  total_nodes: number;
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
  message: string;
}

// Document entities response
export interface DocumentEntitiesResponse {
  document_id: string;
  entities: Entity[];
  total_count: number;
}
