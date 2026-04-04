# Tasks: Stakeholder Personas + Workplan + Stepwise Workflow + Enriched Entity Cards + Report Staleness + PDF and DOCX Export

**Input**: Design documents from `specs/014-personas-workplan-export/`
**Branch**: `014-personas-workplan-export`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)

---

## Phase 1: Setup

**Purpose**: Create LLM prompt templates before any model or service changes.

- [X] T001 [P] Create prompts/persona_generate.txt — system prompt instructing LLM to return JSON `{ persona_name, archetype_label, demographics, motivations: [3 items], frustrations: [3 items] }` given: entity type name, list of up to 10 entity names, project context string; include instruction to return ONLY valid JSON with no markdown wrapping
- [X] T002 [P] Create prompts/workplan_generate.txt — system prompt instructing LLM to return JSON `{ components: [{ title, tasks: [{ task_description, suggested_owner, timeline, dependencies, kpis, related_stakeholder }] }] }` with 4–7 components each having 2–4 tasks, given: SMQ section 6 content, top-10 stakeholder names, project context string; include instruction to return ONLY valid JSON

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema changes and core service that ALL user stories depend on. Must be complete before Phase 3.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Add `STATUS_STALE = 'stale'` to `ReportSection.STATUS_CHOICES` in ner/models.py — insert after `STATUS_ERROR = 'error'`, add `('stale', 'Stale')` tuple to STATUS_CHOICES; `max_length=16` already accommodates 'stale' (5 chars)
- [X] T004 Create migration ner/migrations/0025_report_section_stale.py for the ReportSection STATUS_CHOICES extension — use `migrations.AlterField` to update the `status` CharField choices; no data migration needed (existing rows are unaffected)
- [X] T005 Add `workflow_step` (IntegerField, default=1) and `stakeholder_table_stale` (BooleanField, default=False) to `Project` model in ingestion/models.py; add `get_workflow_status(self) -> dict` method that queries related models to compute step completion: step 1 (initiative_profile.initiative_name non-empty), step 2 (any Document processed), steps 3+4 (any Entity in project NERRuns), step 5 (any ReportSection status='done'), step 6 (any EngagementNote exists for project — proxy for priority table generated), step 7 (always False); returns `{ current_step: int, steps: [{ number, label, complete, url }] }`
- [X] T006 Create migration ingestion/migrations/0012_project_workflow_fields.py for `workflow_step` and `stakeholder_table_stale` fields on Project
- [X] T007 Create ner/services/report_staleness.py — implement `flag_stale_report_sections(project_id: str) -> int`: queries `ReportSection.objects.filter(project_id=project_id, status=ReportSection.STATUS_DONE)`, bulk-updates their status to `STATUS_STALE`, sets `project.stakeholder_table_stale = True` and saves; returns count of sections flagged; import `ReportSection` from ner.models and `Project` from ingestion.models
- [X] T008 Hook `flag_stale_report_sections` into ner/views.py at both extraction completion points — (1) after line ~431 where single-document extraction returns `status: 'completed'`, add `from ner.services.report_staleness import flag_stale_report_sections` and call `flag_stale_report_sections(str(project.id))` before returning the response; (2) after line ~988 where batch extraction finishes its loop, call the same function once; only call if `result.get('entities_created', 0) > 0` to avoid flagging on empty extractions

**Checkpoint**: Run `docker compose run --rm app python manage.py migrate` — all 2 new migrations apply cleanly. Verify `flag_stale_report_sections` is importable. Existing extraction endpoint still returns 200.

---

## Phase 3: User Story 1 — Stakeholder Personas (Priority: P1) 🎯 MVP

**Goal**: Analysts can generate AI persona cards grouped by entity type on the report page.

**Independent Test**: Project with 10+ entities across 3 types. POST to `/api/v1/projects/{id}/personas/generate/` → poll GET `/api/v1/projects/{id}/personas/` → within 30s, cards with non-empty persona_name, archetype_label, demographics, 3 motivations, 3 frustrations appear for types with ≥3 entities.

### Implementation for User Story 1

