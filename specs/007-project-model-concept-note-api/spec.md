# Feature Specification: Project Model + Concept Note + Full Project API

**Feature Branch**: `007-project-model-concept-note-api`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "US-07: Project Model + Concept Note + Full Project API"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Manage Projects (Priority: P1)

As an analyst, I want to create and manage projects as isolated workspaces so each stakeholder analysis effort has clear boundaries and lifecycle status.

**Why this priority**: Project isolation is the structural foundation required before any scoped upload, extraction, graphing, or reporting behavior can be trusted.

**Independent Test**: A user can create, list, view, update, archive, and delete projects and observe that each project has distinct metadata and status.

**Acceptance Scenarios**:

1. **Given** a user has platform access, **When** they create a project with a name and optional description, **Then** a new active project workspace is created.
2. **Given** multiple projects exist, **When** the user lists projects, **Then** each project shows current status and last updated timestamp.
3. **Given** a project is no longer active, **When** the user archives it, **Then** it remains visible but marked as archived.
4. **Given** a project is deleted, **When** the delete action is confirmed, **Then** the project is removed according to retention rules and is no longer available in the dashboard.

---

### User Story 2 - Attach and Reuse a Concept Note Per Project (Priority: P1)

As an analyst, I want one concept note per project, editable over time, so extractions consistently use project-specific context.

**Why this priority**: Concept-note context drives extraction relevance and ensures each project reflects its intended scope and terminology.

**Independent Test**: A user can create or retrieve a project concept note, update its text content, optionally attach a file, and confirm extraction requests include the project context.

**Acceptance Scenarios**:

1. **Given** a project exists without a concept note, **When** the user saves concept note content, **Then** that content is linked to the project as its single concept note.
2. **Given** a concept note already exists, **When** the user updates content or optional attachment, **Then** the latest version is persisted and returned on retrieval.
3. **Given** extraction is started for a project, **When** processing each document chunk, **Then** the project concept note context is applied consistently to extraction calls.

---

### User Story 3 - Work Only Inside Project Context (Priority: P1)

As an analyst, I want document upload, extraction, entities, and graph access to be project-scoped so I never mix data across projects.

**Why this priority**: Scope integrity prevents cross-project contamination and is required for trustworthy stakeholder outputs.

**Independent Test**: A user uploads documents and runs extraction inside one project, then verifies entities and graph results only appear in that same project workspace.

**Acceptance Scenarios**:

1. **Given** a user is inside a project workspace, **When** they upload a document, **Then** the document is stored under that project.
2. **Given** project-scoped extraction is triggered, **When** it completes, **Then** created entities and relationships are linked to that project context.
3. **Given** a user requests project entities or graph, **When** data is returned, **Then** only records from that project are included.
4. **Given** a user is not in a project context, **When** they attempt upload or extraction flows, **Then** the system requires selecting/creating a project first.

---

### User Story 4 - Preserve Existing Data and Backward Compatibility (Priority: P1)

As a platform owner, I want existing documents and APIs to remain functional during migration so current users are not disrupted.

**Why this priority**: This change affects core models and must not break existing integrations or previously ingested data.

**Independent Test**: Existing documents/entities/relationships are migrated to a default project, and both legacy and project-scoped endpoints remain operational during transition.

**Acceptance Scenarios**:

1. **Given** historical documents exist before project support, **When** migration runs, **Then** all legacy documents are assigned to a default project.
2. **Given** legacy clients call existing endpoints during transition, **When** requests are made, **Then** responses remain functional and compatible.
3. **Given** an entity is viewed globally, **When** profile details are requested, **Then** the response includes all projects where that entity appears.

### Edge Cases

- Default project creation during migration is idempotent and does not duplicate on repeated runs.
- Concept note file is absent while text is provided (and vice versa); both valid patterns are accepted.
- A project has no documents yet; workspace and graph views present clear empty states.
- Project is archived while still containing documents/entities; read behavior remains available while write behavior follows policy.
- Legacy endpoint and project endpoint are both used for the same document during transition; data integrity remains consistent.
- Global entity profile includes entities that appear in only one project as well as entities reused across multiple projects.

