# Tasks: Incremental Extraction, Document Review, and Evidence Integrity

**Input**: Design documents from `/specs/016-document-extraction-integrity/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Automated test tasks are included where they are directly required to validate story behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3])
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare schema and API/UI scaffolding for US-016 implementation.

- [X] T001 Add US-016 task tracking notes and command references in specs/016-document-extraction-integrity/quickstart.md
- [X] T002 Create migration scaffold for document extraction and evidence provenance fields in ingestion/migrations/ and ner/migrations/
- [X] T003 [P] Add serializer placeholders for document extraction state metadata in ingestion/serializers.py
- [X] T004 [P] Add route placeholders for document review and re-extract endpoints in ner/urls.py and ingestion/urls.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement core data and service capabilities required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement Document raw/cleaned text and extracted_at fields in ingestion/models.py
- [X] T006 Implement EntityMention provenance model and constraints in ner/models.py
- [X] T007 [P] Extend relationship provenance fields for source_document and excerpt in ner/models.py
- [X] T008 Create and apply schema migrations for foundational model changes in ingestion/migrations/ and ner/migrations/
- [X] T009 Implement text cleaning pipeline utilities for baseline and web-source strict cleaning in ingestion/services/extractor.py
- [X] T010 [P] Wire cleaned_text-first chunking/embedding/extraction flow in ingestion/services/pipeline.py
- [X] T011 Implement graph query guard to exclude entities without mentions in ner/views.py
- [X] T012 Implement reusable orphan cleanup service for legacy records in ner/services/pipeline.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Incremental Extraction Only (Priority: P1) 🎯 MVP

**Goal**: Process only unextracted documents by default and support explicit per-document re-extraction.

**Independent Test**: Mixed extracted/unextracted project processes only new documents and displays accurate extraction counts/states.

### Implementation for User Story 1

- [X] T013 [US1] Update project extraction selector to target only documents where extracted_at is null in ingestion/views.py
- [X] T014 [US1] Persist extraction state transitions and extraction timestamp updates in ingestion/services/pipeline.py
- [X] T015 [US1] Implement single-document re-extract API endpoint in ingestion/views.py
- [X] T016 [US1] Add re-extract endpoint routing for project documents in ingestion/urls.py
- [X] T017 [US1] Expose extraction status and metadata fields in document list serializer in ingestion/serializers.py
- [X] T018 [US1] Update document extraction action label with new-document count in frontend/pages/projects/[id]/documents.tsx
- [X] T019 [US1] Add per-document status badges and extraction timestamp display in frontend/pages/projects/[id]/documents.tsx
- [X] T020 [US1] Add per-document re-extract action handling in frontend/pages/projects/[id]/documents.tsx

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Document-Level Extraction Review and Corrections (Priority: P1)

**Goal**: Provide inline per-document entity/relationship review with edit and delete actions.

**Independent Test**: Analyst can open one processed document, review entities/relationships with confidence/excerpts, edit/delete values, and see immediate graph consistency.

### Implementation for User Story 2

- [X] T021 [US2] Implement document-scoped entities listing endpoint in ner/views.py
- [X] T022 [US2] Implement document-scoped relationships listing endpoint in ner/views.py
- [X] T023 [US2] Implement document-scoped entity mention delete endpoint with orphan-aware behavior in ner/views.py
- [X] T024 [US2] Implement document-scoped relationship delete and relabel endpoints in ner/views.py
- [X] T025 [US2] Implement canonical entity name/type correction endpoint updates in ner/views.py
- [X] T026 [US2] Register document review endpoints in ner/urls.py
- [X] T027 [US2] Add serializers for document review entity and relationship projections in ner/serializers.py
- [X] T028 [US2] Build lazy-loaded document review panel with Entities and Relationships tabs in frontend/pages/projects/[id]/documents.tsx
- [X] T029 [US2] Implement inline entity/relationship edit and delete actions in frontend/pages/projects/[id]/documents.tsx

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - No Orphaned Entities in Graph (Priority: P1)

**Goal**: Enforce strict mention-backed entity integrity across extraction, persistence, query, and cleanup paths.

**Independent Test**: Entities without document mentions are not persisted, are not returned by graph APIs, and are removed by cleanup.

### Implementation for User Story 3

- [X] T030 [US3] Add extraction-time mention evidence validation against chunk text in ner/services/pipeline.py
- [X] T031 [US3] Enforce persistence rule that entities require at least one mention in ner/services/pipeline.py
- [X] T032 [US3] Ensure graph payload construction filters orphaned entities in ner/views.py
- [X] T033 [US3] Add one-time orphan cleanup management command in ner/management/commands/cleanup_orphan_entities.py
- [X] T034 [US3] Integrate orphan cleanup trigger into operational runbook in specs/016-document-extraction-integrity/quickstart.md

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: User Story 4 - Cleaned Text Extraction and Excerpts (Priority: P1)

**Goal**: Use cleaned text across chunking/extraction and all evidence excerpts shown to users.

**Independent Test**: Noisy sample documents produce clean excerpts and extraction uses cleaned text rather than raw text.

### Implementation for User Story 4

- [X] T035 [US4] Persist raw_text and cleaned_text per document during ingestion in ingestion/services/extractor.py
- [X] T036 [US4] Apply strict web-source cleaning heuristics for script/markup-like noise in ingestion/services/web_source.py
- [X] T037 [US4] Ensure chunk creation always uses cleaned_text in ingestion/services/chunker.py
- [X] T038 [US4] Ensure embedding/extraction input uses cleaned_text in ingestion/services/pipeline.py
- [X] T039 [US4] Update entity and relationship excerpt sourcing to cleaned text in ner/services/pipeline.py
- [X] T040 [US4] Update review/detail excerpt display mapping to cleaned evidence fields in frontend/pages/projects/[id]/documents.tsx

**Checkpoint**: User Story 4 is independently functional and testable.

---

## Phase 7: User Story 5 - Specific Entity Context Summaries (Priority: P2)

**Goal**: Produce project-specific, evidence-grounded entity summaries with insufficiency handling and cache invalidation.

**Independent Test**: High-evidence entities receive grounded summaries; low-evidence entities show insufficiency notice; evidence edits invalidate stale cache.

### Implementation for User Story 5

- [X] T041 [US5] Implement evidence-threshold gate for contextual summary generation in ner/services/contextual_summary.py
- [X] T042 [US5] Build summary evidence package from cleaned excerpts and project relationships in ner/services/contextual_summary.py
- [X] T043 [US5] Return insufficiency status payload for low-evidence entities in ner/views.py
- [X] T044 [US5] Invalidate cached summaries on relationship edits/deletes and mention changes in ner/views.py
- [X] T045 [US5] Update entity detail summary rendering for insufficiency and refreshed summary states in frontend/pages/projects/[id]/entities/[entityId].tsx

**Checkpoint**: User Story 5 is independently functional and testable.

---

## Phase 8: User Story 6 - Embedded Entity Mini-Graph (Priority: P2)

**Goal**: Render static 1-hop mini-graph on entity detail with click-through traversal.

**Independent Test**: Connected entities render radial mini-graph with navigable neighbors; disconnected entities show explicit no-connections message.

### Implementation for User Story 6

- [X] T046 [US6] Add entity-neighborhood projection helper for one-hop relationships in frontend/src/lib/
- [X] T047 [US6] Create static radial mini-graph component using D3 in frontend/src/components/EntityMiniGraph.tsx
- [X] T048 [US6] Integrate mini-graph into entity detail between stats and relationships in frontend/pages/projects/[id]/entities/[entityId].tsx
- [X] T049 [US6] Implement neighbor node click navigation to entity detail route in frontend/pages/projects/[id]/entities/[entityId].tsx
- [X] T050 [US6] Add no-connections fallback message for empty neighborhoods in frontend/src/components/EntityMiniGraph.tsx

**Checkpoint**: User Story 6 is independently functional and testable.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and validation across all stories.

- [X] T051 [P] Update API documentation for new/changed endpoints in specs/016-document-extraction-integrity/contracts/api.yaml
- [X] T052 [P] Update user-facing workflow docs for extraction states and review flows in README.md
- [X] T053 Run end-to-end quickstart validation checklist for US-016 scenarios in specs/016-document-extraction-integrity/quickstart.md
- [X] T054 Run backend regression subset for ingestion and NER flows in ingestion/tests/ and ner/tests/
- [X] T055 Run frontend regression subset for documents and entity detail experiences in frontend/src/__tests__/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion
  - P1 stories (US1, US2, US3, US4) should be delivered first
  - P2 stories (US5, US6) depend on data integrity outputs from P1 stories
- **Polish (Phase 9)**: Depends on completion of selected user stories

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; no dependency on other stories
- **US2 (P1)**: Starts after Foundational; relies on foundational provenance fields
- **US3 (P1)**: Starts after Foundational; should complete before final graph QA
- **US4 (P1)**: Starts after Foundational; should complete before US5 summary quality work
- **US5 (P2)**: Depends on US2 + US4 outputs (review edits and cleaned evidence)
- **US6 (P2)**: Depends on US2 graph-consistent relationship payload behavior

### Within Each User Story

- Backend model/service changes before API exposure
- API contract-aligned responses before frontend integration
- Frontend integration before story-level validation

### Parallel Opportunities

- Phase 1: T003 and T004 can run in parallel after T001
- Phase 2: T007 and T010 can run in parallel after T005/T006/T009 readiness
- US1: T018 and T019 can run in parallel after T017
- US2: T021 and T022 can run in parallel; T028 and T029 can run in parallel after T026/T027
- US3: T032 and T033 can run in parallel after T030/T031
- US4: T037 and T038 can run in parallel after T035/T036
- US5: T041 and T042 can run in parallel before T043/T044
- US6: T047 and T050 can run in parallel after T046
- Phase 9: T051 and T052 can run in parallel

---

## Parallel Example: User Story 1

```bash
Task: "T018 [US1] Update document extraction action label with new-document count in frontend/pages/projects/[id]/documents.tsx"
Task: "T019 [US1] Add per-document status badges and extraction timestamp display in frontend/pages/projects/[id]/documents.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T021 [US2] Implement document-scoped entities listing endpoint in ner/views.py"
Task: "T022 [US2] Implement document-scoped relationships listing endpoint in ner/views.py"
```

## Parallel Example: User Story 3

```bash
Task: "T032 [US3] Ensure graph payload construction filters orphaned entities in ner/views.py"
Task: "T033 [US3] Add one-time orphan cleanup management command in ner/management/commands/cleanup_orphan_entities.py"
```

## Parallel Example: User Story 4

```bash
Task: "T037 [US4] Ensure chunk creation always uses cleaned_text in ingestion/services/chunker.py"
Task: "T038 [US4] Ensure embedding/extraction input uses cleaned_text in ingestion/services/pipeline.py"
```

## Parallel Example: User Story 5

```bash
Task: "T041 [US5] Implement evidence-threshold gate for contextual summary generation in ner/services/contextual_summary.py"
Task: "T042 [US5] Build summary evidence package from cleaned excerpts and project relationships in ner/services/contextual_summary.py"
```

## Parallel Example: User Story 6

```bash
Task: "T047 [US6] Create static radial mini-graph component using D3 in frontend/src/components/EntityMiniGraph.tsx"
Task: "T050 [US6] Add no-connections fallback message for empty neighborhoods in frontend/src/components/EntityMiniGraph.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate US1 independently on mixed extracted/unextracted projects

