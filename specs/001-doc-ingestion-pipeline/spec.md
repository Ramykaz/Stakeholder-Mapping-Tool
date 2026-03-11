# Feature Specification: Document Ingestion Pipeline

**Feature Branch**: `001-doc-ingestion-pipeline`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "US-01: Document Ingestion Pipeline — Users upload PDF, DOCX, or TXT files (max 50MB) through a REST API. Files are chunked into semantic segments, embedded using all-MiniLM-L6-v2 (384-dim, local), and stored in Supabase (PostgreSQL + pgvector). Includes Django project skeleton, Docker setup, .env config, and a /health endpoint."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload and Process a Document (Priority: P1)

A user (API client or developer) sends a document file — PDF, DOCX, or TXT — to the ingestion endpoint. The system accepts the file, validates it, breaks it into meaningful semantic chunks, generates a vector embedding for each chunk, and persists those chunks and embeddings to the database so they can be searched later.

**Why this priority**: This is the core value of the pipeline. Without successful ingestion, no downstream NER, reasoning, or graph features can function. It is the single most critical end-to-end flow.

**Independent Test**: Can be fully tested by uploading a sample PDF via the REST API and confirming that the database contains the expected number of chunks with non-null embeddings — delivers a searchable document store as standalone value.

**Acceptance Scenarios**:

1. **Given** a valid PDF file under 50 MB, **When** a user POSTs it to the ingestion endpoint, **Then** the system returns HTTP 202 (Accepted), and the database contains one or more chunks with 384-dimensional embeddings associated with that document.
2. **Given** a valid DOCX file under 50 MB, **When** a user POSTs it to the ingestion endpoint, **Then** the system extracts text, chunks it semantically, embeds each chunk, and stores all chunks in the database.
3. **Given** a valid TXT file under 50 MB, **When** a user POSTs it to the ingestion endpoint, **Then** the system processes and stores all chunks with embeddings.
4. **Given** a file that exceeds 50 MB, **When** a user attempts to upload it, **Then** the system returns HTTP 413 (Payload Too Large) with a descriptive error message.
5. **Given** a file with an unsupported format (e.g., .xlsx, .png), **When** a user attempts to upload it, **Then** the system returns HTTP 415 (Unsupported Media Type) with a descriptive error message.

---

### User Story 2 - Health Check Verification (Priority: P2)

A monitoring system or developer pings the `/health` endpoint to confirm that the service is running and can reach the database.

**Why this priority**: Operational health checks are essential for deployment readiness and infrastructure monitoring, but they deliver no direct business value alone. They are a prerequisite for production reliability.

**Independent Test**: Can be fully tested by sending a GET request to `/health` and confirming a 200 response with service status — provides a standalone liveness indicator for infrastructure tooling.

**Acceptance Scenarios**:

1. **Given** the service is running and the database is reachable, **When** a GET request is made to `/health`, **Then** the system returns HTTP 200 with a JSON body indicating healthy status.
2. **Given** the database is unreachable, **When** a GET request is made to `/health`, **Then** the system returns a non-200 status code indicating degraded or unhealthy status.

---

### User Story 3 - Local Development Environment Setup (Priority: P3)

A developer clones the repository and brings up the full local development environment using Docker Compose, configures the required environment variables, and verifies that all four Django apps (ingestion, ner, reasoning, graph) are registered and the database schema is applied.

**Why this priority**: The development environment setup enables all subsequent contributors to work on the project, but it is infrastructure scaffolding rather than user-facing functionality.

**Independent Test**: Can be fully tested by running `docker compose up`, confirming all containers start without errors, and running Django's system check — delivers a reproducible local development baseline.

**Acceptance Scenarios**:

1. **Given** a `.env` file with valid `DATABASE_URL`, `GROQ_API_KEY`, `DEBUG`, and `ALLOWED_HOSTS` values, **When** a developer runs `docker compose up`, **Then** all services start without errors and the application is accessible on the configured port.
2. **Given** the environment is running, **When** a developer runs Django's management commands, **Then** all four apps (ingestion, ner, reasoning, graph) are recognized and database migrations apply cleanly.
3. **Given** the `.env` file is missing a required variable, **When** the application starts, **Then** it fails with a clear error message naming the missing variable.

---

### Edge Cases

- What happens when an uploaded file is valid in format but contains no extractable text (e.g., a scanned PDF with no OCR layer)?
- **Storage failure during ingestion**: All chunk writes for a document are wrapped in a single transaction. If any write fails, the entire transaction is rolled back and the caller receives an error. No partial document state is persisted.
- What happens when chunking produces zero chunks (e.g., an empty TXT file)?
- How does the system handle concurrent uploads of the same file from multiple clients?
- What happens when the embedding model is unavailable or fails to produce output?

---

## Clarifications

### Session 2026-03-10