- [X] T009 [US1] Add `StakeholderPersona` model to ner/models.py — fields: id (UUID PK), project (FK → Project, related_name='stakeholder_personas'), entity_type (FK → EntityLabel, null=True, blank=True, on_delete=SET_NULL), persona_name (CharField 255), archetype_label (CharField 255), demographics (TextField), motivations (JSONField default=list), frustrations (JSONField default=list), representative_entities (JSONField default=list), generated_at (DateTimeField auto_now_add); Meta: unique_together=[('project', 'entity_type')], ordering=['entity_type__label']
- [X] T010 [P] [US1] Create migration ner/migrations/0023_stakeholder_persona.py for StakeholderPersona model
- [X] T011 [P] [US1] Add `StakeholderPersonaSerializer` to ner/serializers.py — fields: id, entity_type_id, entity_type_label (SerializerMethodField reading entity_type.label), persona_name, archetype_label, demographics, motivations, frustrations, representative_entities, generated_at
- [X] T012 [US1] Create ner/services/persona_generator.py — implement `generate_personas_for_project(project_id: str) -> int`: (1) get project, call `get_project_context(project)` from ingestion.services.context, (2) query entities grouped by entity_type via `Entity.objects.filter(project_ner_runs__project=project).values('entity_type', 'canonical_name', 'description')`, (3) for each entity_type with count ≥ 3, take up to 10 names and 5 descriptions, call `_generate_single_persona()`, (4) delete existing `StakeholderPersona.objects.filter(project=project)` in a transaction, bulk_create new ones; implement `_generate_single_persona(project, entity_type_label, entity_names, descriptions, context) -> dict | None`: load prompts/persona_generate.txt, format with type/names/context, call `_call_provider()` from ner.services.nl_query, parse JSON with `json.loads()`, return dict or None on failure
- [X] T013 [US1] Add `generate_personas_task(project_id: str)` as `@shared_task(bind=True)` to ner/tasks.py — imports `generate_personas_for_project` from ner.services.persona_generator, calls it, returns `{'project_id': project_id, 'personas_created': count}`
- [X] T014 [US1] Add persona views to ner/views.py — `PersonaListView` (GET returns all StakeholderPersona for project ordered by entity_type label, serialized with StakeholderPersonaSerializer, wrapped as `{count, results}`); `PersonaGenerateView` (POST validates project has entities via `Entity.objects.filter(...).exists()`, returns 400 with `error: 'no_entities'` if none, else calls `generate_personas_task.delay(str(project.id))` and returns 202 `{status: 'generating', message: '...'}`)
- [X] T015 [US1] Add persona URL patterns to ner/urls.py — `path('projects/<uuid:id>/personas/', views.PersonaListView.as_view())` and `path('projects/<uuid:id>/personas/generate/', views.PersonaGenerateView.as_view())`
- [X] T016 [P] [US1] Create frontend/src/components/PersonaCard.tsx — card component props: `persona: StakeholderPersonaResponse, onEntityClick: (entityId: string) => void`; renders: coloured entity type badge (matching label config colour), persona_name in large font weight, archetype_label in small italic beneath, `<hr>` divider, demographics paragraph, "MOTIVATIONS" label in small uppercase with teal left border followed by `<ul>` of 3 items, "FRUSTRATIONS" label with red left border followed by `<ul>` of 3 items, "Based on:" line in small monospace with representative entity names as `<button>` elements calling onEntityClick; card has box-shadow and hover translateY(-2px) transition; add TypeScript interface `StakeholderPersonaResponse { id, entity_type_id, entity_type_label, persona_name, archetype_label, demographics, motivations: string[], frustrations: string[], representative_entities: Array<{id, name}>, generated_at }` to frontend/src/lib/api.ts along with API functions `getProjectPersonas(projectId)` and `generateProjectPersonas(projectId)`
- [X] T017 [US1] Add "Stakeholder Personas" section to frontend/pages/projects/[id]/report.tsx — below all 8 ReportSectionCard components, separated by `<hr>` divider: section heading "Stakeholder Personas" in same style as section titles, "Generate personas" button (calls generateProjectPersonas, sets loading state); renders skeleton shimmer cards (1/2/3 column responsive grid matching PersonaCard dimensions) while generating; when data loaded renders PersonaCard grid; for entity types with <3 entities show muted note "Not enough data to generate a persona for this stakeholder type."; poll GET /personas/ every 3s while `loading === true` (then stop when data arrives)

**Checkpoint**: POST generate, poll GET — persona cards render in the UI with correct content. Insufficient-data note appears for types below threshold. Entity links fire onEntityClick.

---

## Phase 4: User Story 2 — Workplan Generation (Priority: P2)

