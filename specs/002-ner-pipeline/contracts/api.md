# API Contracts: NER Pipeline + Entity Retrieval

**Feature**: 002-ner-pipeline  
**Phase**: 1 — Design  
**Date**: 2026-03-11

---

## Overview

Three REST API endpoints comprise the NER feature:

1. **POST** `/api/v1/documents/{id}/extract-entities/` — Trigger entity extraction for a document
2. **GET** `/api/v1/documents/{id}/entities/` — Retrieve all extracted entities for a document
3. **GET** `/api/v1/graph/?document_id={id}` — Retrieve entity nodes in Cytoscape.js format

All endpoints:
- Accept and return JSON
- Return appropriate HTTP status codes and error responses
- Are versioned under `/api/v1/`
- Operate on single or multiple documents (scoped by `document_id`)

---

## Endpoint 1: Trigger Entity Extraction

### Request

**Method**: POST  
**Path**: `/api/v1/documents/{id}/extract-entities/`  
**URL Parameters**:
- `{id}` (UUID, required): The document ID for which to extract entities

**Request Body**: Empty (no body required)

**Request Headers**: None (authentication not required for MVP)

**Processing**: Synchronous. Extraction completes before response is returned.

**Example**:
```bash
curl -X POST http://localhost:8000/api/v1/documents/550e8400-e29b-41d4-a716-446655440000/extract-entities/
```

### Response

**Status Codes**:
- **201 Created** — Extraction completed successfully; entities created/replaced
- **404 Not Found** — Document with given `id` does not exist
- **400 Bad Request** — Invalid document ID format (not a valid UUID)
- **429 Too Many Requests** — Groq API rate limit exceeded
- **500 Internal Server Error** — Unexpected server error during extraction

**Processing**: Synchronous. Extraction completes before response is returned.

### Success Response (201 Created)

```json
{
  "status": "extraction_completed",
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "entities_created": 8,
  "message": "Entity extraction completed. Previous entities have been replaced."
}
```

### Error Responses

**404 Not Found**:
```json
{
  "error": "document_not_found",
  "detail": "Document with ID 550e8400-e29b-41d4-a716-446655440000 does not exist"
}
```

**429 Too Many Requests** (when Groq API rate limit hit):
```json
{
  "error": "rate_limited",
  "detail": "Groq API rate limit exceeded. Please retry after a delay.",
  "retry_after": 60,
  "document_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**500 Internal Server Error**:
```json
{
  "error": "extraction_failed",
  "detail": "An error occurred during entity extraction. No entities were modified."
}
```

---

## Endpoint 2: Retrieve Entities for a Document

### Request

**Method**: GET  
**Path**: `/api/v1/documents/{id}/entities/`  
**URL Parameters**:
- `{id}` (UUID, required): The document ID

**Query Parameters**:
- `confidence_min` (float, optional, default=0.0): Minimum confidence threshold (0.0–1.0). Only return entities with confidence ≥ this value.
- `entity_type` (string, optional): Filter by entity type: `PERSON`, `ORGANIZATION`, `LOCATION`, `ROLE`. If omitted, return all types.

**Request Headers**: None

**Example**:
```bash
curl http://localhost:8000/api/v1/documents/550e8400-e29b-41d4-a716-446655440000/entities/
curl http://localhost:8000/api/v1/documents/550e8400-e29b-41d4-a716-446655440000/entities/?entity_type=PERSON&confidence_min=0.8
```

### Response

**Status Codes**:
- **200 OK** — Successful retrieval (may return empty array if no entities)
- **404 Not Found** — Document with given `id` does not exist
- **400 Bad Request** — Invalid parameter format (e.g., malformed UUID, invalid entity_type)

### Success Response (200 OK)

**Structure**: JSON array of entity objects

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "entities": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "entity_type": "PERSON",
      "canonical_name": "John Smith",
      "raw_mentions": ["John Smith", "J. Smith", "John S."],
      "confidence": 0.92,
      "document_id": "550e8400-e29b-41d4-a716-446655440000",
      "chunk_id": "770e8400-e29b-41d4-a716-446655440002",
      "created_at": "2026-03-11T10:30:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440003",
      "entity_type": "ORGANIZATION",
      "canonical_name": "UNDP",
      "raw_mentions": ["UNDP", "United Nations Development Programme"],
      "confidence": 0.88,
      "document_id": "550e8400-e29b-41d4-a716-446655440000",
      "chunk_id": "770e8400-e29b-41d4-a716-446655440002",
      "created_at": "2026-03-11T10:30:00Z"
    }
  ],
  "total_count": 2
}
```

