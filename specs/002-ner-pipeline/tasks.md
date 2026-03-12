# Tasks: NER Pipeline + Entity API + Basic Frontend

**Input**: Design documents from `/specs/002-ner-pipeli
ne/`
**Prerequisites**: plan.md ✅ spec.md ✅ contracts/api.md ✅ contracts/frontend.md ✅ contracts/prompt.md ✅

**Tests**: Included — tests must be written first and fail before implementation. Requirements: pytest (backend), Jest (frontend).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([Extract Entities], [Retrieve Entities], [Graph Nodes API], [Frontend])
- Exact file paths included in every task description

## Path Conventions

Django project at repository root with Next.js frontend app. Source layout:

```
stakeholder-analysis-tool/       ← repo root
├── stakeholder_analysis/         ← Django project package
├── ingestion/                    ← Django app (US-01)
├── ner/                          ← Django app (US-02)
├── frontend/                     ← Next.js 14 app (new)
├── prompts/                      ← NER extraction prompts
└── specs/002-ner-pipeline/       ← Design documents
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project structure initialization, Next.js app bootstrap, Docker integration. No Django code yet.

- [x] T001 Create `ner/` Django app structure: `models.py`, `views.py`, `serializers.py`, `services/`, `urls.py`, `tests/`, `migrations/` (with `__init__.py`)
- [x] T002 [P] Create `frontend/` Next.js 14 project structure: `pages/`, `src/components/`, `src/lib/`, `public/`, `package.json`, `tsconfig.json`, `next.config.js`
- [x] T003 Create `prompts/` directory with placeholder files: `prompts/ner-extraction-v1.md` (empty), `prompts/ner-extraction-v1.txt` (empty)
- [x] T004 Update `docker-compose.yml`: add `frontend` service (Node.js 20, port 3000, environment `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`, volumes for hot reload)
- [x] T005 Create `frontend/Dockerfile`: multi-stage build (Stage 1: Node 20, npm install, npm run build; Stage 2: Node 20, COPY built app, expose 3000, CMD npm start)
- [x] T006 [P] Update `requirements.txt`: add `groq` Python SDK and verify no version conflicts
- [x] T007 [P] Initialize `frontend/package.json`: add Next.js 14, React 18, axios, cytoscape, typescript, jest, @testing-library/react, tailwindcss

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Django models, core services, API infrastructure, frontend base. Must be complete before any user story begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Database Schema & Models

- [x] T008 Create `Entity` model in `ner/models.py` with fields:
  - `id` (UUIDField primary key)
  - `entity_type` (CharField, choices: PERSON, ORGANIZATION, LOCATION, ROLE)
  - `canonical_name` (CharField, indexed)
  - `raw_mentions` (JSONField: list of surface forms)
  - `confidence` (FloatField 0.0–1.0, indexed)
  - `document_id` (ForeignKey to ingestion.Document)
  - `chunk_id` (ForeignKey to ingestion.Chunk, nullable)
  - `created_at` (DateTimeField auto_now_add)
  - `Meta.unique_together = [('canonical_name', 'document_id', 'entity_type')]`

- [x] T009 Generate and apply Django migration `ner/migrations/0001_initial.py`: creates `ner_entity` table with all indexes; verify migration applies cleanly

### Core Services

- [x] T010 [P] Create `ner/services/__init__.py` (empty)
- [x] T011 [P] Implement `ner/services/groq_client.py`:
  - Function `load_ner_prompt() -> str`: reads `prompts/ner-extraction-v1.md`
  - Function `extract_entities_from_chunk(chunk_text: str) -> dict`: calls Groq Llama 3 API, parses JSON response, returns `{entities: [{entity_type, text, confidence}]}`
  - Error handling: raise custom exceptions on API failure, rate limit (429), invalid JSON

- [x] T012 [P] Implement `ner/services/deduplicator.py`:
  - Function `deduplicate_entities(extracted_entities: list, existing_entities: QuerySet) -> list`: merges duplicate entities by (canonical_name, document_id, entity_type); returns Entity objects ready for create/update

- [x] T013 Create `ner/services/pipeline.py`:
  - Function `extract_entities_for_document(document_id: str) -> dict`: orchestrates full extraction for all document chunks
  - Delete existing entities (clean slate per clarification)
  - Loop through chunks, call groq_client.extract_entities_from_chunk()
  - Deduplicate via deduplicator.deduplicate_entities()
  - Bulk create entities in database (atomic transaction)
  - Return `{entities_created: int}`

### Serializers & API Views

- [x] T014 [P] Create serializers in `ner/serializers.py`:
  - `EntitySerializer` (read-only): id, entity_type, canonical_name, raw_mentions, confidence, chunk_id, document_id, created_at
  - `CytoscapeNodeSerializer` (read-only): id, label (=canonical_name), data (nested: entity_id, entity_type, confidence, document_id, chunk_id, raw_mentions_count)

- [x] T015 Create `ner/views.py` base structure:
  - Import DRF generics, Response, status
  - Define error handler helper: `handle_groq_error(exception) -> Response`
  - Add logging setup

- [x] T016 [P] Create `ner/urls.py`:
  - URL pattern: `POST api/v1/documents/{id}/extract-entities/ -> ExtractEntitiesView`
  - URL pattern: `GET api/v1/documents/{id}/entities/ -> DocumentEntitiesView`
  - URL pattern: `GET api/v1/graph/?document_id={id} -> GraphNodesView`

### Frontend Base Setup

- [x] T017 [P] Create `frontend/src/lib/api.ts`: axios client instance (baseURL: http://localhost:8000, timeout: 10000, error interceptor)
- [x] T018 [P] Create TypeScript interfaces in `frontend/src/types/index.ts`: Entity, Document, CytoscapeNode, GraphResponse, ApiErrorResponse
- [x] T019 [P] Create `frontend/src/pages` directory structure: `_app.tsx`, `_document.tsx`
- [x] T020 [P] Create error boundary component: `frontend/src/components/ErrorBoundary.tsx`

**Checkpoint**: Foundation complete ✅ — all models, services, and infrastructure in place. User story implementation can now begin.

---

## Phase 3: User Story — Extract & Deduplicate Named Entities (Priority: P1) 🎯 MVP

**Goal**: Extract named entities (PERSON, ORGANIZATION, LOCATION, ROLE) from document chunks using Groq Llama 3, deduplicate across chunks, store with confidence scores and canonical names. Return HTTP 201 Created with entities_created count.

**Independent Test**: Call `POST /api/v1/documents/{id}/extract-entities/`, wait for synchronous completion, verify Entity records created in database with correct canonical names, confidence scores, deduplicated raw mentions.

### Tests for Extract Entities ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T021 [P] [Extract Entities] Unit test in `ner/tests/test_groq_client.py`: test `extract_entities_from_chunk()` with mock Groq response; test error handling (API timeout, rate limit, invalid JSON)
- [x] T022 [P] [Extract Entities] Unit test in `ner/tests/test_deduplicator.py`: test merging duplicate entities; test separate entities for different types; test all new entities
- [x] T023 [P] [Extract Entities] Unit test in `ner/tests/test_pipeline.py`: test `extract_entities_for_document()` with 3 chunks; test clean slate deletion; test error handling (rate limit → no entities persisted)
- [x] T024 [Extract Entities] Integration test in `ner/tests/test_views.py::test_extract_entities_success`: call `POST /api/v1/documents/{id}/extract-entities/`, mock Groq; verify HTTP 201, response schema matches api.md, entities_created > 0
- [x] T025 [Extract Entities] Integration test in `ner/tests/test_views.py::test_extract_entities_document_not_found`: call endpoint with non-existent document; verify HTTP 404
- [x] T026 [Extract Entities] Integration test in `ner/tests/test_views.py::test_extract_entities_groq_rate_limit`: mock Groq 429 error; verify HTTP 429 with retry_after header; verify no Entity records created
- [x] T027 [Extract Entities] Integration test in `ner/tests/test_views.py::test_extract_entities_replaces_previous`: extract twice, verify entities_created matches new count (not cumulative)

### Implementation for Extract Entities

- [x] T028 [Extract Entities] Implement `ner/services/groq_client.py::extract_entities_from_chunk()`: load prompt from `prompts/ner-extraction-v1.md`; call Groq Llama 3 API; parse JSON response; return `{entities: [{entity_type, text, confidence}]}`; error handling for API timeout, rate limit (429), invalid JSON
- [x] T029 [Extract Entities] Create prompt file `prompts/ner-extraction-v1.md`: define system prompt for Groq Llama 3; specify entity types with definitions and examples; specify input/output JSON schema; specify confidence scoring guidelines (0.9+, 0.7-0.9, 0.5-0.7, <0.5)
- [x] T030 [Extract Entities] Implement `ner/services/deduplicator.py::deduplicate_entities()`: input is extracted entities from Groq + QuerySet of existing entities; check each extracted entity for match (canonical_name, document_id, entity_type); merge raw_mentions and confidence; return Entity objects for bulk_create
- [x] T031 [Extract Entities] Implement `ner/services/pipeline.py::extract_entities_for_document()`: get document (404 if not found); delete all existing entities (clean slate); get all chunks; loop chunk → extract via groq_client → deduplicate; bulk create Entity records in atomic transaction; return `{entities_created: int}`
- [x] T032 [Extract Entities] Implement `ExtractEntitiesView` in `ner/views.py`: HTTP POST `/api/v1/documents/{id}/extract-entities/`; synchronous processing (waits for completion); success response HTTP 201 Created with `{status, document_id, entities_created, message}`; error responses: 404 (no document), 429 (rate limit with retry_after), 500 (other failures)

**Checkpoint**: Extract Entities complete ✅ — entities extracted, deduplicated, stored. Can be tested independently via API.

---

## Phase 4: User Story — Retrieve Entities for Document (Priority: P1)

**Goal**: Provide GET endpoint that returns all extracted entities for a document in list format with full attributes. Return HTTP 200 with entity array.

**Independent Test**: Call `GET /api/v1/documents/{id}/entities/` after entities are extracted; verify HTTP 200 with complete entity objects (all fields from api.md).

### Tests for Retrieve Entities ⚠️

- [x] T033 [P] [Retrieve Entities] Integration test in `ner/tests/test_views.py::test_get_entities_success`: create document with extracted entities; call `GET /api/v1/documents/{id}/entities/`; verify HTTP 200, response schema matches api.md, all entity fields present
- [x] T034 [P] [Retrieve Entities] Integration test in `ner/tests/test_views.py::test_get_entities_empty_document`: document with no entities; verify HTTP 200 with empty array
- [x] T035 [P] [Retrieve Entities] Integration test in `ner/tests/test_views.py::test_get_entities_document_not_found`: non-existent document; verify HTTP 404
- [x] T036 [P] [Retrieve Entities] Integration test in `ner/tests/test_views.py::test_get_entities_with_filters` (optional): verify filtering by entity_type and confidence_min (future enhancement)

### Implementation for Retrieve Entities

- [x] T037 [Retrieve Entities] Implement `DocumentEntitiesView` in `ner/views.py`: HTTP GET `/api/v1/documents/{id}/entities/`; query Entity table by document_id; serialize with EntitySerializer; return HTTP 200 `{document_id, entities: [...], total_count}`; error responses: 404 (no document), 500 (query failure)
- [x] T038 [Retrieve Entities] Add pagination (optional, for scalability): If more than 100 entities, implement limit/offset pagination; add to response: `{document_id, entities: [...], total_count, page, page_size}`

**Checkpoint**: Retrieve Entities complete ✅ — entities retrievable via REST API. Can be tested independently.

---

## Phase 5: User Story — Graph Nodes API (Priority: P1)

**Goal**: Provide GET endpoint that returns entity data formatted for Cytoscape.js visualization as graph nodes. Return HTTP 200 with Cytoscape-compatible node array.

**Independent Test**: Call `GET /api/v1/graph/?document_id={id}`; verify HTTP 200 with Cytoscape node format (id, label, data object with entity metadata).

### Tests for Graph Nodes API ⚠️

- [x] T039 [P] [Graph Nodes API] Integration test in `ner/tests/test_views.py::test_get_graph_nodes_success`: create document with entities; call `GET /api/v1/graph/?document_id={id}`; verify HTTP 200, Cytoscape format (id, label, data), response matches api.md
- [x] T040 [P] [Graph Nodes API] Integration test in `ner/tests/test_views.py::test_get_graph_nodes_empty_document`: document with no entities; verify HTTP 200 with empty nodes array
- [x] T041 [P] [Graph Nodes API] Integration test in `ner/tests/test_views.py::test_get_graph_nodes_document_not_found`: non-existent document; verify HTTP 404
- [x] T042 [P] [Graph Nodes API] Integration test in `ner/tests/test_views.py::test_get_graph_nodes_cytoscape_format`: verify response format is valid Cytoscape.js node format (no frontend transformation needed)

### Implementation for Graph Nodes API

- [x] T043 [P] [Graph Nodes API] Create `CytoscapeNodeSerializer` helper in `ner/serializers.py`: input Entity object; output `{id, label (canonical_name), data: {entity_id: id, entity_type, confidence, document_id, chunk_id, raw_mentions_count}}`
- [x] T044 [Graph Nodes API] Implement `GraphNodesView` in `ner/views.py`: HTTP GET `/api/v1/graph/?document_id={id}`; query parameter: `document_id` (required); query Entity table by document_id; serialize as CytoscapeNode objects; return HTTP 200 `{document_id, nodes: [...], total_nodes}`; error responses: 404 (no document), 400 (missing document_id), 500 (query failure)

**Checkpoint**: Graph Nodes API complete ✅ — graph-ready entity data retrievable via REST API. Can be tested independently.

---

## Phase 6: User Story — Frontend with Pages & Graph Visualization (Priority: P2)

**Goal**: Next.js frontend with pages for document upload, entity list view, and entity graph visualization using Cytoscape.js. All pages connect to Django backend. Return responsive UI with error handling.

**Independent Test**: Start frontend + backend containers; verify pages load in browser; verify API calls succeed; verify data displays correctly (no 404s, network errors, or rendering failures); verify Cytoscape renders nodes without errors.

### Tests for Frontend ⚠️

- [x] T045 [P] [Frontend] Unit test in `frontend/src/__tests__/lib/api.ts`: test axios client initialization; test error interceptor (catches 404, 429, 500)
- [x] T046 [P] [Frontend] Unit test in `frontend/src/__tests__/pages/upload.test.tsx`: test form renders; test file input; test submission calls uploadDocument() API; test success response; test error response
- [x] T047 [P] [Frontend] Unit test in `frontend/src/__tests__/pages/entities.test.tsx`: test page renders; test getEntities() API call; test entities table displays all fields; test empty state; test error state
- [x] T048 [P] [Frontend] Unit test in `frontend/src/__tests__/pages/graph.test.tsx`: test page renders; test Cytoscape component (dynamic import, ssr:false); test getGraphNodes() API call; test empty state; test error state; verify Cytoscape initialization succeeds
- [ ] T049 [Frontend] Integration test: manual browser test (or Playwright). Start docker-compose; load frontend on localhost:3000; verify pages load; verify API calls use correct backend URL; verify data displays correctly

### Implementation for Frontend

#### API Client & Types

- [x] T050 [P] [Frontend] Implement API client methods in `frontend/src/lib/api.ts`:
  - `uploadDocument(file: File) -> Promise<{document_id}>`
  - `extractEntities(documentId: string) -> Promise<{entities_created}>`
  - `getEntities(documentId: string, filters?: {...}) -> Promise<Entity[]>`
  - `getGraphNodes(documentId: string, confidenceMin?: number) -> Promise<CytoscapeNode[]>`
  - Error handling: catch and log API errors; return user-friendly error messages

- [x] T051 [P] [Frontend] Create TypeScript interfaces in `frontend/src/types/index.ts` (if not already): Entity, Document, CytoscapeNode, GraphResponse, ApiErrorResponse; match api.md schemas exactly

#### Frontend Pages

- [x] T052 [P] [Frontend] Create home page `frontend/src/pages/index.tsx`: navigation links to upload, entities, graph; brief description of feature

- [x] T053 [P] [Frontend] Create upload page `frontend/src/pages/upload.tsx`:
  - Form: file input (accept .pdf, .docx, .txt), submit button
  - On submit: call uploadDocument(file) API method
  - Success: display "Document uploaded successfully! Document ID: {id}"
  - Error: display error message with retry option
  - After success: redirect to entities page or show "View Entities" button

- [x] T054 [P] [Frontend] Create entities page `frontend/src/pages/entities.tsx`:
  - Query parameter: document_id (optional)
  - API call: getEntities(document_id) to fetch entities
  - Display: table/list with columns: canonical_name, entity_type, confidence (%), raw_mentions_count
  - Empty state: "No entities extracted yet"
  - Error state: display error message with retry button
  - Enhancement (optional): link to graph page

- [x] T055 [Frontend] Create graph page `frontend/src/pages/graph.tsx`:
  - Query parameter: document_id (optional)
  - API call: getGraphNodes(document_id) to fetch Cytoscape nodes
  - Component: Import Cytoscape.js with Next.js dynamic import (ssr:false) — CRITICAL requirement
  - Render: Cytoscape container with nodes from API response
  - Empty state: "No entities to visualize yet"
  - Error state: display error message with retry button
  - Layout: Force-directed (cose algorithm)
  - Styling: Color nodes by entity_type (PERSON=blue, ORG=red, LOCATION=green, ROLE=yellow)

#### Frontend Components

- [x] T056 [Frontend] Create Cytoscape wrapper component `frontend/src/components/GraphVisualization.tsx`:
  - Props: nodes (CytoscapeNode[]), edges (empty for MVP)
  - Initialize Cytoscape instance with DOM container
  - Apply styling rules: node colors by entity_type
  - Handle resize events (responsive layout)
  - Error boundary: catch initialization errors, display fallback
  - **CRITICAL**: Use Next.js dynamic import with ssr:false to prevent server-side rendering issues

- [x] T057 [P] [Frontend] Create error handling components:
  - `frontend/src/components/ErrorMessage.tsx`: displays error with retry button
  - `frontend/src/components/LoadingSpinner.tsx`: loading indicator during API calls

- [x] T058 [P] [Frontend] Create layout/navigation `frontend/src/components/Layout.tsx`:
  - Header with app title and navigation menu
  - Links: home, upload, entities, graph pages
  - Footer

#### Docker & Container Setup

- [x] T059 [Frontend] Create `frontend/Dockerfile` (finalize):
  - Multi-stage build (Stage 1: Node 20, npm install, build; Stage 2: Node 20, built app, expose 3000, npm start)
  - Optimizations: .dockerignore excludes node_modules, .next, etc.
  - Environment: NODE_ENV=production, NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

- [x] T060 [Frontend] Update `docker-compose.yml` (finalize):
  - Add frontend service: name `frontend`, build ./frontend, ports `3000:3000`
  - depends_on: `backend` (ensure backend starts first)
  - environment: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
  - volumes (dev mode): `./frontend/src:/app/src` (hot reload)

- [x] T061 [Frontend] Create `frontend/.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

