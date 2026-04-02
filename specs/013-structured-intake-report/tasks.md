# Tasks: Structured Initiative Intake + SMQ + Extraction Guidance + RAG Report + Stakeholder Priority

**Input**: Design documents from `specs/013-structured-intake-report/`
**Branch**: `013-structured-intake-report`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup

**Purpose**: Commit seed data and write LLM prompt templates before any model or code changes.

- [X] T001 Commit docs/smq.txt to repository (git add docs/smq.txt) — required by data migration T017
- [X] T002 [P] Create LLM prompt template prompts/smq_section_generate.txt — system prompt instructs LLM to answer one SMQ section given: section title, question prompts, project context string, and top-K document chunk excerpts with inline citation format `[Doc: {filename}]`
- [X] T003 [P] Create LLM prompt template prompts/report_section.txt — system prompt instructs LLM to write a formal narrative paragraph for a stakeholder report section given: section title, SMQ answer for this section (if available), project context string, and top-K chunk excerpts; require inline citations `[Doc: {filename}, p.{chunk_index}]`
- [X] T004 [P] Create LLM prompt template prompts/engagement_note.txt — system prompt instructs LLM to write a single sentence engagement recommendation for a stakeholder given: entity name, entity type, relationship list, SMQ section 2 and section 6 answers (if available), and top-3 relevant chunk excerpts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities that ALL user stories depend on. Must be complete before Phase 3.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Create ingestion/services/context.py with `get_project_context(project) -> str` helper — priority order: project.initiative_profile.to_context_string() if exists, else project.concept_note.content if exists, else project.description. Import ConceptNote from ingestion.models. Handle DoesNotExist gracefully with try/except.
- [X] T006 Update all existing concept note access in ner/views.py to call get_project_context() from ingestion.services.context — replace `_get_project_concept_note_text(project)` helper at line ~61 to delegate to get_project_context(), and update all 8–12 direct `project.concept_note.content` reads in views.py and ner/services/pipeline.py to use get_project_context() instead
- [X] T007 Extract shared PDF rendering helpers from ner/views.py into ner/services/pdf_utils.py — move `_pdf_safe()`, `_build_pdf_header()` (or equivalent ReportLab setup, styles dict, DejaVu font registration) into pdf_utils.py so both existing ProjectExportReportPDFView and new SMQ report export can import them; update existing view imports accordingly

**Checkpoint**: `get_project_context()` centralised, existing tests still pass (`docker compose run --rm app pytest --tb=short`), PDF export still works.

---

## Phase 3: User Story 1 — Structured Initiative Intake Form (Priority: P1) 🎯 MVP

**Goal**: Replace/extend free-text concept note with a structured form. Improves extraction quality with no re-extraction needed.

**Independent Test**: Open project settings, fill intake form, run extraction, confirm LLM prompt contains all structured fields. Existing ConceptNote data is not lost.

### Implementation for User Story 1

