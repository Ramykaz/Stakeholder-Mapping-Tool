# Tasks: Complete UI Polishing and Rewiring

**Input**: Design documents from `/specs/009-complete-ui-rewiring/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No new test-authoring tasks are included because the feature spec does not explicitly request TDD/test-first implementation; validation tasks are included in the final phase.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently once dependencies are satisfied.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared frontend rewiring scaffolding and path helpers used by all stories.

- [ ] T001 Create rewiring type definitions in frontend/src/types/rewiring.ts
- [ ] T002 [P] Create shared route builder helpers in frontend/src/lib/routes.ts
- [ ] T003 [P] Create workspace context persistence helper in frontend/src/lib/workspaceContext.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the global shell and styling contract required before any page-level story rewiring.

**⚠️ CRITICAL**: User story implementation starts only after this phase is complete.

- [ ] T004 [P] Apply global design tokens, base styles, and utility classes in frontend/src/styles/globals.css
- [ ] T005 [P] Add global font loading and base app wiring in frontend/pages/_app.tsx
- [ ] T006 [P] Implement shared entity/status mapping constants in frontend/src/lib/entityTypes.ts
- [ ] T007 [P] Implement top navigation component in frontend/src/components/layout/TopNavigation.tsx
- [ ] T008 [P] Implement authenticated sidebar component in frontend/src/components/layout/Sidebar.tsx
- [ ] T009 Integrate TopNavigation and Sidebar into shared layout shell in frontend/src/components/Layout.tsx
- [ ] T010 Add shared async-state and badge adapter utilities in frontend/src/lib/uiState.ts

**Checkpoint**: Shared design system and authenticated shell are ready for story work.

---

## Phase 3: User Story 1 - Unified Navigation and Workspace Context (Priority: P1) 🎯 MVP

**Goal**: Deliver consistent navigation/auth/project entry UX with workspace-aware routing continuity.

**Independent Test**: Sign in, open landing/auth/projects flows, and navigate to a project context without losing route-based workspace identity.

- [ ] T011 [US1] Replace unauthenticated marketing landing content in frontend/pages/index.tsx
- [ ] T012 [US1] Keep authenticated redirect behavior from landing in frontend/pages/index.tsx
- [ ] T013 [P] [US1] Rewire login page to split-panel design using existing auth handlers in frontend/pages/login.tsx
- [ ] T014 [P] [US1] Rewire register page to split-panel design using existing auth handlers in frontend/pages/register.tsx
- [ ] T015 [P] [US1] Add auth-route compatibility wrapper for login in frontend/pages/auth/login.tsx
- [ ] T016 [P] [US1] Add auth-route compatibility wrapper for register in frontend/pages/auth/register.tsx
- [ ] T017 [US1] Create projects dashboard page with card grid, empty state, and create modal in frontend/pages/projects/index.tsx
- [ ] T018 [US1] Extend frontend project summary mapping for status/count metadata in frontend/src/lib/api.ts
- [ ] T019 [US1] Expose project status/count fields for dashboard cards in ner/serializers.py
- [ ] T020 [US1] Align project list/detail payload construction with dashboard requirements in ner/views.py
- [ ] T021 [US1] Wire projects dashboard navigation to workspace-aware routes in frontend/pages/projects/index.tsx

**Checkpoint**: Navigation/auth/projects entry experience is coherent and independently demoable.

---

## Phase 4: User Story 2 - End-to-End Processing Transparency (Priority: P1)

**Goal**: Deliver concept-note and document-processing workflow with clear progress and terminal states.

**Independent Test**: Create/select a project, save concept note, upload documents, observe queued/processing/completed/failed transitions, and proceed to graph route when ready.

- [ ] T022 [US2] Create concept note setup page with autosave and upload UX in frontend/pages/projects/[id]/setup.tsx
- [ ] T023 [US2] Add frontend concept-note API methods for read/update/upload in frontend/src/lib/api.ts
- [ ] T024 [US2] Add or align concept-note endpoints for project scope in ner/urls.py
- [ ] T025 [US2] Implement concept-note endpoint handlers and validation in ner/views.py
- [ ] T026 [US2] Add concept-note persistence fields if missing in ner/models.py
- [ ] T027 [US2] Add concept-note schema migration if missing in ner/migrations/0016_project_concept_note_fields.py
- [ ] T028 [US2] Create project documents page with dropzone, list, and CTA gating in frontend/pages/projects/[id]/documents.tsx
- [ ] T029 [US2] Add project-scoped document upload/list/delete/status methods in frontend/src/lib/api.ts
- [ ] T030 [US2] Add or align project document/status endpoints in ner/urls.py
- [ ] T031 [US2] Implement project document/status endpoint handlers with polling-friendly payloads in ner/views.py
- [ ] T032 [US2] Implement polling loop and terminal-state reconciliation in frontend/pages/projects/[id]/documents.tsx
- [ ] T033 [US2] Verify or add Celery progress pipeline wiring for project documents in ingestion/services/pipeline.py
- [ ] T034 [US2] Add Celery task entrypoint and retries for document processing if missing in ingestion/tasks.py
- [ ] T035 [US2] Wire setup→documents→map transitions using route helpers in frontend/src/lib/routes.ts

**Checkpoint**: Analysts can complete upload-to-processed workflow with transparent status behavior.

---

## Phase 5: User Story 3 - Insight Exploration Across Graph and Reasoning Views (Priority: P2)

**Goal**: Deliver project map exploration, entity detail workflows, and reasoning continuity in the same workspace context.

**Independent Test**: From a processed project, open map, inspect entities/relations, open entity detail, and navigate to reasoning/workspace context without manual re-selection.

- [ ] T036 [US3] Create project map route with banner, tabs, and overlay containers in frontend/pages/projects/[id]/map.tsx
- [ ] T037 [US3] Rewire graph visual styling and node/edge semantics in frontend/src/components/GraphVisualization.tsx
- [ ] T038 [US3] Align Cytoscape style mapping with entity constants in frontend/src/lib/cytoscapeStyle.ts
- [ ] T039 [US3] Add NL query input/result panel and highlight behavior in frontend/pages/projects/[id]/map.tsx
- [ ] T040 [US3] Add project graph/query/layout API methods in frontend/src/lib/api.ts
- [ ] T041 [US3] Add or align project map/query/layout endpoints in ner/urls.py
- [ ] T042 [US3] Implement graph/query/layout endpoint handlers for project scope in ner/views.py
- [ ] T043 [US3] Rewire slide-in entity panel presentation and navigation hooks in frontend/src/components/EntitySidePanel.tsx
- [ ] T044 [US3] Create full entity detail route page in frontend/pages/projects/[id]/entities/[entityId].tsx
- [ ] T045 [US3] Add entity profile/global-presence API mapping in frontend/src/lib/api.ts
- [ ] T046 [US3] Add or align project entity detail serializer payload in ner/serializers.py
- [ ] T047 [US3] Implement entity detail/contextual summary handler in ner/views.py
- [ ] T048 [US3] Verify or add deduplication resolution integration in ner/services/deduplicator.py
- [ ] T049 [US3] Verify dedup pipeline usage for persisted entities and relations in ner/services/pipeline.py
- [ ] T050 [US3] Verify provider abstraction parity across configured providers in ner/services/provider_factory.py
- [ ] T051 [US3] Align provider runtime retry/fallback behavior with abstraction contract in ner/services/provider_runtime.py
- [ ] T052 [US3] Add versioned extraction prompt file for joint extraction in prompts/extract_entities_v1.txt
- [ ] T053 [US3] Wire extraction prompt loading into provider payload construction in ner/services/provider_payloads.py
- [ ] T054 [US3] Add reasoning-context navigation integration from map/entity views in frontend/pages/projects/[id]/workspace.tsx

**Checkpoint**: Graph/entity/reasoning exploration works with shared workspace context continuity.

---

## Phase 6: User Story 4 - Reliable Experience During Empty and Error States (Priority: P3)

**Goal**: Provide consistent loading/empty/error behavior and recovery guidance across all rewired pages.

**Independent Test**: Exercise first-use/no-data/error scenarios on projects, setup, documents, map, and entity routes and confirm actionable next steps and retry paths.

- [ ] T055 [US4] Create reusable empty-state component variants for no-data workflows in frontend/src/components/EmptyState.tsx
- [ ] T056 [US4] Standardize retryable error rendering contract in frontend/src/components/ErrorMessage.tsx
- [ ] T057 [US4] Normalize API error payload mapping for UI state handling in frontend/src/lib/api.ts
- [ ] T058 [US4] Apply loading/empty/error state contract to projects dashboard in frontend/pages/projects/index.tsx
- [ ] T059 [US4] Apply loading/empty/error state contract to setup and documents pages in frontend/pages/projects/[id]/setup.tsx
- [ ] T060 [US4] Apply loading/empty/error state contract to map and entity detail pages in frontend/pages/projects/[id]/map.tsx
- [ ] T061 [US4] Add stale-response guards for workspace switching in frontend/src/lib/workspaceContext.ts

**Checkpoint**: Empty/error states are consistent, actionable, and recoverable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and validation passes across all stories.

- [ ] T062 [P] Update rewired route/API documentation in README.md
- [ ] T063 [P] Update requirements alignment notes for rewired UX in docs/PROJECT_REQUIREMENTS.md
- [ ] T064 Run backend validation commands from quickstart and capture outcomes in specs/009-complete-ui-rewiring/quickstart.md
- [ ] T065 Run frontend validation commands from quickstart and capture outcomes in specs/009-complete-ui-rewiring/quickstart.md
- [ ] T066 Perform manual smoke checklist and record sign-off notes in specs/009-complete-ui-rewiring/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2 and uses US1 navigation/routing outputs.
- **Phase 5 (US3)**: Depends on Phase 2 and consumes US2 processing outputs for meaningful map/entity exploration.
- **Phase 6 (US4)**: Depends on Phases 3–5 page surfaces being present.
- **Phase 7 (Polish)**: Depends on all selected stories being complete.

### User Story Dependency Graph

- **US1 (P1)** → Enables workspace entry and shared routing.
- **US2 (P1)** → Uses US1 navigation context for setup/documents workflow.
- **US3 (P2)** → Uses US2 processed outputs for graph/entity/reasoning exploration.
- **US4 (P3)** → Hardens all previously delivered journeys with consistent recovery UX.

### Parallel Opportunities

- **Setup**: T002 and T003 can run in parallel after T001.
- **Foundational**: T004, T005, T006, T007, T008 can run in parallel, then merge at T009.
- **US1**: T013–T016 can run in parallel while T017–T021 proceed sequentially.
- **US2**: Backend concept-note tasks (T024–T027) can run in parallel with frontend setup page tasks (T022–T023) before integration at T028–T035.
- **US3**: Frontend map/entity rewiring (T036–T045) can run in parallel with backend payload tasks (T041–T053), then integrate at T054.
- **US4**: T055–T057 can run in parallel, followed by page applications T058–T061.

---

## Parallel Execution Examples

### User Story 1

```bash
# Parallel auth-page rewiring
T013 frontend/pages/login.tsx
T014 frontend/pages/register.tsx
T015 frontend/pages/auth/login.tsx
T016 frontend/pages/auth/register.tsx
```

### User Story 2

```bash
# Parallel concept-note backend/frontend preparation
T022 frontend/pages/projects/[id]/setup.tsx
T023 frontend/src/lib/api.ts
T024 ner/urls.py
T025 ner/views.py
T026 ner/models.py
T027 ner/migrations/0016_project_concept_note_fields.py
```

### User Story 3

```bash
# Parallel map/entity surface and backend payload alignment
T036 frontend/pages/projects/[id]/map.tsx
T043 frontend/src/components/EntitySidePanel.tsx
T044 frontend/pages/projects/[id]/entities/[entityId].tsx
T046 ner/serializers.py
T047 ner/views.py
```

### User Story 4

```bash
# Parallel shared UX-state hardening
T055 frontend/src/components/EmptyState.tsx
T056 frontend/src/components/ErrorMessage.tsx
T057 frontend/src/lib/api.ts
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate independent navigation/auth/projects flow before proceeding.

### Incremental Delivery

1. Foundation (Phases 1–2)
2. US1 (navigation/workspace entry)
3. US2 (processing transparency)
4. US3 (graph/entity/reasoning exploration)
5. US4 (empty/error resilience)
6. Polish and validation (Phase 7)

### Required Sequence from Rewiring Spec (0→13)

- Task 0–2 are covered in Phase 2 (T004–T009).
- Task 3–5 are covered in US1 (T011–T021).
- Task 6–7 and 10 are covered in US2 (T022–T035).
- Task 8–9 and 11–13 are covered in US3 (T036–T054).
- Cross-page hardening is finalized in US4 and Polish (T055–T066).