- [x] T062 [P] [Frontend] Create `frontend/next.config.js`: basic configuration

#### Styling & UI

- [x] T063 [P] [Frontend] Create global styles `frontend/src/styles/globals.css`: Tailwind CSS setup, responsive layout, typography, color scheme, accessibility

- [x] T064 [P] [Frontend] Create Cytoscape styling `frontend/src/lib/cytoscapeStyle.ts`: node colors, hover states, layout (force-directed), responsive sizing

**Checkpoint**: Frontend complete ✅ — all pages, API integration, graph visualization. Can be tested end-to-end in browser.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, code quality, test coverage, performance, security, final validation.

- [x] T065 [P] Complete prompt file `prompts/ner-extraction-v1.md`: finalize based on actual Groq behavior; add example inputs/outputs; document confidence scoring heuristics; version history placeholder for v2, v3

- [x] T066 [P] Add comprehensive docstrings and inline comments: Backend: models.py, services/*.py, views.py; Frontend: pages, components, hooks

- [x] T067 [P] Add unit tests for edge cases (backend): Groq returns low confidence entities; Groq returns empty entity list; Chunk has special characters/emoji/mixed language; Very long canonical_name (>255 chars)

- [ ] T068 [P] Run full test suites: Backend: `pytest` (all ner/tests/ must pass); Frontend: `npm test` (all __tests__/ must pass)

- [x] T069 [P] Code cleanup and style: Backend: `ruff check ner/`, `black ner/`; Frontend: `npm run lint`, `npm run format`

- [x] T070 [P] Create/complete documentation:
  - `specs/002-ner-pipeline/research.md` (Groq patterns, deduplication, Cytoscape React patterns, Next.js architecture)
  - `specs/002-ner-pipeline/data-model.md` (Entity model schema, relationships, validation rules)
  - `specs/002-ner-pipeline/quickstart.md` (developer setup guide)

- [ ] T071 Validate `quickstart.md`: fresh clone, follow every step explicitly; verify all steps work without errors; verify all 3 backend endpoints work (extract, get entities, get graph); verify frontend loads and connects to backend

- [x] T072 [P] Security hardening: Validate document_id is valid UUID; validate chunk text length before sending to Groq; add rate limiting per IP (optional); add CORS headers if needed

- [x] T073 [P] Performance optimization: Profile entity extraction (<30 seconds for 50 chunks); profile entity retrieval (<1 second for 1000 entities); profile Cytoscape render (<2 seconds for 100+ nodes); add database indexes if needed

- [x] T074 [P] Final validation before PR: Verify no NEEDS CLARIFICATION markers; verify all code matches contracts (api.md, frontend.md, prompt.md); verify all stories independently testable and functional; verify constitution gates pass (Docker, Supabase, prompts versioned); verify git history clean

- [x] T075 Create test fixtures / seed data (optional): Django: create sample documents with chunks; Frontend: mock API responses if needed

- [x] T076 [P] Add code comments explaining key decisions: Explain deduplication strategy in deduplicator.py; explain synchronous extraction choice in ExtractEntitiesView; explain Cytoscape dynamic import necessity

- [x] T077 [P] Update CHANGELOG.md: add entry for US-02 delivery (NER Pipeline + Entity API + Frontend); describe features, endpoints, dependencies

- [ ] T078 Run full test suite in Docker: `docker compose run --rm app pytest` + `docker compose run --rm frontend npm test`; all tests must pass

- [ ] T079 Final end-to-end validation: `docker compose up`; use frontend UI to upload document, view entities, view graph; verify no errors; take screenshots for documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**
- **User Stories (Phase 3-6)**: All depend on Foundational completion
  - Extract Entities/Retrieve Entities/Graph Nodes API (all P1) can proceed in parallel after Foundational
  - Frontend (P2) depends on all 3 P1 APIs working
- **Polish (Phase 7)**: Depends on all desired user stories complete

### Within-Phase Dependencies

**Phase 2**:
- T008-T009 (models) → T010-T013 (services)
- T014 (serializers) → T037 (DocumentEntitiesView), T044 (GraphNodesView)
- T017-T020 (frontend base) → all frontend pages in Phase 6

**Phase 3 (Extract Entities)**:
- Tests T021-T027 → Implementation T028-T032 (write tests first!)
- T028 (groq_client) → T029 (prompt file)
- T030 (deduplicator) → T031 (pipeline)
- T031 (pipeline) → T032 (ExtractEntitiesView)

**Phase 4 (Retrieve Entities)**:
- Tests T033-T036 → Implementation T037 (write tests first!)

**Phase 5 (Graph Nodes API)**:
- Tests T039-T042 → Implementation T043-T044 (write tests first!)

**Phase 6 (Frontend)**:
- Tests T045-T049 → Implementation T050-T064 (write tests first!)
- T050 (API methods) → T053-T055 (pages)
- T055 (graph page) → T056 (Cytoscape component, must use dynamic import!)
- T004 (docker-compose setup) → T059 (Dockerfile) → T060 (docker-compose integration)

### Parallel Opportunities

**Phase 1**: T002, T003, T004, T005, T006, T007 all parallel
**Phase 2**: T008-T009 (models) parallel with T010-T020 (services/frontend)
**Phase 3 Tests**: T021, T022, T023 parallel
**Phase 6**: T052-T064 many tasks can run in parallel (different files, different developers)
**Phase 7**: T065-T077 many tasks parallel; T070-T079 more sequential at end

---

## Implementation Strategy

### MVP First (Extract Entities Only)

1. Complete Phase 1: Setup (T001–T007)
2. Complete Phase 2: Foundational (T008–T020) — **mandatory, blocks all stories**
3. Complete Phase 3: Extract Entities (T021–T032)
4. **STOP and VALIDATE**: `pytest ner/tests/` passes; `curl POST .../api/v1/documents/{id}/extract-entities/` returns 201 with entities_created > 0
5. Demo to stakeholders; proceed to Retrieve Entities only after Extract Entities sign-off

### Incremental Delivery

1. Setup + Foundational → container boots, models/migrations in place
2. Extract Entities → working entity extraction pipeline → **Sprint 2 MVP**
3. Retrieve Entities → entity list endpoint → query capability ready
4. Graph Nodes API → graph-ready data → visualization foundation ready
5. Frontend → complete UI layer → end-to-end workflow ready
6. Polish → docs, tests, performance, security → PR-ready

### Parallel Team Strategy

After Phase 2 complete:
- **Developer A**: Extract Entities (T021–T032) — NER pipeline with Groq
- **Developer B**: Retrieve Entities (T033–T036) — entity retrieval API
- Developer B can start Graph Nodes API (T039–T044) once Retrieve Entities merges
- **Developer C**: Frontend pages/components (T053–T064) once all 3 APIs working

---

## Notes

- `[P]` = different files, no dependencies — safe to run concurrently
- `[Story]` label maps each task to a user story for traceability
- Tests must FAIL before implementation; commit test files separately from implementation
- Commit after each task or logical group; PRs per user story
- Stop at any checkpoint to validate story independently before the next
- **Synchronous extraction**: Per clarification — POST returns 201 Created after completion, not 202 Accepted
- **Clean slate re-extraction**: Per clarification — DELETE all existing entities before creating new ones
- **Cytoscape ssr:false**: Per clarification — Next.js dynamic import with `ssr: false` MANDATORY to prevent hydration errors
- **Prompt versioning**: Per constitution — NER prompts stored in `prompts/ner-extraction-v1.md` as versioned source artifacts
- No authentication (MVP) — all endpoints public

