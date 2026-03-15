# Tasks: Multi-LLM NER Selection

**Input**: Design documents from `/specs/003-openai-llm-toggle/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required)  
**Optional docs found**: none (`research.md`, `data-model.md`, `contracts/`, `quickstart.md` not present at generation time)

**Tests**: Included. The feature request explicitly requires verification of Groq compatibility, OpenAI schema compatibility, token/cost tracking, and multiple runs per document.

**Organization**: Tasks are grouped by user story so each story is independently testable after foundational work.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare dependencies and configuration for provider abstraction and OpenAI support.

- [X] T001 Add OpenAI SDK dependency to `requirements.txt`
- [X] T002 Add OpenAI environment variables documentation to `README.md`
- [X] T003 [P] Add OpenAI API key wiring and validation settings in `stakeholder_analysis/settings.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create shared persistence and interfaces needed by all user stories.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Add `NERRun` model with provider/model/tokens/cost fields in `ner/models.py`
- [X] T005 Create migration for `NERRun` model and entity-run linkage in `ner/migrations/0003_ner_run.py`
- [X] T006 Update entity serializers to expose run metadata fields in `ner/serializers.py`
- [X] T007 [P] Create provider abstraction interface in `ner/services/provider_factory.py`
- [X] T008 [P] Add provider and model request validation helpers in `ner/views.py`
- [X] T009 Implement run-aware pipeline signatures and shared orchestration hooks in `ner/services/pipeline.py`

**Checkpoint**: Foundation ready - user story implementation can start.

---

## Phase 3: User Story 1 - Choose LLM for Extraction (Priority: P1) 🎯 MVP

**Goal**: Let users select Groq or OpenAI (gpt-5-mini / gpt-5-nano) per extraction while preserving existing output shape and Groq default behavior.

**Independent Test**: Trigger extraction from frontend using Groq, OpenAI gpt-5-mini, and OpenAI gpt-5-nano; verify success and unchanged entity JSON structure.

### Tests for User Story 1

- [X] T010 [P] [US1] Add provider selection API tests for accepted/rejected provider-model pairs in `ner/tests/test_views.py`
- [X] T011 [P] [US1] Add pipeline schema-compatibility tests ensuring OpenAI output matches Groq structure in `ner/tests/test_pipeline.py`
- [X] T012 [P] [US1] Add OpenAI provider client tests with mocked responses in `ner/tests/test_openai_client.py`
- [X] T013 [P] [US1] Add frontend selector behavior tests for provider/model inputs in `frontend/src/__tests__/pages/upload.test.tsx`

### Implementation for User Story 1

- [X] T014 [US1] Refactor Groq extraction into provider-adapter compatible implementation in `ner/services/groq_client.py`
- [X] T015 [US1] Implement OpenAI provider extraction client with normalized entity output in `ner/services/openai_client.py`
- [X] T016 [US1] Implement provider factory resolution (`groq` default, `openai` optional) in `ner/services/provider_factory.py`
- [X] T017 [US1] Accept `provider` and `model` on extraction requests and pass to pipeline in `ner/views.py`
- [X] T018 [US1] Update extraction pipeline to call selected provider without changing downstream entity schema in `ner/services/pipeline.py`
- [X] T019 [US1] Extend extraction API client request signature with provider/model payload in `frontend/src/lib/api.ts`
- [X] T020 [US1] Add provider selector and conditional model selector UI in `frontend/pages/upload.tsx`
- [X] T021 [US1] Add provider/model types and request models in `frontend/src/types/index.ts`

**Checkpoint**: User Story 1 independently functional (provider/model selection works with schema compatibility preserved).

---

## Phase 4: User Story 2 - View Usage and Cost Transparency (Priority: P2)

**Goal**: Display provider, model, token counts, and cost per extraction run with server-side OpenAI pricing calculations.

**Independent Test**: Run extraction with both OpenAI models and verify returned usage and computed cost values; verify graceful handling when usage fields are unavailable.

### Tests for User Story 2

- [X] T022 [P] [US2] Add cost-calculation unit tests for gpt-5-mini and gpt-5-nano rates in `ner/tests/test_costing.py`
- [X] T023 [P] [US2] Add extraction response tests for usage-null fallback behavior in `ner/tests/test_views.py`
- [X] T024 [P] [US2] Add frontend result metadata rendering tests (provider/model/tokens/cost) in `frontend/src/__tests__/pages/upload.test.tsx`

### Implementation for User Story 2

