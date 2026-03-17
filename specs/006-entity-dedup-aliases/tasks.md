# Tasks: Entity Deduplication + Alias System

**Input**: Design documents from `/specs/006-entity-dedup-aliases/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested as test-first in spec; include validation runs in final phase.

**Organization**: Tasks are grouped by user story for independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no blocking dependency)
- **[Story]**: Present only for user-story phase tasks (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish dedup feature scaffolding and baseline constants.

- [x] T001 Add RapidFuzz dependency and pin version in `requirements.txt`
- [x] T002 Create shared dedup constants module (thresholds, phase patterns) in `ner/services/entity_dedup_constants.py`
- [x] T003 [P] Add US-06 environment/config documentation notes in `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and service foundations required before all user stories.

**⚠️ CRITICAL**: No user story implementation starts before this phase is complete.

- [x] T004 Extend entity schema fields (`normalized_name`, `needs_review`, `parent_entity`, `mention_count_dedup`) in `ner/models.py`
- [x] T005 Create `EntityAlias`, `AcronymMap`, and `EntityReviewCandidate` models in `ner/models.py`
- [x] T006 Generate migration for entity schema/model additions in `ner/migrations/0011_entity_dedup_alias_models.py`
- [x] T007 Seed baseline acronyms (UNDP, WHO, SDG, UNICEF, FAO, etc.) in `ner/migrations/0012_seed_acronym_map.py`
- [x] T008 [P] Add serializers for alias/review/payload extensions in `ner/serializers.py`
- [x] T009 Implement reusable entity dedup service (exact/acronym/fuzzy/phase) in `ner/services/entity_dedup_service.py`
- [x] T010 Wire dedup service entrypoint for save-time use in `ner/services/pipeline.py`

**Checkpoint**: Schema, seeds, and dedup service are in place for story work.

---

## Phase 3: User Story 1 - Save Canonical Entities with 3-Level Deduplication (Priority: P1) 🎯 MVP

**Goal**: Apply exact + acronym + fuzzy dedup on every entity save and persist aliases/review flags.

**Independent Test**: Run extraction on mixed duplicate/acronym/fuzzy dataset and verify canonical merges, aliases, and review flags.

- [x] T011 [US1] Replace direct entity persistence with dedup service calls in `ner/services/pipeline.py`
- [x] T012 [US1] Implement Level 1 exact normalized match logic using `get_or_create` in `ner/services/entity_dedup_service.py`
- [x] T013 [US1] Implement Level 2 acronym expansion lookup and alias persistence in `ner/services/entity_dedup_service.py`
- [x] T014 [US1] Implement Level 3 same-type RapidFuzz merge and review-candidate creation in `ner/services/entity_dedup_service.py`
- [x] T015 [US1] Enforce “never merge across entity types” guardrails in `ner/services/entity_dedup_service.py`
- [x] T016 [US1] Add structured dedup decision logging (exact/acronym/merge/review) in `ner/services/entity_dedup_service.py`
- [x] T017 [P] [US1] Add backend tests for exact/acronym/fuzzy thresholds and cross-type non-merge in `ner/tests/test_entity_dedup_service.py`
- [x] T018 [P] [US1] Add migration/seed tests for acronym map defaults in `ner/tests/test_acronym_map_seed.py`

**Checkpoint**: Exact/acronym/fuzzy dedup works in extraction save path.

---

## Phase 4: User Story 2 - Preserve Phase Variants and Return Rich Entity Data (Priority: P1)

**Goal**: Keep phase variants separate-but-linked and expose aliases/parent/review/mention metrics through entity APIs.

**Independent Test**: Extract phase-variant entities and verify API responses include parent references and deduplicated mention counts.

- [x] T019 [US2] Implement phase-pattern detection and parent-link assignment in `ner/services/entity_dedup_service.py`
- [x] T020 [US2] Implement overlap-aware unique mention counting for entity persistence in `ner/services/entity_dedup_service.py`
- [x] T021 [US2] Extend entity response payload fields (`aliases`, `parent_entity`, `needs_review`, `mention_count_dedup`) in `ner/serializers.py`
- [x] T022 [US2] Update document entities endpoint to include enriched payload in `ner/views.py`
- [x] T023 [US2] Update graph/list-compatible entity projections to include parent/review metadata in `ner/views.py`
- [x] T024 [P] [US2] Add backend tests for phase-separation + parent linking in `ner/tests/test_entity_phase_linking.py`
- [x] T025 [P] [US2] Add backend tests for mention overlap dedup count behavior in `ner/tests/test_entity_mention_count_dedup.py`

