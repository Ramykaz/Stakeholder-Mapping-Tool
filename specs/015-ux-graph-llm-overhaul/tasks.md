# Tasks: UX, Graph, Workflow, LLM Reliability, and Web Ingestion

**Input**: Design documents from `/specs/015-ux-graph-llm-overhaul/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Tests**: Test creation tasks are not included because the feature spec does not explicitly request TDD/new tests; verification tasks are included in final polish.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

## Format: `[ID] [P?] [Story] Description with file path`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare dependency and implementation scaffolding for all stories.

- [X] T001 Update feature dependency notes and provider env examples in `.env.example`
- [X] T002 [P] Add/verify D3 and graph-related frontend dependencies in `frontend/package.json`
- [X] T003 [P] Add/verify web-ingestion parsing dependencies in `requirements.txt`
- [X] T004 [P] Create US-015 API contract definitions in `specs/015-ux-graph-llm-overhaul/contracts/api.yaml`
- [X] T005 Create implementation tracking notes for visual audit scope in `specs/015-ux-graph-llm-overhaul/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core building blocks required before user-story implementation.

**⚠️ CRITICAL**: No user-story work should begin before this phase is complete.

- [X] T006 Add centralized provider configuration validation helper in `ner/services/provider_runtime.py`
- [X] T007 [P] Add centralized frontend LLM error mapping utility in `frontend/src/lib/api.ts`
- [X] T008 [P] Extend shared UI error/banner primitives for contextual LLM messaging in `frontend/src/components/ErrorMessage.tsx`
- [X] T009 Add backend `ConfigurationError`/provider test response normalization in `ner/services/provider_interface.py`
- [X] T010 [P] Add workflow next-step derivation helper in `ingestion/models.py`
- [X] T011 [P] Add reusable graph interaction state typings for D3 migration in `frontend/src/types/graph.ts`
- [X] T012 Implement migration for new `WebSource` persistence model in `ingestion/migrations/0013_web_source.py`
- [X] T013 Add `WebSource` model and status transitions in `ingestion/models.py`
- [X] T014 Add baseline serializer for `WebSource` records in `ingestion/serializers.py`

**Checkpoint**: Shared provider/error/workflow/web-source primitives are in place.

---

## Phase 3: User Story 1 — Readable Visual System (Priority: P1) 🎯 MVP

**Goal**: Fix invisible/low-contrast/small text across audited UI targets without changing layout or component structure.

**Independent Test**: Run visual audit in light/dark mode and verify all listed targets meet contrast and minimum text-size requirements.

- [X] T015 [US1] Fix sidebar project names/count contrast and min font size in `frontend/src/components/layout/Sidebar.tsx`
- [X] T016 [P] [US1] Fix graph legend entity-label contrast and min font size in `frontend/src/components/GraphVisualization.tsx`
- [X] T017 [P] [US1] Fix graph edge-label readability baseline (size/background token use) in `frontend/src/components/GraphVisualization.tsx`
- [X] T018 [P] [US1] Fix entities/relations table cell contrast and min font size in `frontend/pages/entities.tsx`
- [X] T019 [P] [US1] Fix inactive tab-label contrast in report/stakeholder tabs in `frontend/pages/projects/[id]/report.tsx`
- [X] T020 [US1] Fix status badge foreground contrast across project pages in `frontend/src/lib/entityTypes.ts`
- [X] T021 [P] [US1] Fix initiative profile labels/placeholders and minimum size in `frontend/src/components/IntakeForm.tsx`
- [X] T022 [US1] Fix SMQ content area/report body/stakeholder/persona/stepper text visibility in `frontend/pages/projects/[id]/smq.tsx`, `frontend/src/components/ReportSectionCard.tsx`, `frontend/src/components/StakeholderPriorityTable.tsx`, `frontend/src/components/PersonaCard.tsx`, `frontend/src/components/WorkflowStepper.tsx`

**Checkpoint**: UI text readability corrections complete with no layout/component-structure changes.

---

## Phase 4: User Story 2 — Complete D3 Graph Migration (Priority: P1)

**Goal**: Replace Cytoscape graph with D3 force-directed graph while preserving all existing interactions and API contracts.