**Goal**: Analysts can generate a structured engagement workplan from SMQ Section 6.

**Independent Test**: Project with SMQ Section 6 complete. POST `/api/v1/projects/{id}/workplan/generate/` → GET `/api/v1/projects/{id}/workplan/` → within 30s, 4–7 components with tasks appear. POST on project without Section 6 complete → 400 error.

### Implementation for User Story 2

- [X] T018 [US2] Add `WorkplanComponent` and `WorkplanTask` models to ner/models.py — WorkplanComponent: id (UUID PK), project (FK → Project, related_name='workplan_components'), order (PositiveIntegerField default=0), title (CharField 255), generated_at (DateTimeField auto_now_add); Meta ordering=['order']; WorkplanTask: id (UUID PK), component (FK → WorkplanComponent, related_name='tasks'), order (PositiveIntegerField default=0), task_description (TextField), suggested_owner (CharField 255 blank), timeline (CharField 255 blank), dependencies (TextField blank), kpis (TextField blank), related_entity (FK → Entity, null=True, blank=True, on_delete=SET_NULL); Meta ordering=['order']
- [X] T019 [P] [US2] Create migration ner/migrations/0024_workplan.py for WorkplanComponent and WorkplanTask models
- [X] T020 [P] [US2] Add `WorkplanTaskSerializer` and `WorkplanComponentSerializer` to ner/serializers.py — WorkplanTaskSerializer: id, order, task_description, suggested_owner, timeline, dependencies, kpis, related_entity (nested: {id, name, entity_type} or null); WorkplanComponentSerializer: id, order, title, generated_at, tasks (nested WorkplanTaskSerializer many=True)
- [X] T021 [US2] Create ner/services/workplan_generator.py — define `class WorkplanGenerationError(Exception): pass`; implement `generate_workplan_for_project(project_id: str) -> int`: (1) get project, find SMQ Section 6 ReportSection (section__section_number=6), raise WorkplanGenerationError if status != 'done', (2) read section_6 generated_text, call `get_project_context(project)`, (3) query top-10 EngagementNote entities as stakeholder names, (4) load prompts/workplan_generate.txt, call `_call_provider()`, parse JSON, (5) in a transaction delete existing WorkplanComponent.objects.filter(project=project) and create new WorkplanComponent + WorkplanTask rows; for each task's `related_stakeholder` field attempt `Entity.objects.filter(project_ner_runs__project=project, canonical_name__iexact=name).first()` to link entity; return component count
- [X] T022 [US2] Add `generate_workplan_task(project_id: str)` as `@shared_task(bind=True)` to ner/tasks.py — imports `generate_workplan_for_project, WorkplanGenerationError` from ner.services.workplan_generator; on WorkplanGenerationError logs warning and returns error dict; otherwise returns `{'project_id': project_id, 'components_created': count}`
- [X] T023 [US2] Add workplan views to ner/views.py — `WorkplanView` (GET returns `{project, generated: bool, components: [...]}` using WorkplanComponentSerializer nested tasks); `WorkplanStatusView` (GET returns `{generated, section_6_complete, component_count, task_count}`); `WorkplanGenerateView` (POST checks Section 6 status, returns 400 `{error: 'section_6_incomplete'}` if not done, else calls `generate_workplan_task.delay(str(project.id))` and returns 202)
- [X] T024 [US2] Add workplan URL patterns to ner/urls.py — `projects/<uuid:id>/workplan/`, `projects/<uuid:id>/workplan/status/`, `projects/<uuid:id>/workplan/generate/`
- [X] T025 [P] [US2] Create frontend/src/components/WorkplanAccordion.tsx — props: `components: WorkplanComponentResponse[]`; renders one collapsible panel per component using `<details open>` or custom state; panel header shows component title + chevron icon; inside: `<table>` with columns Task · Owner · Timeline · KPIs (col widths: 40%/20%/20%/20%); clicking a `<tr>` toggles inline expansion below the row showing full task_description and dependencies in a `<div>` with grey/muted background; if task has related_entity show a small coloured entity badge `<button>` calling onEntityClick; add skeleton shimmer rows while loading; add TypeScript interfaces `WorkplanTaskResponse, WorkplanComponentResponse, WorkplanResponse` and API functions `getProjectWorkplan(), getProjectWorkplanStatus(), generateProjectWorkplan()` to frontend/src/lib/api.ts
- [X] T026 [US2] Add Workplan tab to frontend/pages/projects/[id]/report.tsx — insert as second-to-last tab before Export in the tab bar; tab content: page header "Stakeholder Engagement Workplan" + initiative title as subtitle; "Generate workplan" primary button (disabled + tooltip "Complete Section 6 (Stakeholder Engagement Strategies) first." if section_6_complete=false, links to /smq anchor); amber notice if Section 6 complete but no workplan yet; amber warning banner at top if Section 6 status is stale; renders WorkplanAccordion with skeleton while loading; polls GET /workplan/status/ every 3s until generated

