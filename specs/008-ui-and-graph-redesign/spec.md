# Feature Specification: US-08 Kumu-Inspired Graph Redesign + Entity Side Panel + Filters + Focus Mode

**Feature Branch**: `008-ui-and-graph-redesign`  
**Created**: 2026-03-18  
**Status**: Draft  
**Input**: User description: "US-08: Kumu-Inspired Graph Redesign + Entity Side Panel + Filters + Focus Mode"

## Clarifications

### Session 2026-03-18

- Q: Should cross-project entity profiles include only projects visible to the requesting user, or all projects globally? → A: Cross-project profile includes only projects the requesting user can access.
- Q: When should contextual summary generation run for an entity panel? → A: Generate summary only on explicit user action.
- Q: What summary caching policy should apply for contextual summaries? → A: Cache per entity+project for 24 hours, with manual refresh bypassing cache.
- Q: How should contextual summary generation handle slow provider responses? → A: Timeout after 8 seconds and show fallback with retry action.
- Q: When filters are active, how should focus mode determine the two-hop neighborhood? → A: Compute focus neighborhood only on the currently filtered visible graph.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interactive Graph Exploration Experience (Priority: P1)

As an analyst, I can open a project map and interact with a visually rich graph where node style, node size, and edge rendering communicate stakeholder structure clearly.

**Why this priority**: The graph is the core product surface and primary value-delivery point for stakeholder analysis.

**Independent Test**: Open a project map with existing entities/relationships and verify that users can understand stakeholder structure from visual encoding alone.

**Acceptance Scenarios**:

1. **Given** a project has extracted entities and relationships, **When** the user opens the map, **Then** nodes and edges render with dynamic visual styles supplied by project configuration data.
2. **Given** entities have varying connection counts, **When** the graph is rendered, **Then** node sizes reflect connectivity within a bounded visual range.
3. **Given** relationships have confidence scores, **When** edges are rendered, **Then** edge thickness reflects confidence and labels are discoverable on interaction.

---

### User Story 2 - Entity Context Side Panel (Priority: P1)

As an analyst, I can click any node to open a right-side detail panel that explains the entity’s role, relationships, aliases, and project presence without leaving the map.

**Why this priority**: Insight extraction depends on explainable, drill-down context for each stakeholder.

**Independent Test**: Click entities on the map and verify panel content is complete, navigable between linked entities, and closable without losing map context.

**Acceptance Scenarios**:

1. **Given** a user clicks an entity node, **When** the side panel opens, **Then** it shows name, type badge, summary, grouped relationships, aliases, project links, and supporting source excerpts.
2. **Given** a user clicks a related entity from within the panel, **When** navigation occurs, **Then** the panel updates to the new entity and preserves back-navigation history.
3. **Given** the panel is open, **When** the user closes it, **Then** the graph returns to full-width exploration state.

---

### User Story 3 - Real-Time Filtering, Focus, and Search (Priority: P2)

As an analyst, I can narrow the network using entity/relationship filters, focus on local neighborhoods, and search entities instantly without waiting for server refetch.

**Why this priority**: Analysts need fast iterative exploration to answer questions in live review sessions.

**Independent Test**: Apply filters, focus mode, and search on an already-loaded graph and verify updates happen immediately in the same map session.

**Acceptance Scenarios**:

1. **Given** a loaded graph, **When** the user toggles entity/relationship checkboxes, **Then** matching nodes and edges show/hide immediately.
2. **Given** a node is shift-selected, **When** focus mode is applied, **Then** nodes beyond two hops in the currently filtered visible graph are visibly de-emphasized and background click resets focus.
3. **Given** a search term matches an entity label, **When** the user types, **Then** the map highlights and centers matching nodes in real time.

---

### User Story 4 - Cross-Project Entity Intelligence and Contextual Summaries (Priority: P2)

As an analyst, I can retrieve one entity’s cross-project footprint and project-scoped narrative summary so I can understand role and relevance in context.

**Why this priority**: Cross-project continuity is essential for strategic stakeholder tracking and portfolio-level insight.

**Independent Test**: Request an entity’s global profile and contextual summary for a selected project and confirm complete profile + context-aware narrative are returned.

**Acceptance Scenarios**:

1. **Given** an entity appears in multiple projects, **When** its profile is retrieved, **Then** aliases, project memberships, and relationships across projects are available.
2. **Given** a project context is selected, **When** the user explicitly requests summary generation for an entity, **Then** the system generates a concise narrative grounded in project concept context and relationship evidence.
3. **Given** summary generation is temporarily unavailable or exceeds 8 seconds, **When** a user requests summary generation, **Then** the panel shows a clear fallback message with retry action without blocking other details.
4. **Given** an entity appears in projects outside the requester’s permissions, **When** its profile is retrieved, **Then** only authorized project memberships and relationships are returned.
5. **Given** a summary exists for an entity+project within 24 hours, **When** the user requests summary generation, **Then** the system returns cached summary unless the user triggers manual refresh.

### Edge Cases

- Entity label style metadata is missing or partially configured for a type.
- Entity has no aliases, no relationships, or no source excerpts for the selected project.
- Search input matches multiple entities with similar names.
- Focus mode is applied while filters are active and then reset to filtered baseline state.
- User requests summary for entity not linked to selected project context.
- Provider quota/rate limits affect summary generation response time.
- Cached summary is stale relative to recent relationship updates and user requests manual refresh.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extend the existing graph experience rather than replacing it with a separate workflow.
- **FR-002**: System MUST render node shape and color dynamically from active entity label configuration data.
- **FR-003**: System MUST scale node size by connection count within a bounded minimum/maximum visual range.
- **FR-004**: System MUST render curved relationship edges with discoverable relationship labels and confidence-weighted thickness.
- **FR-005**: System MUST provide an entity side panel that includes name, type, contextual summary, grouped relationships, aliases, related projects, and source excerpts.
- **FR-006**: System MUST support linked-entity drill-down inside the side panel with back navigation history.
- **FR-007**: System MUST provide graph controls for zoom in, zoom out, and fit-to-screen.
- **FR-008**: System MUST provide real-time client-side filters for active entity types and relationship types without requiring a full graph refetch.
- **FR-009**: System MUST support two-hop focus mode triggered by modified node click and reset via background click.
- **FR-010**: System MUST provide real-time label search and auto-centering on matched nodes.
- **FR-011**: System MUST provide an entity profile retrieval capability that returns cross-project aliases, project memberships, and relationship history.
- **FR-012**: System MUST provide on-demand contextual summary generation for an entity within a selected project context, triggered only by explicit user action.
- **FR-013**: System MUST use project concept context and relationship evidence as summary input.
- **FR-014**: System MUST return actionable fallback responses for summary/provider failures so the panel remains usable.
- **FR-015**: System MUST preserve existing dependencies and compatibility with prior label configuration, deduplication/alias, and project-scoped extraction capabilities.
- **FR-016**: System MUST scope cross-project entity profile results to projects the requesting user is authorized to access.
- **FR-017**: System MUST cache contextual summaries per entity+project for 24 hours and MUST allow explicit manual refresh to bypass cache and regenerate.
- **FR-018**: System MUST timeout contextual summary generation requests after 8 seconds and MUST return a non-blocking fallback response that includes an explicit retry action.
- **FR-019**: System MUST compute two-hop focus mode neighborhoods from the currently filtered visible graph, not from hidden nodes/edges.

### Key Entities *(include if feature involves data)*

- **Entity Profile**: Canonical stakeholder record with type, aliases, and cross-project footprint.
- **Project Membership**: Association between an entity and a project where it appears.
- **Relationship Evidence**: Typed connections, confidence, directionality, and supporting excerpts used for graph rendering and narrative summaries.
- **Entity Label Style**: Configured visual metadata (shape/color) for each active entity type.
- **Contextual Entity Summary**: One-paragraph narrative describing entity role in a selected project context.

### Dependencies & Assumptions

- Depends on prior capabilities for configurable entity labels, aliases/deduplication, and project/context-aware extraction.
- Assumes concept note context is available for projects where contextual summaries are requested.
- Assumes entity relationship evidence is retrievable for both project-scoped and cross-project views.
- Assumes existing graph data retrieval endpoints remain backward compatible for non-upgraded consumers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of users can open a project graph and identify top connected entities within 30 seconds.
- **SC-002**: 90% of node-click actions display the side panel with complete core data in under 2 seconds (excluding external provider outages).
- **SC-003**: Filter toggle and focus-mode actions update graph visibility within 300 ms for standard project graphs.
- **SC-004**: 95% of successful search interactions center the map on at least one matching node in under 1 second.
- **SC-005**: 90% of summary requests return a context-grounded paragraph on first attempt when provider quotas are available.
- **SC-006**: Analyst usability feedback for map exploration (panel + filters + focus + search) reaches at least 4/5 in UAT sessions.