**Independent Test**: Verify zoom/pan, click panel, hover dimming, fit, focus mode, filter wiring, NL highlight, minimap, and isolated-node controls with D3 graph.

- [X] T023 [US2] Inventory and document current Cytoscape props/events/contracts in `frontend/src/components/GraphVisualization.tsx`
- [X] T024 [US2] Implement D3 force graph core rendering and settled pre-paint initialization in `frontend/src/components/GraphVisualization.tsx`
- [X] T025 [P] [US2] Implement D3 node visuals (size, halo, inner dot, always-visible labels) in `frontend/src/components/GraphVisualization.tsx`
- [X] T026 [P] [US2] Implement D3 edge visuals (curves, arrows, weighted stroke/opacity, readable labels) in `frontend/src/components/GraphVisualization.tsx`
- [X] T027 [US2] Implement hover neighborhood emphasis + tooltip behavior in `frontend/src/components/GraphVisualization.tsx`
- [X] T028 [US2] Implement isolated-node detection, toggle wiring, and orphan visual indicator in `frontend/src/components/GraphVisualization.tsx`
- [X] T029 [US2] Add backend orphan-flag endpoint handler in `ner/views.py`
- [X] T030 [P] [US2] Add orphan-flag URL route in `ner/urls.py`
- [X] T031 [US2] Wire frontend orphan-flag action and entity-table indicator in `frontend/src/components/StakeholderPriorityTable.tsx` and `frontend/src/lib/api.ts`
- [X] T032 [US2] Rewire graph controls (zoom in/out/fit, zoom display, ResizeObserver recenter) in `frontend/src/components/GraphVisualization.tsx`
- [X] T033 [US2] Re-implement minimap with scaled SVG snapshot updates in `frontend/src/components/GraphVisualization.tsx`
- [X] T034 [US2] Remove Cytoscape dependency and dead imports in `frontend/package.json` and `frontend/src/components/GraphVisualization.tsx`

**Checkpoint**: D3 graph fully replaces Cytoscape with required behavior parity and readability improvements.

---

## Phase 5: User Story 3 — Seven-Step Workflow Navigation Fix (Priority: P1)

**Goal**: Make next-step guidance correct per page state and fix step 4 route to map.

**Independent Test**: Validate next-step card text/action on intake, documents (before/after extraction), graph, report, stakeholders, export; verify step 4 never 404s.

- [X] T035 [US3] Fix step-4 workflow URL mapping to existing map route in `ingestion/models.py`
- [X] T036 [P] [US3] Expose explicit `next_step` payload from workflow status endpoint in `ingestion/views.py`
- [X] T037 [P] [US3] Ensure workflow endpoint route remains canonical and stable in `ingestion/urls.py`
- [X] T038 [US3] Update shared layout next-step logic to consume workflow API next incomplete step in `frontend/src/components/Layout.tsx`
- [X] T039 [P] [US3] Add contextual next-step descriptions for documents/graph states in `frontend/src/components/NextStepCard.tsx`
- [X] T040 [US3] Update documents-page dynamic next action (run extraction vs review graph) in `frontend/pages/projects/[id]/documents.tsx`
- [X] T041 [P] [US3] Ensure stepper navigation uses map route for step 4 in `frontend/src/components/WorkflowStepper.tsx`
- [X] T042 [US3] Hide next-step card on export page while preserving workflow banner in `frontend/pages/projects/[id]/report.tsx`

**Checkpoint**: Workflow guidance and routing are correct for all seven steps and page states.

---

## Phase 6: User Story 4 — LLM Error Handling + Sequential Stakeholder Generation (Priority: P1)

**Goal**: Replace generic LLM errors with contextual UX and convert stakeholder table generation to sequential/resumable flow.

**Independent Test**: Trigger 429, timeout, and generic provider errors across listed AI actions; verify contextual banners/messages and resumable stakeholder generation.

