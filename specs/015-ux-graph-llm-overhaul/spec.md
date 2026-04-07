# Feature Specification: UX, Graph, Workflow, and Ingestion Reliability Overhaul

**Feature Branch**: `015-ux-graph-llm-overhaul`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "US-015 multi-story frontend and backend reliability/UX package"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Readable Visual System (Priority: P1)

As an analyst, I need all text in the application to remain readable against its immediate background so I can reliably interpret data, controls, and status indicators.

**Why this priority**: If text is unreadable, core workflows fail even when data and logic are correct.

**Independent Test**: Audit all specified UI areas in both themes and confirm no text is invisible/low-contrast and no label/body text is below minimum readable size.

**Acceptance Scenarios**:

1. **Given** any audited page area, **When** the page renders, **Then** text color contrasts with its direct container background and remains readable.
2. **Given** label/body text in audited components, **When** displayed, **Then** effective font size is at least 12px.
3. **Given** graph edge labels, **When** edges overlap or cross mixed backgrounds, **Then** labels remain legible due to minimum size and background fill.

---

### User Story 2 - Modern Interactive Graph Experience (Priority: P1)

As an analyst, I need a highly legible, stable, and interactive force graph that preserves all existing graph workflows while improving clarity and reducing overlap.

**Why this priority**: Graph exploration is a central analysis activity and must remain fully functional during migration.

**Independent Test**: Open the graph with realistic project data and verify parity for all prior interactions plus improved readability and isolated-node controls.

**Acceptance Scenarios**:

1. **Given** graph data is loaded, **When** the graph renders, **Then** all prior interactions (zoom/pan, node click panel, hover neighborhood emphasis, fit, focus mode, filter wiring, NL-query highlighting, minimap) function as before.
2. **Given** dense graph data, **When** initial render completes, **Then** nodes and edge labels are readable without visible first-load settling animation.
3. **Given** isolated nodes exist in current filters, **When** the user toggles isolated-node visibility or flags them, **Then** graph and entity list states reflect those actions consistently.

---

### User Story 3 - Correct Stepwise Workflow Guidance (Priority: P1)

As a user moving through project setup and analysis, I need the workflow stepper and next-step card to always point to the correct actionable step and valid route.

**Why this priority**: Incorrect navigation and hardcoded guidance causes dead ends and user confusion.

**Independent Test**: Navigate each project page state and verify the next-step card/stepper show correct next action, dynamic text, and valid map route.

**Acceptance Scenarios**:

1. **Given** a project page, **When** workflow status is fetched, **Then** next-step guidance reflects the next incomplete step for that page context.
2. **Given** step 4 is selected, **When** navigation occurs, **Then** it lands on the existing map/graph page (no 404).
3. **Given** the documents page before and after extraction, **When** status changes, **Then** next action changes from running extraction to reviewing the graph.

---

### User Story 4 - Friendly LLM Failures and Resumable Stakeholder Table (Priority: P1)

As a user running AI-powered actions, I need contextual, actionable error messages and resumable generation behavior rather than generic failures.

**Why this priority**: AI provider limits and intermittent failures are expected and must not break user trust or workflows.

**Independent Test**: Trigger rate-limit, timeout, and generic failures across all LLM features; verify contextual messaging and resumable table generation behavior.

**Acceptance Scenarios**:

1. **Given** a 429 provider response after retries, **When** the UI handles it, **Then** an amber dismissible rate-limit banner appears with retry and settings actions.
2. **Given** stakeholder table generation is in progress, **When** entries complete, **Then** rows appear sequentially with progress text and a cap of 20 entries.
3. **Given** a mid-run rate-limit interruption, **When** the user chooses resume, **Then** generation continues from last unfinished entry.

---

### User Story 5 - Immediate Multi-Provider Switching Confidence (Priority: P1)

As an admin or analyst, I need provider changes in Settings to affect all AI call paths immediately and to be testable before running expensive workflows.

**Why this priority**: Provider switching is used to avoid outages, rate limits, and key issues.

**Independent Test**: Change provider/model in settings and validate extraction, report, stakeholder table, personas, workplan, and NL query use new provider without restart.

**Acceptance Scenarios**:

1. **Given** provider settings are changed and saved, **When** a new AI action starts, **Then** it uses the current provider configuration at call time.
2. **Given** required provider credentials are missing, **When** an AI action is attempted or connection test runs, **Then** a clear configuration error names missing values.
3. **Given** connection test is run from settings, **When** provider responds, **Then** status and latency feedback are returned and shown to user.

---

### User Story 6 - Intentional Profile Saving and Focused SMQ Editing (Priority: P2)

As an analyst, I need explicit profile save behavior and a focused one-section-at-a-time SMQ authoring flow to reduce accidental updates and cognitive overload.

**Why this priority**: Form reliability and focused editing improve quality of downstream AI output.

**Independent Test**: Edit profile and SMQ through full lifecycle; verify explicit save-only behavior, unsaved-change warning, and section-by-section notes workflow.

**Acceptance Scenarios**:

1. **Given** profile fields are edited, **When** user does not click save, **Then** data is not persisted and unsaved-change warning appears on navigation.
2. **Given** profile required title is empty, **When** save is attempted, **Then** save action is disabled.
3. **Given** SMQ editing view, **When** user navigates sections, **Then** one section is shown at a time with progress indicator and per-section notes context.

---

### User Story 7 - Web Content as First-Class Ingestion Sources (Priority: P2)

As an analyst, I need to ingest single URLs, crawled website content, and pasted text with the same downstream processing behavior as uploaded files.

**Why this priority**: Many stakeholder sources are web-only or ad hoc text and should not require file conversion.

**Independent Test**: Submit URL, crawl, and pasted-text inputs; verify each creates processable source records and resulting document content enters existing chunk/extraction flow.

**Acceptance Scenarios**:

1. **Given** a valid URL source, **When** submitted, **Then** readable text is extracted, tracked, and processed into the standard document pipeline.
2. **Given** a valid crawl request, **When** processing runs, **Then** content is gathered within depth/page limits and processed as one source.
3. **Given** pasted text input and title, **When** submitted, **Then** it appears in list with standard processing statuses and downstream extraction support.

---

### User Story 8 - Export Includes Personas and Workplan Appendices (Priority: P2)

As a report consumer, I need exports to include generated personas and workplan content when available so outputs are complete without separate tabs.

**Why this priority**: Export is a stakeholder-facing deliverable and must reflect all generated analysis artifacts.

**Independent Test**: Generate exports with different data availability combinations and verify appendices, table of contents, and readiness indicators match actual content.

**Acceptance Scenarios**:

1. **Given** personas exist, **When** exporting, **Then** persona appendix is included with required structure.
2. **Given** workplan exists, **When** exporting, **Then** workplan appendix is included with required table columns.
3. **Given** either dataset is missing, **When** exporting, **Then** missing appendix is omitted without failure and status/readiness text reflects availability.

---

### Edge Cases

