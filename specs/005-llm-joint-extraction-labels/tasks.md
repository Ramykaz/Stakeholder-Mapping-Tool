# Tasks: LLM Provider Abstraction + Joint Extraction + Configurable Labels

**Input**: Design documents from `/specs/005-llm-joint-extraction-labels/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize feature scaffolding and shared interfaces

- [x] T001 Create joint extraction provider protocol in `ner/services/provider_interface.py`
- [x] T002 Add provider config wiring for Azure OpenAI and Gemini in `stakeholder_analysis/settings.py`
- [x] T003 [P] Add provider selection and credential variable documentation in `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence and routing foundations required before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add `EntityLabel` and `RelationshipType` models in `ner/models.py`
- [x] T005 Create taxonomy schema migration in `ner/migrations/0008_entitylabel_relationshiptype.py`
- [x] T006 Seed default labels and relationship types in `ner/migrations/0009_seed_default_taxonomy.py`
- [x] T007 [P] Add taxonomy serializers in `ner/serializers.py`
- [x] T008 [P] Add taxonomy helper service for active labels/types in `ner/services/taxonomy.py`
- [x] T009 Add taxonomy admin API routes in `ner/urls.py`
- [x] T010 Add taxonomy admin API views base in `ner/views.py`
- [x] T011 Add normalized provider request/response DTOs in `ner/services/provider_payloads.py`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - One-Call Joint Extraction Per Chunk (Priority: P1) 🎯 MVP

**Goal**: Replace two-pass extraction with one provider call per chunk returning entities and relationships together

**Independent Test**: Run extraction on a multi-chunk document and verify one provider call per chunk with both entities and relationships persisted in one run context

- [x] T012 [US1] Refactor extraction orchestration to one-call-per-chunk in `ner/services/pipeline.py`
- [x] T013 [US1] Normalize and validate single-call provider results in `ner/services/pipeline.py`
- [x] T014 [US1] Persist entities and relationships from same response in `ner/services/pipeline.py`
- [x] T015 [US1] Update extraction endpoint flow to use joint pipeline in `ner/views.py`
- [x] T016 [P] [US1] Update joint extraction prompt contract text in `prompts/ner-extraction-v1.md`

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: User Story 2 - Unified Multi-Provider Abstraction (Priority: P1)

**Goal**: Support Groq, OpenAI, Azure OpenAI, and Gemini through one interface with shared retry/rate-limit/cost handling

**Independent Test**: Execute extraction against each provider path and confirm normalized payload handling, shared retries/rate-limit behavior, and consistent usage/cost recording

- [x] T017 [US2] Implement shared provider abstraction service for retries/rate-limits/cost hooks in `ner/services/provider_runtime.py`
- [x] T018 [US2] Refactor Groq client to shared interface in `ner/services/groq_client.py`
- [x] T019 [US2] Refactor OpenAI client to shared interface in `ner/services/openai_client.py`
- [x] T020 [P] [US2] Add Azure OpenAI provider implementation in `ner/services/azure_openai_client.py`
- [x] T021 [P] [US2] Add Gemini provider implementation in `ner/services/gemini_client.py`
- [x] T022 [US2] Extend provider factory selection for all providers in `ner/services/provider_factory.py`
- [x] T023 [US2] Enforce explicit credential error messaging with no auto-fallback in `ner/services/provider_factory.py`
- [x] T024 [US2] Surface credential remediation errors in extraction API responses in `ner/views.py`

**Checkpoint**: User Story 2 is fully functional and independently testable

---

## Phase 5: User Story 3 - Admin Taxonomy Management UI (Priority: P1)

**Goal**: Allow admin users to view/add/edit/delete/deactivate entity labels and relationship types from `/admin`

**Independent Test**: As admin, perform CRUD and activation changes in `/admin` and verify next extraction uses only active taxonomy values

