# Feature Specification: Stakeholder Personas + Workplan + Stepwise Workflow + Enriched Entity Cards + Report Staleness + PDF and DOCX Export

**Feature Branch**: `014-personas-workplan-export`
**Created**: 2026-04-03
**Status**: Draft
**Spec**: US-014

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Stakeholder Personas (Priority: P1)

An analyst with an extracted project and at least one complete report section wants to understand the archetypal profiles of each stakeholder category. They navigate to the Report page and scroll to the "Stakeholder Personas" section at the bottom. They click "Generate personas." Within seconds, persona cards appear — one per entity type that has enough data — each showing a named archetype, demographics, motivations, and frustrations. Representative entity names at the bottom of each card are clickable links to those entity detail panels.

**Why this priority**: Personas are the most novel standalone deliverable in this feature set. They transform raw entity lists into human-readable archetypes that analysts can include directly in reports and briefing documents, delivering immediate value without depending on the workplan or export features.

**Independent Test**: Project with 10+ extracted entities across 3 entity types. Click "Generate personas." Within 30 seconds, cards appear for entity types with ≥3 entities, each with non-empty name, archetype, demographics, 3 motivations, and 3 frustrations. Entity types with <3 entities show an insufficient-data note instead.

**Acceptance Scenarios**:

1. **Given** a project with 5 Organization entities, 4 Person entities, and 2 Government entities, **When** the analyst clicks "Generate personas," **Then** cards appear for Organization and Person, and the Government section shows "Not enough data to generate a persona for this stakeholder type."
2. **Given** a project with no extracted entities, **When** the analyst clicks "Generate personas," **Then** all sections show the insufficient-data note and no persona cards are generated.
3. **Given** personas already exist for a project, **When** the analyst clicks "Generate personas" again, **Then** the existing personas are replaced with freshly generated ones.
4. **Given** personas have been generated, **When** the analyst clicks a representative entity name link, **Then** the entity detail side panel opens for that entity.
5. **Given** persona generation is in progress, **When** the page is visible, **Then** skeleton cards with animated shimmer appear in the same grid layout as the final cards.

---

### User Story 2 — Workplan Generation (Priority: P2)

An analyst who has completed SMQ Section 6 ("Develop Stakeholder Engagement Strategies") navigates to the Workplan tab on the report page. The "Generate workplan" button is active. They click it and within 30 seconds a grouped accordion appears with 4–7 thematic components, each containing a table of tasks with owners, timelines, and KPIs. Clicking a task row expands an inline block with full description and dependencies. Tasks referencing known stakeholders show colour-coded entity badges linking to their detail panels.

**Why this priority**: The workplan is a primary deliverable for UNDP program teams. It converts SMQ analysis directly into an actionable engagement plan. It depends only on Section 6 completion, making it achievable earlier than the full PDF export.

**Independent Test**: Project with SMQ Section 6 marked complete. Click "Generate workplan." Within 30 seconds, at least 4 accordion panels appear, each with at least 2 task rows. Clicking a task row expands it to show full task_description and dependencies. The Workplan tab is accessible as the second-to-last tab on the report page tab bar.

**Acceptance Scenarios**:

1. **Given** SMQ Section 6 is not yet complete, **When** the analyst opens the Workplan tab, **Then** the "Generate workplan" button is disabled with a tooltip "Complete Section 6 (Stakeholder Engagement Strategies) first." and a link to that section.
2. **Given** SMQ Section 6 is complete, **When** the analyst clicks "Generate workplan," **Then** 4–7 accordion components appear, each with 2–4 task rows, within 30 seconds.
3. **Given** a workplan task references a known entity name, **When** the task row is expanded, **Then** a colour-coded entity badge is visible and clicking it opens the entity detail panel.
4. **Given** Section 6 status changes to stale after workplan generation, **When** the analyst opens the Workplan tab, **Then** an amber warning banner appears noting that Section 6 data may be outdated.
5. **Given** the workplan is being generated, **When** the page is visible, **Then** skeleton accordion panels with shimmer rows appear in place of the real content.