- Provider is switched while long-running generation is queued; new tasks must use latest provider and old in-flight tasks must fail gracefully without corrupting status.
- Graph filters remove all edges, creating many isolated nodes; isolated-node toggle and orphan actions must still behave predictably.
- Crawl input includes many inaccessible pages, redirects, or blocked paths; ingestion must stop within limits and return partial/clear status.
- User navigates away with unsaved initiative profile changes and then returns; data consistency must prefer last explicit save.
- Report export with only partial completed sections and missing personas/workplan must still produce valid output and accurate table of contents.
- Repeated 429 responses across sequential stakeholder entry generation must preserve resume point and avoid duplicate entries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST correct unreadable or low-contrast text across all explicitly listed frontend areas without changing layout or component structure.
- **FR-002**: System MUST ensure body/label text in audited areas has an effective minimum size of 12px.
- **FR-003**: System MUST render graph edge labels with readable contrast and minimum 11px size.
- **FR-004**: System MUST replace the current graph renderer with a force-directed renderer while preserving all existing graph interactions and data contracts.
- **FR-005**: System MUST preserve existing graph API endpoint and response shape for the migrated graph experience.
- **FR-006**: System MUST implement isolated-node visibility controls and persistent orphan-flag action in the graph workflow.
- **FR-007**: System MUST compute and display next-step workflow guidance from workflow status data rather than hardcoded values.
- **FR-008**: System MUST route workflow step 4 to the existing map/graph page and prevent dead-link navigation.
- **FR-009**: System MUST show dynamic documents-page next action that changes from extraction trigger to graph navigation after extraction completion.
- **FR-010**: System MUST replace generic AI failure messages with contextual user-facing messaging for rate limits, timeouts, and other provider failures across all listed AI actions.
- **FR-011**: System MUST present rate-limit outcomes as amber warning treatment with retry and settings actions.
- **FR-012**: System MUST generate stakeholder table entries sequentially, display incremental row completion, and cap generation to 20 entries.
- **FR-013**: System MUST support pause-and-resume continuation for stakeholder table generation after rate-limit interruption without restarting completed entries.
- **FR-014**: System MUST ensure provider selection changes are applied at call time for extraction, reporting, stakeholder table, personas, workplan, and NL query.
- **FR-015**: System MUST validate required provider configuration values before provider calls and return clear missing-configuration errors.
- **FR-016**: System MUST provide an API endpoint to test current provider connectivity and return provider/model/status/error/latency information.
- **FR-017**: Settings UI MUST allow users to trigger provider connectivity test and display success/failure feedback.
- **FR-018**: Initiative profile editing MUST save only on explicit save action, with unsaved-change indication and leave-page confirmation.
- **FR-019**: Initiative profile save action MUST remain disabled until required title field is populated.
- **FR-020**: SMQ editing UI MUST show one section at a time with section progress and a per-section notes field stored separately from generated content.
- **FR-021**: SMQ per-section notes MUST be included as additional context when generating that section.
- **FR-022**: System MUST support three new ingestion source types (single URL, website crawl, pasted text) and track processing status.
- **FR-023**: Website crawling MUST enforce maximum depth and page-count limits for safety and predictable processing.
- **FR-024**: Content extracted from URL/crawl/paste sources MUST enter the same downstream document chunking and extraction pipeline as file uploads.
- **FR-025**: Documents page MUST provide input tabs for file upload, single URL, website crawl, and pasted text, each with validation and clear user guidance.
- **FR-026**: Export output MUST include personas and workplan appendices when present, and omit absent appendices without error.
- **FR-027**: Export table of contents and export-status/readiness data MUST reflect actual inclusion of personas and workplan content.

### Assumptions

- Existing authentication and project ownership rules remain unchanged.
- Existing settings persistence mechanism is reused; this feature does not introduce a new auth/config model.
- Web crawling is limited to content users are authorized to ingest.
- Existing report export sections remain unchanged except for appendix inclusion and status indicators.

### Key Entities *(include if feature involves data)*

- **Web Source**: Represents non-file ingestion input (single URL, crawl request, pasted text), lifecycle status, source metadata, and linkage to created document content.
- **Workflow Status**: Represents ordered project-step completion state and the computed next actionable step for each page context.
- **Provider Configuration Health Check**: Represents runtime validation result for selected AI provider and model, including success/failure and latency.
- **Isolated Entity Flag State**: Represents entities with zero-degree connectivity in current analysis view and persistent flagging outcome.
- **Stakeholder Generation Progress**: Represents sequential progress status, completed entry count, pause/resume point, and capped total for stakeholder table generation.
- **Export Readiness Summary**: Represents section completion and appendix-availability indicators used to govern export behavior and user guidance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of audited UI text targets remain readable in light and dark themes with no invisible text regressions.
- **SC-002**: In usability validation, at least 95% of users complete graph exploration tasks (hover, click, focus, filter, minimap navigation) without loss of prior capabilities.
- **SC-003**: Workflow next-step guidance accuracy is 100% across the seven defined page states and no stepper route produces a 404.
- **SC-004**: For AI rate-limit events, 100% of affected user flows present contextual warning guidance instead of generic raw network errors.
- **SC-005**: Stakeholder table generation displays progressive completion and supports resume-after-interruption with zero duplicate generated entries in test runs.
- **SC-006**: Provider switch effectiveness is verifiable end-to-end: all listed AI features reflect new provider selection on subsequent calls without service restart.
- **SC-007**: Initiative profile edits are never persisted without explicit save action, and unsaved navigation warnings trigger consistently.
- **SC-008**: URL/crawl/paste ingestion sources achieve parity with file ingestion in downstream processing visibility and extraction eligibility.
- **SC-009**: Export outputs correctly include or omit personas/workplan appendices according to availability in 100% of tested combinations.