### Incremental Delivery

1. Deliver US1 (incremental extraction)
2. Deliver US2 + US3 + US4 (reviewability + integrity + cleaning)
3. Deliver US5 + US6 (summary quality + mini-graph)
4. Run Phase 9 regression and documentation updates

### Parallel Team Strategy

1. Team A: Backend provenance/integrity tasks (US2/US3/US4)
2. Team B: Frontend review and mini-graph tasks (US2/US6)
3. Team C: Summary quality tasks (US5)
4. Merge after contract and quickstart validation

---

## Notes

- [P] tasks indicate safe concurrency where files/dependencies do not conflict.
- [US#] labels provide direct traceability to spec user stories.
- Each user story includes an independent test criterion from spec.md.
- Suggested MVP scope: Phase 1 + Phase 2 + Phase 3 (US1 only).

---

## Post-Implementation Follow-up (UX Continuity)

- [X] F001 Add project-level extraction status and stop endpoints with cooperative cancellation in `ner/views.py`, `ner/services/pipeline.py`, and `ner/urls.py`
- [X] F002 Integrate extraction status polling + stop action in `frontend/pages/projects/[id]/analyze.tsx` and API client methods in `frontend/src/lib/api.ts`
- [X] F003 Refresh documents extraction state during/after active runs in `frontend/pages/projects/[id]/documents.tsx` and add backend regression tests in `ner/tests/test_views.py`
- [X] F004 Fix provider/model resolution fallback so explicit request provider uses provider-default model when model is omitted in `ner/views.py`, with regression coverage in `ner/tests/test_views.py`
- [X] F005 Return user-friendly provider rate-limit payloads and map them in the Analyze client flow via `ner/views.py` and `frontend/src/lib/api.ts`, with regression tests in `ner/tests/test_views.py` and `frontend/src/__tests__/lib/api.test.ts`
- [X] F006 Prevent Analyze from getting stuck on 429 by persisting failed extraction status and improve stop-flow status transitions (`running` → `cancelling`) in `ner/views.py` and `frontend/pages/projects/[id]/analyze.tsx`, with backend regressions in `ner/tests/test_views.py`
