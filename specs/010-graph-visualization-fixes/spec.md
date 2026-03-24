# Feature Specification: Graph & Visualization Fixes + Features

**Feature Branch**: `010-graph-visualization-fixes`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "US-10: Graph & Visualization Fixes + Features\n\nIssue 12 — Node shapes to all circles sized by influence:\nForce all nodes to ellipse shape regardless of taxonomy config. Size each node by degree mapped to a pixel range of minimum 28px to maximum 72px. Keep per-type border colour as the only type differentiator between entity types. Add a visible size legend on the map page explaining what node size represents.\n\nIssue 13 — Canvas background in light/day mode:\nCytoscape canvas background is currently hardcoded to #080c14 even in light mode making the graph unreadable. Detect the active theme via data-theme attribute on the html element. In light mode set the canvas background to warm off-white #f0ece2 matching the page background. Adjust node label text outline colour for readability in light mode. Re-apply the correct background on theme toggle without requiring a page reload.\n\nIssue 14 — Entity type filters + cluster layout:\nThe graph currently shows all entities with no way to filter or group making it unnavigable on large documents. Add a filter panel with entity type checkboxes, a confidence slider, and a degree slider. Add a cluster layout option that groups nodes by entity type or by Louvain community detection. All filters must update the graph live without re-fetching data from the backend.\n\nIssue 15 — Delete project button visible + confirmation modal:\nThe delete button currently has opacity 0 until hover making it invisible and undiscoverable. Replace the hidden button with a visible three-dot dropdown menu on each project card. Dropdown items are Open and Delete. Delete triggers a confirmation modal that requires the user to type the project name before confirming deletion.\n\nIssue 16 — Edit concept note link from workspace sidebar:\nThe concept note editor exists at /projects/{id}/setup but once inside the workspace there is no navigation back to it. Add an Edit concept note link in the project sidebar under the project name. Add an Edit concept note button on the Analyze page. The setup page must clearly indicate it is editable at any time and not just during onboarding.\n\nIssue 22 — Persistent focus mode with N-hop neighbourhood:\nCurrent hover dimming is not persistent — moving the mouse restores all nodes immediately. Implement click-to-enter persistent focus mode that dims all nodes not in the neighbourhood of the clicked node. Add a toolbar toggle for 1-hop and 2-hop neighbourhood radius. The user exits focus mode via a visible exit button or by pressing Escape. The focused node gets a stronger border or glow effect. The entity side panel opens alongside when entering focus mode.\n\nReference: docs/PROJECT_REQUIREMENTS.md, docs/ARCHITECTURE.md , spec 009-complete-ui-rewiring (See <attachments> above for file contents. You may not need to search or read the file again.)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Graph Node Visual Consistency (Priority: P1)

As a user viewing the graph, I see all nodes as circles sized by influence (degree), with only border color indicating entity type, and a visible size legend explaining node size.

**Why this priority**: Ensures immediate visual clarity and comparability across all entities, reducing confusion and supporting analysis.

**Independent Test**: Can be fully tested by opening the graph page and confirming all nodes are circles sized by degree, border color by type, and a size legend is present.

**Acceptance Scenarios**:
1. **Given** a loaded graph, **When** I view the nodes, **Then** all are circles sized by degree (28–72px), border color by type, and a size legend is visible.
2. **Given** a graph with varying node degrees, **When** I compare nodes, **Then** size differences are visually proportional to degree.

---

### User Story 2 - Theme-Adaptive Canvas (Priority: P1)

As a user, the graph canvas background and label outlines adapt instantly to the active theme (light/dark), improving readability and visual comfort.

**Why this priority**: Prevents unreadable graphs and ensures accessibility in all themes.

**Independent Test**: Can be fully tested by toggling the theme and observing immediate canvas and label outline updates.

**Acceptance Scenarios**:
1. **Given** the app is in light mode, **When** I view the graph, **Then** the canvas background is #f0ece2 and label outlines are readable.
2. **Given** I toggle between light and dark mode, **When** I view the graph, **Then** the background and outlines update instantly without reload.

---

### User Story 3 - Live Entity Filtering & Clustering (Priority: P1)

As a user, I can filter entities by type, confidence, and degree, and cluster nodes by type or community, all updating the graph live without backend refetch.

**Why this priority**: Enables navigation and analysis of large graphs without performance or usability issues.

**Independent Test**: Can be fully tested by adjusting filters and cluster layout, confirming the graph updates instantly and smoothly.

