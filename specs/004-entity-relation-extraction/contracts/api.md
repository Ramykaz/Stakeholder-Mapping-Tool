# API Contract: Entity + Relation Extraction

**Feature**: Entity + Relation Extraction with Graph Integration  
**Version**: 1.0  
**Date**: 2026-03-15

---

## Endpoints

### 1. POST /api/v1/documents/{id}/extract-entities-relations/

Extract named entities AND relations from a document in a single run.

**Method**: `POST`  
**Path**: `/api/v1/documents/{document_id}/extract-entities-relations/`  
**Authentication**: None (MVP)  
**Content-Type**: `application/json`

#### Request Body

```json
{
  "provider": "groq" | "openai",
  "model": "llama-3.1-8b-instant" | "gpt-4o-mini" | "gpt-5-mini" | "gpt-5-nano"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `provider` | string | No | One of: `"groq"`, `"openai"`. Defaults to `groq` if omitted. |
| `model` | string | No | Model name valid for the selected provider. Defaults to provider default if omitted. |

#### Response — Success (HTTP 201 Created)

```json
{
  "status": "completed",
  "document_id": "123e4567-e89b-12d3-a456-426614174000",
  "entities_created": 12,
  "relations_created": 8,
  "run_id": "789e0123-e45b-67c8-d901-234567890abc",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "tokens_input": 3420,
  "tokens_output": 1280,
  "tokens_cached": 512,
  "cost_usd": "0.002340",
  "duration_seconds": 8.4
}
```

| Field | Type | Notes |
|-------|------|-------|
| `status` | string | Always `"completed"` on success (extraction is synchronous) |
| `document_id` | UUID | Echo of the document ID from the path |
| `entities_created` | integer | Number of entities persisted (deduplicated) |
| `relations_created` | integer | Number of relations persisted (deduplicated); 0 if no valid relations found |
| `run_id` | UUID | Identifier of the NERRun record tracking this extraction |
| `provider` | string | Provider used (`groq` or `openai`) |
| `model` | string | Model used |
| `tokens_input` | integer | Total input tokens consumed (entities + relations) |
| `tokens_output` | integer | Total output tokens consumed |
| `tokens_cached` | integer | Cached tokens (OpenAI only; 0 for Groq) |
| `cost_usd` | string | Total cost in USD (OpenAI only; `"0.000000"` for Groq) |
| `duration_seconds` | float | Wall-clock time from start to finish |

#### Response — Errors

| HTTP Status | Scenario | Response Body |
|-------------|----------|---------------|
| 404 Not Found | Document does not exist | `{ "error": "document_not_found", "detail": "Document {id} does not exist" }` |
| 422 Unprocessable Entity | Extraction failed (empty text, LLM error) | `{ "error": "extraction_failed", "detail": "<descriptive message>" }` |
| 429 Too Many Requests | Provider rate limit hit | `{ "error": "rate_limit_exceeded", "detail": "API rate limit exceeded" }` |
| 500 Internal Server Error | Unexpected failure | `{ "error": "internal_error", "detail": "Extraction failed. Please try again or contact support." }` |

#### Behavior

- **Synchronous**: Blocks until extraction completes; returns 201 when done
- **Clean slate**: Deletes all existing entities and relations for the document before extraction begins
- **Atomic**: If any step fails (entity extraction, relation extraction, or storage), the entire transaction rolls back; no partial data persists
- **Validation**: Relations referencing non-existent entities are discarded; self-loops (source = target) are discarded

---

### 2. GET /api/v1/documents/{id}/relations/

Retrieve all relations for a document.

**Method**: `GET`  
**Path**: `/api/v1/documents/{document_id}/relations/`  
**Authentication**: None (MVP)

#### Query Parameters

None.

#### Response — Success (HTTP 200 OK)

```json
{
  "relations": [
    {
      "id": "r1",
      "source_entity_id": "e1",
      "source_entity_name": "Sarah Chen",
      "target_entity_id": "e2",
      "target_entity_name": "Apex Corp",
      "label": "REPORTS_TO",
      "confidence": 0.87,
      "run_id": "run1",
      "document_id": "doc1",
      "created_at": "2026-03-15T10:30:00Z"
    },
    {
      "id": "r2",
      "source_entity_id": "e2",
      "source_entity_name": "Apex Corp",
      "target_entity_id": "e3",
      "target_entity_name": "Ministry of Agriculture",
      "label": "PARTNERS_WITH",
      "confidence": 0.79,
      "run_id": "run1",
      "document_id": "doc1",
      "created_at": "2026-03-15T10:30:00Z"
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `relations` | array | Array of relation objects; empty array if no relations extracted |
| `id` | UUID | Unique relation identifier |
| `source_entity_id` | UUID | ID of the source entity |
| `source_entity_name` | string | Canonical name of the source entity (for convenience) |
| `target_entity_id` | UUID | ID of the target entity |
| `target_entity_name` | string | Canonical name of the target entity (for convenience) |
| `label` | string | Relation type/phrase (e.g., "REPORTS_TO") |
| `confidence` | float | Confidence score (0.0–1.0) |
| `run_id` | UUID | NERRun that extracted this relation |
| `document_id` | UUID | Document this relation belongs to |
| `created_at` | ISO 8601 timestamp | When the relation was created |

#### Response — Errors

| HTTP Status | Scenario | Response Body |
|-------------|----------|---------------|
| 404 Not Found | Document does not exist | `{ "error": "document_not_found", "detail": "Document {id} does not exist" }` |

#### Behavior

- Returns empty array if document has no relations (entity-only extraction or zero valid relations found)
- Ordered by `created_at` DESC (newest first)

---

### 3. GET /api/v1/graph/?document_id={id} (UPDATED)

Retrieve graph data (nodes + edges) for a document in Cytoscape.js format.

**Method**: `GET`  
**Path**: `/api/v1/graph/`  
**Authentication**: None (MVP)

#### Query Parameters

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `document_id` | UUID | Yes | Document to retrieve graph for |
| `confidence_min` | float | No | Minimum confidence threshold (0.0–1.0); filters both nodes and edges |

#### Response — Success (HTTP 200 OK)

```json
{
  "nodes": [
    {
      "data": {
        "id": "e1",
        "label": "Sarah Chen",
        "entity_type": "PERSON",
        "shape": "ellipse",
        "confidence": 0.92,
        "document_id": "doc1",
        "chunk_id": "chunk1"
      }
    },
    {
      "data": {
        "id": "e2",
        "label": "Apex Corp",
        "entity_type": "ORGANIZATION",
        "shape": "rectangle",
        "confidence": 0.88,
        "document_id": "doc1",
        "chunk_id": "chunk2"
      }
    },
    {
      "data": {
        "id": "e3",
        "label": "Ministry of Agriculture",
        "entity_type": "ORGANIZATION",
        "shape": "rectangle",
        "confidence": 0.85,
        "document_id": "doc1",
        "chunk_id": "chunk3"
      }
    }
  ],
  "edges": [
    {
      "data": {
        "id": "r1",
        "source": "e1",
        "target": "e2",
        "label": "REPORTS_TO",
        "confidence": 0.87
      }
    },
    {
      "data": {
        "id": "r2",
        "source": "e2",
        "target": "e3",
        "label": "PARTNERS_WITH",
        "confidence": 0.79
      }
    }
  ]
}
```

**Node fields** (same as before, now with `shape`):

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Entity ID |
| `label` | string | Canonical entity name |
| `entity_type` | string | PERSON, ORGANIZATION, LOCATION, or ROLE |
| `shape` | string | Cytoscape shape: `ellipse`, `rectangle`, `diamond`, or `hexagon` |
| `confidence` | float | Entity confidence (0.0–1.0) |
| `document_id` | UUID | Source document |
| `chunk_id` | UUID | Source chunk (nullable) |

**Edge fields** (NEW):

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Relation ID |
| `source` | UUID | Source entity ID (matches a node `id`) |
| `target` | UUID | Target entity ID (matches a node `id`) |
| `label` | string | Relation label (e.g., "REPORTS_TO") |
| `confidence` | float | Relation confidence (0.0–1.0) |

#### Response — Errors

Same as GET /api/v1/documents/{id}/entities/ (404 if document not found).

#### Behavior

- **Backward compatible**: Documents with only entity extraction (no relations) return `{ nodes: [...], edges: [] }`
- **Confidence filter**: If `confidence_min` is provided, both nodes (entities) and edges (relations) below the threshold are excluded
- **Shape mapping**: Applied server-side based on entity_type; frontend receives pre-mapped shapes

---

## Contract Guarantees

1. **Atomicity**: Entity+relation extraction is a single atomic transaction; either both succeed or both roll back.
2. **Idempotence**: Re-running extraction on the same document with the same provider/model produces a deterministic result (modulo LLM non-determinism).
3. **Referential integrity**: All persisted relations reference valid entities in the same document; no dangling FKs.
4. **Deduplication**: Duplicate entities and relations (across chunks) are merged; highest-confidence instance wins.
5. **Backward compatibility**: Existing `/extract-entities/` endpoint remains unchanged; documents with entity-only runs continue to work in all graph/entity views.
