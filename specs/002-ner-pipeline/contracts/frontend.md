# Frontend API Contract

**Feature**: 002-ner-pipeline  
**Phase**: 1 — Design  
**Date**: 2026-03-11

---

## Overview

The frontend (Next.js/React) communicates with the Django backend via REST API calls. This document defines the client-side interface and contract for all API interactions.

---

## API Client Interface

### Module: `src/services/api.ts`

The API client is a modular service layer that wraps axios and provides strongly-typed TypeScript methods for all backend endpoints.

#### Initialization

```typescript
// Create a configured axios instance
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log all errors; user-facing error messages are handled in React components
    console.error('[API Error]', error.response?.data || error.message);
    throw error;
  }
);
```

#### Methods

### 1. Extract Entities

```typescript
export async function extractEntities(
  documentId: string
): Promise<{ entities_created: number }> {
  // POST /api/v1/documents/{id}/extract-entities/
  // Synchronous extraction; completes before response
  // Returns count of created/updated entities
  // Throws AxiosError if request fails
  
  const response = await apiClient.post(
    `/api/v1/documents/${documentId}/extract-entities/`
  );
  
  if (response.status !== 201) {
    throw new Error(`Unexpected status code: ${response.status}`);
  }
  
  return response.data;
}
```

**Parameters**:
- `documentId: string` — UUID of document to extract entities from

**Returns**: `Promise<{ entities_created: number }>` — Count of entities created/replaced

**Throws**: `AxiosError` with backend error response

**Processing**: Synchronous. Waits for all entities to be extracted, deduplicated, and stored before returning.

**Example Usage**:
```typescript
try {
  const { entities_created } = await extractEntities('550e8400-e29b-41d4-a716-446655440000');
  showSuccess(`Extracted ${entities_created} entities`);
  // Automatically fetch updated entities
  const updatedEntities = await getEntities(documentId);
  setEntities(updatedEntities);
} catch (error) {
  // Display error message
  const detail = error.response?.data?.detail || 'Extraction failed';
  showErrorMessage(detail);
}
```

---

### 2. Get Entities

```typescript
export async function getEntities(
  documentId: string,
  filters?: { confidence_min?: number; entity_type?: string }
): Promise<Entity[]> {
  // GET /api/v1/documents/{id}/entities/?confidence_min=X&entity_type=Y
  
  const params = new URLSearchParams();
  if (filters?.confidence_min !== undefined) {
    params.append('confidence_min', String(filters.confidence_min));
  }
  if (filters?.entity_type) {
    params.append('entity_type', filters.entity_type);
  }
  
  const response = await apiClient.get(
    `/api/v1/documents/${documentId}/entities/`,
    { params }
  );
  
  return response.data.entities || [];
}
```

**Parameters**:
- `documentId: string` — UUID of document
- `filters?: { confidence_min?: number; entity_type?: string }` — Optional filters

**Returns**: `Promise<Entity[]>` — Array of entity objects (empty array if none)

**Throws**: `AxiosError` if request fails

**Example Usage**:
```typescript
// Fetch all entities
const allEntities = await getEntities('550e8400-e29b-41d4-a716-446655440000');

// Fetch with filters
const persons = await getEntities('550e8400-e29b-41d4-a716-446655440000', {
  entity_type: 'PERSON',
  confidence_min: 0.8,
});
```

---

### 3. Get Graph Nodes

```typescript
export async function getGraphNodes(
  documentId: string,
  confidenceMin?: number
): Promise<CytoscapeNode[]> {
  // GET /api/v1/graph/?document_id=ID&confidence_min=X
  
  const params = new URLSearchParams({ document_id: documentId });
  if (confidenceMin !== undefined) {
    params.append('confidence_min', String(confidenceMin));
  }
  
  const response = await apiClient.get('/api/v1/graph/', { params });
  
  return response.data.nodes || [];
}
```

**Parameters**:
- `documentId: string` — UUID of document
- `confidenceMin?: number` — Minimum confidence threshold (0.0–1.0)

**Returns**: `Promise<CytoscapeNode[]>` — Array of Cytoscape-compatible node objects

**Throws**: `AxiosError` if request fails

**Example Usage**:
```typescript
const nodes = await getGraphNodes('550e8400-e29b-41d4-a716-446655440000');
initializeCytoscape(nodes); // Pass nodes to Cytoscape
```

---

### 4. Upload Document

```typescript
export async function uploadDocument(
  file: File
): Promise<{ document_id: string }> {
  // POST /api/v1/documents/
  // Reuses existing endpoint from US-01
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/api/v1/documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  
  return response.data;
}
```

**Parameters**:
- `file: File` — File object from HTML input

**Returns**: `Promise<{ document_id: string }>` — ID of created document

**Throws**: `AxiosError` if upload fails