## Requirements *(mandatory)*

### Functional Requirements

#### Project and Concept Note Lifecycle

- **FR-001**: System MUST support project creation with a unique identifier, name, optional description, lifecycle status, and audit timestamps.
- **FR-002**: System MUST support full project lifecycle operations: create, list, retrieve, update, and delete.
- **FR-003**: System MUST support project status transitions between active and archived.
- **FR-004**: System MUST support exactly one concept note per project.
- **FR-005**: System MUST allow concept note content updates at any time.
- **FR-006**: System MUST allow an optional concept note file attachment.
- **FR-007**: System MUST return current concept note data for any existing project.

#### Data Migration and Backward Compatibility

- **FR-008**: System MUST add project linkage to existing documents while preserving historical records.
- **FR-009**: System MUST assign all pre-existing documents to a default project during migration.
- **FR-010**: System MUST add project linkage to existing entities and relationships.
- **FR-011**: System MUST keep existing endpoints functional during a transition period.
- **FR-012**: System MUST maintain compatibility of legacy response contracts while project-scoped flows are introduced.

#### Project-Scoped Operational Flows

- **FR-013**: System MUST require a project context for document upload operations.
- **FR-014**: System MUST require a project context for extraction triggers.
- **FR-015**: System MUST scope entity list retrieval to the selected project.
- **FR-016**: System MUST scope graph retrieval to the selected project.
- **FR-017**: System MUST apply project concept note context to each extraction call for project-scoped extraction.
- **FR-018**: System MUST provide a global entity profile view that includes all projects where the entity appears.

#### Frontend Experience

- **FR-019**: System MUST provide a project dashboard with project cards showing name, status, document count, entity count, and last updated metadata.
- **FR-020**: System MUST provide a multi-step project creation flow covering project details, concept note capture, and confirmation.
- **FR-021**: System MUST provide a project workspace view with document management and project-scoped map exploration.
- **FR-022**: System MUST provide project settings for editing project details and concept note content.
- **FR-023**: System MUST prevent users from accessing upload/extraction flows outside a project context.

### Key Entities *(include if feature involves data)*

- **Project**: A named analysis workspace with status, metadata, and ownership context for documents and graph outputs.
- **ConceptNote**: A single contextual brief attached to one project, including editable text and optional source file.
- **Document (extended)**: Existing uploaded document enriched with project association.
- **Entity (extended)**: Existing extracted entity enriched with project association for scoped retrieval and cross-project profile aggregation.
- **Relationship (extended)**: Existing relation record enriched with project association for scoped graph retrieval.
- **GlobalEntityProfile**: A consolidated view of one entity and all projects in which it appears.

### Dependencies

- Spec `001-doc-ingestion-pipeline`
- Spec `002-ner-pipeline`
- Spec `003-openai-llm-toggle`
- Spec `004-entity-relation-extraction`
- Spec `005-llm-joint-extraction-labels`
- Spec `006-entity-dedup-aliases`

### Assumptions

- Existing authenticated users retain access to their current capabilities during transition.
- Default project assignment is acceptable for all historical documents migrated from pre-project schema.
- Project-level counts shown in dashboard are derived from current linked records at read time.
- Legacy endpoints remain available for transition until explicitly deprecated in a later spec.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pre-existing documents are linked to a project after migration, with zero orphaned records.
- **SC-002**: 100% of project-scoped upload and extraction actions are rejected when no project context is provided.
- **SC-003**: 95% of users can complete project creation (details, concept note, confirmation) in under 3 minutes.
- **SC-004**: 100% of project entity and graph queries return only records belonging to the requested project.
- **SC-005**: 100% of global entity profile responses include complete project membership information for that entity.
- **SC-006**: Legacy endpoint consumers experience no breaking contract changes during transition validation.