---

### User Story 3 — Stepwise Workflow UI (Priority: P3)

An analyst working on a new project sees a persistent horizontal stepper banner on every project page showing 7 clearly labelled steps. Completed steps show a filled teal circle with a checkmark. The current active step (first incomplete) pulses gently to draw attention. All circles are clickable and navigate to the right page. At the bottom of each project page (except Export), a "Next step" card shows the next step label, a one-line description, and a prominent navigation button.

**Why this priority**: The workflow stepper reduces analyst friction and onboarding time. It makes the platform feel guided rather than a collection of disconnected pages, benefiting all project workflows.

**Independent Test**: Open any project page. The stepper banner is visible below the project header. All 7 step labels are present. The first incomplete step has a pulsing accent circle. Clicking any step navigates to the correct URL. On mobile viewports, the stepper collapses to a single-line display with arrow navigation.

**Acceptance Scenarios**:

1. **Given** a project with no initiative profile and no documents, **When** the analyst opens any project page, **Then** Step 1 shows an active pulsing circle and Steps 2–7 show muted grey circles.
2. **Given** a project with documents extracted and report sections complete, **When** the analyst views the stepper, **Then** Steps 1–5 show filled teal checkmarks and Step 6 is the active step.
3. **Given** a mobile viewport under 768px, **When** the project page loads, **Then** the stepper collapses to "Step X of 7 — [label]" with left and right arrow navigation buttons.
4. **Given** the analyst is on the Export tab, **When** the page renders, **Then** the "Next step" card at the bottom of the page is not shown.
5. **Given** all 7 steps are complete, **When** the analyst views the stepper, **Then** all circles show teal checkmarks and no pulsing step is shown.

---

### User Story 4 — Enriched Entity Card with Report Context (Priority: P4)

An analyst clicks on a stakeholder entity in the graph or priority table. In the entity detail panel, below the existing stats row, a new "Stakeholder analysis" section appears — but only when relevant data exists. It shows the entity's priority rank and reasoning, which report sections mention this entity as clickable chips, and the persona archetype linked to this entity's type. If no priority data exists yet, a link invites the analyst to generate the stakeholder table.

**Why this priority**: Enriched entity cards connect all analysis outputs to individual stakeholders, making the platform more actionable. An analyst should click any entity and understand its strategic context without navigating to multiple other pages.

**Independent Test**: Project with a generated priority table, at least one persona, and at least one complete report section mentioning the entity. Click any entity. The "Stakeholder analysis" section shows a priority badge, priority_reason, at least one report section chip, and a persona archetype link. Clicking a chip scrolls the report page to the correct section.

**Acceptance Scenarios**:

1. **Given** an entity in the ranked stakeholder table, **When** the analyst opens its detail panel, **Then** the priority badge (High/Medium/Low), category, rank "#N of M," priority_reason, and ask_request are all visible.
2. **Given** an entity whose type has a generated persona, **When** the analyst views the panel, **Then** the persona archetype label and name appear as a link to the personas section of the report page.
3. **Given** an entity mentioned in a complete report section, **When** the analyst views the panel, **Then** that section's title appears as a teal chip, and clicking it navigates to the report page scrolled to that section.
4. **Given** an entity not in the priority table but the table has been generated, **When** the analyst views the panel, **Then** a grey note says "Not ranked in the top stakeholders."
5. **Given** the priority table has not been generated, **When** the analyst views the panel, **Then** a grey note with a link "Generate stakeholder table to see priority analysis →" appears.

---

### User Story 5 — Incremental Report Staleness (Priority: P5)

An analyst uploads a new document to a project that already has generated report sections. After processing completes, a dismissible amber toast appears on the documents page. When they visit the report page, an amber notice bar at the top warns that sections are stale. Individual stale section cards show an amber banner with two options: regenerate, or keep the current version. The same staleness pattern applies to the stakeholder table.