- [X] T043 [US4] Add normalized provider error classification (rate limit, timeout, generic) in `ner/services/provider_runtime.py`
- [X] T044 [P] [US4] Apply contextual error mapping to extraction/report/persona/workplan/NL-query responses in `ner/views.py`
- [X] T045 [P] [US4] Add frontend LLM error-message renderer (no raw network error leaks) in `frontend/src/lib/api.ts`
- [X] T046 [US4] Implement amber rate-limit banner component usage for AI actions in `frontend/src/components/StalenessNotice.tsx` and `frontend/src/components/ErrorMessage.tsx`
- [X] T047 [US4] Refactor stakeholder-note generation to sequential capped processing (max 20) in `ner/services/engagement_notes.py`
- [X] T048 [US4] Add pause/resume generation state contract for stakeholder notes in `ner/views.py`
- [X] T049 [P] [US4] Update stakeholder generation endpoint routing/shape for start/resume behavior in `ner/urls.py`
- [X] T050 [US4] Update stakeholder table UI for progressive row appearance and progress indicator in `frontend/src/components/StakeholderPriorityTable.tsx`
- [X] T051 [US4] Add resume-generation UX control and banner handling in `frontend/pages/projects/[id]/stakeholders.tsx`
- [X] T052 [US4] Replace extraction row red-failure style with amber retry state in `frontend/pages/projects/[id]/documents.tsx`
- [X] T053 [US4] Ensure report/persona/workplan/NL-query UI surfaces contextual errors only in `frontend/pages/projects/[id]/report.tsx`, `frontend/src/components/ExportTab.tsx`, `frontend/pages/projects/[id]/smq.tsx`

**Checkpoint**: AI failures are contextualized and stakeholder generation is sequential/resumable.

---

## Phase 7: User Story 5 — Multi-Provider API Key Wiring Verification (Priority: P1)

**Goal**: Ensure provider switching applies immediately to all LLM calls and provide connection testing from Settings.

**Independent Test**: Switch provider in settings, run test endpoint, and verify all LLM features use selected provider without server restart.

- [X] T054 [US5] Refactor all LLM call sites to resolve provider at call time in `ner/services/nl_query.py`, `ner/services/report_generator.py`, `ner/services/smq_generator.py`, `ner/services/persona_generator.py`, `ner/services/workplan_generator.py`, `ner/services/engagement_notes.py`, `ner/services/pipeline.py`
- [X] T055 [P] [US5] Enforce provider-specific missing-env validation in central provider utility in `ner/services/provider_factory.py`
- [X] T056 [US5] Add `GET /api/v1/settings/llm/test/` endpoint in `ner/views.py`
- [X] T057 [P] [US5] Add LLM test endpoint URL route in `ner/urls.py`
- [X] T058 [P] [US5] Add frontend API client function for LLM connection test in `frontend/src/lib/api.ts`
- [X] T059 [US5] Add Settings page "Test connection" flow and status feedback in `frontend/pages/projects/[id]/settings.tsx`
- [X] T060 [P] [US5] Add provider-specific settings field handling (Azure endpoint/deployment; model/API key fields; show/hide toggles) in `frontend/pages/projects/[id]/settings.tsx`
- [X] T061 [US5] Ensure save action triggers immediate post-save connection test in `frontend/pages/projects/[id]/settings.tsx`
- [X] T062 [US5] Normalize backend error payload for provider test endpoint in `ner/serializers.py`
- [X] T063 [US5] Update settings/help text for provider wiring expectations in `README.md`

**Checkpoint**: Provider switching and configuration verification are deterministic and immediate.

---

## Phase 8: User Story 6 — Initiative Profile Save + SMQ Input UX (Priority: P2)

**Goal**: Replace autosave profile behavior with explicit save and provide single-section-focused SMQ note input.

**Independent Test**: Confirm profile changes only persist on explicit save; unsaved navigation warning appears; SMQ shows one section at a time with notes context.

- [X] T064 [US6] Remove profile autosave-on-blur behavior and add explicit save-only state in `frontend/src/components/IntakeForm.tsx`
- [X] T065 [P] [US6] Add unsaved-changes indicator and page-leave confirmation in `frontend/pages/projects/[id]/intake.tsx`
- [X] T066 [US6] Enforce save-button disablement until required title exists in `frontend/src/components/IntakeForm.tsx`
- [X] T067 [P] [US6] Add/extend backend profile PATCH semantics for full-form save in `ingestion/views.py`
- [X] T068 [US6] Add single-section SMQ focused UI shell with section progress and prev/next controls in `frontend/pages/projects/[id]/smq.tsx`
- [X] T069 [P] [US6] Add SMQ notes textarea model binding separate from generated content in `frontend/src/components/SMQSection.tsx`
- [X] T070 [P] [US6] Extend SMQ API payload/types for per-section notes context in `frontend/src/lib/api.ts`
- [X] T071 [US6] Persist and return per-section notes in backend SMQ endpoints in `ner/views.py` and `ner/serializers.py`
- [X] T072 [US6] Include notes context in section generation call path in `ner/services/smq_generator.py`