- [X] T025 [US2] Implement server-side token cost calculator for configured OpenAI pricing in `ner/services/costing.py`
- [X] T026 [US2] Persist per-run usage and cost metrics from provider responses in `ner/services/pipeline.py`
- [X] T027 [US2] Extend extraction response payload with run usage/cost metadata in `ner/views.py`
- [X] T028 [US2] Add usage/cost fields to API response types in `frontend/src/types/index.ts`
- [X] T029 [US2] Render extraction run metadata panel (provider/model/tokens/cost) after completion in `frontend/pages/upload.tsx`

**Checkpoint**: User Story 2 independently functional (cost and tokens visible per extraction run).

---

## Phase 5: User Story 3 - Track Multiple Runs per Document (Priority: P3)

**Goal**: Keep each extraction run separately and show document-level run history with provider/model and usage/cost details.

**Independent Test**: Run extraction multiple times on one document with different providers/models and verify each run appears in history without overwriting previous runs.

### Tests for User Story 3

- [X] T030 [P] [US3] Add run-history persistence tests ensuring no overwrite across multiple runs in `ner/tests/test_pipeline.py`
- [X] T031 [P] [US3] Add run-history API tests for document run listing endpoint in `ner/tests/test_views.py`
- [X] T032 [P] [US3] Add frontend run-history rendering tests in `frontend/src/__tests__/pages/entities.test.tsx`

### Implementation for User Story 3

- [X] T033 [US3] Create document run-history serializer for ordered NER runs in `ner/serializers.py`
- [X] T034 [US3] Add document NER runs endpoint for listing provider/model/token/cost history in `ner/views.py`
- [X] T035 [US3] Register run-history route under document APIs in `ner/urls.py`
- [X] T036 [US3] Add frontend API method for fetching document NER run history in `frontend/src/lib/api.ts`
- [X] T037 [US3] Display run-history list with provider/model and usage/cost in `frontend/pages/entities.tsx`

**Checkpoint**: User Story 3 independently functional (multiple runs retained and visible per document).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize reliability, compatibility, and docs across all stories.

- [X] T038 [P] Add regression tests confirming Groq default behavior remains unchanged in `ner/tests/test_views.py`
- [X] T039 [P] Add end-to-end API contract validation for extraction + entities + run history in `ner/tests/test_views.py`
- [X] T040 [P] Update frontend copy and loading/error states for provider/cost metadata in `frontend/pages/upload.tsx`
- [X] T041 [P] Update frontend copy for run-history empty and populated states in `frontend/pages/entities.tsx`
- [X] T042 Update feature quickstart commands and verification flow in `specs/003-openai-llm-toggle/quickstart.md`
- [X] T043 Run and document backend/frontend test commands for this feature in `specs/003-openai-llm-toggle/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependencies.
- Foundational (Phase 2): depends on Setup and blocks all user stories.
- User Story phases (Phase 3-5): depend on Foundational completion.
- Polish (Phase 6): depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): starts immediately after Foundational and delivers MVP behavior.
- US2 (P2): depends on US1 provider output/selection plumbing.
- US3 (P3): depends on Foundational persistence model and can be developed after US1 API shape is stable.

### Within Story Ordering

- Tests first, confirm failing state.
- Provider/model and domain types before endpoint wiring.
- Endpoint wiring before frontend display.
- Story checkpoint validation before moving on.

## Parallel Execution Examples

### US1 Parallel Example

```bash
# Run in parallel after foundational completion:
Task: T010 [US1] ner/tests/test_views.py
Task: T011 [US1] ner/tests/test_pipeline.py
Task: T012 [US1] ner/tests/test_openai_client.py
Task: T013 [US1] frontend/src/__tests__/pages/upload.test.tsx
```

### US2 Parallel Example

```bash
# Run in parallel once US1 implementation lands:
Task: T022 [US2] ner/tests/test_costing.py
Task: T023 [US2] ner/tests/test_views.py
Task: T024 [US2] frontend/src/__tests__/pages/upload.test.tsx
```

### US3 Parallel Example

```bash
# Run in parallel once run model and serializers are ready:
Task: T030 [US3] ner/tests/test_pipeline.py
Task: T031 [US3] ner/tests/test_views.py
Task: T032 [US3] frontend/src/__tests__/pages/entities.test.tsx
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete US1 and validate Groq + OpenAI model selection.
3. Demo provider/model toggle with unchanged extraction schema.

### Incremental Delivery

1. Add US2 to surface run usage and cost transparency.
2. Add US3 to retain and visualize run history per document.
3. Finish with Phase 6 regression and quickstart verification.