- Q: What happens when the database is temporarily unavailable during chunk storage — rollback, partial commit, or retry? → A: Roll back all chunks for the document on any storage failure; return an error to the caller.
- Q: Should duplicate file uploads (same name or content) be deduplicated or allowed? → A: Allow duplicates — each upload creates a new independent Document record; no deduplication for MVP.
- Q: What is the acceptable ingestion processing time for a 50 MB document? → A: Under 60 seconds end-to-end (extract, chunk, embed, store) under normal operating conditions.
- Q: What states does a Document's processing status go through? → A: Three states: `pending` (on creation) → `completed` (success) or `failed` (any processing error, with full rollback).
- Q: Are raw uploaded files retained in storage after processing, or discarded? → A: Discard the raw file immediately after processing; only chunks and embeddings are persisted.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept file uploads of PDF, DOCX, and TXT formats via a REST API endpoint.
- **FR-002**: The system MUST reject uploads exceeding 50 MB with a clear error response indicating the size limit.
- **FR-003**: The system MUST reject files of unsupported formats with a clear error response.
- **FR-004**: The system MUST extract text from uploaded documents (PDF, DOCX, TXT).
- **FR-005**: The system MUST split extracted text into semantic chunks using a consistent chunking strategy.
- **FR-006**: The system MUST generate a 384-dimensional vector embedding for each chunk using the local all-MiniLM-L6-v2 model.
- **FR-007**: The system MUST persist each chunk — including its text content, embedding vector, and reference to the source document — in the database.
- **FR-008**: The system MUST expose a `/health` endpoint that returns the operational status of the service and its database connectivity.
- **FR-009**: The project MUST include four Django applications: `ingestion`, `ner`, `reasoning`, and `graph`, each registered in the project configuration.
- **FR-010**: The project MUST be runnable locally using Docker and Docker Compose without additional manual setup beyond copying a `.env` file.
- **FR-011**: The application MUST read configuration from environment variables: `DATABASE_URL`, `GROQ_API_KEY`, `DEBUG`, and `ALLOWED_HOSTS`.
- **FR-012**: The database MUST have the pgvector extension enabled to support vector similarity storage and queries.
- **FR-013**: The system MUST return a meaningful error response (not an unhandled exception) for any processing failure during ingestion.
- **FR-014**: All chunk writes for a given document MUST be executed within a single atomic transaction; any storage failure MUST trigger a full rollback and return an error to the caller — no partial document state may be persisted.
- **FR-015**: The system MUST discard the raw uploaded file from server storage immediately after processing completes (successfully or not); only chunks and their embeddings are retained.

### Key Entities

- **Document**: Represents an uploaded file. Attributes include a unique identifier, original filename, file format, upload timestamp, and processing status. No uniqueness constraint is applied — duplicate uploads (same filename or same content) each create a new independent Document record. Processing status follows a three-state lifecycle: `pending` (created, not yet processed) → `completed` (all chunks stored successfully) or `failed` (processing error; no chunks retained).
- **Chunk**: Represents a semantic segment derived from a Document. Attributes include the chunk's text content, its 384-dimensional embedding vector, its position/order within the source document, and a foreign key reference to the parent Document.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can clone the repository, copy the `.env` template, run a single command to start the environment, and successfully upload a document within 10 minutes — with no additional manual steps.
- **SC-002**: All three supported file formats (PDF, DOCX, TXT) are processed end-to-end without errors for representative sample documents.
- **SC-003**: Files exceeding the 50 MB limit are rejected 100% of the time without being stored or partially processed.
- **SC-004**: Each uploaded document produces one or more stored chunks, each with a non-null 384-dimensional embedding vector, verifiable by a database query.
- **SC-005**: The `/health` endpoint responds within 1 second under normal operating conditions.
- **SC-008**: A valid 50 MB document is fully ingested (text extracted, chunked, embedded, and stored) within 60 seconds under normal operating conditions.
- **SC-006**: All four Django apps are importable and functional after environment setup, with no migration errors.
- **SC-007**: Invalid or oversized uploads always receive a structured error response (never an unhandled server error).

---

## Assumptions

- The all-MiniLM-L6-v2 model is run locally (not via an external API), so no additional authentication is needed for embedding generation.
- Chunking strategy defaults to sentence-boundary-aware splitting with a target chunk size appropriate for the embedding model's context window; exact chunk size parameters may be refined during planning.
- The Supabase instance is externally provisioned; the application connects to it via `DATABASE_URL` and does not manage Supabase account setup.
- The API does not require authentication for the MVP scope of this user story; access control may be addressed in a future story.
- Raw uploaded files are not persisted to any storage layer; they are processed in-memory or via a temporary file and discarded immediately after ingestion completes.
- Files are processed synchronously in the MVP; async/queue-based processing may be introduced later if performance demands it.
- OCR for image-based PDFs is out of scope for this story; only text-layer PDFs are supported.
- The `GROQ_API_KEY` environment variable is included in configuration for future use by other apps (ner, reasoning) but is not consumed by the ingestion pipeline itself.

---

## Dependencies

- Supabase PostgreSQL instance with pgvector extension enabled (external, pre-provisioned)
- all-MiniLM-L6-v2 model weights available locally at application startup
- Docker and Docker Compose installed on the developer's machine