**Checkpoint**: Profile saves are explicit-only and SMQ editing is section-focused with separate notes context.

---

## Phase 9: User Story 7 — Web Content Ingestion (URLs/Crawl/Paste) (Priority: P2)

**Goal**: Add URL, crawl, and pasted-text ingestion paths that feed existing document chunk/extraction pipeline.

**Independent Test**: Submit all three source types and verify source status lifecycle plus resulting document processing parity with uploaded files.

- [X] T073 [US7] Add `WebSource` model implementation in `ingestion/models.py`
- [X] T074 [P] [US7] Add `WebSource` serializer and request validation in `ingestion/serializers.py`
- [X] T075 [US7] Add web-source processing service (url fetch/readability extraction/crawl bounds/paste) in `ingestion/services/web_source.py`
- [X] T076 [US7] Add Celery task `process_web_source(web_source_id)` in `ingestion/services/pipeline.py`
- [X] T077 [US7] Add web-source create/list/delete API views in `ingestion/views.py`
- [X] T078 [P] [US7] Add web-source URL routes in `ingestion/urls.py`
- [X] T079 [US7] Create web-source API client types/functions in `frontend/src/lib/api.ts`
- [X] T080 [US7] Add documents-page input tabs for upload/url/crawl/paste in `frontend/pages/projects/[id]/documents.tsx`
- [X] T081 [P] [US7] Implement URL tab form + validation and submit behavior in `frontend/pages/projects/[id]/documents.tsx`
- [X] T082 [P] [US7] Implement crawl tab form (root URL + depth selector + warning copy) in `frontend/pages/projects/[id]/documents.tsx`
- [X] T083 [P] [US7] Implement paste-text tab form (title + textarea) in `frontend/pages/projects/[id]/documents.tsx`
- [X] T084 [US7] Integrate web-source rows into unified document/status list rendering in `frontend/pages/projects/[id]/documents.tsx`
- [X] T085 [US7] Wire delete behavior for web sources in documents list actions in `frontend/pages/projects/[id]/documents.tsx`
- [X] T086 [US7] Ensure web-ingested documents flow through existing extraction actions in `frontend/pages/projects/[id]/documents.tsx` and `ingestion/views.py`

**Checkpoint**: URL/crawl/paste sources behave as first-class ingestion entries.

---

## Phase 10: User Story 8 — Include Personas + Workplan in Export (Priority: P2)

**Goal**: Include generated personas and workplan in PDF/DOCX exports as conditional appendices and reflect readiness accurately.

**Independent Test**: Export with/without personas/workplan and verify appendices, TOC, and readiness checklist/note text are accurate.

- [X] T087 [US8] Extend export status computation with `has_workplan` in `ner/services/report_export.py`
- [X] T088 [P] [US8] Update export status endpoint payload to include `has_workplan` in `ner/views.py` and `ner/serializers.py`
- [X] T089 [US8] Add conditional Appendix B personas rendering (if present) in PDF/DOCX generation in `ner/services/report_export.py`
- [X] T090 [US8] Add conditional Appendix C workplan rendering (if present) in PDF/DOCX generation in `ner/services/report_export.py`
- [X] T091 [US8] Update export table-of-contents builder to include only present appendices in `ner/services/report_export.py`
- [X] T092 [P] [US8] Extend frontend export status type with `has_workplan` in `frontend/src/lib/api.ts`
- [X] T093 [US8] Add workplan readiness line item in export checklist UI in `frontend/src/components/ExportTab.tsx`
- [X] T094 [US8] Update "Report includes" summary text to conditionally mention personas/workplan in `frontend/src/components/ExportTab.tsx`
- [X] T095 [US8] Ensure report export tab wiring consumes updated readiness contract in `frontend/pages/projects/[id]/report.tsx`

**Checkpoint**: Exports include personas/workplan appendices conditionally with accurate readiness and TOC.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, regression checks, and handoff quality.