- [X] T008 [US1] Add InitiativeProfile model to ingestion/models.py — OneToOneField to Project (related_name='initiative_profile'), fields: initiative_name (CharField 255, blank), geography (CharField 255, blank), thematic_area (CharField 255, blank), core_objectives (TextField, blank), expected_outcomes (TextField, blank), stakeholder_focus (TextField, blank), created_at/updated_at. Add `to_context_string()` method that formats all non-empty fields as a labelled multi-line string.
- [X] T009 [US1] Create migration ingestion/migrations/0009_initiative_profile.py for InitiativeProfile model
- [X] T010 [P] [US1] Update get_project_context() in ingestion/services/context.py to read project.initiative_profile.to_context_string() as first-priority branch (add after model exists)
- [X] T011 [P] [US1] Add InitiativeProfileSerializer to ingestion/serializers.py — all fields writable, returns project UUID, includes updated_at
- [X] T012 [US1] Add InitiativeProfileView (GET + PUT upsert) to ingestion/views.py — GET returns existing profile or empty defaults pre-filled from ConceptNote.content into core_objectives; PUT uses get_or_create on project then updates all provided fields; requires project ownership
- [X] T013 [US1] Add intake URL pattern to ingestion/urls.py: `projects/<uuid:project_id>/intake/` → InitiativeProfileView
- [X] T014 [P] [US1] Create frontend/src/components/IntakeForm.tsx — controlled form with 6 labeled fields (Initiative Name, Geography, Thematic Area, Core Objectives textarea, Expected Outcomes textarea, Stakeholder Focus textarea), Save button, success/error toast; calls PUT /api/v1/projects/{id}/intake/ on submit; loads existing values on mount via GET
- [X] T015 [US1] Create frontend/pages/projects/[id]/intake.tsx — page wrapper that renders IntakeForm, linked from project workspace sidebar as "Initiative Profile" nav item; add the nav link to the project sidebar component (wherever project settings links live, e.g. frontend/src/components/ProjectSidebar.tsx or equivalent)

**Checkpoint**: User can open a project, fill the structured form, save it, and subsequent extraction calls use the structured fields via get_project_context().

---

## Phase 4: User Story 2 — SMQ Template System (Priority: P2)

**Goal**: 8-section Stakeholder Mapping Questionnaire per project with AI pre-fill from document chunks.

**Independent Test**: Open SMQ tab, fill section 1 manually, save. Click "Generate with AI" on section 2, confirm AI answer appears with citations. All answers persist across sessions.

### Implementation for User Story 2

- [X] T016 [US2] Add SMQTemplate and SMQSection models to ner/models.py — SMQTemplate: title (CharField), description (TextField blank), is_active (BooleanField default True); SMQSection: FK to SMQTemplate, section_number (PositiveIntegerField), title (CharField), question_prompts (TextField), order (PositiveIntegerField), is_active (BooleanField default True); Meta unique_together on (template, section_number)
- [X] T017 [US2] Create schema migration ner/migrations/0018_smq_template.py for SMQTemplate and SMQSection models
- [X] T018 [US2] Create data migration ner/migrations/0019_smq_template_seed.py — reads docs/smq.txt at migration time using os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'smq.txt'), parses the 8 sections (split on numbered headers "1.", "2.", etc.), creates one SMQTemplate with title="Stakeholder Mapping Questionnaire" and 8 SMQSection records using get_or_create on section_number; migration is idempotent
- [X] T019 [US2] Add ProjectSMQResponse and ProjectSMQAnswer models to ner/models.py — ProjectSMQResponse: OneToOneField to Project (related_name='smq_response'), created_at/updated_at; ProjectSMQAnswer: FK to ProjectSMQResponse, FK to SMQSection, answer_text (TextField blank), ai_generated (BooleanField default False), is_stale (BooleanField default False), last_generated_at (DateTimeField null blank), chunk_ids_used (JSONField default list), unique_together on (response, section)
- [X] T020 [US2] Create migration ner/migrations/0020_project_smq_response.py for ProjectSMQResponse and ProjectSMQAnswer models
- [X] T021 [P] [US2] Add SMQ serializers to ner/serializers.py — SMQSectionSerializer (id, section_number, title, question_prompts), SMQTemplateSerializer (nested sections), ProjectSMQAnswerSerializer (section_id, section_number, section_title, answer_text, ai_generated, is_stale, last_generated_at), ProjectSMQResponseSerializer (nested answers list)
- [X] T022 [US2] Create ner/services/smq_generator.py — implement generate_smq_section(project, section) function: (1) embed section.question_prompts using existing embedding model, (2) query Chunk vectors via pgvector cosine similarity (top-8), (3) load prompt from prompts/smq_section_generate.txt, (4) call _call_provider() from ner/services/nl_query.py with project provider/model, (5) return {answer_text, chunk_ids_used, citations list}
- [X] T023 [US2] Add SMQ API views to ner/views.py — SMQTemplateView (GET /smq/template/), ProjectSMQView (GET /projects/{id}/smq/), ProjectSMQAnswerView (PUT /projects/{id}/smq/{section_id}/), ProjectSMQGenerateView (POST /projects/{id}/smq/{section_id}/generate/ — calls smq_generator.generate_smq_section synchronously, saves result to ProjectSMQAnswer, returns answer with citations)
- [X] T024 [US2] Add SMQ URL patterns to ner/urls.py: smq/template/, projects/<uuid>/smq/, projects/<uuid>/smq/<uuid:section_id>/, projects/<uuid>/smq/<uuid:section_id>/generate/
- [X] T025 [P] [US2] Create frontend/src/components/SMQSection.tsx — collapsible section card showing section title, question_prompts as hint text, answer textarea (editable), "Generate with AI" button (shows spinner while loading, disabled if no documents), citation list below answer; on save calls PUT endpoint; on generate calls POST generate endpoint
- [X] T026 [P] [US2] Create frontend/pages/projects/[id]/smq.tsx — page that loads GET /smq/template/ and GET /projects/{id}/smq/, renders 8 SMQSection components, shows "No documents extracted yet" banner if project has no chunks; add "SMQ" nav link to project workspace sidebar