**Checkpoint**: APIs return enriched entity metadata with correct phase/mention behavior.

---

## Phase 5: User Story 3 - Review Flagged Near-Duplicates in Entity List UI (Priority: P2)

**Goal**: Surface review banner and merge/keep actions for pending near-duplicate candidates.

**Independent Test**: Load entities list with pending candidates; execute merge/keep action and confirm state updates.

- [x] T026 [US3] Add review-candidate list and resolve endpoints in `ner/urls.py`
- [x] T027 [US3] Implement review-candidate list and resolve action handlers in `ner/views.py`
- [x] T028 [US3] Implement merge resolution behavior (alias consolidation + candidate resolution) in `ner/services/entity_dedup_service.py`
- [x] T029 [US3] Implement keep-separate resolution behavior in `ner/services/entity_dedup_service.py`
- [x] T030 [US3] Add frontend API methods for review candidates and resolve actions in `frontend/src/lib/api.ts`
- [x] T031 [US3] Add review banner with per-pair Merge/Keep actions in `frontend/pages/entities.tsx`
- [x] T032 [US3] Render aliases beneath canonical names in smaller text in `frontend/pages/entities.tsx`
- [x] T033 [P] [US3] Add frontend tests for review banner visibility/actions in `frontend/src/__tests__/pages/entities.test.tsx`
- [x] T034 [P] [US3] Add backend tests for resolve action API and stale-candidate handling in `ner/tests/test_entity_review_candidates.py`

**Checkpoint**: Human-in-the-loop review workflow is fully functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, docs, validation, and release readiness for US-06 scope.

- [x] T035 [P] Update contracts and examples for final endpoint payloads in `specs/006-entity-dedup-aliases/contracts/api.md`
- [x] T036 [P] Update quickstart verification steps and expected outputs in `specs/006-entity-dedup-aliases/quickstart.md`
- [x] T037 Add changelog entry for US-06 dedup + alias + review workflow in `CHANGELOG.md`
- [x] T038 Run backend regression suite in Docker and record pass status in `specs/006-entity-dedup-aliases/quickstart.md`
- [x] T039 Run frontend test suite and record pass status in `specs/006-entity-dedup-aliases/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all stories
- **Phase 3 (US1)**: depends on Phase 2
- **Phase 4 (US2)**: depends on Phase 2 and integrates with US1 save path
- **Phase 5 (US3)**: depends on Phase 2 and consumes US1/US2 review metadata
- **Phase 6 (Polish)**: depends on all implemented story phases

### User Story Dependencies

- **US1 (P1)**: base dedup behavior; no dependency on other stories
- **US2 (P1)**: depends on US1 dedup service outputs for metadata correctness
- **US3 (P2)**: depends on review candidates generated by US1 and payload fields from US2

### Parallel Opportunities

- Setup: `T003`
- Foundational: `T008`
- US1 tests: `T017`, `T018`
- US2 tests: `T024`, `T025`
- US3 tests: `T033`, `T034`
- Polish docs: `T035`, `T036`

---

## Parallel Example: User Story 1

```bash
# After foundational completion:
Task: T013 Implement acronym expansion + alias persistence in ner/services/entity_dedup_service.py
Task: T014 Implement fuzzy merge/review threshold logic in ner/services/entity_dedup_service.py
Task: T017 Add backend tests for exact/acronym/fuzzy thresholds in ner/tests/test_entity_dedup_service.py
```

## Parallel Example: User Story 2

```bash
Task: T024 Add backend tests for phase parent linking in ner/tests/test_entity_phase_linking.py
Task: T025 Add backend tests for overlap mention dedup in ner/tests/test_entity_mention_count_dedup.py
```

## Parallel Example: User Story 3

```bash
Task: T030 Add frontend API methods for review actions in frontend/src/lib/api.ts
Task: T033 Add frontend tests for review banner/actions in frontend/src/__tests__/pages/entities.test.tsx
Task: T034 Add backend tests for review resolve endpoint in ner/tests/test_entity_review_candidates.py
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Setup + Foundational
2. Deliver US1 dedup save path
3. Validate canonicalization outcomes before UI review workflow

### Incremental Delivery

1. Ship US1 (automatic dedup)
2. Add US2 (phase linking + enriched APIs)
3. Add US3 (human review actions in UI)
4. Finish with polish, docs, and test validation

### Team Parallel Strategy

1. One engineer on backend dedup core (US1/US2 service and models)
2. One engineer on API/view/contracts updates (US2/US3 backend endpoints)
3. One engineer on entities page + tests (US3 frontend)
