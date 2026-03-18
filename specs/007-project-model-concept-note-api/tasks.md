# Tasks: Project Model + Concept Note + Full Project API

**Input**: Design documents from `/specs/007-project-model-concept-note-api/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: New test-writing tasks are not mandated by spec; regression validation tasks are included in final phase.

**Organization**: Tasks are grouped by user story for independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no incomplete dependency)
- **[Story]**: Present only in user story phases (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare project-scoped feature scaffolding and route integration points.

- [X] T001 Add US-07 branch context and scope notes in `specs/007-project-model-concept-note-api/plan.md`
- [X] T002 [P] Add US-07 API surface summary in `specs/007-project-model-concept-note-api/contracts/api.md`
- [X] T003 [P] Add project-scoped flow overview in `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and migration groundwork required before all user stories.

**⚠️ CRITICAL**: No user story work starts before this phase is complete.

- [X] T004 Create `Project` and `ConceptNote` models in `ingestion/models.py`
- [X] T005 Add nullable `project` FK to `Document` in `ingestion/models.py`
- [X] T006 Add nullable `project` FK to `Entity` and `Relation` in `ner/models.py`
- [X] T007 Create migration for project/concept note/document FK in `ingestion/migrations/0003_project_conceptnote_and_document_fk.py`
- [X] T008 Create migration for entity/relation project FKs in `ner/migrations/0013_add_project_fk_to_entity_and_relation.py`
- [X] T009 Implement data migration to create default project and assign legacy documents in `ingestion/migrations/0004_backfill_default_project.py`
- [X] T010 Implement data migration to backfill `Entity.project` and `Relation.project` from document context in `ner/migrations/0014_backfill_project_fk.py`
- [X] T011 [P] Add serializers for `Project` and `ConceptNote` in `ingestion/serializers.py`
- [X] T012 [P] Add serializer support for global entity profile projects list in `ner/serializers.py`
- [X] T013 Add shared project-context resolver helper in `ingestion/views.py`

**Checkpoint**: Database and serialization foundations are complete; story work can begin.

---

## Phase 3: User Story 1 - Create and Manage Projects (Priority: P1) 🎯 MVP

**Goal**: Deliver full project CRUD and dashboard-ready project summaries.

**Independent Test**: User can create/list/retrieve/update/delete projects and see summary metrics in dashboard cards.

- [X] T014 [US1] Implement project list/create API (`POST/GET /api/v1/projects/`) in `ingestion/views.py`
- [X] T015 [US1] Implement project detail/update/delete API (`GET/PATCH/DELETE /api/v1/projects/{id}/`) in `ingestion/views.py`
- [X] T016 [US1] Register project CRUD routes in `ingestion/urls.py`
- [X] T017 [US1] Include ingestion project routes in root API router in `stakeholder_analysis/urls.py`
- [X] T018 [US1] Add project list/detail/update/delete API client methods in `frontend/src/lib/api.ts`
- [X] T019 [US1] Add project domain types (`ProjectSummary`, `ProjectDetail`) in `frontend/src/types/index.ts`
- [X] T020 [US1] Replace landing page with project dashboard cards in `frontend/pages/index.tsx`
- [X] T021 [US1] Add project create step 1 (name + description) UI in `frontend/pages/projects/new.tsx`
- [X] T022 [US1] Add project create step 3 (confirmation) UI in `frontend/pages/projects/new.tsx`

**Checkpoint**: Project lifecycle and dashboard are functional independently.

---

## Phase 4: User Story 2 - Attach and Reuse a Concept Note Per Project (Priority: P1)

**Goal**: Deliver project concept note CRUD (single note per project) and extraction-context readiness.

**Independent Test**: User can create/retrieve/update project concept note with text and optional file.

- [X] T023 [US2] Implement concept note get/upsert API (`GET/POST /api/v1/projects/{id}/concept-note/`) in `ingestion/views.py`
- [X] T024 [US2] Register concept note route in `ingestion/urls.py`
- [X] T025 [US2] Add concept note request/response serializers in `ingestion/serializers.py`
- [X] T026 [US2] Add concept note API client methods in `frontend/src/lib/api.ts`
- [X] T027 [US2] Add concept note type definitions in `frontend/src/types/index.ts`
- [X] T028 [US2] Add project create step 2 concept note editor (textarea + optional file upload) in `frontend/pages/projects/new.tsx`
- [X] T029 [US2] Add project settings concept note editor in `frontend/pages/projects/[id]/settings.tsx`

**Checkpoint**: Concept note lifecycle works independently and is editable over time.

---

## Phase 5: User Story 3 - Work Only Inside Project Context (Priority: P1)

**Goal**: Enforce project-scoped upload/extraction/entity/graph flows and workspace UX.

**Independent Test**: Upload/extract/read succeeds only within project context; scoped endpoints return only project data.