**Checkpoint**: User can fill all 8 SMQ sections manually or via AI. Answers persist. AI generation cites source documents.

---

## Phase 5: User Story 3 — Extraction Guidance Panel (Priority: P3)

**Goal**: Per-project text instructions that are injected verbatim into the LLM extraction prompt for every extraction run.

**Independent Test**: Add two guidance items, run extraction, verify both items appear in extraction prompt (check backend logs or debug endpoint). Delete an item, re-run, verify it is absent.

### Implementation for User Story 3

- [X] T027 [US3] Add ExtractionGuidance model to ingestion/models.py — FK to Project (related_name='extraction_guidance_items'), text (TextField), order (PositiveIntegerField default 0), created_at; Meta ordering=['order', 'created_at']
- [X] T028 [US3] Create migration ingestion/migrations/0010_extraction_guidance.py for ExtractionGuidance model
- [X] T029 [P] [US3] Add ExtractionGuidanceSerializer to ingestion/serializers.py — id, text, order fields
- [X] T030 [US3] Add guidance CRUD views to ingestion/views.py — ExtractionGuidanceListView (GET list + POST create), ExtractionGuidanceDetailView (PATCH + DELETE), ExtractionGuidanceReorderView (POST bulk reorder accepting {"order": [uuid1, uuid2, ...]})
- [X] T031 [US3] Add guidance URL patterns to ingestion/urls.py: projects/<uuid>/guidance/, projects/<uuid>/guidance/<uuid:guidance_id>/, projects/<uuid>/guidance/reorder/
- [X] T032 [US3] Update extraction prompt assembly in ner/services/pipeline.py — after loading concept_note context (now via get_project_context()), query ExtractionGuidance.objects.filter(project=project).order_by('order') and if items exist append a "EXTRACTION GUIDANCE" block with bulleted list before the document chunk in the prompt passed to each provider client; update JointExtractionRequest or the prompt-building function to accept guidance_items: list[str] parameter
- [X] T033 [P] [US3] Create frontend/src/components/GuidancePanel.tsx — displays ordered list of guidance items with add input, edit-in-place, delete button per item, and drag handles for reordering; calls GET/POST/PATCH/DELETE guidance endpoints; shows empty state "No guidance items yet — add instructions to focus extraction"
- [X] T034 [US3] Integrate GuidancePanel into the project settings page — locate the project settings page in the frontend (frontend/pages/projects/[id]/settings.tsx or similar) and add a "Extraction Guidance" section rendering GuidancePanel; if no settings page exists create frontend/pages/projects/[id]/settings.tsx with intake link + guidance panel