### Empty Response (200 OK, no entities)

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "entities": [],
  "total_count": 0,
  "message": "No entities extracted yet. Trigger extraction with POST /api/v1/documents/{id}/extract-entities/"
}
```

### Error Responses

**404 Not Found**:
```json
{
  "error": "document_not_found",
  "detail": "Document with ID 550e8400-e29b-41d4-a716-446655440000 does not exist"
}
```

**400 Bad Request**:
```json
{
  "error": "invalid_parameter",
  "detail": "entity_type must be one of: PERSON, ORGANIZATION, LOCATION, ROLE"
}
```

---

## Endpoint 3: Retrieve Entity Graph Nodes

### Request

**Method**: GET  
**Path**: `/api/v1/graph/`  
**Query Parameters** (required):
- `document_id` (UUID, required): The document ID to retrieve entity nodes for

**Query Parameters** (optional):
- `confidence_min` (float, optional, default=0.0): Minimum confidence threshold

**Request Headers**: None

**Example**:
```bash
curl http://localhost:8000/api/v1/graph/?document_id=550e8400-e29b-41d4-a716-446655440000
curl http://localhost:8000/api/v1/graph/?document_id=550e8400-e29b-41d4-a716-446655440000&confidence_min=0.7
```

### Response

**Status Codes**:
- **200 OK** — Successful retrieval (may return empty nodes array if no entities)
- **400 Bad Request** — Missing or invalid `document_id` parameter
- **404 Not Found** — Document with given `document_id` does not exist

### Success Response (200 OK)

**Structure**: JSON with Cytoscape-compatible nodes array. Format is optimized for direct consumption by Cytoscape.js without additional transformation.

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "nodes": [
    {
      "id": "entity_660e8400-e29b-41d4-a716-446655440001",
      "label": "John Smith",
      "data": {
        "entity_id": "660e8400-e29b-41d4-a716-446655440001",
        "entity_type": "PERSON",
        "confidence": 0.92,
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "chunk_id": "770e8400-e29b-41d4-a716-446655440002",
        "raw_mentions_count": 3
      }
    },
    {
      "id": "entity_660e8400-e29b-41d4-a716-446655440003",
      "label": "UNDP",
      "data": {
        "entity_id": "660e8400-e29b-41d4-a716-446655440003",
        "entity_type": "ORGANIZATION",
        "confidence": 0.88,
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "chunk_id": "770e8400-e29b-41d4-a716-446655440002",
        "raw_mentions_count": 2
      }
    }
  ],
  "edges": [],
  "total_nodes": 2,
  "note": "Edges are out of scope for this feature. They will be added in a future story."
}
```

### Empty Response (200 OK, no entities)

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "nodes": [],
  "edges": [],
  "total_nodes": 0,
  "message": "No entities found for this document"
}
```

### Error Responses

**400 Bad Request**:
```json
{
  "error": "missing_parameter",
  "detail": "document_id is required"
}
```

```json
{
  "error": "invalid_parameter",
  "detail": "document_id must be a valid UUID"
}
```

**404 Not Found**:
```json
{
  "error": "document_not_found",
  "detail": "Document with ID 550e8400-e29b-41d4-a716-446655440000 does not exist"
}
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "[error_code]",
  "detail": "[human-readable message]",
  "timestamp": "2026-03-11T10:30:00Z"
}
```

**Common error codes**:
- `document_not_found` — Document does not exist
- `invalid_parameter` — Malformed query/path parameter
- `missing_parameter` — Required parameter not provided
- `extraction_failed` — Entity extraction encountered an error; no entities were modified
- `rate_limited` — Groq API rate limit hit; caller should retry
- `internal_error` — Unexpected server error

---

## Data Types

### Entity Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (string) | Unique entity identifier |
| `entity_type` | enum: PERSON, ORGANIZATION, LOCATION, ROLE | Type of entity |
| `canonical_name` | string | Resolved/canonical name of the entity |
| `raw_mentions` | array of strings | All surface forms found in the document |
| `confidence` | float (0.0–1.0) | Confidence score from Groq API |
| `document_id` | UUID (string) | ID of the parent document |
| `chunk_id` | UUID (string, nullable) | ID of the source chunk (null if document-level) |
| `created_at` | ISO 8601 timestamp | When the entity was created/extracted |

### Cytoscape Node Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique node identifier (format: `entity_{entity_id}`) |
| `label` | string | Display label (canonical_name) |
| `data` | object | Metadata for styling and interaction |
| `data.entity_id` | UUID | Reference to Entity id |
| `data.entity_type` | string | Entity type for styling (e.g., CSS classes) |
| `data.confidence` | float | Confidence for transparency scaling |
| `data.document_id` | UUID | Document context |
| `data.chunk_id` | UUID, nullable | Chunk context |
| `data.raw_mentions_count` | integer | Number of mentions found |

---

## Notes

- All UUIDs are serialized as strings in JSON
- All timestamps are ISO 8601 format with UTC timezone (Z suffix)
- Empty arrays `[]` are returned when no entities match; never `null`
- Rate limit responses include a `retry_after` field (seconds to wait) when applicable
- The `/api/v1/graph/` endpoint is optimized for Cytoscape.js visualization; no additional transformation is needed on the frontend

