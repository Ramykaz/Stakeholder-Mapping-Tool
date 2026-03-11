# Tasks: NER Pipeline + Entity API + Basic Frontend

**Input**: Design documents from `/specs/002-ner-pipeline/`
**Prerequisites**: spec.md (4 user stories), plan.md (technical context, constraints), contracts/ (api.md, frontend.md, prompt.md)
**Tests**: Tests are INCLUDED — pytest for backend, Jest for frontend. Tests MUST be written first and FAIL before implementation.

**Organization**: Tasks grouped by user story to enable independent implementation and testing. Backend and frontend work can proceed in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Paths: `ingestion/` (US-01 app), `ner/` (new US-02 app), `frontend/` (new Next.js app)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create `ner/` Django app structure (models.py, views.py, serializers.py, services/, urls.py, tests/)
- [ ] T002 [P] Create `frontend/` Next.js 14 project structure with TypeScript, ESLint, Tailwind CSS (optional styling)
- [ ] T003 Create `prompts/` directory; commit empty `prompts/ner-extraction-v1.md` and `prompts/ner-extraction-v1.txt` placeholders
- [ ] T004 Update `docker-compose.yml`: add frontend service for Next.js app (port 3000, volume mounts for hot reload)
- [ ] T005 Create `frontend/Dockerfile` for multi-stage build (Node.js 20 base, build output, production image)
- [ ] T006 [P] Update `requirements.txt`: add `groq` Python SDK and any other missing backend dependencies
- [ ] T007 [P] Initialize `frontend/package.json`: add Next.js 14, React 18, axios, Cytoscape.js, Jest, React Testing Library, TypeScript dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database Schema & Models

- [ ] T008 Create Django migration: new `Entity` model in `ner/models.py` with fields:
  - `id` (UUID primary key)
  - `entity_type` (CharField, choices: PERSON, ORGANIZATION, LOCATION, ROLE)
  - `canonical_name` (CharField, indexed)
  - `raw_mentions` (JSONField: list of surface forms from extraction)
  - `confidence` (FloatField, 0.0–1.0, indexed)
  - `document_id` (ForeignKey to ingestion.Document)
  - `chunk_id` (ForeignKey to ingestion.Chunk, nullable)
  - `created_at` (DateTimeField auto_now_add)
  - Unique constraint on (canonical_name, document_id, entity_type)

- [ ] T009 Create Django migration for Entity model (run migrations; ensures Supabase schema updated)

### Authentication & Authorization

- [ ] T010 [P] Document that MVP has NO authentication (all endpoints public); add comment in `ner/views.py`

### Base Services & Utilities

- [ ] T011 [P] Create `ner/services/__init__.py`
- [ ] T012 [P] Create `ner/services/groq_client.py`: 
  - Function `load_ner_prompt()` → reads `prompts/ner-extraction-v1.md`
  - Function `extract_entities_from_chunk(chunk_text: str) → dict` → calls Groq Llama 3 API
  - Error handling: raises exceptions on API failure, rate limit (HTTP 429), or invalid JSON response

- [ ] T013 [P] Create `ner/services/deduplicator.py`:
  - Function `deduplicate_entities(extracted_entities: list, existing_entities: QuerySet) → list` → merges duplicates
  - Deduplication logic: match canonical_name + document_id + entity_type; if no match, create new
  - Return list of Entity objects ready for bulk_create or update

- [ ] T014 Create `ner/services/pipeline.py`:
  - Function `extract_entities_for_document(document_id: str) → dict` (orchestrates extraction for all document chunks)
  - Delete all existing entities for document (clean slate per clarification)
  - Loop through all chunks, call groq_client.extract_entities_from_chunk()
  - Deduplicate results via deduplicator.deduplicate_entities()
  - Bulk create Entity records in database
  - Return { entities_created: int }

### Serializers & API Infrastructure

- [ ] T015 [P] Create `ner/serializers.py`:
  - `EntitySerializer` (read-only) → matches api.md schema: id, entity_type, canonical_name, raw_mentions, confidence, chunk_id, document_id, created_at
  - `CytoscapeNodeSerializer` (read-only) → matches api.md schema: id, label (canonical_name), data (nested object with entity_type, confidence, document_id, chunk_id, raw_mentions_count)

### API Views Framework

- [ ] T016 Create `ner/views.py` base structure:
  - Import DRF generics, Response, status
  - Define error handling helper: `handle_groq_error(exception) → Response` (catches rate limit, API errors)
  - Add logging setup

