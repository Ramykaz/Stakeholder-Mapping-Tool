# Feature Specification: Incremental Extraction, Document Review, and Evidence Integrity

**Feature Branch**: `016-document-extraction-integrity`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "US-016-01 to US-016-06"

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

### User Story 1 - Incremental Extraction Only (Priority: P1)

As an analyst, I want extraction runs to process only new documents so repeated runs do not waste time and cost by reprocessing previously extracted content.

**Why this priority**: This directly reduces redundant work and prevents accidental re-extraction of stable documents.

**Independent Test**: Run extraction on a project containing both previously extracted and new documents; verify only new documents are processed and the action label clearly states how many new documents will be extracted.

**Acceptance Scenarios**:

1. **Given** a project with extracted and unextracted documents, **When** extraction is triggered, **Then** only documents that have never been extracted are processed.
2. **Given** a document already extracted, **When** standard extraction is triggered again, **Then** that document is skipped unless a user explicitly requests re-extraction for that document.
3. **Given** a successfully processed document, **When** extraction completes, **Then** the document is marked as extracted with a visible extraction timestamp.

---

### User Story 2 - Document-Level Extraction Review and Corrections (Priority: P1)

As an analyst, I want to review entities and relationships extracted from each document and correct or remove errors inline so the knowledge graph reflects validated evidence.

**Why this priority**: Users need precise, document-scoped quality control immediately after extraction.

**Independent Test**: Open one processed document, review extracted entities and relationships, edit labels/names/types, and delete false positives; confirm graph updates immediately.

**Acceptance Scenarios**:

1. **Given** a processed document, **When** the user opens review, **Then** document-specific entities and relationships are shown with confidence and evidence excerpts.
2. **Given** an incorrect entity or relationship, **When** the user edits or deletes it, **Then** changes apply immediately to project data.
3. **Given** an entity removed from one document, **When** it has no remaining document evidence, **Then** it is removed from the project graph.

---

### User Story 3 - No Orphaned Entities in Graph (Priority: P1)

As a data steward, I need strict entity-to-document evidence integrity so entities without document mentions never appear in project graphs.

**Why this priority**: This enforces trust in extracted knowledge and removes unsupported graph artifacts.

**Independent Test**: Validate extraction save rules, graph retrieval rules, and cleanup behavior to confirm entities with zero document mentions are not persisted or returned.

**Acceptance Scenarios**:

1. **Given** extracted candidate entities from a chunk, **When** an entity cannot be matched to text evidence in that chunk, **Then** it is discarded.
2. **Given** project graph data is requested, **When** entities are returned, **Then** every returned entity has at least one document mention in that project.
3. **Given** legacy orphaned entities exist, **When** cleanup runs, **Then** orphaned entities are removed.

---

### User Story 4 - Cleaned Text Extraction and Excerpts (Priority: P1)

As an analyst, I want document text cleaned before chunking and extraction so noisy content (links, navigation fragments, code-like noise) does not pollute extracted entities, relationships, and excerpts.

**Why this priority**: Cleaner inputs produce materially better extraction quality and cleaner evidence displays.

**Independent Test**: Process sample file and web-source documents containing noise; verify cleaned content drives chunking/extraction and displayed excerpts no longer include noisy artifacts.

**Acceptance Scenarios**:

1. **Given** raw document text, **When** preprocessing runs, **Then** cleaned text removes link/navigation/noise patterns and preserves natural-language evidence.
2. **Given** extraction and embeddings, **When** pipeline runs, **Then** cleaned text (not raw text) is used for chunking, retrieval, and extraction.
3. **Given** entity/relation excerpts in UI, **When** shown to users, **Then** they are sourced from cleaned text.

---

### User Story 5 - Specific Entity Context Summaries (Priority: P2)

As an analyst, I want entity detail summaries to describe what that specific entity does in this specific initiative using concrete evidence, not generic role descriptions.

**Why this priority**: High-quality summaries improve interpretability and decision-making.

**Independent Test**: Generate entity summaries for entities with sufficient evidence and verify summaries cite project-specific relationships/documents; verify low-evidence entities show insufficiency message.

**Acceptance Scenarios**:

1. **Given** sufficient evidence for an entity, **When** summary is generated, **Then** output references project context, document evidence, and actual relationships.
2. **Given** insufficient evidence, **When** summary is requested, **Then** summary generation is skipped and an insufficiency notice is shown.
3. **Given** relationship edits/deletions or new extraction evidence, **When** data changes, **Then** cached summary is invalidated.

---

### User Story 6 - Embedded Entity Mini-Graph (Priority: P2)

As an analyst, I want a mini-graph on the entity detail page showing direct neighbors so I can visually traverse local relationships without leaving entity detail views.

**Why this priority**: This speeds relationship exploration and reduces navigation friction.

**Independent Test**: Open an entity detail page with direct relationships and verify static 1-hop mini-graph rendering, labels, and click-through navigation to neighbor entities.

**Acceptance Scenarios**:

1. **Given** an entity with one-hop connections, **When** entity detail is opened, **Then** a static radial mini-graph is rendered in-page with central and connected nodes.
2. **Given** connected entity nodes, **When** user clicks one, **Then** navigation opens that connected entity’s detail page.
3. **Given** no direct connections, **When** entity detail is opened, **Then** a clear no-connections message is displayed instead of a graph.