**Checkpoint**: Guidance items appear in extraction LLM prompt. Adding/removing items immediately affects next extraction run.

---

## Phase 6: User Story 4 — Per-Section RAG Report Generation (Priority: P4)

**Goal**: Generate an 8-section formal stakeholder report from document evidence. Sections generate in parallel, cached 24h, exportable as PDF.

**Independent Test**: Project with 2+ extracted documents. Click "Generate All Sections". Within 60 seconds all 8 sections show "Done" with narrative text and citations. Export PDF downloads a valid multi-section file.

### Implementation for User Story 4

- [X] T035 [US4] Add ReportSection model to ner/models.py — FK to Project (related_name='report_sections'), FK to SMQSection, status (CharField choices: pending/generating/done/error, default pending), generated_text (TextField blank), citations (JSONField default list, schema: [{doc_name, chunk_id, snippet}]), error_message (TextField blank), cache_key (CharField 64 blank), generated_at (DateTimeField null blank), unique_together on (project, section)
- [X] T036 [US4] Create migration ner/migrations/0021_report_section.py for ReportSection model
- [X] T037 [P] [US4] Add ReportSectionSerializer to ner/serializers.py — section_id, section_number, section_title, status, generated_text, citations, error_message, generated_at
- [X] T038 [US4] Create ner/services/report_generator.py — implement: (1) generate_report_section(project_id, section_id): calls django.db.close_old_connections(), loads project + section + SMQ answer, embeds section title for pgvector search (top-10 chunks), loads prompts/report_section.txt, calls _call_provider(), saves result to ReportSection with status=done or status=error; (2) generate_all_sections(project, section_ids): creates/resets ReportSection records to status=pending, uses ThreadPoolExecutor(max_workers=4) to run generate_report_section for each section_id, results are written to DB by each thread
- [X] T039 [US4] Add report API views to ner/views.py — ProjectReportView (GET /projects/{id}/report/ — returns all ReportSection status+content), ProjectReportGenerateView (POST /projects/{id}/report/generate/ — accepts {sections:"all"|[ids]}, calls generate_all_sections in background thread so HTTP returns 202 immediately, spawns via threading.Thread(target=generate_all_sections, daemon=True).start()), ProjectReportRegenerateView (POST /projects/{id}/report/regenerate/{section_id}/ — resets one section to pending and re-triggers), ProjectReportExportPDFView (GET /projects/{id}/report/export/pdf/ — checks all sections done, builds ReportLab PDF using pdf_utils.py + section texts + citations, returns binary download)
- [X] T040 [US4] Add report URL patterns to ner/urls.py: projects/<uuid>/report/, projects/<uuid>/report/generate/, projects/<uuid>/report/regenerate/<uuid:section_id>/, projects/<uuid>/report/export/pdf/
- [X] T041 [P] [US4] Create frontend/src/components/ReportSectionCard.tsx — card showing section title, status badge (pending/generating/done/error), generated text with inline citation markers rendered, citations list collapsed by default, "Regenerate" button (visible on done/error/stale); uses status colour tokens from design system
- [X] T042 [US4] Create frontend/pages/projects/[id]/report.tsx — page that loads GET /projects/{id}/report/ on mount, polls every 2 seconds while any section has status pending or generating (useEffect with setInterval), renders 8 ReportSectionCard components, shows "Generate All Sections" button at top, "Export PDF" button (enabled only when all done); add "Report" nav link to project workspace sidebar

**Checkpoint**: "Generate All Sections" populates all 8 sections within 60s. PDF export downloads a complete formatted file. Polling stops when all sections reach done/error.

---

## Phase 7: User Story 5 — Stakeholder Priority Table (Priority: P5)

**Goal**: Ranked list of entities by priority_score = degree × avg_confidence, filterable by type, with AI engagement notes, CSV export.

**Independent Test**: Project with 10+ extracted entities of mixed types. Priority table loads in < 2 seconds, entities ranked by score, type filter updates table instantly, CSV exports all rows including empty engagement_note column.

