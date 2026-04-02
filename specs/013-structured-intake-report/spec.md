# Feature Specification: Structured Initiative Intake + SMQ System + Extraction Guidance + RAG Report Generation + Stakeholder Priority Table

**Feature Branch**: `013-structured-intake-report`
**Created**: 2026-04-02
**Status**: Draft

---

## Overview

This feature replaces the single free-text concept note with a structured initiative profile form, introduces a reusable 8-section Stakeholder Mapping Questionnaire (SMQ) template system, adds a per-project extraction guidance panel, generates section-by-section narrative reports via RAG, and surfaces a scored stakeholder priority table. All five capabilities extend existing infrastructure (pgvector, LLM provider abstraction, joint extraction) — nothing is rebuilt from scratch.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Structured Initiative Intake Form (Priority: P1)

An analyst creates a new project (or edits an existing one) and, instead of typing a single free-text concept note, fills in a structured form covering initiative name, geography, theme, objectives, expected outcomes, and stakeholder focus areas. The completed profile is stored per project and automatically used as the context seed for all subsequent extraction and RAG calls — exactly as the concept note was used before, but with richer, structured context.

**Why this priority**: Every other story (SMQ, extraction guidance, RAG report, priority table) depends on having structured project context. This also directly improves extraction quality by giving the LLM more precise guidance.

**Independent Test**: Create a project, fill in the structured intake form, run extraction on a test document, verify the LLM prompt contains the structured fields and that extraction results reflect the initiative's stated focus area.

**Acceptance Scenarios**:

1. **Given** a new project with no concept note, **When** the user opens the project settings or a dedicated intake page, **Then** a structured form is shown with labeled fields for: initiative name, geography/country context, thematic area, core objectives (text block), expected outcomes (text block), and stakeholder focus description.
2. **Given** a completed intake form, **When** extraction is run on any document in the project, **Then** the LLM system prompt includes all structured fields in a formatted context block equivalent to or richer than the previous concept note.
3. **Given** an existing project that already has a concept note (free text), **When** the user opens the intake page, **Then** the existing concept note is displayed in the "Core Objectives" field as a migration default so no data is lost.
4. **Given** a partially filled intake form (mandatory fields missing), **When** the user tries to save, **Then** validation prevents save and highlights the empty mandatory fields.
5. **Given** a fully saved intake form, **When** the user views the project workspace sidebar, **Then** a summary of the initiative profile (name, theme, geography) is visible without opening the full form.

---

### User Story 2 — SMQ Template System (Priority: P2)

A project owner opens a dedicated "Stakeholder Mapping Questionnaire" tab within their project. They see 8 structured sections drawn from the standard SMQ template (Objectives, Identify Stakeholders, Categorize, Assess Needs, Analyze Impact, Engagement Strategies, Monitor and Evaluate, Iterate and Refine). They answer the questions per-section. Their answers are saved against the project and can be regenerated via AI using existing document chunks as evidence. The SMQ answers also feed the RAG report generation in User Story 4.

**Why this priority**: The SMQ is the core deliverable that UNDP analysts produce. Digitizing it with AI-assisted pre-fill transforms the manual process into a guided, evidence-backed workflow.

**Independent Test**: Open a project, navigate to the SMQ tab, answer sections 1 and 2 manually, save, confirm answers persist. Then use AI pre-fill on section 1 and confirm the generated answer references actual document content.

**Acceptance Scenarios**:

1. **Given** a project with at least one extracted document, **When** the user opens the SMQ tab, **Then** all 8 sections are displayed with their question prompts and an editable text area per section.
2. **Given** a user on any SMQ section, **When** they click "Generate with AI", **Then** the system retrieves relevant document chunks via semantic search and fills that section's answer using the LLM, displaying the response with source citations.
3. **Given** SMQ answers for any section, **When** the user edits the AI-generated text, **Then** the edited version is saved as the canonical answer (AI answer is a starting point, not locked).
4. **Given** a project with no documents yet, **When** the user opens the SMQ tab, **Then** sections are still editable manually and a notice explains that AI generation requires extracted documents.
5. **Given** SMQ answers saved for a project, **When** another session is opened, **Then** all saved answers are loaded and displayed correctly.
6. **Given** a project admin, **When** they manage the global SMQ template from the admin panel, **Then** they can add, edit, or reorder sections and the updated template applies to all new SMQ responses (existing project answers are not changed).

