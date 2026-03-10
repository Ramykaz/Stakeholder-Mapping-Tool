# API Contracts: Document Ingestion Pipeline

**Branch**: `001-doc-ingestion-pipeline` | **Date**: 2026-03-10
**Phase**: 1 — Design
**Base URL**: `/api/v1`

---

## Endpoints

### POST /api/v1/documents/

Upload a document for ingestion. The system extracts text, chunks it semantically, embeds each chunk, and stores all chunks atomically.

**Authentication**: None (MVP — unauthenticated)

**Request**

| Property | Value |
|----------|-------|
| Method | `POST` |
| Content-Type | `multipart/form-data` |
| Max body size | 50 MB |

| Form Field | Type | Required | Description |
|------------|------|----------|-------------|
| `file` | File | Yes | The document to ingest. Accepted: `.pdf`, `.docx`, `.txt` |

**Success Response — HTTP 201 Created**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "filename": "stakeholder-report-2025.pdf",
  "file_format": "pdf",
  "upload_timestamp": "2026-03-10T09:14:00Z",
  "processing_status": "completed",
  "chunk_count": 42
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID string | Stable document identifier |
| `filename` | string | Original uploaded filename |
| `file_format` | string | One of: `pdf`, `docx`, `txt` |
| `upload_timestamp` | ISO 8601 datetime | UTC timestamp of upload |
| `processing_status` | string | `completed` or `failed` |
| `chunk_count` | integer or null | Number of chunks stored; `null` if `failed` |

**Error Responses**

| HTTP Status | Condition | Response body (example) |
|-------------|-----------|------------------------|
| 413 Payload Too Large | File exceeds 50 MB | `{"error": "File size exceeds the 50 MB limit."}` |
| 415 Unsupported Media Type | File format not supported | `{"error": "Unsupported file format. Accepted: pdf, docx, txt."}` |
| 422 Unprocessable Entity | File is empty or yields no text | `{"error": "No extractable text found in the uploaded document."}` |
| 500 Internal Server Error | Unexpected processing failure | `{"error": "Ingestion failed. Please try again or contact support."}` |

**Notes**:
- Duplicate uploads (same filename or content) are accepted and each creates an independent Document record.
- The request is synchronous. The caller blocks until processing completes or fails (max ~60 seconds for a 50 MB document).
- On failure, the transaction is rolled back: no partial chunks are written and `processing_status` is set to `failed`.
- The raw uploaded file is discarded from server storage immediately after processing.

---

### GET /health

Liveness and readiness check. Returns service status and database connectivity.

**Authentication**: None

**Request**

| Property | Value |
|----------|-------|
| Method | `GET` |
| Content-Type | N/A |

**Success Response — HTTP 200 OK**

```json
{
  "status": "healthy",
  "database": "connected"
}
```

**Degraded Response — HTTP 503 Service Unavailable**

```json
{
  "status": "unhealthy",
  "database": "unreachable"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `healthy` or `unhealthy` |
| `database` | string | `connected` or `unreachable` |

**Notes**:
- Target response time: < 1 second under normal conditions.
- This endpoint does NOT require a working embedding model — it only checks service liveness and database connectivity.

---

## Error Response Schema (all endpoints)

All error responses return a JSON object with a single `error` field:

```json
{
  "error": "Human-readable description of the problem."
}
```

No unhandled exceptions or Django debug tracebacks are exposed to API callers.

---

## Versioning

All endpoints are prefixed with `/api/v1/`. Breaking changes will increment the version prefix. The `/health` endpoint is unversioned (infrastructure convention).