---

### Edge Cases
- A project has zero new documents and extraction is triggered; action should communicate no-op clearly.
- A single document re-extraction fails after clearing extraction marker; document should show failed state and remain retryable.
- Entity or relationship is deleted in document review while the same entity exists in other documents; shared graph state must remain consistent.
- Legacy data includes relationships or entities missing direct mention metadata; review and graph logic must degrade gracefully while preserving integrity rules.
- Cleaning removes most content from a noisy document; extraction should fail safely with user-visible reason.
- Entity summary evidence becomes insufficient after relationship edits; prior summary must not remain as if still valid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST track whether each document has been successfully extracted and when extraction completed.
- **FR-002**: System MUST process only documents not yet extracted during standard project extraction runs.
- **FR-003**: System MUST provide a per-document re-extract action that only reprocesses the selected document.
- **FR-004**: System MUST show per-document extraction states: Not extracted, Extracting, Extracted, and Failed.
- **FR-005**: System MUST show extracted document metadata including entity count and extraction timestamp.
- **FR-006**: System MUST present extraction action labeling that explicitly shows the count of new documents to be processed.
- **FR-007**: System MUST support document-level listing of extracted entities with evidence and confidence.
- **FR-008**: System MUST support document-level listing of extracted relationships with evidence and confidence.
- **FR-009**: System MUST allow users to delete a document-scoped entity mention without automatically deleting the whole entity unless no remaining mentions exist.
- **FR-010**: System MUST allow users to delete or relabel document-scoped relationships.
- **FR-011**: System MUST allow correction of entity canonical name and type from review workflows.
- **FR-012**: System MUST enforce that entities cannot persist in project graph data without at least one traceable document mention.
- **FR-013**: System MUST reject extracted entity candidates that lack evidence in source chunk text.
- **FR-014**: System MUST exclude orphaned entities from graph query responses.
- **FR-015**: System MUST provide one-time cleanup capability for pre-existing orphaned entities.
- **FR-016**: System MUST persist both raw text and cleaned text for each document.
- **FR-017**: System MUST apply text cleaning before chunking, embedding, and extraction.
- **FR-018**: System MUST use cleaned text when generating excerpts shown in review/detail interfaces.
- **FR-019**: System MUST apply stricter cleaning for web-ingested sources to suppress non-linguistic markup/script-like content.
- **FR-020**: System MUST generate entity contextual summaries using project context, cleaned evidence excerpts, and project relationships.
- **FR-021**: System MUST suppress summary generation for low-evidence entities and show an insufficiency message.
- **FR-022**: System MUST invalidate cached entity summaries when supporting relationship evidence changes.
- **FR-023**: System MUST render an in-page 1-hop mini-graph on entity detail using existing relationship data.
- **FR-024**: System MUST enable node-to-entity navigation from mini-graph neighbor nodes.
- **FR-025**: System MUST show a no-connections message instead of mini-graph when no direct relationships exist.
- **FR-026**: System MUST ensure document review edits are reflected in the knowledge graph immediately.

### Assumptions

- Existing authentication and authorization rules remain unchanged.
- Existing deduplication behavior remains authoritative during re-extraction merge workflows.
- Existing extraction triggers and background execution patterns are retained and extended rather than replaced.
- Existing project entity detail payload already includes relationship data sufficient for mini-graph rendering.
- Existing projects may contain legacy data needing one-time integrity cleanup.

### Key Entities *(include if feature involves data)*

- **Document Extraction Record**: Tracks whether a document has been extracted, extraction timestamp, and extraction status for incremental workflows.
- **Document Evidence Text**: Stores original and cleaned document text used for chunking, retrieval, and evidence display.
- **Entity Mention Evidence**: Represents document-scoped proof that an entity appears in a source passage.
- **Document-Scoped Relationship Evidence**: Represents relationships extracted from a specific document with supporting excerpt.
- **Project Graph Entity**: Canonical entity in project graph, valid only if at least one mention evidence record exists.
- **Entity Contextual Summary**: Cached narrative summary derived from project-specific context, relationships, and cleaned excerpts.
- **Entity Neighborhood View**: One-hop connection projection used for mini-graph rendering on entity detail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In mixed projects, 100% of standard extraction runs process only previously unextracted documents.
- **SC-002**: For processed documents, 100% display one valid extraction state with consistent status semantics.
- **SC-003**: In document review, users can complete entity/relationship correction tasks without leaving the documents page.
- **SC-004**: Graph responses contain 0 entities with zero document mentions after integrity cleanup and rule enforcement.
- **SC-005**: Cleaned excerpts shown in review/detail views contain no URL/navigation noise in at least 95% of tested noisy-document samples.
- **SC-006**: Entity summaries for sufficient-evidence entities reference project-specific relationships/evidence in at least 90% of manual QA checks.
- **SC-007**: For low-evidence entities, 100% of summary requests show insufficiency notice instead of generic narrative.
- **SC-008**: Mini-graph renders correctly for connected entities and supports neighbor-to-detail navigation in 100% of tested cases.