---

### User Story 3 — Extraction Guidance Panel (Priority: P3)

A project owner adds specific extraction guidance items to their project — for example "focus on funding relationships", "ignore references to the general public as a stakeholder", "treat 'the Lab' as UNDP SDG AI Lab". These items are stored per project and automatically injected into the LLM extraction prompt as structured instructions alongside the initiative profile context.

**Why this priority**: Extraction quality is directly tied to how well the LLM understands the analyst's intent. Guidance items give analysts fine-grained control without modifying global configuration.

**Independent Test**: Add two guidance items to a project, run extraction, verify the LLM prompt includes both items as explicit instructions, and compare entity/relation output against a baseline run without guidance.

**Acceptance Scenarios**:

1. **Given** a project workspace, **When** the user opens project settings or a dedicated guidance panel, **Then** they see a list of existing guidance items (empty by default) and an "Add guidance" input.
2. **Given** the user types a guidance instruction and saves it, **When** extraction is next run, **Then** the LLM prompt contains that instruction verbatim in a dedicated guidance block.
3. **Given** multiple guidance items, **When** the user reorders or deletes one, **Then** the change persists and is reflected in the next extraction prompt.
4. **Given** a guidance item that says "treat X as Y", **When** extraction runs on a new document, **Then** canonical entity name Y is used instead of X in the extracted output.
5. **Given** a project with no guidance items, **When** extraction runs, **Then** the prompt contains an empty guidance section and extraction behaves identically to current behaviour.

---

### User Story 4 — Per-Section RAG Report Generation (Priority: P4)

After a project has extracted documents, the user navigates to a "Report" tab within the project. They see the 8 SMQ sections listed. They click "Generate Report" for the whole project or for individual sections. For each section, the system retrieves relevant document chunks via pgvector semantic search, constructs a prompt combining the section's question template, the SMQ answers (if any), the initiative profile, and the retrieved chunks, then calls the configured LLM provider. The generated narrative is displayed per section with source citations. The full report can be exported as PDF or copied as text.

**Why this priority**: Report generation is the highest-value output — it transforms extracted data into a deliverable analysts can send to stakeholders. It depends on US1 (intake), US2 (SMQ), and the existing pgvector + LLM infrastructure.

**Independent Test**: A project with at least 2 extracted documents generates a report for Section 1 (Objectives). The output is a coherent narrative paragraph citing specific document passages. Generation completes within 60 seconds.

**Acceptance Scenarios**:

1. **Given** a project with extracted documents, **When** the user opens the Report tab and clicks "Generate All Sections", **Then** all 8 sections begin generating asynchronously and each section shows a progress indicator.
2. **Given** a section that has finished generating, **When** the user views it, **Then** the narrative text is shown with inline citation markers (e.g. "[Doc 1, p.3]") and a citations list below.
3. **Given** any section report, **When** the user clicks "Regenerate", **Then** the section is re-queued and a fresh generation replaces the previous result.
4. **Given** a fully generated report, **When** the user clicks "Export PDF", **Then** a PDF is downloaded containing all 8 sections with project name, date, and citations formatted for sharing.
5. **Given** a section generation that fails (LLM error or rate limit), **When** the section finishes with an error, **Then** an error state is shown with a retry button and the error message is logged.
6. **Given** a previously cached section result, **When** the underlying document chunks have not changed, **Then** the cached result is returned immediately without a new LLM call (24-hour TTL, invalidated by new extraction).

---

### User Story 5 — Stakeholder Priority Table (Priority: P5)

Within the project workspace (graph page or a dedicated "Stakeholders" sub-tab), the user can view a ranked stakeholder priority table. The table lists extracted entities (filtered to types: Person, Organization, Role, Government) sorted by a computed priority score derived from graph degree and extraction confidence. A secondary LLM call enriches each row with a one-line engagement recommendation grounded in the SMQ section 2 (Identify Stakeholders) and section 6 (Engagement Strategies) answers and top document chunks.

**Why this priority**: The priority table is the most direct actionable output — analysts need to know which 20 stakeholders to engage first. It depends on all prior user stories being in place.