**Checkpoint**: Workplan generates and accordion renders with task expansion. Entity badges link to panels. Section 6 incomplete state disables button with correct tooltip.

---

## Phase 5: User Story 3 — Stepwise Workflow UI (Priority: P3)

**Goal**: Persistent 7-step workflow stepper on every project page guides analysts to the next action.

**Independent Test**: Open any project page — stepper banner visible below project header with 7 labelled steps. First incomplete step pulses. Clicking any step navigates to correct URL. Mobile collapse to single-line works.

### Implementation for User Story 3

- [X] T027 [US3] Add `WorkflowStatusView` to ingestion/views.py — GET `/api/v1/projects/{id}/workflow/`: calls `project.get_workflow_status()` and returns the result; requires project ownership check; add `WorkflowStatusSerializer` (or return dict directly) with fields: current_step, steps (list of {number, label, complete, url})
- [X] T028 [P] [US3] Add workflow URL pattern to ingestion/urls.py — `path('projects/<uuid:id>/workflow/', WorkflowStatusView.as_view())`; also add TypeScript interface `WorkflowStatus` and API function `getProjectWorkflow(projectId)` to frontend/src/lib/api.ts
- [X] T029 [US3] Create frontend/src/components/WorkflowStepper.tsx — props: `workflow: WorkflowStatus`; renders horizontal `<nav>` flex row of 7 steps connected by `<div>` lines (1px, solid teal for complete transitions, dashed grey for incomplete); each step is a `<button>` navigating to step.url: 28px circle with step number or `<CheckIcon>` for complete, 11px label beneath; completed = solid teal fill + white check; active (first incomplete) = accent colour fill + white text + `@keyframes pulse-glow` animation (box-shadow 0→teal→0); future = light grey border + muted text; on mobile `< 768px` (via CSS media query or `useWindowSize`) collapse to `"Step X of 7 — [label]"` single line with `<ChevronLeftIcon>` and `<ChevronRightIcon>` buttons that update active display step; banner has subtle background tint (e.g. bg-muted/30)
- [X] T030 [P] [US3] Create frontend/src/components/NextStepCard.tsx — props: `step: { label, description, url }`; renders full-width card with 4px left border in teal, step label in medium font weight, one-line description in muted text, primary "Go to [label]" button linking to url; not rendered on Export tab (caller passes `showNextStep={!isExportTab}`)
- [X] T031 [US3] Integrate WorkflowStepper and NextStepCard into the project page layout — locate the layout component used by all project sub-pages (check frontend/src/components/layout/ or frontend/pages/projects/[id]/_layout.tsx or equivalent); add `useEffect` to fetch `getProjectWorkflow(projectId)` on mount; render `<WorkflowStepper workflow={...} />` immediately below the project name/header bar and above the page content; render `<NextStepCard />` at the bottom of the page passing `showNextStep={currentTab !== 'export'}`

**Checkpoint**: Stepper renders on `/projects/{id}`, `/projects/{id}/report`, and `/projects/{id}/smq`. Active step pulses. Clicking navigates. Mobile collapses. No stepper "Next step" card on Export tab.

---

## Phase 6: User Story 4 — Enriched Entity Card with Report Context (Priority: P4)

**Goal**: Entity detail panels show priority rank, persona archetype, and report section references.

**Independent Test**: Entity in priority table, with a persona for its type, mentioned in a complete report section. Open entity detail panel — all 3 enrichment fields visible. Report chip click navigates to correct section. Entity not in table shows correct fallback note.

### Implementation for User Story 4