**Why this priority**: Without staleness detection, analysts may unknowingly present outdated analysis. This is a correctness and trust feature that depends on the report infrastructure from US-013.

**Independent Test**: Project with at least 2 complete report sections. Upload and process a new document. Amber toast appears on the documents page. Navigate to the report page — the page-level amber bar is visible. At least one section shows a stale banner. "Keep current version" resets the section to complete without content change. "Regenerate this section" enters generating state.

**Acceptance Scenarios**:

1. **Given** a project with generated report sections and a new document is successfully processed, **When** the documents page is visible, **Then** a dismissible amber toast appears with "Your report was generated before this document was added. View report →".
2. **Given** a project with stale report sections, **When** the analyst opens the report page, **Then** an amber notice bar says "Some sections were generated before new documents were added. [Regenerate all stale sections →]."
3. **Given** a stale section, **When** the analyst clicks "Keep current version," **Then** the section status returns to complete and the content is unchanged.
4. **Given** a stale section, **When** the analyst clicks "Regenerate this section," **Then** the section enters generating state and refreshes with new document data included.
5. **Given** the stakeholder table is flagged stale after a new document is processed, **When** the analyst opens the stakeholder table page, **Then** an amber banner with "Regenerate table" and "Keep current version" buttons appears at the top.

---

### User Story 6 — Full Report Export PDF and DOCX (Priority: P6)

An analyst who has completed report sections navigates to the Export tab (last tab on the report page). A readiness checklist shows which of the 8 sections are complete, whether the stakeholder table exists, and whether personas are generated. They click "Download PDF report" — within 15 seconds, a branded PDF downloads with a cover page, table of contents, all complete sections as prose, Appendix A (stakeholder priority table), and Appendix B (personas). A "Download Word document" option produces the same content in DOCX format.

**Why this priority**: Export is the end-product deliverable. All other features in this spec feed into the export. It is last because it requires the most upstream data to be meaningful, but it completes the analyst's workflow.

**Independent Test**: Project with 4 complete report sections, a generated stakeholder table, and personas. Navigate to the Export tab. The checklist shows 4 of 8 sections complete with teal checkmarks. Click "Download PDF report." A PDF downloads within 15 seconds. The PDF has a cover page, TOC, 4 prose sections, Appendix A (stakeholder table), and Appendix B (persona entries).

**Acceptance Scenarios**:

1. **Given** no report sections are complete, **When** the analyst opens the Export tab, **Then** both download buttons are disabled with the tooltip "Complete at least one report section to export."
2. **Given** 6 of 8 sections are complete plus a stakeholder table (no personas), **When** the analyst downloads the PDF, **Then** the file includes cover page, TOC, 6 prose sections, and Appendix A. No Appendix B is present.
3. **Given** the export is being generated, **When** the button is clicked, **Then** a loading spinner and "Generating…" text appear and the button cannot be clicked again until complete.
4. **Given** a PDF is downloaded, **When** the analyst opens it, **Then** section headings use navy colour, subheadings use teal, and the cover page shows initiative title, host organisation, country, and generation date.
5. **Given** both personas and the stakeholder table are generated, **When** the analyst downloads either PDF or DOCX, **Then** Appendix A (priority table) and Appendix B (personas) are both present.

---

### Edge Cases

- Entity type with exactly 3 entities must generate a persona (threshold is inclusive ≥3).
- Workplan generation returning fewer than 4 components from the LLM must display gracefully without error.
- If a PDF font cannot render a unicode character, the system substitutes a safe fallback character rather than failing the entire export.
- Clicking "Regenerate all stale sections" while a section is already regenerating must not create duplicate generation jobs — already-generating sections are skipped.
- A workplan task referencing a stakeholder name with no matching entity is displayed as plain text (no badge) rather than failing.
- Filenames for DOCX/PDF downloads must be sanitised to remove characters invalid in filenames (e.g., `/`, `:`).
- The "Next step" card must not appear on the Export tab even if the Export tab is the current page.
- Persona generation for a type that returns invalid JSON from the LLM must skip that type silently, not fail the entire generation task.
- "Regenerate all stale sections" triggered while no documents are present must return a clear error rather than attempting generation.