### Implementation for User Story 5

- [X] T043 [US5] Create ner/services/priority_table.py — implement compute_priority_scores(project, entity_type=None) function: query Relation table for degree per entity (annotate with Count of subject edges in project scope), query Entity table for avg_confidence and mention_count per entity (filter by project, is_flagged=False, type filter if provided), join on entity id, compute priority_score = degree × avg_confidence, sort descending, return list of dicts {rank, entity_id, name, entity_type, mention_count, avg_confidence, degree, priority_score, engagement_note}; engagement_note is None until explicitly generated
- [X] T044 [P] [US5] Add StakeholderPrioritySerializer to ner/serializers.py — rank, entity_id, name, entity_type, mention_count, avg_confidence, degree, priority_score, engagement_note
- [X] T045 [US5] Add priority table views to ner/views.py — ProjectPriorityTableView (GET /projects/{id}/stakeholders/priority/ with optional entity_type query param and page, calls compute_priority_scores, returns paginated results 50/page), ProjectPriorityGenerateNotesView (POST /projects/{id}/stakeholders/priority/generate-notes/ — for each entity in top-50 loads SMQ section 2+6 answers and top-3 relevant chunks, calls _call_provider() with prompts/engagement_note.txt, saves note back to Entity via a new engagement_note field or a separate JSON store — for MVP store notes in a JSONField on Project or as a simple dict cache — simplest: add engagement_notes JSONField to Project model or store in a separate table — use a simple dict stored in a new EngagementNote model: entity FK, project FK, note_text, generated_at), ProjectPriorityExportCSVView (GET /projects/{id}/stakeholders/priority/export/csv/ — streams CSV with all columns)
- [X] T046 [US5] Add priority table URL patterns to ner/urls.py: projects/<uuid>/stakeholders/priority/, projects/<uuid>/stakeholders/priority/generate-notes/, projects/<uuid>/stakeholders/priority/export/csv/
- [X] T047 [P] [US5] Create frontend/src/components/StakeholderPriorityTable.tsx — table with columns: rank, name (clickable → opens entity side panel), entity_type (with colour badge), mention_count, confidence (%), connections, score, engagement_note (truncated to 80 chars with tooltip); entity_type filter dropdown at top; "Generate Engagement Notes" button (triggers POST, shows per-row loading spinner); "Export CSV" button; pagination controls (50/page)
- [X] T048 [US5] Create frontend/pages/projects/[id]/stakeholders.tsx — page rendering StakeholderPriorityTable, loads GET /projects/{id}/stakeholders/priority/ on mount, re-loads on filter change; add "Stakeholders" nav link to project workspace sidebar

**Checkpoint**: Priority table renders ranked entities. Type filter works instantly. CSV exports cleanly. Clicking entity opens the existing entity side panel.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Backend tests, regression verification, and sidebar navigation integration.

