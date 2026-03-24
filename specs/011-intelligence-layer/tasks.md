# Tasks: Intelligence Layer

**Input**: Design documents from `/specs/011-intelligence-layer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.md, quickstart.md

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Create versioned RAG summarization prompt template in prompts/entity_summary_rag.txt
- [X] T002 [P] Create versioned NL query prompt template in prompts/nl_query_rag.txt
- [X] T003 [P] Write docs/ADR-graph-library.md covering all five evaluation dimensions (D3 vs Cytoscape edge bundling, layout support, animation, bundle size/SSR, migration effort) with unambiguous recommendation to stay with Cytoscape.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: US1 and US2 cannot begin until T004 is complete. All other user stories are independent of this phase.

- [X] T004 Create ner/services/semantic_search.py — loads all-MiniLM-L6-v2 from /app/models/all-MiniLM-L6-v2, embeds query at query time, runs pgvector CosineDistance query over Chunk.embedding scoped to project documents, returns top-K chunks with their entity associations
- [X] T005 [P] Extend frontend/src/lib/api.ts with all new API calls required by this spec: semantic query, entity flag, review list, review resolve, entity timeline, global entities list, project providers list, and project provider PATCH

---

## Phase 3: User Story 1 - Semantic Search and NL Query (Priority: P1)

**Goal**: Replace SQL icontains search with pgvector cosine similarity; detect NL questions and return LLM-generated answers in a panel above the graph with matched nodes highlighted.
**Independent Test**: Open project map, type a question — confirm LLM answer panel appears and nodes highlight. Type an entity name — confirm only node highlight (no panel).

- [X] T006 [US1] Replace ProjectQueryView in ner/views.py — remove canonical_name__icontains filter; use semantic_search.py (T004) to retrieve top-K chunks; extract entity IDs from returned chunks; detect NL question (question words or token count > 3); if NL, call LLM provider with nl_query_rag.txt prompt + retrieved chunks; return {query, is_nl_query, answer, entity_ids, count}
- [X] T007 [P] [US1] Create ner/services/nl_query.py — NL question detector function (question word list + token count check); LLM call function using existing JointExtractionProvider abstraction and run_with_retry; assembles prompt from nl_query_rag.txt + top-K chunk texts + question
- [X] T008 [P] [US1] Add NL answer result panel to frontend/pages/projects/[id]/map.tsx — show answer text above the graph when is_nl_query=true; hide panel when query is cleared or returns is_nl_query=false
- [X] T009 [US1] Update frontend/src/components/GraphVisualization.tsx to accept and apply highlightedNodeIds prop — highlight matched entity nodes from search results (extend existing search highlight logic)
- [X] T010 [US1] Wire map.tsx search bar to new query API — on submit call the updated /query/ endpoint, pass entity_ids to GraphVisualization as highlightedNodeIds, show/hide answer panel based on is_nl_query flag

---

## Phase 4: User Story 2 - LLM RAG Entity Summary (Priority: P1)

**Goal**: Generate summary button calls LLM with retrieved document chunks rather than returning a hardcoded template string. Cache and TTL logic unchanged.
**Independent Test**: Click Generate summary on any entity — confirm the text is a narrative grounded in document content, not a template. Click again within 24h — confirm instant return (cached).

- [X] T011 [US2] Replace _generate_summary_text() in ner/services/contextual_summary.py — embed entity.canonical_name using all-MiniLM-L6-v2 (reuse semantic_search.py from T004); retrieve top-K chunks from project documents; build prompt from entity_summary_rag.txt + chunk texts + entity metadata + concept note; call LLM provider using existing JointExtractionProvider abstraction and run_with_retry; return generated text; update generated_by_provider to the actual provider name; preserve all existing cache/TTL/_upsert_cache/get_or_generate_summary logic unchanged
- [X] T012 [US2] Update EntitySummaryView in ner/views.py to pass the project-level provider (project.provider or settings.LLM_PROVIDER) to the summary generation call; handle 503 gracefully when LLM unavailable and no cache exists

---

## Phase 5: User Story 3 - Per-Document Extraction Stats (Priority: P1)

**Goal**: Documents page shows inline entity count, relation count, and confidence distribution per document after extraction. Each row is expandable to show top 5 entities.
**Independent Test**: Run extraction on a project with 2 documents, open /projects/{id}/documents — confirm each completed document shows stats row. Expand one row — confirm top 5 entities listed.

- [X] T013 [US3] Extend the project documents API view in ner/views.py (GET /api/v1/projects/{id}/documents/) to support ?include_stats=true query param — annotate each completed document with entity_count (Entity count filtered by document and completed NERRun), relation_count (sum of NERRun.relations_created for completed runs), confidence distribution (high ≥0.8 / medium 0.5–0.8 / low <0.5 buckets), and top_entities (top 5 by confidence with id, name, type, confidence); return stats: null for non-completed documents
- [X] T014 [US3] Add per-document stats row UI to frontend/pages/projects/[id]/documents.tsx — after fetch, call documents API with include_stats=true; render entity_count, relation_count, and confidence distribution badges inline on each completed document row; show "Not extracted" state for documents without stats
- [X] T015 [US3] Add expandable row to frontend/pages/projects/[id]/documents.tsx — expand/collapse toggle arrow on each document row; expanded state shows top 5 entities as a mini-list with name, type badge, and confidence score

---

## Phase 6: User Story 4 - Entity Flagging and Rejection (Priority: P1)

**Goal**: Users can flag any entity from the side panel or entities table. Flagged entities disappear from the graph. Project header shows flagged count. Unflag available on entity detail page.
**Independent Test**: Flag an entity from the side panel — confirm it disappears from the graph immediately and flagged count in project header increments. Navigate to entity detail — confirm unflag option. Unflag — confirm entity reappears.

- [X] T016 [US4] Add is_flagged = BooleanField(default=False, db_index=True) to Entity model in ner/models.py and generate migration ner/migrations/0xxx_entity_is_flagged.py
- [X] T017 [US4] Create EntityFlagView in ner/views.py — POST /api/v1/entities/{id}/flag/ accepts {is_flagged: bool}; sets entity.is_flagged; returns {id, canonical_name, is_flagged}; requires authenticated user with access to entity's project
- [X] T018 [US4] Register new URL in ner/urls.py: path('entities/<uuid:id>/flag/', EntityFlagView.as_view())
- [X] T019 [US4] Update project graph API (GET /api/v1/projects/{id}/graph/) in ner/views.py to exclude entities where is_flagged=True from the nodes response
- [X] T020 [US4] Add flag/reject button to entity side panel in frontend/src/components/GraphVisualization.tsx — calls flag API on click; on success removes the entity node from the graph via cy.remove() and updates local flagged count state
- [X] T021 [US4] Add flagged entity count to project header in frontend/pages/projects/[id]/map.tsx — fetch count of flagged entities for the project on load and after each flag action; display as a small badge when count > 0
- [X] T022 [US4] Add unflag button to entity detail page in frontend/pages/projects/[id]/entities/[entityId].tsx — visible only when entity is_flagged=true; calls flag API with is_flagged=false; redirects back to map on success

---

## Phase 7: User Story 5 - Dedup Review Queue for Project Owners (Priority: P2)

**Goal**: Project owners can access /projects/{id}/review to see and resolve near-duplicate entity pairs without admin access. Sidebar shows pending count badge.
**Independent Test**: Open /projects/{id}/review — confirm candidate pairs listed with names, score, context. Merge one — graph shows single node. Keep separate — both persist. Sidebar badge decrements.

- [X] T023 [US5] Create DeduplicationReviewListView in ner/views.py — GET /api/v1/projects/{id}/review/ returns paginated list of EntityReviewCandidate with status=pending scoped via document__project=project; each result includes left_entity {id, name, type}, right_entity {id, name, type}, similarity_score, and mention_context (first 280 chars of left_entity's chunk text)
- [X] T024 [US5] Create ReviewCandidateResolveView in ner/views.py — POST /api/v1/review-candidates/{id}/resolve/ accepts {action: merge|keep_separate}; for merge: creates EntityAlias for the losing entity's name on the winning entity, reassigns all Relations from losing to winning entity, sets losing entity is_flagged=True, sets candidate status=merged; for keep_separate: sets status=kept_separate; sets resolved_by and resolved_at; returns resolved candidate with canonical_entity if merged
- [X] T025 [US5] Create resolve_review_candidate() service function in ner/services/dedup_review.py implementing the merge and keep_separate logic cleanly separated from the view
- [X] T026 [US5] Register new URLs in ner/urls.py: GET path('projects/<uuid:id>/review/', ...) and POST path('review-candidates/<uuid:id>/resolve/', ...)
- [X] T027 [US5] Create frontend/pages/projects/[id]/review.tsx — fetches GET /projects/{id}/review/; renders candidate pairs table with entity names, similarity score, mention context snippet, and Merge / Keep separate action buttons; shows empty state when no pending candidates
- [X] T028 [US5] Add dedup review sidebar badge to frontend/src/components/layout/Sidebar.tsx — fetch pending review count for the active project; display as a small numeric badge next to the project name when count > 0; add "Review duplicates" link to project sub-pages list
- [X] T029 [US5] Add /projects/{id}/review to project sub-pages in Sidebar.tsx projectSubPages array

---

## Phase 8: User Story 6 - Entity Mention Timeline (Priority: P2)

**Goal**: Entity detail page shows a chronological timeline of document mentions with document name, upload date, and context snippet per entry, each linking to the source document.
**Independent Test**: Open entity detail page for an entity in multiple documents — confirm timeline section present, entries in chronological order by upload date, each with name, date, snippet. Click document link — navigates to source document.

- [X] T030 [US6] Create EntityTimelineView in ner/views.py — GET /api/v1/entities/{id}/timeline/?project_id={id} queries Chunk.objects.filter(document__project=project, text__icontains=entity.canonical_name).select_related('document').order_by('document__created_at'); deduplicates by document (one entry per document, earliest chunk); returns list of {document_id, document_name, uploaded_at, context_snippet (280-char slice around first entity mention)}
- [X] T031 [US6] Register new URL in ner/urls.py: path('entities/<uuid:id>/timeline/', EntityTimelineView.as_view())
- [X] T032 [US6] Add Timeline section to frontend/pages/projects/[id]/entities/[entityId].tsx — fetches GET /entities/{id}/timeline/?project_id={id}; renders chronological list of entries with document name, uploaded_at formatted date, context snippet in a styled box, and a link to /projects/{project_id}/documents filtered to that document; show "No mentions found" empty state

---

## Phase 9: User Story 7 - Global Entity View (Priority: P2)

**Goal**: /entities global page lists all entities across user's projects sorted by cross-project frequency. Sidebar shows Entities link. Clicking an entity opens its existing global profile.
**Independent Test**: Create two projects mentioning the same entity. Open /entities — confirm entity appears once with project_count=2, sorted first. Click it — existing global profile page opens showing both projects.

- [X] T033 [US7] Create GlobalEntityListView in ner/views.py — GET /api/v1/entities/ (no project scope); filters Entity.objects to project__owner=request.user; annotates with project_count (Count('project', distinct=True)), document_count (Count('document_id', distinct=True)), confidence_min (Min('confidence')), confidence_max (Max('confidence')); orders by -project_count; paginates (page_size=50); supports ?type= filter
- [X] T034 [US7] Register new URL in ner/urls.py: path('entities/', GlobalEntityListView.as_view()) — ensure it does not conflict with existing entity detail URLs
- [X] T035 [US7] Create frontend/pages/entities/index.tsx — fetches GET /api/v1/entities/; renders sortable table with columns: name, type (badge), project count, document count, confidence range; each row links to existing /projects/{first_project_id}/entities/{entity_id} global profile; shows loading and empty states
- [X] T036 [US7] Add Entities link to frontend/src/components/layout/Sidebar.tsx bottom navigation section — navigate to /entities

---

## Phase 10: User Story 8 - LLM Provider Selection Per Project (Priority: P2)

**Goal**: Project settings page shows a provider dropdown. Selected provider is stored on the Project model and used for all LLM calls for that project. Active provider shown in project workspace sidebar.
**Independent Test**: Open project settings, select a different provider, save. Confirm sidebar shows new provider. Run extraction — confirm NERRun.provider matches the selected project provider.

- [X] T037 [US8] Add provider = CharField(max_length=32, blank=True, default='') and model = CharField(max_length=64, blank=True, default='') to Project model in ingestion/models.py and generate migration ingestion/migrations/0xxx_project_provider_model.py
- [X] T038 [US8] Create ProjectProviderView in ner/views.py — GET /api/v1/projects/{id}/providers/ checks os.environ for GROQ_API_KEY, OPENAI_API_KEY, AZURE_OPENAI_API_KEY, GEMINI_API_KEY; returns current_provider, current_model, and list of all providers with available bool and supported models list
- [X] T039 [US8] Extend PATCH /api/v1/projects/{id}/ in ingestion serializers/views to accept and validate provider and model fields — validate provider is in allowed list; validate model is valid for provider; validate provider is available (API key set); save to project
- [X] T040 [US8] Update all LLM call sites to resolve provider from project — in ner/services/contextual_summary.py, ner/views.py (ProjectQueryView NL path, NERRun creation), use project.provider if non-empty else settings.LLM_PROVIDER as the provider identifier
- [X] T041 [US8] Register new URL in ner/urls.py: path('projects/<uuid:id>/providers/', ProjectProviderView.as_view())
- [X] T042 [US8] Add provider selection dropdown to frontend/pages/projects/[id]/settings.tsx — fetches GET /projects/{id}/providers/; renders dropdown with available providers (selectable) and unavailable providers (greyed out, "not configured" label); saves via PATCH /projects/{id}/ on change; shows save confirmation
- [X] T043 [US8] Display active provider in frontend/src/components/layout/Sidebar.tsx — fetch project detail for active project; show provider name and model in the project sub-pages section below the project name in small monospace text

---

## Phase 11: User Story 9 - D3.js vs Cytoscape.js ADR (Priority: P3)

**Goal**: docs/ADR-graph-library.md exists with all five evaluation dimensions and an unambiguous recommendation.
**Independent Test**: Open docs/ADR-graph-library.md — confirm it covers all five dimensions and ends with a clear recommendation.

- [X] T044 [US9] Finalize and expand docs/ADR-graph-library.md using research from research.md section 10 — cover: edge bundling at 500+ nodes, custom layout support (Louvain, timeline), animation quality, bundle size and Next.js SSR compatibility, estimated migration effort; conclude with explicit recommendation "Stay with Cytoscape.js" and full rationale; format as a standard ADR (Context, Decision, Rationale, Alternatives Considered, Consequences)

---

## Final Phase: Polish & Cross-Cutting

- [X] T045 [P] Add backend tests for semantic_search.py in ner/tests/test_semantic_search.py — mock sentence-transformers model; test cosine distance query returns ranked results; test empty project returns empty list
- [X] T046 [P] Add backend tests for EntityFlagView in ner/tests/test_entity_flag.py — test flag sets is_flagged=True; test flagged entity absent from graph API response; test unflag restores entity
- [X] T047 [P] Add backend tests for DeduplicationReviewListView and ReviewCandidateResolveView in ner/tests/test_dedup_review_api.py — test merge consolidates entities; test keep_separate dismisses candidate; test non-owner access denied
- [X] T048 [P] Update README.md Specs table to add spec 011 entry and update frontend routes table with /entities and /projects/{id}/review

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001, T002, T003 can start immediately and run in parallel
- **Foundational (Phase 2)**: No external dependencies; T004 blocks US1 (T006, T007, T010) and US2 (T011, T012). T005 (frontend api.ts) can run in parallel with T004.
- **User Stories (Phase 3+)**:
  - US1 (Phase 3): Requires T004 complete. T006, T007, T008, T009 can run in parallel; T010 depends on T006+T007+T008+T009
  - US2 (Phase 4): Requires T004 complete. Independent of US1.
  - US3 (Phase 5): Independent of Foundational — can start immediately after Setup
  - US4 (Phase 6): Independent of Foundational — requires only its own migration T016
  - US5 (Phase 7): Independent of Foundational. T023, T024, T025 can be done before T026+T027+T028+T029
  - US6 (Phase 8): Independent. T030, T031 backend before T032 frontend
  - US7 (Phase 9): Independent. T033, T034 backend before T035, T036 frontend
  - US8 (Phase 10): Requires its own migration T037. T038, T039, T040 can run in parallel after T037; T041, T042, T043 after backend
  - US9 (Phase 11): Fully independent — research spike only
- **Polish (Final Phase)**: After all desired user stories are complete

### User Story Dependencies

- **US1 (P1)**: Requires T004 (semantic_search.py) — HIGH PRIORITY
- **US2 (P1)**: Requires T004 (semantic_search.py) — HIGH PRIORITY
- **US3 (P1)**: No blocking dependencies
- **US4 (P1)**: No blocking dependencies (only its own migration)
- **US5 (P2)**: No blocking dependencies
- **US6 (P2)**: No blocking dependencies
- **US7 (P2)**: No blocking dependencies
- **US8 (P2)**: No blocking dependencies (only its own migration)
- **US9 (P3)**: No blocking dependencies

### Parallel Opportunities

- T001, T002, T003 can all run in parallel (different files)
- T004 and T005 can run in parallel
- After T004: T006, T007, T008, T009 (US1) and T011 (US2) can all run in parallel
- T013 (US3 backend) and T016 (US4 migration) can run in parallel
- T023, T024, T025 (US5 backend) can run in parallel
- T030 (US6) and T033 (US7) and T037 (US8 migration) can all run in parallel
- T045, T046, T047, T048 (Polish) can all run in parallel

---

## Parallel Execution Examples

### US1 + US2 in parallel (after T004)

```text
T004 complete → launch simultaneously:
  Thread A (US1): T006 → T010 (sequential within US1)
  Thread A (US1): T007, T008, T009 (parallel within US1)
  Thread B (US2): T011 → T012 (sequential within US2)