- [X] T032 [US4] Extend existing entity detail endpoint in ner/views.py — find the view handling `GET /api/v1/projects/{id}/entities/{entity_id}/`; add computation of three new fields: (1) `stakeholder_priority`: query `EngagementNote.objects.filter(project=project, entity_id=entity_id).first()`, extract rank/category/priority/priority_reason/ask_request (map fields from existing EngagementNote model or from priority_table computation); (2) `persona`: query `StakeholderPersona.objects.filter(project=project, entity_type=entity.entity_type).first()`, return `{archetype_label, persona_name}` or null; (3) `appears_in_report_sections`: query `ReportSection.objects.filter(project=project, status='done')` and filter those where `str(entity_id)` appears in `section.citations` JSON array (search chunk_ids or entity references stored there); return list of `{section_number, report_chapter_title}`; add all three as extra fields in the response
- [X] T033 [P] [US4] Update entity detail serializer in ner/serializers.py — add `stakeholder_priority` (dict or null), `persona` (dict or null), `appears_in_report_sections` (list) to the entity detail serializer/response; update frontend/src/lib/api.ts TypeScript interface for entity detail to include these three new optional fields
- [X] T034 [P] [US4] Create frontend/src/components/EntityStakeholderAnalysis.tsx — props: `stakeholderPriority, persona, appearsInReportSections, projectId, hasStakeholderTable: bool`; only renders if at least one prop is non-null/non-empty; renders: subtle `<hr>` divider, "STAKEHOLDER ANALYSIS" heading in small uppercase tracking; if stakeholder_priority: priority badge component (High=teal bg, Medium=amber bg, Low=grey bg) + category text + "#N of M" rank in muted monospace + "Why this priority:" label + priority_reason paragraph + "Recommended ask:" label + ask_request paragraph; if appears_in_report_sections: "Appears in report:" label + teal chip `<button>` per section that calls `router.push('/projects/{id}/report#section-{number}')` on click; if persona: "Representative archetype:" label + archetype_label and persona_name as link to `/projects/{id}/report#personas`; if stakeholder_priority null and hasStakeholderTable: grey note "Not ranked in the top stakeholders."; if !hasStakeholderTable: grey note with link "Generate stakeholder table to see priority analysis →"
- [X] T035 [US4] Integrate EntityStakeholderAnalysis into the existing entity detail side panel and full entity page — locate the entity side panel component (check frontend/src/components/ for EntityPanel, EntitySidePanel, or similar); pass the three new API fields as props to EntityStakeholderAnalysis; render it below the existing stats row; pass `hasStakeholderTable` by checking if any EngagementNote exists for the project (add to existing entity detail API call or check priority table state)

**Checkpoint**: Open entity detail panel for a ranked entity — all 3 enrichment sections visible. Click a report chip — navigates to report page. Entity not in table shows "Not ranked" note. Project with no table shows link note.

---

## Phase 7: User Story 5 — Incremental Report Staleness (Priority: P5)

**Goal**: Analysts see amber staleness banners when new documents are added after report generation.

**Independent Test**: Project with 2 complete report sections. Process a new document. Amber toast on documents page. Report page shows amber notice bar + per-section stale banners. "Keep current version" resets to done. "Regenerate this section" triggers generation.

### Implementation for User Story 5