- [X] T049 [P] Write backend tests for InitiativeProfile and get_project_context() in ner/tests/test_intake.py — test: profile creation, to_context_string() with all fields, with partial fields, with empty fields; test get_project_context() fallback order (profile → ConceptNote → description → empty string); mock out InitiativeProfile.DoesNotExist
- [X] T050 [P] Write backend tests for ExtractionGuidance injection in ner/tests/test_guidance.py — test: guidance items appear in extraction prompt when present; empty guidance list produces no guidance block in prompt; ordering is respected; test uses mocked LLM response
- [X] T051 [P] Write backend tests for SMQ generation in ner/tests/test_smq.py — test: SMQ data migration seeds 8 sections (use call_command('migrate') in test setup or assert count); generate_smq_section returns answer_text and citations; mock the LLM provider; test GET/PUT endpoints return correct structure
- [X] T052 [P] Write backend tests for report generation in ner/tests/test_report.py — test: generate_report_section saves ReportSection with status=done on success and status=error on LLM failure; generate_all_sections creates ReportSection records and transitions from pending to done; mock ThreadPoolExecutor to run synchronously in tests; mock LLM provider
- [X] T053 [P] Write backend tests for priority table computation in ner/tests/test_priority.py — test: compute_priority_scores returns entities sorted by priority_score descending; type filter returns only matching entity types; entities with degree=0 are excluded or ranked last; test CSV export returns correct headers
- [X] T054 Run full backend test suite in Docker and confirm all tests pass: `docker compose run --rm app pytest --tb=short`
- [X] T055 Verify regression scenarios from quickstart.md — run through: existing extraction unchanged, entity summary uses get_project_context(), NL query unchanged, existing PDF/DOCX report export unchanged, light/dark mode on all new pages, dedup review page still loads

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately, T002/T003/T004 in parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2 (independent of US1 except shares get_project_context())
- **Phase 5 (US3)**: Depends on Phase 2 (independent of US1, US2)
- **Phase 6 (US4)**: Depends on Phase 2 + US2 (needs SMQSection model for ReportSection FK, needs SMQ answers for report context)
- **Phase 7 (US5)**: Depends on Phase 2 (independent of US1-US4 for core table, optional SMQ dependency for engagement notes)
- **Phase 8 (Polish)**: Depends on all user stories complete

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|------------|-------------------|
| US1 (Intake) | Phase 2 | US2, US3, US5 |
| US2 (SMQ) | Phase 2 | US1, US3, US5 |
| US3 (Guidance) | Phase 2 | US1, US2, US5 |
| US4 (Report) | Phase 2 + US2 | US1, US3, US5 |
| US5 (Priority) | Phase 2 | US1, US2, US3 |

### Within Each Story

- Models must exist before services
- Services must exist before API views
- API views must exist before frontend pages
- Frontend components can be built in parallel with backend (if mocked)

### Within-Story Parallel Opportunities

- **US1**: T011 (serializer) and T014 (IntakeForm frontend) in parallel after T008 (model)
- **US2**: T021 (serializers) and T025/T026 (frontend) in parallel after T016/T019 (models)
- **US3**: T029 (serializer) and T033/T034 (frontend) in parallel after T027 (model)
- **US4**: T037 (serializer) and T041/T042 (frontend) in parallel after T035 (model)
- **US5**: T044 (serializer) and T047/T048 (frontend) in parallel after T043 (service)

---

## Implementation Strategy

### MVP First (US1 only — 8 tasks after Foundational)

1. Complete Phase 1 (T001–T004)
2. Complete Phase 2 (T005–T007) — verify existing tests pass
3. Complete Phase 3/US1 (T008–T015)
4. **STOP**: Test extraction with structured intake, confirm `get_project_context()` returns richer context
5. Demo: analyst can fill structured form, extraction uses it immediately

### Incremental Delivery

1. Phase 1 + 2 → Foundation ✓
2. US1 (Intake) → Immediate extraction quality improvement
3. US3 (Guidance) → Analyst-controlled extraction focus (quick win, no LLM dependency)
4. US2 (SMQ) → AI-assisted questionnaire
5. US4 (Report) → Full SMQ-backed PDF report (highest-value output)
6. US5 (Priority) → Ranked stakeholder table with engagement notes

---

## Notes

- All LLM calls must use existing `_call_provider()` from `ner/services/nl_query.py` — do not duplicate provider dispatch logic
- All new migrations must be backward-compatible (new tables only, no column changes to existing models)
- ThreadPoolExecutor in T038 must call `django.db.close_old_connections()` at the start of each thread function to avoid stale connection errors
- Prompt templates (T002–T004) are versioned in `prompts/` — treat changes as reviewable
- The `docs/smq.txt` commit (T001) must happen before the data migration (T018) or the migration will fail at runtime
- Frontend polling in T042: use `setInterval` inside `useEffect`, clear interval when all sections are done/error or component unmounts