**Independent Test**: A project with 10+ extracted entities shows a ranked table with correct columns (name, type, priority score, engagement note). Scores reflect degree×confidence ranking. The table is filterable by entity type.

**Acceptance Scenarios**:

1. **Given** a project with extracted entities, **When** the user opens the Stakeholders tab or priority table section, **Then** entities of type Person, Organization, Role, and Government are listed sorted by priority score (highest first).
2. **Given** the priority table, **When** the user sees each row, **Then** columns show: rank number, entity name, entity type, mention count, confidence score, graph degree (connection count), priority score, and AI-generated engagement note.
3. **Given** the priority table, **When** the user clicks on any entity row, **Then** the entity side panel opens showing full entity details (reusing the existing panel component).
4. **Given** the priority table, **When** the user applies a type filter (e.g. "Organizations only"), **Then** the table updates without re-fetching and rows are re-ranked within the filtered set.
5. **Given** the user clicks "Generate engagement notes", **When** generation completes, **Then** each row shows a one-line recommendation referencing either an SMQ answer or a source document chunk.
6. **Given** a priority table with generated engagement notes, **When** the user clicks "Export as CSV", **Then** a CSV is downloaded with all columns including the engagement note text.

---

### Edge Cases

- Project with zero extracted entities: intake form and SMQ still work; RAG report shows "no documents extracted yet" per section; priority table shows empty state.
- Project with a very large number of entities (500+): priority table paginates (50 per page) and remains responsive.
- LLM rate limit during batch report generation: queued sections wait with exponential backoff; already-completed sections are not re-run.
- User edits SMQ answer after report is generated: the edited section is marked as "stale" with a "Regenerate" prompt; other sections are not affected.
- Existing projects migrating to structured intake: the current `concept_note` text is preserved in the "Core Objectives" field of the new intake form; all existing extractions remain valid without re-running.
- Admin deletes an SMQ section from the global template: existing project SMQ answers for that section are preserved as an "archived" section, not deleted.
- Export PDF with sections that contain no generated content yet: those sections show a placeholder ("Section not yet generated") in the PDF.
- Celery worker unavailable during report generation request: the API returns an informative error immediately; no silent hang.

---

## Requirements *(mandatory)*

### Functional Requirements

**Initiative Intake**

- **FR-001**: System MUST provide a structured initiative profile form replacing or extending the free-text concept note, with fields for: initiative name, geography, thematic area, core objectives, expected outcomes, and stakeholder focus description.
- **FR-002**: Saving the intake form MUST update the context used by all subsequent LLM calls (extraction, RAG, entity summary, NL query) for that project without requiring re-extraction.
- **FR-003**: Existing projects with a concept note MUST have their concept note migrated into the "Core Objectives" field; no data loss is permitted.
- **FR-004**: The initiative profile MUST be readable via API so that a `get_project_context()` helper can assemble the full context string for any LLM call in the project scope.

**SMQ Template System**

- **FR-005**: System MUST ship a seeded global SMQ template with 8 sections derived from `docs/smq.txt`, including section title and question prompts per section.
- **FR-006**: Each project MUST have its own SMQ response record with one text answer per section, independently editable.
- **FR-007**: Each SMQ section MUST offer an "AI Generate" action that retrieves top-K relevant chunks via pgvector and calls the project's configured LLM provider with a structured prompt.
- **FR-008**: The global SMQ template MUST be manageable by admins (add, edit, reorder sections) from the admin panel; template changes MUST NOT modify existing project answers.

**Extraction Guidance**

- **FR-009**: Project owners MUST be able to add, edit, delete, and reorder free-text extraction guidance items per project.
- **FR-010**: All guidance items for a project MUST be injected verbatim into the extraction prompt in a dedicated guidance block, applied to every extraction run for that project.
- **FR-011**: Guidance items MUST be visible in the project settings page alongside the initiative profile.

**RAG Report Generation**

- **FR-012**: The Report tab MUST display all 8 SMQ sections as independently generatable report sections.
- **FR-013**: Report generation MUST run asynchronously via background tasks; the UI MUST show per-section progress without blocking the user.
- **FR-014**: Each generated section MUST include inline source citations referencing the specific document chunks used.
- **FR-015**: Generated report sections MUST be cached with a 24-hour TTL, invalidated when new documents are extracted for the project.
- **FR-016**: The full report MUST be exportable as PDF with project name, generation date, all 8 sections, and citations formatted for distribution.
- **FR-017**: Section generation MUST use the same LLM provider configured for the project (from US-011 per-project provider setting).