---

## Requirements *(mandatory)*

### Functional Requirements

**US-014-01: Stakeholder Personas**

- **FR-001**: The system must allow users to trigger AI generation of stakeholder persona cards grouped by entity type for a given project.
- **FR-002**: Persona generation must only produce a card for entity types with 3 or more extracted entities in the project.
- **FR-003**: Each persona card must include: persona name, archetype label, demographics paragraph, exactly 3 motivations, exactly 3 frustrations, and a "Based on:" list of up to 10 representative entity names as clickable links.
- **FR-004**: Clicking a representative entity name must open that entity's detail side panel.
- **FR-005**: While personas are generating, skeleton cards with animated shimmer must appear in the same grid layout as the final cards.
- **FR-006**: Regenerating personas must replace all existing personas for the project, not append to them.

**US-014-02: Workplan Generation**

- **FR-007**: Workplan generation must be blocked if SMQ Section 6 is not in "complete" status, with a clear error message and a link to Section 6.
- **FR-008**: A generated workplan must contain 4–7 components each with 2–4 tasks, where each task has: description, suggested owner, timeline, KPIs, and dependencies.
- **FR-009**: Tasks referencing a stakeholder name matching an extracted entity must display a colour-coded entity badge linking to that entity's detail panel.
- **FR-010**: The workplan UI must render as a grouped accordion with one collapsible panel per component, expanded by default on first load.
- **FR-011**: Clicking a task row must expand it inline to show full task description and dependencies on a grey background.
- **FR-012**: The Workplan tab must appear as the second-to-last tab on the report page tab bar (before the Export tab).

**US-014-03: Stepwise Workflow UI**

- **FR-013**: A persistent 7-step workflow stepper banner must appear on every project page below the project header.
- **FR-014**: Step completion must be computed dynamically using: Step 1 (initiative profile non-empty), Step 2 (any document processed), Step 3 & 4 (any entity extracted), Step 5 (any report section complete), Step 6 (stakeholder table generated), Step 7 (export file generated).
- **FR-015**: The first incomplete step must show an accent-coloured circle with a pulsing glow animation.
- **FR-016**: All step circles must be clickable and navigate to the corresponding project sub-page.
- **FR-017**: On viewports narrower than 768px the stepper must collapse to "Step X of 7 — [label]" with left/right arrow navigation.
- **FR-018**: Every project page except the Export tab must show a "Next step" card at the bottom with the next incomplete step label, a one-line description, and a navigation button.

**US-014-04: Enriched Entity Card**

- **FR-019**: The entity detail panel and full entity page must include a "Stakeholder analysis" section that only renders when at least one of: priority data, persona, or report section references is non-empty.
- **FR-020**: The priority display must show badge (High/Medium/Low), category, rank, priority_reason, and ask_request for entities in the priority table.
- **FR-021**: Report section chips must be clickable and navigate to the report page scrolled to the relevant section.
- **FR-022**: If the entity's type has a generated persona, a link to the personas section of the report page must appear.

**US-014-05: Report Staleness**

- **FR-023**: When a new document is successfully processed, all complete report sections for the project must be marked stale and the stakeholder table must be flagged stale.
- **FR-024**: A dismissible amber toast must appear on the documents page when stale-able content exists and a document is processed.
- **FR-025**: The report page must show a page-level amber notice bar when any sections are stale, with a "Regenerate all stale sections" action.
- **FR-026**: Each stale section card must show an amber banner with "Regenerate this section" and "Keep current version" buttons.
- **FR-027**: "Keep current version" must transition the section status from stale to complete without modifying the section content.
- **FR-028**: The stakeholder table page must show the same amber banner pattern when stakeholder_table_stale is true.

**US-014-06: Full Report Export**