- [X] T096 [P] Run backend regression suite in Docker for affected domains using `ner/tests/` and `ingestion/tests/`
- [X] T097 [P] Run frontend checks/build for changed project pages/components in `frontend/package.json` scripts
- [X] T098 Validate all quickstart scenarios and record outcomes in `specs/015-ux-graph-llm-overhaul/quickstart.md`
- [X] T099 Update high-level user/developer docs for new ingestion and provider test flows in `README.md`
- [X] T100 Confirm Cytoscape removal and no dead imports remain in `frontend/package.json` and `frontend/src/components/GraphVisualization.tsx`
- [X] T101 Final pass on contextual error copy consistency across all LLM actions in `frontend/pages/projects/[id]/report.tsx`, `frontend/pages/projects/[id]/stakeholders.tsx`, `frontend/pages/projects/[id]/documents.tsx`, `frontend/pages/projects/[id]/smq.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phase 3–7 (P1 stories)**: Depend on Phase 2; can run in parallel by team capacity.
- **Phase 8–10 (P2 stories)**: Depend on Phase 2; may additionally depend on outputs from relevant P1 stories.
- **Phase 11 (Polish)**: Depends on all selected user-story phases.

### User Story Dependencies

- **US1 (Typography)**: Depends on foundational token/error primitives only.
- **US2 (D3 Graph)**: Depends on foundational graph typings/helpers; independent from provider stories.
- **US3 (Workflow Navigation)**: Depends on foundational workflow helper.
- **US4 (LLM Errors + Sequential Stakeholder)**: Depends on foundational provider/error utilities.
- **US5 (Provider Wiring/Test)**: Depends on foundational provider utilities; informs US4 behavior.
- **US6 (Profile + SMQ UX)**: Depends on foundational API typing/state utilities.
- **US7 (Web Ingestion)**: Depends on foundational `WebSource` model/serializer base.
- **US8 (Export Appendices)**: Depends on existing personas/workplan/export modules; independent of graph migration.

### Recommended Delivery Order (MVP-first within P1)

1. US1 (Readable visual system)
2. US3 (Workflow correctness)
3. US5 (Provider wiring + test connection)
4. US4 (LLM handling + sequential stakeholder generation)
5. US2 (D3 migration)
6. US6 (Profile/SMQ UX)
7. US7 (Web ingestion)
8. US8 (Export appendices)

---

## Parallel Execution Examples

### US1
- Run T016, T018, T019, T021 in parallel after T015 starts token corrections.

### US2
- Run T025 and T026 in parallel after T024 force-core implementation.
- Run T029 and T030 in parallel for orphan-flag backend endpoint wiring.

### US3
- Run T036 and T037 in parallel after T035 URL mapping fix.
- Run T039 and T041 in parallel once workflow API payload is updated.

### US4
- Run T044 and T045 in parallel after T043 classifier is introduced.
- Run T050 and T051 in parallel once T048 endpoint behavior is available.

### US5
- Run T056 and T057 in parallel while T054 call-site refactor is underway.
- Run T058 and T060 in parallel for frontend settings integration.

### US6
- Run T065 and T066 in parallel after T064 save-state refactor.
- Run T069 and T070 in parallel after T068 section-focused SMQ shell.

### US7
- Run T081, T082, and T083 in parallel after T080 tab shell creation.
- Run T074 and T078 in parallel after T073 model definition.

### US8
- Run T088 and T092 in parallel after T087 status computation extension.
- Run T093 and T094 in parallel after updated frontend status types.

---

## Implementation Strategy

### MVP First

- Complete Phase 1 and Phase 2.
- Deliver US1 + US3 + US5 first to stabilize readability, navigation, and provider confidence.
- Then deliver US4 for robust AI-failure UX and resumable stakeholder generation.

### Incremental Delivery

- Ship P1 stories in small increments with quickstart validation after each story.
- Follow with P2 stories (US6, US7, US8) as independently testable increments.
- Finish with full polish/regression phase.

### Notes

- All tasks are written as executable units with concrete file paths.
- `[P]` marks tasks that can proceed in parallel without direct dependency/file collision.
- Tasks are intentionally grouped by user story to preserve independent implementation and validation.