- [X] T036 [US5] Add `ReportStalenessView` to ner/views.py — GET `/api/v1/projects/{id}/report/staleness/`: query stale sections (`ReportSection.objects.filter(project=project, status='stale').values_list('section__section_number', flat=True)`), get `project.stakeholder_table_stale`, count new entities created after the oldest stale section `generated_at` (query `Entity` rows linked to project NERRuns with created_at > min stale section generated_at); return `{stale_sections: list[int], stakeholder_table_stale: bool, new_entity_count: int}`; add API function `getReportStaleness(projectId)` and TypeScript interface to frontend/src/lib/api.ts
- [X] T037 [P] [US5] Add `ReportSectionKeepView` to ner/views.py — PATCH `/api/v1/projects/{id}/report/{section_id}/keep/`: get ReportSection, validate status='stale' (return 400 `{error: 'not_stale'}` if not), set status='done', save; return `{status: 'done', section_id}`; add API function `keepReportSectionCurrent(projectId, sectionId)` to frontend/src/lib/api.ts
- [X] T038 [P] [US5] Add `StakeholderTableKeepCurrentView` to ner/views.py — POST `/api/v1/projects/{id}/stakeholders/priority/keep-current/`: set `project.stakeholder_table_stale = False`, save, return `{status: 'ok', stakeholder_table_stale: false}`; add API function `keepStakeholderTableCurrent(projectId)` to frontend/src/lib/api.ts
- [X] T039 [US5] Add URL patterns to ner/urls.py — `projects/<uuid:id>/report/staleness/`, `projects/<uuid:id>/report/<uuid:section_id>/keep/`, `projects/<uuid:id>/stakeholders/priority/keep-current/`
- [X] T040 [P] [US5] Create frontend/src/components/StalenessNotice.tsx — reusable amber banner component; props: `title: string, onRegenerate: () => void, onKeepCurrent: () => void, isRegenerating?: bool`; renders: amber background strip with warning icon, title text, "Regenerate this section" primary button (disabled + spinner if isRegenerating), "Keep current version" ghost button; use existing amber/warning colour tokens from design system
- [X] T041 [US5] Integrate staleness UI into frontend/pages/projects/[id]/report.tsx — (1) on mount and after document upload events, call `getReportStaleness(projectId)` and store stale state; (2) show page-level amber notice bar at top of report page if `stale_sections.length > 0`: "Some sections were generated before new documents were added. [Regenerate all stale sections →]" — clicking regenerates each stale section sequentially via existing generate endpoint; (3) for each section card where `section.status === 'stale'`, render `<StalenessNotice>` above the section content with `onRegenerate` calling the existing regenerate endpoint and `onKeepCurrent` calling `keepReportSectionCurrent`
- [X] T042 [US5] Integrate staleness banner on frontend/pages/projects/[id]/stakeholders.tsx — fetch `getReportStaleness(projectId)` on mount; if `stakeholder_table_stale === true` show `<StalenessNotice title="Stakeholder table was generated before new documents were added." onRegenerate={() => triggerGenerateNotes()} onKeepCurrent={() => keepStakeholderTableCurrent(projectId)} />` at the top of the page, above the StakeholderPriorityTable component
- [X] T043 [US5] Add dismissible amber toast to frontend/pages/projects/[id]/documents.tsx — after a successful document processing response, check if `stale_sections.length > 0` via a call to `getReportStaleness(projectId)`; if true, show a toast notification (use existing toast/notification system in the project) at bottom-right: "Your report was generated before this document was added. View report →" with a link to `/projects/{id}/report`; toast is dismissible by the user; only show once per document processing event

**Checkpoint**: Process a new document — toast appears on documents page. Navigate to report page — amber notice bar + stale banners visible on completed sections. "Keep current version" clears the banner. Stakeholder table page shows banner when stale.

---

## Phase 8: User Story 6 — Full Report Export PDF and DOCX (Priority: P6)

**Goal**: Analysts can download a complete branded PDF or DOCX stakeholder report with cover, TOC, sections, and appendices.

**Independent Test**: Project with 4 complete report sections, priority table, personas. GET `/api/v1/projects/{id}/report/export/?format=pdf` → PDF downloads within 15 seconds. Open PDF — cover page, TOC, 4 prose sections, Appendix A, Appendix B present. Navy headings, teal accents.

### Implementation for User Story 6

