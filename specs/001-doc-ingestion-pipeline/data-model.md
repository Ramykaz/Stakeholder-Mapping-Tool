# Data Model: Document Ingestion Pipeline

**Branch**: `001-doc-ingestion-pipeline` | **Date**: 2026-03-10
**Phase**: 1 — Design

---

## Entities

### Document

Represents a single uploaded file processed by the ingestion pipeline.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, auto-generated | Stable identifier returned to API caller |
| `filename` | VARCHAR(255) | NOT NULL | Original filename as uploaded; no uniqueness constraint (duplicates allowed) |
| `file_format` | VARCHAR(10) | NOT NULL, one of: `pdf`, `docx`, `txt` | Determined from MIME type + extension at upload |
| `upload_timestamp` | TIMESTAMPTZ | NOT NULL, default: `now()` | Set at record creation; never updated |
| `processing_status` | VARCHAR(20) | NOT NULL, default: `pending` | See state transitions below |
| `chunk_count` | INTEGER | NULLABLE | Set to the number of chunks after successful completion; NULL while pending or failed |

**Uniqueness**: None. Each upload creates a new independent Document record regardless of filename or content.

---

### Chunk

Represents one semantic segment derived from a Document.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, auto-generated | |
| `document_id` | UUID | NOT NULL, FOREIGN KEY → Document(id) ON DELETE CASCADE | Links chunk to its parent document |
| `text` | TEXT | NOT NULL | The raw extracted text of this chunk |
| `embedding` | VECTOR(384) | NOT NULL | 384-dimensional float embedding from all-MiniLM-L6-v2 |
| `chunk_index` | INTEGER | NOT NULL, >= 0 | 0-based position of this chunk within the source document |
| `token_count` | INTEGER | NOT NULL, 1 ≤ token_count ≤ 256 | Verified pre-embedding; ensures model input is within context window |

**Uniqueness**: `(document_id, chunk_index)` must be unique — no two chunks in the same document share a position.

---

## Relationships

```
Document  1 ──────────────────── N  Chunk
          (document_id FK + CASCADE)
```

- One Document has zero or more Chunks (zero while `pending` or `failed`; one or more when `completed`)
- Deleting a Document cascades to all its Chunks
- Chunk creation and Document status update occur within a single atomic transaction (FR-014)

---

## State Transitions — Document.processing_status

```
          ┌─────────┐
  upload  │         │
 ────────►│ pending │
          │         │
          └────┬────┘
               │ processing begins (synchronous)
       ┌───────┴────────┐
       │                │
       ▼                ▼
  ┌──────────┐    ┌────────┐
  │completed │    │ failed │
  └──────────┘    └────────┘
```

| Transition | Trigger | Side Effects |
|------------|---------|--------------|
| `pending` → `completed` | All chunks written and committed successfully | `chunk_count` set to number of chunks stored |
| `pending` → `failed` | Any processing error (extraction, chunking, embedding, or storage failure) | Full transaction rollback; no Chunk records persist; `chunk_count` remains NULL |

**Note**: There is no `processing` intermediate state in the MVP. Status moves from `pending` directly to `completed` or `failed` within the synchronous request lifecycle.

---

## Validation Rules

### At API boundary (before any database write)

| Rule | Behaviour on violation |
|------|----------------------|
| File size ≤ 50 MB | HTTP 413, no processing |
| File format is `pdf`, `docx`, or `txt` | HTTP 415, no processing |
| File is not empty | HTTP 422, no processing |

### At processing layer

| Rule | Behaviour on violation |
|------|----------------------|
| Extracted text is non-empty | Document status → `failed`; HTTP 422 with descriptive error |
| Token count per chunk: 1–256 | Enforced by chunker; chunks below 50 tokens merged, chunks above 256 split |
| Embedding dimension = 384 | Enforced by embedder; mismatch raises a processing error → `failed` |

---

## pgvector Index

```sql
-- Created at migration time on the chunks table
CREATE INDEX chunk_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

- **Type**: IVFFlat
- **Metric**: Cosine similarity (`vector_cosine_ops` / `<=>` operator)
- **Initial `lists`**: 100 (sufficient for up to ~10,000 vectors)
- **Migration path**: Rebuild with `lists = sqrt(N)` at 10k+ vectors; evaluate HNSW at 50k+ vectors

---

## Django App Ownership

| Model | Django App |
|-------|-----------|
| `Document` | `ingestion` |
| `Chunk` | `ingestion` |

NER, reasoning, and graph apps do not own models in this story — they are registered as empty Django applications.