**Example Usage**:
```typescript
const file = fileInputRef.current?.files?.[0];
if (file) {
  const { document_id } = await uploadDocument(file);
  navigateToEntities(document_id);
}
```

---

## TypeScript Type Definitions

### Module: `src/types/index.ts`

```typescript
export interface Entity {
  id: string;
  entity_type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'ROLE';
  canonical_name: string;
  raw_mentions: string[];
  confidence: number; // 0.0–1.0
  document_id: string;
  chunk_id: string | null;
  created_at: string; // ISO 8601
}

export interface CytoscapeNode {
  id: string;
  label: string;
  data: {
    entity_id: string;
    entity_type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'ROLE';
    confidence: number;
    document_id: string;
    chunk_id: string | null;
    raw_mentions_count: number;
  };
}

export interface Document {
  id: string;
  filename: string;
  file_format: 'pdf' | 'docx' | 'txt';
  upload_timestamp: string; // ISO 8601
  processing_status: 'pending' | 'completed' | 'failed';
  chunk_count?: number;
}

export interface GraphResponse {
  document_id: string;
  nodes: CytoscapeNode[];
  edges: any[]; // Currently empty; future expansion
  total_nodes: number;
}

export interface ApiErrorResponse {
  error: string;
  detail: string;
  timestamp?: string;
  retry_after?: number;
}
```

---

## Error Handling

### Error Interceptor Pattern

```typescript
// In components: catch and display errors
try {
  await extractEntities(docId);
  showSuccess('Extraction started');
} catch (error) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail || error.message;
    const retryAfter = error.response?.data?.retry_after;
    
    if (error.response?.status === 429) {
      showError(`Rate limited. Please retry after ${retryAfter}s`);
    } else if (error.response?.status === 404) {
      showError('Document not found');
    } else {
      showError(detail);
    }
  } else {
    showError('Network error');
  }
}
```

---

## Environment Configuration

### Frontend Environment Variables

**File**: `.env.local.example`

```bash
# Backend API base URL (must match Django development server)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Note**: `NEXT_PUBLIC_` prefix makes the variable accessible in the browser. All API URLs are relative to `NEXT_PUBLIC_API_BASE_URL`.

---

## Component Integration

### Important: Cytoscape.js Dynamic Import Requirement

**Cytoscape.js is a client-side-only library and cannot be server-side rendered.** Always use Next.js dynamic import with `ssr: false`:

```typescript
import dynamic from 'next/dynamic';
import { CytoscapeNode } from '@/types';

// Dynamically import Cytoscape component (no SSR)
const GraphView = dynamic(
  () => import('@/components/GraphView'),
  {
    loading: () => <div>Loading graph...</div>,
    ssr: false, // CRITICAL: Cytoscape requires client-side rendering only
  }
);

export default function GraphPage({ documentId }: { documentId: string }) {
  const [nodes, setNodes] = useState<CytoscapeNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGraphNodes(documentId)
      .then(setNodes)
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load graph'));
  }, [documentId]);

  if (error) return <div className="alert-error">{error}</div>;

  return <GraphView nodes={nodes} />;
}
```

---

### Example: Entities List Component

```typescript
import { useEffect, useState } from 'react';
import { getEntities, Entity } from '@/services/api';
import { ApiErrorResponse } from '@/types';

export function EntitiesList({ documentId }: { documentId: string }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getEntities(documentId);
        setEntities(data);
      } catch (err) {
        setError(
          axios.isAxiosError(err)
            ? err.response?.data?.detail || err.message
            : 'Failed to load entities'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [documentId]);

  if (loading) return <div>Loading entities...</div>;
  if (error) return <div className="alert-error">{error}</div>;
  if (entities.length === 0) return <div>No entities extracted yet</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Canonical Name</th>
          <th>Type</th>
          <th>Confidence</th>
          <th>Mentions</th>
        </tr>
      </thead>
      <tbody>
        {entities.map((entity) => (
          <tr key={entity.id}>
            <td>{entity.canonical_name}</td>
            <td>{entity.entity_type}</td>
            <td>{(entity.confidence * 100).toFixed(0)}%</td>
            <td>{entity.raw_mentions.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Documentation Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `extractEntities(documentId)` | POST /api/v1/documents/{id}/extract-entities/ | Trigger NER extraction |
| `getEntities(documentId, filters)` | GET /api/v1/documents/{id}/entities/ | Fetch entities with optional filters |
| `getGraphNodes(documentId, confidenceMin)` | GET /api/v1/graph/?document_id={id} | Fetch Cytoscape-compatible nodes |
| `uploadDocument(file)` | POST /api/v1/documents/ | Upload document (from US-01) |

All methods:
- Return strongly-typed TypeScript promises
- Throw `AxiosError` on failure
- Include sensible defaults (e.g., empty arrays instead of null)
- Are fully documented in JSDoc comments in source code