```

### US3, US4, US5 in parallel (no blocking dependencies)

```text
Thread A: T013 → T014 → T015 (US3)
Thread B: T016 → T017 → T018 → T019 → T020 → T021 → T022 (US4)
Thread C: T023 → T025 → T026 → T027 → T028 → T029 (US5)
```

### US6, US7, US8 in parallel

```text
Thread A: T030 → T031 → T032 (US6)
Thread B: T033 → T034 → T035 → T036 (US7)
Thread C: T037 → T038 + T039 + T040 → T041 → T042 → T043 (US8)
```

---

## Implementation Strategy

### MVP (P1 stories — maximum intelligence value)

1. Complete Phase 1: Setup (T001, T002 — prompt templates)
2. Complete Phase 2: Foundational (T004 — semantic_search.py)
3. Complete Phase 3: US1 — Semantic search + NL query
4. Complete Phase 4: US2 — LLM RAG entity summaries
5. Complete Phase 5: US3 — Per-document stats
6. Complete Phase 6: US4 — Entity flagging
7. **STOP and VALIDATE**: All P1 stories independently testable

### Incremental Delivery

1. Setup + Foundational → semantic search infrastructure ready
2. US1 + US2 → core intelligence (search + summaries) working
3. US3 + US4 → quality feedback loop (stats + flagging) working
4. US5 + US6 → dedup review + timeline
5. US7 + US8 → global view + provider selection
6. US9 → ADR document
7. Polish → tests, README