- [ ] T017 [P] Update `ner/urls.py`: 
  - Add URL patterns (endpoints defined in api.md)
  - POST /api/v1/documents/{id}/extract-entities/ → ExtractEntitiesView
  - GET /api/v1/documents/{id}/entities/ → DocumentEntitiesView
  - GET /api/v1/graph/?document_id={id} → GraphNodesView

### Frontend Base Setup

- [ ] T018 [P] Initialize Next.js app: `npx create-next-app@latest frontend --typescript --tailwind --eslint`
- [ ] T019 [P] Create `frontend/src/lib/api.ts`: axios client instance (baseURL: http://localhost:8000, timeout: 10000, error interceptor)
- [ ] T020 [P] Create TypeScript interfaces in `frontend/src/types/index.ts`:
  - `Entity`, `Document`, `CytoscapeNode`, `GraphResponse`, `ApiErrorResponse` (match api.md schemas)
- [ ] T021 [P] Create `frontend/src/pages` directory structure: _app.tsx, _document.tsx
- [ ] T022 [P] Create error boundary component: `frontend/src/components/ErrorBoundary.tsx`

**Checkpoint**: Foundation complete ✅ — all models, services, and infrastructure in place. User story implementation can now proceed in parallel.

---

## Phase 3: User Story 1 — Extract and Deduplicate Named Entities (Priority: P1) 🎯 MVP

**Goal**: Extract named entities (PERSON, ORGANIZATION, LOCATION, ROLE) from document chunks using Groq Llama 3, deduplicate across chunks, store with confidence scores and canonical names.

**Independent Test**: Call POST /api/v1/documents/{id}/extract-entities/, wait for synchronous completion, verify Entity records created in database with correct canonical names, confidence scores, deduplicated raw mentions.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T023 [P] [US1] Unit test: `ner/tests/test_groq_client.py`
  - Test `extract_entities_from_chunk()` with mock Groq_response → returns dict with entities array
  - Test error handling: Groq API timeout → raises GroqAPIError
  - Test error handling: invalid JSON response → raises JSONDecodeError

- [ ] T024 [P] [US1] Unit test: `ner/tests/test_deduplicator.py`
  - Test deduplication: same entity_type + canonical_name + document_id → merged into 1 Entity with combined raw_mentions
  - Test deduplication: different entity_type (same canonical_name) → creates separate Entity records
  - Test deduplication: no existing entities → all extracted entities created as new

- [ ] T025 [P] [US1] Unit test: `ner/tests/test_pipeline.py`
  - Test extract_entities_for_document() with 3 chunks → deletes old entities, creates new ones, returns entities_created count
  - Test pipeline error handling: Groq API rate limit (429) → raises exception, no entities persisted (rollback)

- [ ] T026 [US1] Integration test: `ner/tests/test_views.py::test_extract_entities_success`
  - Setup: Create document with 2 chunks containing entity mentions
  - Call: POST /api/v1/documents/{id}/extract-entities/
  - Verify: Response status 201 Created
  - Verify: Response body contains { status, document_id, entities_created, message }
  - Verify: entities_created > 0, Entity records in database match extracted data

- [ ] T027 [US1] Integration test: `ner/tests/test_views.py::test_extract_entities_document_not_found`
  - Call: POST /api/v1/documents/nonexistent-id/extract-entities/
  - Verify: Response status 404 Not Found with error message

- [ ] T028 [US1] Integration test: `ner/tests/test_views.py::test_extract_entities_groq_rate_limit`
  - Setup: Mock Groq API to return 429 (rate limit)
  - Call: POST /api/v1/documents/{id}/extract-entities/
  - Verify: Response status 429 Too Many Requests with retry_after header
  - Verify: No Entity records created (transaction rolled back)

- [ ] T029 [US1] Integration test: `ner/tests/test_views.py::test_extract_entities_replaces_previous`
  - Setup: Create document, extract entities, verify entities_created = N
  - Call: Extract again on same document
  - Verify: Response shows entities_created = M (new count)
  - Verify: Database contains M entities (not N+M) — old entities deleted

### Implementation for User Story 1

- [ ] T030 [US1] Implement `ner/services/groq_client.py::extract_entities_from_chunk()` (depends on T012)
  - Load prompt from `prompts/ner-extraction-v1.md`
  - Call Groq Llama 3 API with chunk text
  - Parse JSON response from Groq
  - Return { entities: [{ entity_type, text, confidence }] }
  - Error handling: API timeout → log and re-raise as GroqAPIError
  - Error handling: rate limit (429) → extract retry-after header, re-raise as GroqRateLimitError

- [ ] T031 [US1] Implement prompt file: `prompts/ner-extraction-v1.md` (depends on T003)
  - Define system prompt for Groq Llama 3
  - Specify entity types: PERSON, ORGANIZATION, LOCATION, ROLE with definitions and examples
  - Specify input (chunk text), output JSON schema
  - Specify confidence scoring guidelines (0.9+/0.7-0.9/0.5-0.7/<0.5)
  - Include extraction instructions and edge cases

- [ ] T032 [US1] Implement `ner/services/deduplicator.py::deduplicate_entities()` (depends on T013)
  - Input: list of extracted entities from Groq, QuerySet of existing entities from database
  - For each extracted entity:
    - Check if (canonical_name, document_id, entity_type) exists in QuerySet
    - If match: merge raw_mentions (union of old + new), use highest confidence, mark for update
    - If no match: create new Entity object
  - Return list of Entity objects (mix of updates/creates)

- [ ] T033 [US1] Implement `ner/services/pipeline.py::extract_entities_for_document()` (depends on T014)
  - Get document by ID (or raise 404 if not found)
  - Delete ALL existing entities for this document (clean slate)
  - Get all chunks for document
  - For each chunk: call groq_client.extract_entities_from_chunk() (error handling per T032)
  - Aggregate all extracted entities
  - Call deduplicator.deduplicate_entities() to merge duplicates
  - Bulk create Entity records in database
  - Return { entities_created: count }
  - Transaction safety: wrap in atomic transaction; rollback on error

- [ ] T034 [US1] Create API view: `ner/views.py::ExtractEntitiesView` (depends on T016, T030-T033)
  - HTTP method: POST
  - URL: /api/v1/documents/{id}/extract-entities/
  - Handler: Calls pipeline.extract_entities_for_document(document_id)
  - Success response: 201 Created
    - Body: { status: "extraction_completed", document_id, entities_created, message }
  - Error responses:
    - 404 Not Found: document does not exist
    - 429 Too Many Requests: Groq API rate limit (include retry_after header)
    - 500 Internal Server Error: other failures (log exception)
  - Processing: Synchronous (waits for completion before returning response)

**Checkpoint**: User Story 1 complete ✅ — entities can be extracted, deduplicated, stored. Backend retrieves entities via database. Can be tested independently via API.

---

## Phase 4: User Story 2 — Retrieve Entities for a Document via REST API (Priority: P1)

**Goal**: Provide GET endpoint that returns all extracted entities for a document in list format with full attributes.

**Independent Test**: Call GET /api/v1/documents/{id}/entities/ and verify response contains complete entity objects with all attributes (id, entity_type, canonical_name, raw_mentions, confidence, chunk_id, document_id, created_at).

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T035 [P] [US2] Integration test: `ner/tests/test_views.py::test_get_entities_success`
  - Setup: Create document with extracted entities (4+ entities, different types, various confidence levels)
  - Call: GET /api/v1/documents/{id}/entities/
  - Verify: Response status 200 OK
  - Verify: Response body matches api.md schema:
    - { document_id, entities: [{ id, entity_type, canonical_name, raw_mentions, confidence, chunk_id, document_id, created_at }], total_count }
  - Verify: All entities returned regardless of confidence (no filtering applied)

- [ ] T036 [P] [US2] Integration test: `ner/tests/test_views.py::test_get_entities_empty_document`
  - Setup: Create document with NO extracted entities
  - Call: GET /api/v1/documents/{id}/entities/
  - Verify: Response status 200 OK with empty entities array: { document_id, entities: [], total_count: 0 }

- [ ] T037 [P] [US2] Integration test: `ner/tests/test_views.py::test_get_entities_document_not_found`
  - Call: GET /api/v1/documents/nonexistent-id/entities/
  - Verify: Response status 404 Not Found with error message

- [ ] T038 [P] [US2] Integration test: `ner/tests/test_views.py::test_get_entities_with_filters` (optional, for future enhancement)
  - Setup: Create document with mixed entity types and confidence levels
  - Call: GET /api/v1/documents/{id}/entities/?entity_type=PERSON&confidence_min=0.7
  - Verify: Response filters entities by type and minimum confidence
  - **Note**: Not required for MVP; placeholder for future feature

### Implementation for User Story 2

- [ ] T039 [US2] Create API view: `ner/views.py::DocumentEntitiesView` (depends on T015)
  - HTTP method: GET
  - URL: /api/v1/documents/{id}/entities/
  - Handler: Queries Entity table, filters by document_id
  - Success response: 200 OK
    - Body: { document_id, entities: [EntitySerializer], total_count }
  - Error responses:
    - 404 Not Found: document does not exist
    - 500 Internal Server Error: database query failure
  - Optional parameters (future enhancement): entity_type, confidence_min (extract from query params, apply to QuerySet)

- [ ] T040 [US2] Add pagination (optional, for scalability):
  - If more than 100 entities, implement limit/offset pagination
  - Add to response: { document_id, entities: [...], total_count, page, page_size }

**Checkpoint**: User Story 2 complete ✅ — entities can be retrieved via REST API. Can be tested independently.

---

## Phase 5: User Story 3 — Retrieve Entity Graph Nodes via REST API (Priority: P1)

**Goal**: Provide GET endpoint that returns entity data formatted for Cytoscape.js visualization as graph nodes (edges out of scope).

**Independent Test**: Call GET /api/v1/graph/?document_id={id}, verify response contains Cytoscape-compatible node array with id, label, and nested data object.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T041 [P] [US3] Integration test: `ner/tests/test_views.py::test_get_graph_nodes_success`
  - Setup: Create document with extracted entities (mix of types, various confidence levels)
  - Call: GET /api/v1/graph/?document_id={id}
  - Verify: Response status 200 OK
  - Verify: Response body matches api.md Cytoscape schema:
    - { document_id, nodes: [{ id, label, data: { entity_id, entity_type, confidence, document_id, chunk_id, raw_mentions_count } }], total_nodes }
  - Verify: label === canonical_name, raw_mentions_count = len(raw_mentions)

- [ ] T042 [P] [US3] Integration test: `ner/tests/test_views.py::test_get_graph_nodes_empty_document`
  - Setup: Create document with NO extracted entities
  - Call: GET /api/v1/graph/?document_id={id}
  - Verify: Response status 200 OK with empty nodes array: { document_id, nodes: [], total_nodes: 0 }

- [ ] T043 [P] [US3] Integration test: `ner/tests/test_views.py::test_get_graph_nodes_document_not_found`
  - Call: GET /api/v1/graph/?document_id=nonexistent-id
  - Verify: Response status 404 Not Found with error message

- [ ] T044 [P] [US3] Integration test: `ner/tests/test_views.py::test_get_graph_nodes_cytoscape_format`
  - Setup: Create document with entities
  - Call: GET /api/v1/graph/?document_id={id}
  - Verify: Response format is valid Cytoscape.js node format (can be directly passed to cy.add())
  - Verify: No transformation needed on frontend (format matches contract exactly)

### Implementation for User Story 3

- [ ] T045 [P] [US3] Create CytoscapeNode helper class in `ner/serializers.py`:
  - Input: Entity object
  - Output: { id, label (canonical_name), data: { entity_id: id, entity_type, confidence, document_id, chunk_id, raw_mentions_count } }
  - Note: Rename `id` to `entity_id` in data object to avoid conflict with node id

- [ ] T046 [US3] Create API view: `ner/views.py::GraphNodesView` (depends on T015, T045)
  - HTTP method: GET
  - URL: /api/v1/graph/?document_id={id}
  - Query parameter: document_id (required)
  - Handler: Queries Entity table, filters by document_id, serializes as CytoscapeNode objects
  - Success response: 200 OK
    - Body: { document_id, nodes: [CytoscapeNodeSerializer], total_nodes }
  - Error responses:
    - 404 Not Found: document does not exist
    - 400 Bad Request: document_id parameter missing
    - 500 Internal Server Error: database query failure

**Checkpoint**: User Story 3 complete ✅ — graph-ready entity data can be retrieved via REST API. Frontend can directly use response in Cytoscape.js without transformation.

---

## Phase 6: User Story 4 — Basic Frontend with Document Upload, Entities, and Graph Pages (Priority: P2)

**Goal**: Next.js frontend with pages for document upload, entity list view, and entity graph visualization using Cytoscape.js. All pages connect to Django backend.

**Independent Test**: Start frontend container, verify pages load in browser, verify API calls to backend succeed, verify data displays correctly (no 404s, network errors, or rendering failures).

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T047 [P] [US4] Unit test: `frontend/src/__tests__/lib/api.ts`
  - Test axios client initialization (correct baseURL, timeout)
  - Test error interceptor (catches 404, 429, 500 errors)

- [ ] T048 [P] [US4] Unit test: `frontend/src/__tests__/pages/upload.test.tsx`
  - Test document upload form renders (input field, submit button)
  - Test form submission calls uploadDocument() API method
  - Test success response: displays uploaded document_id to user
  - Test error response: displays error message to user

- [ ] T049 [P] [US4] Unit test: `frontend/src/__tests__/pages/entities.test.tsx`
  - Test entities list page renders (table/list format)
  - Test entities list calls getEntities() API method
  - Test success response: displays all entities with canonical_name, entity_type, confidence, raw_mentions
  - Test empty state: displays "no entities extracted yet" when entities array is empty
  - Test error response: displays error message to user

- [ ] T050 [P] [US4] Unit test: `frontend/src/__tests__/pages/graph.test.tsx`
  - Test graph visualization page renders
  - Test Cytoscape component initializes (with dynamic import, ssr:false)
  - Test graph calls getGraphNodes() API method
  - Test success response: Cytoscape renders nodes without error
  - Test empty state: displays "no entities yet" when nodes array is empty
  - Test error response: displays error message, page remains functional

- [ ] T051 [US4] Integration test: Browser/E2E (manual or Playwright)
  - Start frontend and backend containers (docker-compose up)
  - Verify frontend loads on localhost:3000
  - Verify upload page: select file, submit, receive success response
  - Verify entities page: displays extracted entities or "no entities" message
  - Verify graph page: Cytoscape renders nodes or "no entities" message
  - Verify API calls use correct backend URL (http://localhost:8000)

### Implementation for User Story 4

#### Frontend Pages & Components

- [ ] T052 [P] [US4] Create API client methods in `frontend/src/lib/api.ts` (depends on T019):
  - `uploadDocument(file: File) → Promise<{ document_id: string }>`
  - `extractEntities(documentId: string) → Promise<{ entities_created: number }>`
  - `getEntities(documentId: string, filters?: { confidence_min?, entity_type? }) → Promise<Entity[]>`
  - `getGraphNodes(documentId: string, confidenceMin?: number) → Promise<CytoscapeNode[]>`
  - Error handling: catch and log API errors, return user-friendly error messages

- [ ] T053 [P] [US4] Create page: `frontend/src/pages/index.tsx` (home/dashboard)
  - Navigation links to upload, entities, graph pages
  - Brief description of the feature

- [ ] T054 [P] [US4] Create page: `frontend/src/pages/upload.tsx` (document upload)
  - Form: file input (accept .pdf, .docx, .txt), submit button
  - On submit: call uploadDocument(file) API method
  - Success: display "Document uploaded successfully! Document ID: {id}"
  - Error: display error message with retry option
  - After success: redirect to entities page or show "View Entities" button

- [ ] T055 [P] [US4] Create page: `frontend/src/pages/entities.tsx` (entities list)
  - Query parameter: document_id (optional; if missing, show "select a document" message)
  - API call: getEntities(document_id) to fetch entities
  - Display: table or list with columns: canonical_name, entity_type, confidence (as %), raw_mentions_count
  - Empty state: "No entities extracted yet. Trigger extraction from here?" (link or button)
  - Error state: display error message with retry button
  - Enhancement (optional): link to graph page

- [ ] T056 [US4] Create page: `frontend/src/pages/graph.tsx` (entity graph visualization) (depends on T055)
  - Query parameter: document_id (optional)
  - API call: getGraphNodes(document_id) to fetch Cytoscape-compatible nodes
  - Component: Import Cytoscape.js with Next.js dynamic import (ssr:false, no SSR)
  - Render: Cytoscape container with nodes from API response
  - Empty state: "No entities to visualize yet."
  - Error state: display error message with retry button
  - Layout: Force-directed layout (e.g., cose or breadthfirst)
  - Styling: Color nodes by entity_type (e.g., PERSON=blue, ORG=red, LOCATION=green, ROLE=yellow)
  - Interactivity: hover to highlight node, click for details (optional)

- [ ] T057 [US4] Create Cytoscape wrapper component: `frontend/src/components/GraphVisualization.tsx` (depends on T056)
  - Props: nodes (CytoscapeNode[]), edges (optional; empty for MVP)
  - Initialize Cytoscape instance with DOM container
  - Apply styling rules for node colors by entity_type
  - Handle resize events (responsive layout)
  - Error boundary: catch initialization errors, display fallback message
  - **CRITICAL**: Use Next.js dynamic import with ssr:false to prevent server-side rendering issues

- [ ] T058 [P] [US4] Create error handling components:
  - `frontend/src/components/ErrorMessage.tsx` → displays error with retry button
  - `frontend/src/components/LoadingSpinner.tsx` → displays loading indicator during API calls

- [ ] T059 [P] [US4] Create layout/navigation: `frontend/src/components/Layout.tsx`
  - Header with app title and navigation menu
  - Links to: home, upload, entities, graph pages
  - Footer with copyright/attribution

#### Dockerfile & Container Setup

- [ ] T060 [US4] Create `frontend/Dockerfile` (depends on T005)
  - Multi-stage build:
    - Stage 1: Node.js 20 base, install dependencies (npm ci), build Next.js app (npm run build)
    - Stage 2: Node.js 20 base, copy built app, expose port 3000, run npm start
  - Optimizations: .dockerignore to exclude node_modules, .next, etc.
  - Environment: NODE_ENV=production, NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 (configurable)

- [ ] T061 [US4] Update `docker-compose.yml` (depends on T004)
  - Add frontend service:
    - service name: frontend
    - build: ./frontend
    - ports: "3000:3000"
    - depends_on: backend (ensure backend starts first for health checks)
    - environment: NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
    - volumes (development mode): ./frontend/src:/app/src (hot reload)

- [ ] T062 [US4] Create `frontend/.env.local` (local development)
  - NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

- [ ] T063 [P] [US4] Create `frontend/next.config.js`:
  - Suppress build warnings (optional)
  - Configure internationalization if needed (optional)

#### Styling & UI Enhancements

- [ ] T064 [P] [US4] Create global styles: `frontend/src/styles/globals.css` (Tailwind CSS)
  - Basic layout: responsive containers, typography, spacing
  - Color scheme: professional look (optional theming)
  - Accessibility: focus states, contrast ratios

- [ ] T065 [P] [US4] Create Cytoscape styling: `frontend/src/lib/cytoscapeStyle.ts`
  - Node styles: size, color by entity_type, label visibility
  - Hover states: highlight on hover
  - Layout: force-directed (cose algorithm)
  - Responsive: adjust for different screen sizes

**Checkpoint**: User Story 4 complete ✅ — full frontend with all pages, API integration, graph visualization. Can be tested end-to-end in browser.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and final validation across all stories

- [ ] T066 [P] Complete prompt file: `prompts/ner-extraction-v1.md` (depends on T031)
  - Finalize based on Phase 0 research findings and actual Groq behavior
  - Add example inputs/outputs
  - Document confidence scoring heuristics
  - Version history placeholder for v2, v3

- [ ] T067 [P] Create comprehensive docstrings and inline comments:
  - Backend: models, services, views (describe each method/parameter)
  - Frontend: pages, components, hooks

- [ ] T068 [P] Add additional unit tests for edge cases:
  - Test: Groq returns entities with very low confidence (<0.5) → should be included per api.md
  - Test: Groq returns empty entity list → pipeline completes, entities_created=0
  - Test: Chunk has special characters, emoji, mixed language → extraction handles gracefully
  - Test: Very long canonical_name (>255 chars) → truncated or rejected (decide in Phase 0)

- [ ] T069 [P] Run full test suites:
  - Backend: `cd . && pytest` (runs all ner/tests/)
  - Frontend: `cd frontend && npm test` (runs all __tests__/)
  - Verify all tests pass (T023-T050 should all be green)

- [ ] T070 [P] Code cleanup and style:
  - Backend: `ruff check ner/` (linting), fix violations
  - Frontend: `npm run lint` (ESLint), fix violations
  - Backend: format with Black (optional)
  - Frontend: format with Prettier (optional)

- [ ] T071 [P] Create or complete documentation:
  - `specs/002-ner-pipeline/research.md` (Phase 0 findings) → finalize based on implementation learnings
  - `specs/002-ner-pipeline/data-model.md` → document Entity model, schema, relationships
  - `specs/002-ner-pipeline/quickstart.md` → developer setup guide (install deps, run migrations, start docker-compose, test endpoints)

- [ ] T072 Run `quickstart.md` validation:
  - Fresh checkout of branch
  - Follow quickstart.md steps explicitly
  - Verify all steps work without errors
  - Verify all 4 user story endpoints work correctly
  - Update quickstart.md based on any issues found

- [ ] T073 [P] Security hardening (MVP considerations):
  - Validate document_id is valid UUID (prevent SQL injection)
  - Validate chunk text length before sending to Groq (prevent abuse)
  - Add rate limiting per IP (optional, for production readiness)
  - Add CORS headers to backend if frontend and backend on different origins (verify if needed for docker-compose)

- [ ] T074 [P] Performance optimization:
  - Profile entity extraction: measure time for 50 chunks (target: <30 seconds per plan.md)
  - Profile entity retrieval: measure GET /api/v1/documents/{id}/entities/ (target: <1 second for 1000 entities)
  - Profile Cytoscape render: measure render time for 100+ nodes (target: <2 seconds)
  - Add database indexes if needed (entity_type, confidence, document_id)

- [ ] T075 [P] Final validation before PR:
  - Verify no NEEDS CLARIFICATION markers in code
  - Verify all code matches contracts (api.md, frontend.md, prompt.md)
  - Verify all 4 user stories independently testable and functional
  - Verify constitution gates still pass (Docker, Supabase, prompts versioned, etc.)
  - Verify git history is clean (commits are logical, messages are clear)

- [ ] T076 Create test fixtures / seed data (optional, for manual testing):
  - Django: create sample documents with chunks for testing extraction
  - Frontend: mock API responses if needed for isolated testing

- [ ] T077 [P] Documentation in code comments:
  - Explain deduplication strategy in deduplicator.py
  - Explain synchronous extraction choice in ExtractEntitiesView
  - Explain Cytoscape dynamic import necessity in GraphVisualization.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**
- **User Stories (Phase 3-6)**: All depend on Foundational completion
  - US1, US2, US3 (all P1): Can proceed in parallel after Foundational
  - US4 (P2): Can start after US1, US2, US3 complete (depends on those APIs working)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### Within-Phase Dependencies

**Phase 2 (Foundational)**:
- T008 (Entity model) → T009 (migration)
- T012 (groq_client) → T030 (implement extraction)
- T013 (deduplicator) → T032 (implement dedup)
- T014 (pipeline) → T033 (implement pipeline)
- T015 (serializers) → T039 (DocumentEntitiesView), T046 (GraphNodesView)
- T018-T022 (frontend setup) → all frontend pages in Phase 6

**Phase 3 (US1)**:
- Tests T023-T029 → Implementation T030-T034 (write tests first!)
- T030 (groq_client) → T031 (prompt file/CRITICAL DATA)
- T032 (deduplicator) → T033 (pipeline)
- T033 (pipeline) → T034 (ExtractEntitiesView)

**Phase 4 (US2)**:
- Tests T035-T038 → Implementation T039 (write tests first!)
- T015 (EntitySerializer) → T039 (DocumentEntitiesView)

**Phase 5 (US3)**:
- Tests T041-T044 → Implementation T045-T046 (write tests first!)
- T015 (EntitySerializer) → T045 (CytoscapeNode serializer)
- T045 (CytoscapeNode) → T046 (GraphNodesView)

**Phase 6 (US4)**:
- Tests T047-T051 → Implementation T052-T065 (write tests first!)
- T019 (axios client) → T052 (API methods)
- T020-T021 (TypeScript types) → all pages
- T052 (API methods) → T054-T056 (pages)
- T055 (entities page) → T056 (graph page uses same document_id logic)
- T056 (graph page) → T057 (Cytoscape component, must use dynamic import!)
- T004 (docker-compose setup) → T060 (Dockerfile)
- T060 (Dockerfile) → T061 (docker-compose integration)

### Parallel Opportunities

**Phase 1**:
- T001, T002, T003 (setup) can run in parallel
- T006, T007 (dependencies) can run in parallel

**Phase 2**:
- T008-T009 (models) vs. T012-T014 (services) independently
- T015-T017 (serializers/views) in parallel
- T018-T022 (frontend base) in parallel with backend setup

**Phase 3, 4, 5** (after Phase 2 complete):
- US1, US2, US3 tests (T023-T044) can run in parallel (different test files)
- US1, US2, US3 implementation (T030-T046) can proceed in parallel if dependencies met
- **Recommended order**: US1 first (most critical), then US2, US3 in parallel

**Phase 6** (after US1-3 complete):
- Frontend pages (T054-T056) can be developed in parallel (different files)
- Component creation (T057-T059) in parallel
- Dockerfile/container setup (T060-T063) in parallel with page development
- Styling (T064-T065) in parallel

**Phase 7**:
- T066-T068 (documentation, tests, comments) in parallel
- T069-T070 (test suites, linting) in parallel
- T071-T077 (final checks, docs) sequential at end

### Recommended Execution Strategy

**Option A: Sequential (Safest for Solo Dev)**
1. Phase 1: Setup (2 hours)
2. Phase 2: Foundational (6 hours)
   - Checkpoint: Models, services, views in place
3. Phase 3: US1 (8 hours) — highest value, enables extraction
   - US1 tests must PASS before moving forward
4. Phase 4: US2 (4 hours) — enabled by US1
5. Phase 5: US3 (4 hours) — enabled by US1
6. Phase 6: US4 (12 hours) — frontend enabled by US1-3
   - Launch docker-compose
   - Run browser tests manually
7. Phase 7: Polish (6 hours)
   - Total: ~42 hours for complete implementation

**Option B: Parallel (For Team)**
- Developer A: Phase 1 + 2 (foundational) — MUST be first
- Developer B & C: Wait for Phase 2 checkpoint, then:
  - B: Phase 3 (US1 extraction pipeline)
  - C: Phase 6a (frontend setup: base pages)
- When US1 complete:
  - B: Phase 4 (US2 retrieval API)
  - C: Continue Phase 6 (pages, Cytoscape)
- When US2 complete:
  - B: Phase 5 (US3 graph API)
  - C: Finish Phase 6
- Parallel Phase 7:
  - All: Tests, linting, docs

---

## Testing Strategy

### Before Implementation: Write Tests First

For each user story:
1. Write tests based on api.md, frontend.md contracts
2. Run tests → FAIL (red status)
3. Implement feature until tests PASS (green status)
4. Ensure no unrelated tests break (regression)

### Unit Tests (Backend)

- **groq_client.py**: Mock Groq API responses, test JSON parsing, error handling
- **deduplicator.py**: Mock Entity QuerySet, test merge logic, dedupe accuracy
- **pipeline.py**: Mock services, test orchestration, transaction rollback on error

### Integration Tests (Backend)

- **views.py**: Mock Groq API, test full request→response flow, HTTP status codes, response JSON schema

### Unit Tests (Frontend)

- **api.ts**: Mock axios, test error handling, response parsing
- **pages/*.tsx**: Mock API client, test rendering, form submission, error states

### Integration Tests (Frontend)

- **Browser/E2E**: Start docker-compose, test full workflow: upload → extract → view entities → view graph

### Test Coverage Goals

- Backend: >80% code coverage (pytest with coverage.py)
- Frontend: >70% component coverage (Jest)

---

## Deliverables (End of Phase 7)

### Backend

✅ Django `ner/` app with:
- Entity model (indexed, with relationships)
- ExtractEntitiesView, DocumentEntitiesView, GraphNodesView endpoints
- groq_client, deduplicator, pipeline services
- Comprehensive test suite (pytest)

✅ NER extraction prompt: `prompts/ner-extraction-v1.md`

✅ Updated docker-compose.yml with tested configuration

### Frontend

✅ Next.js 14 app with:
- Pages: upload, entities, graph
- Cytoscape.js graph visualization (dynamic import, ssr:false)
- API integration with error handling
- Comprehensive test suite (Jest)

✅ Updated docker-compose.yml with frontend service

### Documentation

✅ Completed Phase 1 artifacts:
- research.md (if Phase 0 research needed)
- data-model.md (Entity schema, relationships)
- quickstart.md (developer setup, running docker-compose, testing endpoints)

✅ All contracts validated to match implementation:
- api.md (3 endpoints, 201 Created, error responses)
- frontend.md (4 API methods, Cytoscape pattern, TypeScript interfaces)
- prompt.md (NER extraction specification)

### Validation

✅ quickstart.md runs end-to-end without errors

✅ All 4 user stories independently testable and functional

✅ Constitution gates still pass (Docker, Supabase, versioned prompts)

✅ Clean git history with logical commits

---

## Notes

- **[P] tasks**: Different files, no dependencies — can run in parallel
- **[Story] label**: Maps each task to specific user story for traceability
- **Tests first**: Every user story must have tests written and FAIL before implementation
- **Synchronous extraction**: Per clarification — POST returns 201 Created after completion, not 202 Accepted
- **Clean slate re-extraction**: Per clarification — deletes all previous entities before creating new ones
- **Cytoscape ssr:false**: Per clarification — Next.js dynamic import with ssr:false MANDATORY to prevent hydration errors
- **Commit strategy**: Commit after each task or logical group (not per line of code)
- **Stop at checkpoints**: Can deploy/demo at any checkpoint to validate story independently
- **No authentication (MVP)**: All endpoints public; add auth in future sprint if needed

