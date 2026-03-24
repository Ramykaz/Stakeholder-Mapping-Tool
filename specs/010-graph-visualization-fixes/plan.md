# Implementation Plan: Graph & Visualization Fixes + Features

**Branch**: `010-graph-visualization-fixes` | **Date**: 2026-03-24 | **Spec**: [specs/010-graph-visualization-fixes/spec.md](specs/010-graph-visualization-fixes/spec.md)
**Input**: Feature specification from `/specs/010-graph-visualization-fixes/spec.md`

## Summary

This feature delivers a set of high-impact improvements to the graph visualization and workspace UI, including:
- All graph nodes as circles sized by degree (influence), border color by entity type, with a visible size legend
- Theme-adaptive Cytoscape canvas and label outlines (instant update on theme toggle)
- Live entity type, confidence, and degree filtering, plus cluster layout (type/community) — all client-side
- Project card dropdown for Open/Delete, with confirmation modal for deletion
- Persistent access to concept note editor from sidebar and Analyze page
- Persistent focus mode with N-hop neighbourhood, toolbar toggle, and side panel integration

All changes extend the rewired UI from 009-complete-ui-rewiring, with no backend refetch for graph filtering or clustering.

## Technical Context

**Language/Version**: TypeScript (Next.js 14), Python 3.11 (Django 4.2)
**Primary Dependencies**: React, Cytoscape.js, Tailwind CSS, Django REST Framework
**Storage**: PostgreSQL (via Django ORM)
**Testing**: Jest (frontend), Pytest (backend)
**Target Platform**: Web (modern browsers)
**Project Type**: Web application (monorepo: frontend + backend)
**Performance Goals**: Graph updates <100ms for 1k nodes; UI theme switch <50ms
**Constraints**: No backend refetch for graph filtering/clustering; must extend, not rebuild, existing rewired UI
**Scale/Scope**: Up to 10k nodes/edges per graph; 100+ concurrent users

## Constitution Check

- Spec-driven, incremental, and reviewable (SDD pipeline)
- Simplicity: All filtering and clustering is client-side; no new backend endpoints
- Open-source stack (React, Cytoscape.js, Django, PostgreSQL)
- All changes are review-gated and test-after is acceptable
- No new paid APIs or non-reviewed dependencies

## Project Structure

### Documentation (this feature)

```text
specs/010-graph-visualization-fixes/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── pages/                      ← Next.js pages router (NOT under src/)
│   ├── projects/[id]/
│   │   ├── analyze.tsx
│   │   ├── map.tsx
│   │   └── setup.tsx
│   └── ...
└── src/
    ├── components/
    │   ├── GraphVisualization.tsx
    │   └── layout/
    │       └── Sidebar.tsx
    ├── lib/
    │   ├── cytoscapeStyle.ts
    │   ├── graphFocus.ts
    │   └── uiState.ts
    └── types/
```

**Structure Decision**: Monorepo with backend (Django) and frontend (Next.js) directories. Next.js pages live at `frontend/pages/` (root-level, not under src/). Components, lib utilities, and types live under `frontend/src/`.

## Complexity Tracking

No constitution violations. All complexity is justified by user-facing requirements and is implemented in the simplest way possible (client-side filtering, no backend changes).

**Louvain community detection**: Not implemented — requires an unreviewed external library, violating the constitution. Cluster layout uses type-based grouping with Cytoscape's built-in `cose` layout and positional separation instead.