- **FR-029**: Exported documents must include: cover page (initiative title, host organisation, country, generation date), table of contents, all complete report sections as prose, Appendix A (priority table), Appendix B (personas).
- **FR-030**: Only sections in "complete" status must be included in the export body; stale, pending, or error sections are excluded.
- **FR-031**: Appendix A must render the priority table with columns: No., Name, Category, Priority, Ask/Request.
- **FR-032**: Appendix B must render each persona with name, archetype heading, demographics, motivations list, and frustrations list.
- **FR-033**: PDF exports must use navy (#0D1B3E) for section headings, teal (#007A87) for subheadings and table header rows, with alternating row shading.
- **FR-034**: Both PDF and DOCX export formats must be available; the Export tab must be the last tab on the report page tab bar.
- **FR-035**: Both export buttons must be disabled (with tooltip) if no sections are in "complete" status.
- **FR-036**: The export readiness checklist must accurately reflect the completion status of all 8 report sections, the stakeholder table, and personas.

### Key Entities

- **StakeholderPersona**: One per entity type per project. Stores archetype data — persona name, archetype label, demographics text, motivations list (3 items), frustrations list (3 items), representative entity names list. Linked to project and entity type.
- **WorkplanComponent**: A thematic grouping in a project workplan. Has project link, ordering position, title, and generation timestamp.
- **WorkplanTask**: One actionable item within a component. Has task description, suggested owner, timeline, KPIs text, dependencies text, ordering position, and an optional link to an extracted entity.
- **WorkflowStep** (computed, not persisted): A real-time status structure for each of the 7 steps — label, complete flag, and target URL.
- **ReportStaleness** (computed): Describes which sections are stale, whether the stakeholder table is stale, and how many new entities have appeared since the oldest stale section was generated.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Stakeholder persona generation completes within 30 seconds for a project with up to 50 entities across 5 entity types.
- **SC-002**: Workplan generation completes within 30 seconds and produces 4–7 components each with 2–4 tasks.
- **SC-003**: PDF and DOCX export files download within 15 seconds for a project with all 8 sections complete.
- **SC-004**: The 7-step workflow stepper accurately reflects project completion state on every page load without requiring manual refresh.
- **SC-005**: After a new document is processed, all stale section banners appear within one page load — no stale content is silently presented.
- **SC-006**: An analyst can navigate from any entity detail panel to the relevant report section, persona card, or priority table row in at most 2 clicks.
- **SC-007**: The export readiness checklist accurately reflects the current state of all 8 sections, the stakeholder table, and personas with no false positives or negatives.

---

## Assumptions

- Celery and Redis are already operational from spec 013 — no new queue infrastructure is needed.
- `python-docx` and `reportlab` are already in `requirements.txt` or will be added as part of this spec; no other new Python packages are required.
- The existing LLM abstraction layer can be instructed to return structured JSON output (via `json_mode=True` or equivalent prompt instruction); the service layer will parse and validate the response.
- `StakeholderPriorityEntry` (from spec 013) holds priority rank, category, priority_reason, and ask_request per entity per project.
- The `ProjectSMQ` status field (from spec 013) can be extended to include a "stale" value without a destructive migration.
- The entity detail side panel is a shared component from prior specs and can be extended with additional sections.
- Report section content is stored as a markdown-like text field; the export renderer will parse double-newline paragraphs, `##`/`**` markers as subheadings, and `-`/`•` prefixed lines as bullets.
- The reference documents `docs/UAE-OGB-SA_1.pdf`, `docs/workplan.pdf`, and `docs/first-20-stakeholders.pdf` are available in the repository for format reference.
- Persona cards reuse the existing entity type colour configuration already defined in the frontend label config.
- "Export tab" is a tab within the existing report page tab bar structure, not a separate top-level navigation page.
- `host_organisation` and `country` for the cover page are taken from the `InitiativeProfile` fields added in spec 013 (`thematic_area` and `geography` respectively), as no dedicated `host_organisation` field exists yet — this assumption should be validated during planning.