**Stakeholder Priority Table**

- **FR-018**: The priority table MUST compute a priority score for each entity as a function of graph degree and average extraction confidence, and display entities ranked highest-first.
- **FR-019**: The table MUST be filterable by entity type without a page reload.
- **FR-020**: The table MUST be exportable as CSV including all columns.
- **FR-021**: "Generate engagement notes" MUST trigger a background LLM call per entity (or batched) that grounds recommendations in SMQ section 2/6 answers and top document chunks.
- **FR-022**: Clicking any entity row MUST open the existing entity side panel.

### Key Entities

- **InitiativeProfile**: One-to-one with Project. Fields: initiative_name, geography, thematic_area, core_objectives (text), expected_outcomes (text), stakeholder_focus (text). Replaces/extends the `concept_note` field on the Project model. Has a `to_concept_note()` method that serializes all fields into a formatted string for LLM consumption.
- **SMQTemplate**: Global template record. Fields: title, description, is_active. Has ordered child sections.
- **SMQSection**: Child of SMQTemplate. Fields: section_number (1–8), title, question_prompts (text block), order.
- **ProjectSMQResponse**: One-to-one with Project. Parent container for all section answers for a project.
- **ProjectSMQAnswer**: Child of ProjectSMQResponse. Fields: section (FK to SMQSection), answer_text, ai_generated (bool), last_generated_at, chunk_ids_used (array).
- **ExtractionGuidance**: Per-project ordered list. Fields: project (FK), text, order, created_at.
- **ReportSection**: Child of Project (or ProjectSMQResponse). Fields: section (FK to SMQSection), generated_text, citations (JSON), status (pending/generating/done/error), generated_at, cache_key.
- **StakeholderPriorityEntry**: Computed/cached per-project ranking. Fields: entity (FK), priority_score (float), rank, engagement_note (text), generated_at.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An analyst can complete the structured intake form for a new project in under 5 minutes and immediately see improved extraction relevance without any code changes.
- **SC-002**: All 8 SMQ sections can be AI-generated for a project with 5+ extracted documents in under 3 minutes total end-to-end (background processing included).
- **SC-003**: A full 8-section PDF report is exported and opens correctly within 10 seconds of the user clicking "Export PDF".
- **SC-004**: The stakeholder priority table for a project with up to 200 entities loads and renders in under 2 seconds.
- **SC-005**: Extraction guidance items are correctly reflected in extraction output — entities or relationships explicitly excluded by guidance items do not appear in results for 90%+ of test cases.
- **SC-006**: Zero data loss during migration — all existing projects with concept notes retain their full concept note text accessible from the intake form after deployment.
- **SC-007**: Section report cache is correctly invalidated after new extraction — re-opening a cached section after a new extraction always shows a "stale" indicator prompting regeneration.

---

## Assumptions

- Celery + Redis will be added as new infrastructure for async report generation. Redis is not currently in the stack. Docker Compose will be updated to include a Redis service and a Celery worker service.
- The `docs/smq.txt` file will be committed to the repository and used as the seed data for the SMQ template migration. The 8 sections and their question prompts are taken directly from that file.
- The existing `concept_note` field on the Project model is kept for backwards compatibility during the migration period. The `get_project_context()` helper reads `InitiativeProfile` if it exists, otherwise falls back to `project.concept_note`.
- Per-project LLM provider selection (US-011, Issue 25) is already implemented and available. All LLM calls in this feature use the project's configured provider.
- pgvector semantic search infrastructure (US-011, Issue 10) is already implemented and available. No changes needed to the embedding or retrieval layer.
- PDF export uses the existing ReportLab/WeasyPrint setup already used in the NER report feature. If that does not exist, a new lightweight PDF renderer will be added.
- Priority score formula: `priority_score = degree × avg_confidence`, where degree is the number of direct relationships in the project graph and avg_confidence is the mean extraction confidence across all mentions. This formula is fixed for this sprint and can be made configurable later.
- Engagement note generation is triggered on-demand (not automatically on extraction) to avoid unexpected LLM costs.
