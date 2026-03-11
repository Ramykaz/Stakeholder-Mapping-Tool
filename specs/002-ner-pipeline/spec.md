# Feature Specification: NER Pipeline + Entity API + Basic Frontend

**Feature Branch**: `002-ner-pipeline`
**Created**: 2026-03-11
**Status**: Ready for Planning
**Input**: User description: "US-02: NER Pipeline + Entity API + Basic Frontend. Part 1 — NER Pipeline: Extract named entities from ingested document chunks already stored in Supabase from US-01. Use Groq API (Llama 3 free tier) — LLM-based NER. Entity types: People, Organizations, Locations, Roles. Entity deduplication and canonical name resolution. Store entities in new Supabase entities table linked to source document and chunk. REST endpoint: POST /api/v1/documents/{id}/extract-entities/ Part 2 — Entity + Graph API: GET /api/v1/documents/{id}/entities/ GET /api/v1/graph/?document_id={id} — entity nodes only, no edges yet. Part 3 — Basic Frontend: Next.js frontend scaffold. Cytoscape.js for graph visualization. Pages: upload document, view entities list, basic graph nodes view. Connect to Django backend at http://localhost:8000. Frontend runs in its own Docker container added to docker-compose.yml."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract and Deduplicate Named Entities from Document Chunks (Priority: P1)

A data analyst has uploaded a document via US-01, which is now stored as chunks in the database. The analyst triggers entity extraction on that document. The system calls the Groq Llama 3 API to identify named entities (PERSON, ORGANIZATION, LOCATION, ROLE) in each chunk. The system deduplicates mentions across chunks (e.g., "John Smith" and "John S." are recognized as the same person), resolves canonical names, and stores entities with confidence scores and source references.

**Why this priority**: This is the core value of the feature. Without successful entity extraction, no downstream graph visualization, reasoning, or stakeholder analysis can occur. It directly enables the primary use case of extracting stakeholder knowledge from documents.

**Independent Test**: Can be fully tested by calling POST /api/v1/documents/{id}/extract-entities/ on a document with chunks, waiting for completion, and verifying that Entity records are created in the database with canonical names, confidence scores, and deduplicated raw mentions — delivers a queryable entity knowledge base as standalone value.

**Acceptance Scenarios**:

1. **Given** a document with multiple chunks containing entity mentions, **When** POST /api/v1/documents/{id}/extract-entities/ is called, **Then** the system calls the Groq API with each chunk's text content and receives entity extraction results.
2. **Given** Groq API returns entity mentions, **When** the system processes the results, **Then** entities are stored in the database with attributes: id (UUID), entity_type (PERSON/ORGANIZATION/LOCATION/ROLE), canonical_name, raw_mentions (JSON array of all surface forms), confidence (float 0-1), and links to Document and source Chunk.
3. **Given** the same entity is mentioned in multiple chunks with different surface forms (e.g., "John Smith" and "J. Smith"), **When** the system deduplicates, **Then** a single Entity record is created with raw_mentions containing both forms and a canonical_name representing the resolved identity.
4. **Given** entity extraction is triggered, **When** the operation completes successfully, **Then** the system returns HTTP 202 (Accepted) and extraction occurs asynchronously or synchronously (to be clarified in planning).
5. **Given** the Groq API is unreachable or returns an error, **When** the extraction process encounters this failure, **Then** the system returns an error response and no partial Entity records are persisted.
6. **Given** Confidence is calculated by Groq for each extracted entity, **When** the entity is stored, **Then** a confidence score (0.0 to 1.0) is included for each entity record.

---

### User Story 2 - Retrieve Entities for a Document via REST API (Priority: P1)

A frontend application or external client needs to retrieve the list of extracted entities for a specific document. They call a GET endpoint and receive a comprehensive entity list with all attributes, enabling further processing.

**Why this priority**: Necessary for all downstream consumption (frontend display, graph construction, analysis pipelines). Without this endpoint, extracted entities are inaccessible and the extraction feature provides no value.

**Independent Test**: Can be fully tested by calling GET /api/v1/documents/{id}/entities/ after entities are extracted and verifying response structure, data completeness, and correctness — provides the entity retrieval capability as standalone value.

**Acceptance Scenarios**:

1. **Given** a document with extracted entities, **When** GET /api/v1/documents/{id}/entities/ is called, **Then** HTTP 200 is returned with a JSON array of entity objects.
2. **Given** the response is returned, **When** each entity object is inspected, **Then** it contains: id, entity_type, canonical_name, raw_mentions, confidence, chunk_id (or null if document-level), document_id, and created_at.
3. **Given** no entities exist for a document (not yet extracted), **When** the endpoint is called, **Then** HTTP 200 is returned with an empty array.
4. **Given** a request with a non-existent document_id, **When** the endpoint is called, **Then** HTTP 404 is returned with an error message.
5. **Given** entities are extracted with different confidence levels, **When** the endpoint is called, **Then** all entities are returned regardless of confidence threshold (filtering can be added later if needed).

---

### User Story 3 - Retrieve Entity Graph Nodes via REST API (Priority: P1)

A frontend application needs entity data in a graph format compatible with Cytoscape.js visualization. The API returns entity nodes (edges are out of scope for this feature) formatted as Cytoscape request format, enabling direct use in visualization components.

**Why this priority**: Enables graph visualization on the frontend. Without this endpoint properly formatted, the graph feature cannot render correctly and users cannot see the visual stakeholder network.

**Independent Test**: Can be fully tested by calling GET /api/v1/graph/?document_id={id} and verifying response format (Cytoscape nodes array), completeness, and data accuracy — provides graph-ready entity data as standalone value.

**Acceptance Scenarios**:

1. **Given** a document with extracted entities, **When** GET /api/v1/graph/?document_id={id} is called, **Then** HTTP 200 is returned with a JSON response containing a `nodes` array in Cytoscape format.
2. **Given** the response is returned, **When** the nodes array is inspected, **Then** each node object contains: `id` (entity UUID), `label` (canonical_name), and `data` object with entity metadata (entity_type, confidence, document_id, chunk_id).
3. **Given** no entities exist for a document, **When** the endpoint is called, **Then** HTTP 200 is returned with `nodes: []` (empty array).
4. **Given** a request with a non-existent document_id, **When** the endpoint is called, **Then** HTTP 404 is returned with an error message.
5. **Given** Cytoscape.js frontend reads the response, **When** the nodes are used to render a graph, **Then** the format is compatible and renders without errors (no transformation of the response is needed).

---

### User Story 4 - Basic Frontend with Pages for Document Upload, Entities, and Graph Visualization (Priority: P2)

A data analyst accesses a web interface that provides the complete workflow: upload a document, view extracted entities, and visualize entity relationships. The frontend is a Next.js application running in Docker, connecting to the Django backend, and providing pages for document management and entity visualization.

**Why this priority**: Provides the user-facing interface for analysts to interact with the system. Depends on all P1 APIs and infrastructure being ready. Without this, the backend capabilities are only accessible via API calls; users need a cohesive visual interface.

**Independent Test**: Can be fully tested by starting the frontend container, loading pages in a browser, verifying API connectivity to the backend, and checking that data displays correctly and is responsive — provides the complete end-to-end UI layer as standalone value.

**Acceptance Scenarios**:

1. **Given** the frontend is defined in a Next.js project and packaged in Docker, **When** `docker-compose up` is run, **Then** the frontend container starts without errors and is accessible on a configured port (default: 3000).
2. **Given** the frontend loads in a browser, **When** the page makes HTTP requests to backend APIs, **Then** requests are successful and return expected data (Frontend connects to http://localhost:8000 as configured).
3. **Given** the document upload page is loaded, **When** a user selects a file from their computer, **Then** the form displays the file name and provides a submit button to trigger upload.
4. **Given** a user submits the upload form, **When** the backend endpoint receives the file, **Then** the frontend receives a success response (or appropriate error) and can display status to the user.
5. **Given** the entities list page is loaded for a document with extracted entities, **When** the page renders, **Then** all entities are displayed in a table or list format showing canonical_name, entity_type, confidence, and raw_mentions.
6. **Given** the graph visualization page is loaded, **When** entities exist for the document, **Then** Cytoscape.js successfully renders entity nodes in a visual layout (e.g., grid or force-directed).
7. **Given** Cytoscape.js library fails to load from CDN or local import, **When** the graph page attempts to render, **Then** an error message is displayed and the rest of the page remains functional.
8. **Given** the frontend receives an error response from the backend, **When** the user views the page, **Then** a clear and user-friendly error message is displayed explaining what went wrong.

---

### Edge Cases

- What happens when entity extraction is triggered multiple times for the same document? → Each extraction replaces all previous entities with newly extracted ones (clean slate); this allows users to refresh results with improved extraction logic and removes stale data. See Clarifications section for decision.
- How are homonym entities handled (e.g., "Washington" as a person name vs. location)? → Context from chunk and Groq API should disambiguate; if ambiguous, multiple entities may be created and user review is required.
- What happens if a chunk contains no extractable entities? → The chunk is processed normally, no entities are created for it, extraction still completes successfully.
- What if Groq API rate limits are hit during batch extraction? → The system fails immediately with HTTP 429 error and returns a message to the user; manual retry is caller's responsibility. See Clarifications section for decision.
- What if the frontend attempts to access entities before extraction is complete? → Empty list is returned (HTTP 200 with empty array); frontend shows "no entities extracted yet" message; user can refresh after extraction completes.
- What if the Cytoscape.js visualization page loads but the backend API is temporarily unreachable? → The graph page renders with an error message, and the user can retry.
- How are entities handled if their canonical names are identical but confidence scores differ? → Merge into single Entity record, use the highest confidence score, or average (to be determined in planning).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a REST endpoint POST /api/v1/documents/{id}/extract-entities/ that accepts a document ID and triggers named entity extraction for all chunks belonging to that document. If entities already exist for the document, the extraction MUST replace all previous entities and create new Entity records based on the latest extraction results.
- **FR-002**: The system MUST call the Groq Llama 3 API for each chunk to extract named entities of types: PERSON, ORGANIZATION, LOCATION, ROLE.
- **FR-003**: The system MUST deduplicate entity mentions across multiple chunks (e.g., merging "John Smith" from chunk 1 and "J. Smith" from chunk 2 into a single canonical entity).
- **FR-004**: The system MUST resolve and store a canonical name for each unique entity, along with a JSON array of all surface forms (raw mentions) found in the document.
- **FR-005**: The system MUST store each entity in a Supabase table with attributes: id (UUID), document_id (FK), chunk_id (FK, nullable), entity_type (enum: PERSON/ORGANIZATION/LOCATION/ROLE), canonical_name, raw_mentions (JSON array), confidence (float 0-1), created_at (timestamp).
- **FR-006**: The system MUST expose a REST endpoint GET /api/v1/documents/{id}/entities/ that returns a complete list of entities for a given document, including all attributes.
- **FR-007**: The system MUST expose a REST endpoint GET /api/v1/graph/?document_id={id} that returns entity nodes in Cytoscape.js-compatible format (nodes array with id, label, data).
- **FR-008**: The system MUST NOT persist partial or incomplete entity extraction results if any error occurs during the process; either all entities for a batch are committed or none are.
- **FR-009**: The system MUST include a Next.js frontend application with pages for: (1) document upload, (2) entities list view, (3) entity graph visualization.
- **FR-010**: The frontend MUST connect to the Django backend at http://localhost:8000 via HTTP REST API calls.
- **FR-011**: The frontend MUST be containerized in Docker and run as a separate service in docker-compose.yml, accessible on a configured port (default 3000).
- **FR-012**: The frontend MUST use Cytoscape.js for entity graph visualization on the graph visualization page.
- **FR-013**: The system MUST handle errors gracefully; any failure in entity extraction, API retrieval, or frontend connectivity MUST return a meaningful error response or user-friendly message (never an unhandled exception).
- **FR-014**: The system MUST validate that a document_id refers to a valid document before processing; invalid IDs MUST return HTTP 404.
- **FR-015**: If the Groq API is rate-limited (HTTP 429 or equivalent error response), the system MUST immediately fail the extraction request and return HTTP 429 (Too Many Requests) to the caller with a clear error message. The system MUST NOT implement automatic retry, backoff, or queueing; the caller is responsible for retry logic.

### Key Entities

- **Entity**: Represents a named entity extracted from a document's chunks. Attributes include: unique identifier (UUID), reference to Document (FK), reference to source Chunk (FK, nullable for document-level entities), entity type (enumeration: PERSON, ORGANIZATION, LOCATION, ROLE), canonical name (resolved identity), raw mentions (JSON array of all textual forms found), confidence score (float 0-1 from Groq), and creation timestamp. Entities are unique within a document; duplicate mentions across chunks are merged into a single Entity with a raw_mentions list.

- **Document**: Represents an uploaded file (from US-01). The Entity feature links entities to documents and their constituent chunks. No changes to the Document model from US-01 in this feature; used as a foreign key reference only.

- **Chunk**: Represents a semantic segment from a Document (from US-01). Entities are linked to source chunks to enable document-level provenance tracking. No changes to the Chunk model in this feature; used as a foreign key reference only.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can trigger entity extraction on a document by calling POST /api/v1/documents/{id}/extract-entities/ and see Entity records created in the database within 30 seconds for a document with up to 50 chunks.
- **SC-002**: Calling GET /api/v1/documents/{id}/entities/ returns all entities for a document within 1 second, including all required attributes (id, entity_type, canonical_name, raw_mentions, confidence, chunk_id, document_id, created_at).
- **SC-003**: Calling GET /api/v1/graph/?document_id={id} returns entity nodes in valid Cytoscape.js format that can be directly rendered in Cytoscape without additional transformation.
- **SC-004**: The frontend application starts in Docker without errors and all pages (upload, entities, graph) load in under 3 seconds on a standard connection.
- **SC-005**: Cytoscape.js renders entity graphs with 100+ nodes without performance degradation (visible within 2 seconds after page load).
- **SC-006**: Entity deduplication correctly merges mentions of the same entity across chunks with 95% accuracy on a representative test corpus (e.g., 10 sample documents with known entities).
- **SC-007**: The frontend displays appropriate error messages (no unhandled exceptions) when backend APIs are unavailable or return errors.
- **SC-008**: All four Django apps (ingestion, ner, reasoning, graph) remain importable and functional after adding the NER pipeline; no migration errors or conflicts.

---

## Assumptions

- The Groq Llama 3 API is accessible during development and production using the free tier; no authentication beyond `GROQ_API_KEY` environment variable is required.
- Entity deduplication and canonicalization logic is implemented by Groq's response or by a post-processing step in the backend (specific approach deferred to planning); the specification assumes this capability is available.
- The Document and Chunk models from US-01 are complete and stable; no schema changes to those models are needed for this feature.
- The frontend assumes chunks are already extracted and available via the backend; it does not perform chunk extraction itself.
- The Cytoscape.js visualization is a static node layout (no interactive edge creation or editing); edges and relationships are future work.
- Entity extraction is triggered manually via the REST endpoint; no automatic triggering on document upload is included in this scope.
- Frontend runs on localhost:3000 in development; URL configuration for production is out of scope.
- User authentication and authorization are out of scope; all API endpoints are accessible without authentication (can be added in a future story).
- Backend handles CORS configuration to allow frontend requests from localhost:3000 (or appropriate domain).
- Raw uploaded files (from US-01) are already discarded after ingestion; this feature does not re-download or re-extract files.
- Conflicts or overlapping NEEDS CLARIFICATION items noted below may be resolved during planning rather than blocking specification.
- Re-extraction of entities for the same document replaces all previous entities (clean slate); this decision allows users to refresh results and prevents stale data accumulation.
- The system fails immediately if Groq API rate limits are hit; callers implement their own retry strategy (no built-in backoff or queueing).

---

## Clarifications

### Session 2026-03-11

- Q: What should happen if entity extraction is triggered multiple times for the same document? → A: Replace all existing entities with newly extracted ones (clean slate approach). This allows users to refresh results with improved extraction models and prevents accumulation of stale entities.

- Q: How should the system respond when Groq API rate limits are hit? → A: Fail immediately with HTTP 429 error. System does not implement automatic retry or queueing; the caller (frontend or external service) is responsible for implementing retry logic as needed.

---

## Dependencies

- Groq Llama 3 API with free tier access and valid `GROQ_API_KEY` environment variable
- Supabase PostgreSQL instance with pgvector extension (from US-01) and a new `entities` table
- Document and Chunk models from US-01 (must be stable)
- Docker and Docker Compose for containerizing the frontend
- Next.js and Cytoscape.js JavaScript libraries (to be installed via npm)
- Django REST Framework endpoints (already available from US-01; reused for new endpoints)

