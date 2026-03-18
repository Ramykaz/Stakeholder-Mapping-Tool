# Tasks: US-08 Kumu-Inspired Graph Redesign + Entity Side Panel + Filters + Focus Mode

**Input**: Design documents from `/specs/008-ui-and-graph-redesign/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include tests for each user story because the spec defines independent test criteria and the constitution requires relevant tests before PR.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Every task includes exact file path(s)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared scaffolding for US-08 implementation across backend/frontend.

- [X] T001 Create US-08 graph/panel test fixture module in frontend/src/__tests__/fixtures/graphPanel.ts
- [X] T002 Create backend API fixture helpers for graph/profile/summary tests in ner/tests/factories.py
- [X] T003 [P] Add US-08 endpoint/type placeholders in frontend/src/types/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required before user stories can be delivered.

**⚠️ CRITICAL**: No user story work should start before this phase is complete.

- [X] T004 Add contextual summary cache model in ner/models.py
- [X] T005 Add contextual summary cache migration in ner/migrations/0008_contextual_entity_summary.py
- [X] T006 [P] Add access-scoped entity profile serializer primitives in ner/serializers.py
- [X] T007 [P] Add summary service skeleton (cache/refresh/timeout contract) in ner/services/contextual_summary.py
- [X] T008 Add profile/summary route wiring in ner/urls.py
- [X] T009 [P] Expose new backend routes in stakeholder_analysis/urls.py
- [X] T010 Add frontend API client methods for entity profile and summary endpoints in frontend/src/lib/api.ts
- [X] T011 [P] Add shared graph/filter/focus/summary TS types in frontend/src/types/index.ts

**Checkpoint**: Foundation complete; user stories can proceed independently.

---

## Phase 3: User Story 1 - Interactive Graph Exploration Experience (Priority: P1) 🎯 MVP

**Goal**: Deliver richer graph visual encoding (dynamic style, bounded node sizes, confidence-weighted edges, graph controls).

**Independent Test**: Open a project graph and verify visual encoding alone communicates structure.

### Tests for User Story 1

- [X] T012 [P] [US1] Add graph payload contract test for style/degree/confidence fields in ner/tests/test_graph_payload_api.py
- [X] T013 [P] [US1] Add frontend graph visual encoding test in frontend/src/__tests__/pages/graph-visuals.test.tsx

### Implementation for User Story 1

- [X] T014 [US1] Extend project graph response shape with style/degree data in ner/views.py
- [X] T015 [US1] Add deterministic node-style fallback mapping in ner/services/pipeline.py
- [X] T016 [US1] Add node-size and edge-width scaling utilities in frontend/src/lib/api.ts
- [X] T017 [US1] Implement Kumu-inspired graph render rules in frontend/pages/graph.tsx
- [X] T018 [US1] Implement zoom-in/zoom-out/fit-to-screen controls in frontend/pages/graph.tsx
- [X] T019 [US1] Wire workspace graph to enhanced rendering payload in frontend/pages/projects/[id]/workspace.tsx

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Entity Context Side Panel (Priority: P1)

**Goal**: Deliver right-side entity panel with complete context and drill-down/back navigation.

**Independent Test**: Click nodes and verify panel completeness, drill-down, and close behavior without losing map context.

### Tests for User Story 2

- [X] T020 [P] [US2] Add access-scope entity profile API test in ner/tests/test_entity_profile_api.py
- [X] T021 [P] [US2] Add side-panel drill-down/back navigation test in frontend/src/__tests__/pages/workspace-panel.test.tsx

### Implementation for User Story 2

- [X] T022 [US2] Implement access-scoped entity profile endpoint in ner/views.py
- [X] T023 [US2] Implement grouped relationship/alias/project profile serializer in ner/serializers.py
- [X] T024 [US2] Create reusable side-panel component in frontend/src/components/EntitySidePanel.tsx
- [X] T025 [US2] Implement panel open/close and detail rendering in frontend/pages/projects/[id]/workspace.tsx
- [X] T026 [US2] Implement linked-entity drill-down history stack in frontend/pages/projects/[id]/workspace.tsx
- [X] T027 [US2] Wire graph node click selection to side panel in frontend/pages/graph.tsx

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Real-Time Filtering, Focus, and Search (Priority: P2)

**Goal**: Deliver client-side filters, filtered-subgraph focus mode, and real-time search/centering.

**Independent Test**: Apply filters/focus/search on loaded graph and verify immediate updates without refetch.

### Tests for User Story 3

- [X] T028 [P] [US3] Add frontend filter/focus/search interaction test in frontend/src/__tests__/pages/graph-focus-filters.test.tsx

### Implementation for User Story 3

- [X] T029 [US3] Implement client-side entity/relationship filter state and visibility rules in frontend/pages/graph.tsx
- [X] T030 [US3] Implement filtered-visible two-hop focus algorithm in frontend/src/lib/graphFocus.ts
- [X] T031 [US3] Implement focus activation/reset behavior on graph interactions in frontend/pages/graph.tsx
- [X] T032 [US3] Implement real-time search highlight and auto-center behavior in frontend/pages/graph.tsx
- [X] T033 [US3] Mirror filter/focus/search controls in workspace map view in frontend/pages/projects/[id]/workspace.tsx

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: User Story 4 - Cross-Project Entity Intelligence and Contextual Summaries (Priority: P2)

**Goal**: Deliver access-scoped cross-project profile plus on-demand contextual summaries with cache, timeout fallback, and retry.

**Independent Test**: Retrieve profile + summary for selected project and confirm access scope, cache/refresh, and timeout fallback behavior.

### Tests for User Story 4

- [X] T034 [P] [US4] Add summary cache/refresh/timeout API tests in ner/tests/test_contextual_summary_api.py
- [X] T035 [P] [US4] Add frontend summary state test (idle/loading/ready/fallback/retry) in frontend/src/__tests__/pages/entity-summary.test.tsx

### Implementation for User Story 4

- [X] T036 [US4] Implement summary cache persistence and TTL logic in ner/services/contextual_summary.py
- [X] T037 [US4] Implement on-demand summary endpoint with refresh flag and 8-second timeout fallback in ner/views.py
- [X] T038 [US4] Implement summary endpoint serializer/response contract in ner/serializers.py
- [X] T039 [US4] Implement profile+summary API client integration with refresh option in frontend/src/lib/api.ts
- [X] T040 [US4] Implement summary action/state UI in frontend/src/components/EntitySidePanel.tsx
- [X] T041 [US4] Integrate summary generate/refresh workflow into workspace panel in frontend/pages/projects/[id]/workspace.tsx

**Checkpoint**: US4 is independently functional and testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cross-story hardening and validation.

- [X] T042 [P] Update feature documentation and release notes in docs/PROJECT_REQUIREMENTS.md and CHANGELOG.md
- [X] T043 Add cross-project leakage regression assertions in ner/tests/test_views.py
- [X] T044 [P] Run and record US-08 validation workflow in specs/008-ui-and-graph-redesign/quickstart.md
- [X] T045 Tune graph interaction performance paths in frontend/pages/graph.tsx and frontend/src/lib/graphFocus.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phases 3–6 (User Stories)**: Depend on Phase 2 completion.
- **Phase 7 (Polish)**: Depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: Can begin after Phase 2; no dependency on other stories.
- **US2 (P1)**: Can begin after Phase 2; no dependency on US1.
- **US3 (P2)**: Can begin after Phase 2; may reuse graph UI from US1 but remains independently testable.
- **US4 (P2)**: Can begin after Phase 2; independent from US3 and compatible with US2 panel surface.

### Recommended Completion Order

1. US1 (MVP graph exploration)
2. US2 (panel context)
3. US3 (interactive exploration controls)
4. US4 (cross-project intelligence + summaries)

---

## Parallel Opportunities

- Setup: `T003` can run in parallel with `T001–T002`.
- Foundational: `T006`, `T007`, `T009`, `T011` can run concurrently after `T004–T005` kickoff.
- US1: `T012` and `T013` can run together; backend/frontend implementation split can parallelize (`T014–T015` vs `T016–T018`).
- US2: `T020` and `T021` parallel; component work (`T024`) can run with backend endpoint/serializer (`T022–T023`).
- US3: Test `T028` can be prepared while algorithm task `T030` is developed.
- US4: `T034` and `T035` parallel; backend service `T036–T038` parallel with frontend integration `T039–T040`.

### Parallel Example: User Story 1

```bash
# Parallel test authoring
Task T012: ner/tests/test_graph_payload_api.py
Task T013: frontend/src/__tests__/pages/graph-visuals.test.tsx

# Parallel implementation streams
Task T014-T015: backend graph payload + style fallback
Task T016-T018: frontend render/scaling/controls
```

### Parallel Example: User Story 2

```bash
# Parallel backend/frontend streams
Task T022-T023: ner/views.py + ner/serializers.py
Task T024-T025: frontend/src/components/EntitySidePanel.tsx + workspace wiring
```

### Parallel Example: User Story 4

```bash
# Parallel summary flows
Task T036-T038: backend cache/endpoint/serializer
Task T039-T040: frontend API integration + summary UI states
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) and validate independent test criteria.
3. Demo MVP graph exploration before expanding scope.

### Incremental Delivery

1. Add US2 for explainable panel context.
2. Add US3 for fast exploratory controls.
3. Add US4 for cross-project intelligence and contextual summaries.
4. Finish with Phase 7 cross-cutting hardening and quickstart validation.

### Team Parallelization

1. One stream owns backend profile/summary contracts.
2. One stream owns frontend graph/panel interactions.
3. Integrate per-story at checkpoints to preserve independent testability.

---

## Notes

- `[P]` marks tasks safe for parallel execution.
- `[USx]` labels map directly to spec user stories for traceability.
- Keep each story independently shippable and testable before moving to the next checkpoint.