- [x] T025 [US3] Implement taxonomy list/create/update/delete endpoints with admin authorization in `ner/views.py`
- [x] T026 [US3] Enforce hard-delete blocking for referenced taxonomy with deactivate guidance in `ner/views.py`
- [x] T027 [US3] Add taxonomy API client methods in `frontend/src/lib/api.ts`
- [x] T028 [US3] Create admin page route and layout in `frontend/pages/admin.tsx`
- [x] T029 [P] [US3] Build entity label management component in `frontend/src/components/admin/EntityLabelsPanel.tsx`
- [x] T030 [P] [US3] Build relationship type management component in `frontend/src/components/admin/RelationshipTypesPanel.tsx`
- [x] T031 [US3] Wire admin page save/edit/delete/toggle flows in `frontend/pages/admin.tsx`

**Checkpoint**: User Story 3 is fully functional and independently testable

---

## Phase 6: User Story 4 - Persist Only Connected Graph Data (Priority: P2)

**Goal**: Ensure persistence excludes orphan entities and canonicalizes non-directional relations

**Independent Test**: Run extraction containing standalone and connected entities; verify only connected entities persist and non-directional reversed duplicates collapse to one canonical relation

- [x] T032 [US4] Filter out orphan entities during persistence in `ner/services/pipeline.py`
- [x] T033 [US4] Canonicalize non-directional relation pairs during deduplication in `ner/services/relation_deduplicator.py`
- [x] T034 [US4] Add/adjust DB deduplication constraint for canonical non-directional triplets in `ner/migrations/0010_relation_canonical_dedup.py`
- [x] T035 [US4] Align persisted relation save rules with directional flag semantics in `ner/services/pipeline.py`

**Checkpoint**: User Story 4 is fully functional and independently testable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, docs, and validation across all stories

- [x] T036 [P] Update provider and taxonomy operational docs in `docs/SPRINT_PLAN.md`
- [x] T037 [P] Update API and provider contract docs for final behavior in `specs/005-llm-joint-extraction-labels/contracts/api.md`
- [x] T038 Validate quickstart workflow against implemented behavior in `specs/005-llm-joint-extraction-labels/quickstart.md`
- [x] T039 Add extraction observability and remediation logging alignment in `ner/services/pipeline.py`
- [x] T040 Record feature completion notes in `CHANGELOG.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories
- **Phases 3-6 (User Stories)**: Depend on Phase 2 completion
- **Phase 7 (Polish)**: Depends on completion of selected user stories

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; MVP extraction path
- **US2 (P1)**: Starts after Foundational; can proceed in parallel with US1
- **US3 (P1)**: Starts after Foundational; can proceed in parallel with US1/US2
- **US4 (P2)**: Starts after Foundational; depends on US1 persistence flow being in place

### Within Each User Story

- Service and model changes before endpoint/UI wiring
- API contract alignment before final polish
- Story checkpoint validation before advancing priority

### Parallel Opportunities

- Setup: `T003`
- Foundational: `T007`, `T008`
- US1: `T016`
- US2: `T020`, `T021`
- US3: `T029`, `T030`
- Polish: `T036`, `T037`

---

## Parallel Example: User Story 2

```bash
# Run provider additions in parallel:
Task: T020 Add Azure OpenAI provider implementation in ner/services/azure_openai_client.py
Task: T021 Add Gemini provider implementation in ner/services/gemini_client.py
```

## Parallel Example: User Story 3

```bash
# Build admin UI panels in parallel:
Task: T029 Build entity label management component in frontend/src/components/admin/EntityLabelsPanel.tsx
Task: T030 Build relationship type management component in frontend/src/components/admin/RelationshipTypesPanel.tsx
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2
2. Deliver Phase 3 (US1) end-to-end
3. Validate one-call-per-chunk extraction behavior before expanding provider/admin scope

### Incremental Delivery

1. Ship US1 joint extraction core
2. Add US2 provider expansion and runtime error behavior
3. Add US3 admin taxonomy management
4. Add US4 persistence-quality constraints
5. Finish with Phase 7 polish and validation

### Parallel Team Strategy

1. Team completes Phases 1-2 together
2. Then split by story:
   - Engineer A: US1/US4 backend persistence pipeline
   - Engineer B: US2 provider abstraction and clients
   - Engineer C: US3 admin API + frontend page/components
3. Rejoin for Phase 7 validation and documentation