- [X] T044 [US6] Create ner/services/report_export.py — implement three functions: (1) `get_export_status(project) -> dict`: query ReportSection for complete sections count (status='done'), check EngagementNote exists (has_stakeholder_table), check StakeholderPersona exists (has_personas), return `{can_export: bool, complete_sections: int, total_sections: 8, has_stakeholder_table: bool, has_personas: bool, section_statuses: list}`; (2) `generate_pdf_report(project) -> bytes`: use `pdf_utils.resolve_pdf_fonts()` and `pdf_utils.pdf_safe()` from ner.services.pdf_utils; build ReportLab PDF with: cover page (initiative_name, host_organization, geography as country, date in navy text), TOC listing all 8 section titles + Appendix A + Appendix B, each complete ReportSection rendered as paragraphs (split generated_text on `\n\n`; lines starting `##` or `**` become teal subheadings; lines starting `-` or `•` become bullets; plain text as body paragraphs), Appendix A as ReportLab Table with columns No./Name/Category/Priority/Ask from EngagementNote rows sorted by rank, Appendix B as persona entries (persona_name + archetype heading in teal, demographics paragraph, motivations bullet list, frustrations bullet list); use navy (#0D1B3E) for H1 section headings and teal (#007A87) for H2 subheadings and table header row fill, alternating white/#F5F9FA for table rows; return `buffer.getvalue()`; (3) `generate_docx_report(project) -> bytes`: equivalent structure using python-docx `Document()` — set heading styles to navy/teal via paragraph format XML; return `BytesIO` buffer
- [X] T045 [P] [US6] Add `ReportExportStatusView` to ner/views.py — GET `/api/v1/projects/{id}/report/export/status/`: calls `get_export_status(project)` and returns the dict; add API function `getReportExportStatus(projectId)` and TypeScript interface `ReportExportStatus { can_export, complete_sections, total_sections, has_stakeholder_table, has_personas, section_statuses }` to frontend/src/lib/api.ts
- [X] T046 [US6] Add `ReportExportView` to ner/views.py — GET `/api/v1/projects/{id}/report/export/?format=pdf|docx`: validates `format` query param (400 if missing/invalid); calls `get_export_status(project)` and returns 400 `{error: 'no_complete_sections'}` if `can_export === False`; for pdf calls `generate_pdf_report(project)` and returns `HttpResponse(content_type='application/pdf', ...)` with Content-Disposition `attachment; filename="{safe_name}_stakeholder_analysis.pdf"` where safe_name = re.sub(r'[^\w\-_]', '_', initiative_name); for docx same pattern with correct MIME type
- [X] T047 [US6] Add export URL patterns to ner/urls.py — `projects/<uuid:id>/report/export/` (for GET with format param), `projects/<uuid:id>/report/export/status/`; add API functions `downloadReportPdf(projectId)` and `downloadReportDocx(projectId)` (using `fetch` + `URL.createObjectURL` + anchor click pattern for file download) to frontend/src/lib/api.ts
- [X] T048 [P] [US6] Create frontend/src/components/ExportTab.tsx — props: `projectId: string`; on mount calls `getReportExportStatus(projectId)`; renders: readiness checklist card with heading "Your report is ready to export" (if can_export) or "Complete these steps before exporting" (if not); checklist rows for each of 8 report sections (teal checkmark or grey × based on status='done'), stakeholder table row, personas row; incomplete rows are clickable links to the relevant page; summary line "Report includes: cover page, table of contents, [N] of 8 analysis sections[, stakeholder priority table][, stakeholder personas]." in muted text; two large download buttons side by side (stacked on mobile): "Download PDF report" primary button (PDF icon + text) and "Download Word document" ghost button (DOCX icon + text); buttons call downloadReportPdf/downloadReportDocx and show spinner + "Generating…" text while fetching; both disabled with tooltip "Complete at least one report section to export" if can_export===false; small monospace note below explaining formats
- [X] T049 [US6] Add Export tab as the last tab on frontend/pages/projects/[id]/report.tsx tab bar — renders ExportTab component when active; tab label "Export"; confirm Workplan tab is second-to-last

**Checkpoint**: Navigate to Export tab — checklist shows correct section statuses. Click "Download PDF report" — PDF downloads within 15s. Open PDF — cover page visible, navy headings, teal accents, Appendix A and B present. DOCX downloads with equivalent structure.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Backend tests and regression verification.

- [X] T050 [P] Write backend tests for StakeholderPersona and persona_generator in ner/tests/test_personas.py — test: generate_personas_for_project creates one persona per type with ≥3 entities; types with <3 entities are skipped; existing personas deleted on regeneration; _generate_single_persona returns None on JSON parse failure; PersonaListView returns 200 with correct schema; PersonaGenerateView returns 202; mock _call_provider with valid JSON response
- [X] T051 [P] Write backend tests for workplan_generator in ner/tests/test_workplan.py — test: generate_workplan_for_project raises WorkplanGenerationError when Section 6 not complete; creates correct component/task structure from mocked LLM response; related_entity linked by case-insensitive name match; existing workplan deleted on regeneration; WorkplanGenerateView returns 400 when Section 6 incomplete; mock _call_provider
- [X] T052 [P] Write backend tests for report_staleness in ner/tests/test_staleness.py — test: flag_stale_report_sections sets status='stale' on done sections only (not pending/generating/error); sets project.stakeholder_table_stale=True; returns correct count; ReportSectionKeepView sets status='done' without changing generated_text; returns 400 if section not stale; StakeholderTableKeepCurrentView sets stakeholder_table_stale=False; ReportStalenessView returns correct section numbers and new_entity_count
- [X] T053 [P] Write backend tests for report_export in ner/tests/test_export.py — test: get_export_status returns correct can_export True/False; complete_sections count matches done ReportSections; generate_pdf_report returns bytes (non-empty); generate_docx_report returns bytes; ReportExportView returns 400 when no complete sections; returns 200 with correct Content-Type and Content-Disposition for both formats; mock PDF/DOCX generation to avoid ReportLab/python-docx in test assertions
- [X] T054 [P] Write backend tests for workflow status in ingestion/tests/test_workflow.py — test: Project.get_workflow_status() returns step 1 complete when initiative_name non-empty; step 2 complete when Document processed; step 5 complete when ReportSection status='done' exists; WorkflowStatusView returns 200 with current_step and steps list; step URLs are correct
- [X] T055 Run full backend test suite — `docker compose run --rm app pytest --tb=short` — confirm all new and existing tests pass
- [X] T056 Verify regression scenarios from quickstart.md — manually verify: existing report generation (US-013) still works; entity detail panel still shows existing fields; SMQ save/load still works; stakeholder priority table loads and CSV exports; extraction still works and staleness flag fires; light/dark mode on all new components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001/T002 in parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1 Personas)**: Depends on Phase 2
- **Phase 4 (US2 Workplan)**: Depends on Phase 2
- **Phase 5 (US3 Workflow)**: Depends on Phase 2
- **Phase 6 (US4 Entity Enrichment)**: Depends on Phase 2 + US1 (needs StakeholderPersona) + US6-priority-table data
- **Phase 7 (US5 Staleness)**: Depends on Phase 2 (ReportSection STATUS_STALE already added in foundational)
- **Phase 8 (US6 Export)**: Depends on Phase 2 + US1 (needs StakeholderPersona) + US5 (staleness affects export status)
- **Phase 9 (Polish)**: Depends on all user stories complete

