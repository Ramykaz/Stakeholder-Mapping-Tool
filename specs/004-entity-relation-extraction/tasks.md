# Tasks: Entity + Relation Extraction with Graph Integration

**Input**: Design documents from `/specs/004-entity-relation-extraction/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema updates

- [x] T001 Create migration 0006_add_relations in ner/migrations/
- [x] T002 Create Relation model in ner/models.py with FKs to Document, NERRun, source_entity, target_entity
- [x] T003 Add relations_created field to NERRun model in ner/models.py
- [x] T004 [P] Create RelationSerializer in ner/serializers.py
- [x] T005 [P] Create relation-extraction-v1.md prompt template in prompts/ directory

**Checkpoint**: Database schema ready, models defined

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core relation extraction infrastructure that MUST be complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create relation_extractor.py service in ner/services/ (LLM call logic, validation, confidence scoring)
- [x] T007 Create relation_deduplicator.py service in ner/services/ (composite key deduplication with normalized labels)
- [x] T008 Extend pipeline.py in ner/services/ to add extract_relations_for_document() function
- [x] T009 Update pipeline.py to orchestrate two-pass extraction (entities → relations) in extract_relations_for_document()

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Extract Entity Relations from an Uploaded Document (Priority: P1) 🎯 MVP

**Goal**: Enable relation extraction via REST API that produces triplets (source_entity, relation_label, target_entity) with deduplication and confidence scores

**Independent Test**: Call POST /api/v1/documents/{id}/extract-entities-relations/ on a document with chunks and verify that both Entity and Relation records are created with correct attributes

### Implementation for User Story 1

- [x] T010 [US1] Create ExtractEntitiesRelationsView in ner/views.py (POST handler, validate request, call pipeline)
- [x] T011 [US1] Add route /api/v1/documents/<uuid:pk>/extract-entities-relations/ in ner/urls.py pointing to ExtractEntitiesRelationsView
- [x] T012 [US1] Update ExtractEntitiesRelationsView to delete existing relations before extraction (clean slate pattern)
- [x] T013 [US1] Integrate relation_extractor.py into pipeline for per-chunk relation extraction
- [x] T014 [US1] Integrate relation_deduplicator.py to deduplicate relations across chunks in pipeline
- [x] T015 [US1] Update pipeline to save relations_created count to NERRun after deduplication
- [x] T016 [US1] Update pipeline to include tokens/cost/duration for both entity and relation extraction phases
- [x] T017 [US1] Add validation in relation_extractor to discard relations with dangling entity references
- [x] T018 [US1] Add validation in relation_extractor to discard self-loops (source = target)
- [x] T019 [US1] Update ExtractEntitiesRelationsView response to return entities_created, relations_created, tokens, cost, duration

**Backend Tests for User Story 1**:

- [x] T020 [P] [US1] Create test_relation_extractor.py in ner/tests/ with tests for LLM response parsing, validation, confidence scoring
- [x] T021 [P] [US1] Create test_relation_deduplicator.py in ner/tests/ with tests for composite key deduplication and label normalization
- [x] T022 [P] [US1] Update test_views.py in ner/tests/ to add tests for ExtractEntitiesRelationsView (success, empty entities, dangling refs, self-loops)
- [x] T023 [P] [US1] Add test for clean-slate pattern (re-extraction deletes old relations) in test_views.py

**Checkpoint**: At this point, User Story 1 should be fully functional - relation extraction works end-to-end via API

---

## Phase 4: User Story 2 - View Entities and Relations as a Graph with Typed Node Shapes (Priority: P1)

**Goal**: Render network graph with entity nodes (shape-coded by type) and relation edges (labeled, directional)

**Independent Test**: Load graph page for a document with extracted relations and verify that edges appear with labels, node shapes vary by entity type, and graph is interactive

### Implementation for User Story 2

- [x] T024 [US2] Update CytoscapeGraphView in graph/views.py to include edges array in response when relations exist
- [x] T025 [US2] Add node shape mapping in CytoscapeGraphView: PERSON=ellipse, ORGANIZATION=rectangle, LOCATION=diamond, ROLE=hexagon
- [x] T026 [US2] Format edges array in CytoscapeGraphView as {data: {id, source, target, label, confidence}} for Cytoscape
- [x] T027 [US2] Update graph.tsx in frontend/pages/ to render edges alongside nodes using Cytoscape.js
- [x] T028 [US2] Add edge stylesheet in graph.tsx with directional arrows (target-arrow-shape: triangle), bezier curves, autorotate labels
- [x] T029 [US2] Update node stylesheet in graph.tsx to use data(shape) for shape property (reads from backend)
- [x] T030 [US2] Apply confidence filter to edges in graph.tsx (hide edges below minimum confidence threshold)
- [x] T031 [US2] Test backward compatibility in graph.tsx for documents with entity-only extraction (no edges)

**Frontend Tests for User Story 2**:

- [x] T032 [P] [US2] Update graph.test.tsx in frontend/src/__tests__/ to test edge rendering with labels
- [x] T033 [P] [US2] Add test for node shape mapping (verify PERSON=ellipse, ORG=rectangle, etc.) in graph.test.tsx
- [x] T034 [P] [US2] Add test for confidence filtering on edges in graph.test.tsx
- [x] T035 [P] [US2] Add test for backward compatibility (entity-only documents render with no edges) in graph.test.tsx

**Backend Tests for User Story 2**:

- [x] T036 [P] [US2] Create test_graph_edges.py in ner/tests/ to test graph endpoint returns edges array for documents with relations
- [x] T037 [P] [US2] Add test for graph endpoint backward compatibility (no edges array for entity-only documents) in ner/tests/test_graph_edges.py

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - extraction + graph rendering complete

---

## Phase 5: User Story 3 - Trigger Extraction from the Upload Flow with Provider Selection (Priority: P1)

**Goal**: Add "Extract Entities + Relations" button to upload flow with provider/model selector and completion summary

**Independent Test**: Select "Extract Entities + Relations" in upload UI, complete flow, verify extraction runs successfully and completion screen shows entity + relation counts

### Implementation for User Story 3

- [x] T038 [US3] Update upload.tsx in frontend/pages/ to add "Extract Entities + Relations" button alongside "Extract Entities"
- [x] T039 [US3] Add extractEntitiesRelations() function to api.ts in frontend/src/lib/ (calls POST /extract-entities-relations/)
- [x] T040 [US3] Update DocumentSummary type in frontend/src/types/index.ts to include relations_created field
- [x] T041 [US3] Update upload.tsx to show provider/model selector for both extraction options (reuse existing selector UI)
- [x] T042 [US3] Update extraction completion screen in upload.tsx to display both entities_created and relations_created counts
- [x] T043 [US3] Update extraction progress indicator in upload.tsx to show "Extracting entities and relations…" for new mode
- [x] T044 [US3] Update Recent Documents list in upload.tsx to show relation count alongside entity count when available

**Frontend Tests for User Story 3**:

- [x] T045 [P] [US3] Update upload.test.tsx in frontend/src/__tests__/ to test "Extract Entities + Relations" button appears
- [x] T046 [P] [US3] Add test for extraction completion screen showing both entity and relation counts in upload.test.tsx
- [x] T047 [P] [US3] Add test for Recent Documents showing relation metadata in upload.test.tsx

**Checkpoint**: All P1 user stories (1, 2, 3) should now be independently functional - full extraction + graph + UI flow works

---

## Phase 6: User Story 4 - Retrieve Relations via REST API (Priority: P2)

**Goal**: Expose dedicated REST endpoint to query all relations for a document with full triplet data

**Independent Test**: Call GET /api/v1/documents/{id}/relations/ and verify response structure, data completeness, and correct entity linkage

### Implementation for User Story 4

- [x] T048 [US4] Create RelationsView in ner/views.py (GET handler returning relations array for document)
- [x] T049 [US4] Add route /api/v1/documents/<uuid:pk>/relations/ in ner/urls.py pointing to RelationsView
- [x] T050 [US4] Format RelationsView response with full triplet data (source_entity_id, source_entity_name, target_entity_id, target_entity_name, label, confidence, run_id, created_at)
- [x] T051 [US4] Add getRelations() function to api.ts in frontend/src/lib/ (calls GET /relations/)
- [x] T052 [US4] Create Relation type in frontend/src/types/index.ts matching API response structure

**Tests for User Story 4**:

- [x] T053 [P] [US4] Update test_views.py in ner/tests/ to add tests for RelationsView (document with relations, document with no relations, nonexistent document)
- [x] T054 [P] [US4] Add test for relation response structure completeness (all expected fields present) in test_views.py

**Checkpoint**: All user stories (P1 + P2) should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [x] T055 [P] Apply migration 0006_add_relations to local database via docker compose exec app python manage.py migrate
- [x] T056 [P] Validate quickstart.md instructions work end-to-end (upload → extract relations → view graph)
- [x] T057 [P] Run pytest on backend (ensure all new tests pass, no regressions in existing tests)
- [x] T058 [P] Run Jest on frontend (ensure all new tests pass, no regressions in existing tests)
- [x] T059 Code review and cleanup: remove debug logging, ensure consistent error handling across views
- [x] T060 [P] Update README.md with "Extract Entities + Relations" feature description
- [x] T061 Performance validation: test extraction time is ≤2× entity-only time for same document/provider
- [x] T062 Performance validation: test graph rendering with 100 entities + 200 relations loads within 3 seconds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1, US2, US3 (P1) can proceed in parallel after Foundational
  - US4 (P2) can proceed in parallel with P1 stories or sequentially after
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Backend relation extraction - Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Graph rendering - Can start after Foundational (Phase 2) - Integrates with US1 but independently testable
- **User Story 3 (P1)**: Upload flow UI - Can start after Foundational (Phase 2) - Integrates with US1 but independently testable
- **User Story 4 (P2)**: Relations API - Can start after Foundational (Phase 2) - Independent, can be implemented anytime

### Within Each User Story

- Models and serializers before services
- Services before views
- Views before frontend integration
- Core implementation before tests
- All tests for a story can run in parallel (marked [P])

### Parallel Opportunities

**Setup Phase (Phase 1)**:
```bash
# Can run in parallel:
make task T004 &  # RelationSerializer
make task T005 &  # relation-extraction-v1.md prompt
wait
```

**Foundational Phase (Phase 2)**:
```bash
# Sequential (each depends on prior):
make task T006    # relation_extractor.py
make task T007    # relation_deduplicator.py
make task T008    # extend pipeline.py
make task T009    # orchestrate two-pass extraction
```

**User Story 1 (Phase 3) - Backend Tests**:
```bash
# All tests can run in parallel:
make task T020 &  # test_relation_extractor.py
make task T021 &  # test_relation_deduplicator.py
make task T022 &  # test_views.py updates
make task T023 &  # clean-slate test
wait
```

**User Story 2 (Phase 4) - Tests**:
```bash
# All tests can run in parallel:
make task T032 &  # edge rendering test
make task T033 &  # node shape mapping test
make task T034 &  # confidence filtering test
make task T035 &  # backward compatibility test
make task T036 &  # backend graph edges test
make task T037 &  # backend backward compat test
wait
```

**User Story 3 (Phase 5) - Frontend Tests**:
```bash
# All tests can run in parallel:
make task T045 &  # button appears test
make task T046 &  # completion screen test
make task T047 &  # Recent Documents test
wait
```

**User Story 4 (Phase 6) - Tests**:
```bash
# All tests can run in parallel:
make task T053 &  # RelationsView tests
make task T054 &  # response structure test
wait
```

**Polish Phase (Phase 7)**:
```bash
# Can run in parallel:
make task T055 &  # apply migration
make task T056 &  # quickstart validation
make task T057 &  # pytest
make task T058 &  # Jest
make task T060 &  # README update
wait
```

**Cross-Story Parallelization** (if team capacity allows):
```bash
# After Foundational phase completes, all user stories can start in parallel:
make user-story US1 &  # Backend relation extraction
make user-story US2 &  # Graph rendering
make user-story US3 &  # Upload flow UI
make user-story US4 &  # Relations API
wait
```

---

## Implementation Strategy

**MVP Scope**: User Stories 1, 2, and 3 (all P1) constitute the minimum viable product:
- US1: Backend relation extraction with deduplication
- US2: Graph visualization with edges and node shapes
- US3: Upload flow UI integration

**Incremental Delivery**:
1. **First deliverable**: Complete Phase 1 + Phase 2 + US1 → Backend relation extraction working via API (testable with curl/Postman)
2. **Second deliverable**: Add US2 → Graph visualization shows edges and node shapes (full visual output)
3. **Third deliverable**: Add US3 → Upload flow integration (end-to-end user journey complete)
4. **Optional enhancement**: Add US4 → Dedicated relations API (programmatic access for downstream tools)

**Suggested Execution Order** (single developer):
1. Phase 1 (Setup) → Phase 2 (Foundational) → Build core backend extraction
2. Phase 3 (US1) → Complete backend relation extraction with tests
3. Phase 4 (US2) → Add graph rendering with tests
4. Phase 5 (US3) → Integrate upload flow UI with tests
5. Phase 6 (US4) → Add relations API endpoint (optional, can be deferred post-MVP)
6. Phase 7 (Polish) → Final validation and cleanup

**Testing Strategy**:
- Write backend tests alongside implementation (pytest)
- Write frontend tests alongside implementation (Jest)
- Integration test via quickstart.md at end of Phase 7
- Continuous validation: pytest + Jest must pass before moving between phases