- [X] T030 [US3] Implement project-scoped document upload endpoint (`POST /api/v1/projects/{id}/documents/`) in `ingestion/views.py`
- [X] T031 [US3] Register project-scoped upload route in `ingestion/urls.py`
- [X] T032 [US3] Implement project-scoped extraction trigger (`POST /api/v1/projects/{id}/extract-entities/`) in `ner/views.py`
- [X] T033 [US3] Inject project concept note context into provider pipeline calls in `ner/services/pipeline.py`
- [X] T034 [US3] Implement project-scoped entities endpoint (`GET /api/v1/projects/{id}/entities/`) in `ner/views.py`
- [X] T035 [US3] Implement project-scoped graph endpoint (`GET /api/v1/projects/{id}/graph/`) in `ner/views.py`
- [X] T036 [US3] Register scoped extraction/entities/graph routes in `ner/urls.py`
- [X] T037 [US3] Add project workspace page (left document panel + right map panel) in `frontend/pages/projects/[id]/workspace.tsx`
- [X] T038 [US3] Update upload flow to require project context in `frontend/pages/upload.tsx`
- [X] T039 [US3] Update entities page to consume project-scoped endpoints in `frontend/pages/entities.tsx`
- [X] T040 [US3] Update graph page to consume project-scoped endpoints in `frontend/pages/graph.tsx`
- [X] T041 [US3] Add project-scoped upload/extraction/entities/graph API methods in `frontend/src/lib/api.ts`
- [X] T042 [US3] Add client-side route guard preventing no-project upload/extraction access in `frontend/src/components/Layout.tsx`

**Checkpoint**: Users can only operate within project-scoped workflows.

---

## Phase 6: User Story 4 - Preserve Existing Data and Backward Compatibility (Priority: P1)

**Goal**: Keep legacy behavior functional while delivering migration safety and global entity profile.

**Independent Test**: Legacy endpoints remain functional; old records are linked to default project; global entity profile reports project memberships.

- [X] T043 [US4] Ensure legacy document upload endpoint remains operational with fallback default project mapping in `ingestion/views.py`
- [X] T044 [US4] Ensure legacy extraction endpoint remains operational with inferred project context in `ner/views.py`
- [X] T045 [US4] Ensure legacy entity and graph endpoints remain backward-compatible in `ner/views.py`
- [X] T046 [US4] Implement global entity profile endpoint (`GET /api/v1/entities/{id}/`) in `ner/views.py`
- [X] T047 [US4] Register global entity profile route in `ner/urls.py`
- [X] T048 [US4] Add global entity profile API method in `frontend/src/lib/api.ts`
- [X] T049 [US4] Add global entity profile response type in `frontend/src/types/index.ts`
- [X] T050 [US4] Add migration-safe default project lookup utility used by legacy paths in `ingestion/models.py`

**Checkpoint**: Transition behavior is safe for old and new clients.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, docs, validation, and release readiness.

- [X] T051 [P] Update US-07 API contract examples to final payloads in `specs/007-project-model-concept-note-api/contracts/api.md`
- [X] T052 [P] Update US-07 quickstart to match final endpoint set in `specs/007-project-model-concept-note-api/quickstart.md`
- [X] T053 [P] Update `docs/SPRINT_PLAN.md` progress markers for US-07 scope in `docs/SPRINT_PLAN.md`
- [X] T054 Add changelog entry for US-07 project model and scoped flows in `CHANGELOG.md`
- [X] T055 Run backend regression in Docker and record result in `specs/007-project-model-concept-note-api/quickstart.md`
- [X] T056 Run frontend regression and record result in `specs/007-project-model-concept-note-api/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all stories
- **Phase 3 (US1)**: depends on Phase 2
- **Phase 4 (US2)**: depends on Phase 2; integrates with US1 project model
- **Phase 5 (US3)**: depends on Phase 2 and consumes US1/US2 models and APIs
- **Phase 6 (US4)**: depends on Phase 2; validates compatibility against US1–US3 additions
- **Phase 7 (Polish)**: depends on all story phases

### User Story Dependencies

- **US1 (P1)**: can start after foundational completion
- **US2 (P1)**: depends on US1 `Project` existence
- **US3 (P1)**: depends on US1 + US2 for scoped context and concept note injection
- **US4 (P1)**: depends on foundational migrations and updated API routing from US1–US3

### Parallel Opportunities

- Setup docs: `T002`, `T003`
- Foundational serialization tasks: `T011`, `T012`
- US1 frontend API/types can proceed with backend endpoints: `T018`, `T019`
- US2 frontend API/types can proceed with backend concept-note endpoint: `T026`, `T027`
- Polish docs: `T051`, `T052`, `T053`

---

## Parallel Example: User Story 1

```bash
Task: T014 Implement project list/create API in ingestion/views.py
Task: T018 Add project list/detail/update/delete API client methods in frontend/src/lib/api.ts
Task: T019 Add project domain types in frontend/src/types/index.ts
```

## Parallel Example: User Story 2

```bash
Task: T023 Implement concept note get/upsert API in ingestion/views.py
Task: T026 Add concept note API client methods in frontend/src/lib/api.ts
Task: T027 Add concept note types in frontend/src/types/index.ts
```

## Parallel Example: User Story 3

```bash
Task: T032 Implement project-scoped extraction trigger in ner/views.py
Task: T033 Inject concept note context into provider pipeline in ner/services/pipeline.py
Task: T041 Add project-scoped API client methods in frontend/src/lib/api.ts
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Setup + Foundational
2. Deliver US1 project CRUD and dashboard cards
3. Validate independent project lifecycle before scoped workflows

### Incremental Delivery

1. Ship US1 (project model + dashboard)
2. Add US2 (concept note lifecycle)
3. Add US3 (project-scoped operational flows)
4. Add US4 (compatibility + global entity profile)
5. Complete polish and regression validation

### Team Parallel Strategy

1. Backend engineer A: migrations + project/concept-note APIs (US1/US2)
2. Backend engineer B: scoped extraction/entities/graph + compatibility (US3/US4)
3. Frontend engineer: dashboard/new flow/workspace/settings + API integration
