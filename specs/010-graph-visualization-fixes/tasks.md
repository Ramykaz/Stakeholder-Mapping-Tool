# Tasks: Graph & Visualization Fixes + Features

**Input**: Design documents from `/specs/010-graph-visualization-fixes/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Ensure Cytoscape.js and theme utilities are up to date in frontend/src/lib/cytoscapeStyle.ts
- [X] T002 [P] Add degree-to-size mapping utility (degree → 28–72px) in frontend/src/lib/graphFocus.ts
- [X] T003 [P] Add/validate color and size legend component in frontend/src/components/GraphVisualization.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 [P] Add/validate entity type, confidence, and degree filter state in frontend/src/lib/uiState.ts
- [X] T005 [P] Add type-based cluster layout logic (groups nodes by entity type using positional layout, no external library) in frontend/src/lib/graphFocus.ts
- [X] T006 [P] Add/validate theme detection and update logic in frontend/src/lib/uiState.ts

---

## Phase 3: User Story 1 - Graph Node Visual Consistency (Priority: P1)

**Goal**: All nodes are circles sized by degree, border color by type, with a visible size legend.
**Independent Test**: Open graph page, confirm node shapes, sizes, border colors, and legend.

- [X] T007 [US1] Force all nodes to ellipse shape and compute node_size from degree (28–72px) in frontend/pages/projects/[id]/map.tsx and frontend/src/lib/cytoscapeStyle.ts
- [X] T008 [US1] Apply per-type border color only in frontend/src/components/GraphVisualization.tsx
- [X] T009 [US1] Display visible size legend in frontend/src/components/GraphVisualization.tsx

---

## Phase 4: User Story 2 - Theme-Adaptive Canvas (Priority: P1)

**Goal**: Canvas background and label outlines update instantly with theme.
**Independent Test**: Toggle theme, confirm background and label outline update instantly.

- [X] T010 [US2] Detect active theme via data-theme on html in frontend/src/lib/uiState.ts
- [X] T011 [US2] Update Cytoscape canvas background and label outlines in frontend/src/components/GraphVisualization.tsx
- [X] T012 [US2] Ensure background/labels update on theme toggle without reload in frontend/src/components/GraphVisualization.tsx

---

## Phase 5: User Story 3 - Live Entity Filtering & Clustering (Priority: P1)

**Goal**: Filter panel for entity type, confidence, degree; cluster by type (no Louvain — type-based grouping only); all live, client-side.
**Independent Test**: Adjust filters/layout, confirm graph updates instantly, no backend refetch.

- [X] T013 [US3] Add filter panel UI (entity type checkboxes, confidence/degree sliders) in frontend/src/components/GraphVisualization.tsx
- [X] T014 [US3] Implement live filtering logic in frontend/src/lib/graphFocus.ts
- [X] T015 [US3] Add cluster layout toggle (type/none) in frontend/src/components/GraphVisualization.tsx
- [X] T016 [US3] Implement type-based cluster layout logic (no Louvain — groups by entity type using cose layout with type-based position seeding) in frontend/src/lib/graphFocus.ts

---

## Phase 6: User Story 4 - Discoverable Project Deletion (Priority: P2)

**Goal**: Project card dropdown with Open/Delete; Delete triggers confirmation modal (type project name).
**Independent Test**: Open dropdown, select Delete, confirm modal requires project name.

- [X] T017 [US4] Add visible three-dot dropdown menu to project cards in frontend/src/components/layout/Sidebar.tsx
- [X] T018 [US4] Add Delete option and confirmation modal in frontend/src/components/layout/Sidebar.tsx
- [X] T019 [US4] Require project name input before confirming deletion in frontend/src/components/layout/Sidebar.tsx

---

## Phase 7: User Story 5 - Persistent Concept Note Editing (Priority: P2)

**Goal**: Sidebar/Analyze page always link to concept note editor; setup page always editable.
**Independent Test**: Access concept note editor from sidebar/Analyze, confirm editability.

- [X] T020 [US5] Add Edit concept note link under project name in frontend/src/components/layout/Sidebar.tsx
- [X] T021 [US5] Add Edit concept note button to Analyze page in frontend/pages/projects/[id]/analyze.tsx
- [X] T022 [US5] Update setup page to indicate persistent editability in frontend/pages/projects/[id]/setup.tsx

---

## Phase 8: User Story 6 - Persistent Focus Mode (Priority: P2)

**Goal**: Click node to enter focus mode, dim others, toggle 1-hop/2-hop, exit via button/Escape, highlight node, open side panel.
**Independent Test**: Click node, toggle hop, exit, confirm all visual/side panel behaviors.

- [X] T023 [US6] Implement click-to-enter persistent focus mode in frontend/src/components/GraphVisualization.tsx
- [X] T024 [US6] Add toolbar toggle for 1-hop/2-hop in frontend/src/components/GraphVisualization.tsx
- [X] T025 [US6] Add exit button and Escape key handler in frontend/src/components/GraphVisualization.tsx
- [X] T026 [US6] Highlight focused node and open side panel in frontend/src/components/GraphVisualization.tsx

---

## Final Phase: Polish & Cross-Cutting

- [ ] T027 [P] Refactor and document all new/changed components in frontend/src/components/GraphVisualization.tsx
- [ ] T028 [P] Add/validate tests for all new UI and logic in frontend/src/__tests__/pages/graph-visuals.test.tsx
- [ ] T029 [P] Update README and user docs for new graph features in README.md

## Dependencies
- User stories 1–3 (P1) can be implemented in parallel after foundational tasks.
- User stories 4–6 (P2) can be implemented in parallel after P1 stories.

## Parallel Execution Examples
- T007, T008, T009 (US1) can be done in parallel.
- T013, T014, T015, T016 (US3) can be done in parallel.
- T017, T018, T019 (US4) can be done in parallel.

## Implementation Strategy
- MVP: Complete all P1 user stories (US1–US3) and foundational tasks.
- Incremental: Deliver each user story as an independently testable increment.