### Recommended Implementation Order

Per the plan.md implementation strategy (MVP first, foundation first):

1. **Phase 1 + 2** → Foundation + staleness infrastructure (hook in Phase 2)
2. **Phase 7 (US5)** → Staleness UI (only needs Phase 2; high value, low LLM risk)
3. **Phase 5 (US3)** → Workflow stepper (no LLM; improves UX for all subsequent work)
4. **Phase 3 (US1)** → Personas (Celery + LLM)
5. **Phase 4 (US2)** → Workplan (Celery + LLM)
6. **Phase 6 (US4)** → Entity enrichment (aggregates data from all prior stories)
7. **Phase 8 (US6)** → Export (most data-dependent)
8. **Phase 9** → Tests + regression

### Within-Story Parallel Opportunities

- **US1**: T010 (migration) + T011 (serializer) + T016 (frontend PersonaCard) in parallel after T009 (model)
- **US2**: T019 (migration) + T020 (serializers) + T025 (frontend accordion) in parallel after T018 (models)
- **US3**: T028 (URL) + T029 (WorkflowStepper) + T030 (NextStepCard) in parallel after T027 (view)
- **US4**: T033 (serializer update) + T034 (EntityStakeholderAnalysis) in parallel after T032 (view extension)
- **US5**: T037 (keep view) + T038 (table keep view) + T040 (StalenessNotice) in parallel after T036 (staleness view)
- **US6**: T045 (status view) + T048 (ExportTab) in parallel after T044 (export service)
- **Phase 9**: T050–T054 all in parallel

---

## Implementation Strategy

### MVP First (Phase 2 + US5 + US3 only — 12 tasks)

1. Complete Phase 1 (T001–T002)
2. Complete Phase 2 (T003–T008) — verify existing tests pass
3. Complete Phase 7/US5 (T036–T043) — staleness UX visible immediately
4. Complete Phase 5/US3 (T027–T031) — workflow stepper visible on all pages
5. **STOP**: Demo — analysts see staleness warnings and workflow guidance

### Incremental Delivery

1. Phase 1 + 2 + US5 + US3 → Foundation + UX guidance
2. US1 (Personas) → First AI output visible on report page
3. US2 (Workplan) → Workplan tab functional
4. US4 (Entity Enrichment) → Entity panels enriched with all outputs
5. US6 (Export) → Full download capability — completes the workflow

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All LLM calls must be mocked in tests via `unittest.mock.patch('ner.services.nl_query._call_provider')`
- Commit after each checkpoint to preserve working state
- Stop at any checkpoint to validate the story independently before proceeding