**Acceptance Scenarios**:
1. **Given** a large graph, **When** I use the filter panel, **Then** only matching nodes/edges are shown, updated live.
2. **Given** I select a cluster layout, **When** I switch between type and community, **Then** nodes regroup accordingly without data reload.

---

### User Story 4 - Discoverable Project Deletion (Priority: P2)

As a user, I can easily find and use the delete option for projects via a visible dropdown, and must confirm by typing the project name before deletion.

**Why this priority**: Prevents accidental deletion and improves discoverability of destructive actions.

**Independent Test**: Can be fully tested by opening the project card menu, selecting Delete, and confirming via modal.

**Acceptance Scenarios**:
1. **Given** a project card, **When** I open the dropdown, **Then** Open and Delete options are visible.
2. **Given** I select Delete, **When** I type the project name and confirm, **Then** the project is deleted only after confirmation.

---

### User Story 5 - Persistent Concept Note Editing (Priority: P2)

As a user, I can always access and edit the concept note from the sidebar or Analyze page, and the setup page clearly indicates it is always editable.

**Why this priority**: Ensures critical project documentation is always accessible and editable, not just during onboarding.

**Independent Test**: Can be fully tested by navigating to the concept note editor from multiple entry points and confirming editability.

**Acceptance Scenarios**:
1. **Given** I am in a workspace, **When** I use the sidebar or Analyze page, **Then** I can access the concept note editor.
2. **Given** I am on the setup page, **When** I view the UI, **Then** it clearly states the note is always editable.

---

### User Story 6 - Persistent Focus Mode (Priority: P2)

As a user, I can click a node to enter persistent focus mode, dimming unrelated nodes, toggle 1-hop/2-hop neighbourhood, and exit via button or Escape; the focused node is highlighted and the side panel opens.

**Why this priority**: Supports deep analysis of network context and relationships.

**Independent Test**: Can be fully tested by clicking nodes, toggling hop radius, and exiting focus mode, confirming all visual and side panel behaviors.

**Acceptance Scenarios**:
1. **Given** a graph, **When** I click a node, **Then** unrelated nodes are dimmed, the focused node is highlighted, and the side panel opens.
2. **Given** I am in focus mode, **When** I toggle hop radius or exit, **Then** the graph updates accordingly and exits cleanly.

### Edge Cases
- User toggles theme rapidly or mid-interaction: canvas and labels always update instantly.
- Graph has nodes with identical degree: size mapping remains consistent and legend is clear.
- User applies filters that hide all nodes: graph shows empty state or message.
- User attempts to delete a project with a similar name: modal requires exact match.
- User enters focus mode, then changes filters: focus mode updates or exits gracefully.
- User opens concept note editor from multiple places: always lands on the same editable page.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: All graph nodes MUST be rendered as circles sized by degree (28–72px), with border color indicating entity type, and a visible size legend.
- **FR-002**: Cytoscape canvas background and label outlines MUST adapt instantly to the active theme, updating on toggle without reload.
- **FR-003**: A filter panel MUST allow live filtering by entity type, confidence, and degree, updating the graph client-side only.
- **FR-004**: Cluster layout option MUST allow grouping by entity type or Louvain community, updating live without backend refetch.
- **FR-005**: Project cards MUST have a visible dropdown menu with Open and Delete; Delete opens a confirmation modal requiring project name input.
- **FR-006**: Workspace sidebar and Analyze page MUST provide access to the concept note editor; setup page MUST indicate persistent editability.
- **FR-007**: Persistent focus mode MUST allow click-to-focus, 1-hop/2-hop toggle, exit via button/Escape, highlight focused node, and open side panel.

### Key Entities *(include if feature involves data)*
- **GraphNode**: Represents an entity in the graph (id, type, degree, confidence, etc.)
- **Project**: Represents a workspace/project (id, name, metadata)
- **ConceptNote**: Project documentation (projectId, content)
- **Theme**: Current UI theme (light/dark)
- **FilterState**: Current filter settings (entityTypes, confidence, degree)
- **FocusState**: Persistent focus mode state (focusedNodeId, hopRadius)

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: 100% of graph nodes are circles sized by degree, with only border color indicating type, and a visible size legend.
- **SC-002**: Canvas background and label outlines update instantly with theme toggle, with no reload required.
- **SC-003**: Filters and cluster layout update the graph live, with no backend refetch or page reload.
- **SC-004**: Project delete is always discoverable and requires explicit project name confirmation.
- **SC-005**: Concept note is always accessible and editable from workspace sidebar and Analyze page.
- **SC-006**: Focus mode is persistent, intuitive, and visually clear; user can exit easily and side panel opens on focus. 
