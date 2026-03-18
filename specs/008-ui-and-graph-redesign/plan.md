# Implementation Plan: US-08 Kumu-Inspired Graph Redesign + Entity Side Panel + Filters + Focus Mode

**Branch**: `008-ui-and-graph-redesign` | **Date**: 2026-03-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-ui-and-graph-redesign/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Upgrade the current graph exploration experience (not a replacement flow) with Kumu-inspired visual encoding, right-side entity detail panel, real-time client-side filters/search/focus mode, and cross-project entity intelligence with on-demand contextual summaries. Preserve existing extraction/labeling/dedup dependencies and add explicit behavior for access-scoped profile retrieval, summary caching (24h per entity+project), and summary timeout fallback (8s + retry).

## Technical Context

**Language/Version**: Python 3.11 (Django backend), TypeScript (Next.js frontend)  
**Primary Dependencies**: Django 4.2, Django REST Framework, Next.js 14, React 18, Cytoscape.js integration, existing NER provider abstraction (`groq`, `openai`, `azure_openai`, `gemini`)  
**Storage**: PostgreSQL 15 (Supabase) with existing entity/relation/project tables; summary cache persisted in relational storage  
**Testing**: pytest + pytest-django (backend), Jest + React Testing Library (frontend)  
**Target Platform**: Dockerized Linux services via Docker Compose (local/dev), browser-based web UI
**Project Type**: Web application (Django API + Next.js frontend)  
**Performance Goals**: Graph interactions (filter/focus) under 300ms for standard project graphs; side-panel core data render under 2s; search centering under 1s  
**Constraints**: Maintain existing graph route compatibility, no cross-project data leakage, no LLM calls in CI, summary request hard-timeout at 8s with fallback + retry, summary cache TTL 24h with manual refresh bypass  
**Scale/Scope**: Incremental US-08 enhancement to existing graph/panel/data APIs for analyst project workspaces (not a greenfield rewrite)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate Review

| Gate | Status | Evidence |
|------|--------|----------|
| Spec-driven workflow | ✅ Pass | US-08 spec and clarifications exist before implementation tasks |
| Simplicity/KISS/YAGNI | ✅ Pass | Extend existing pages/components/APIs; no parallel app or workflow |
| Modularity & explicit contracts | ✅ Pass | UI/API contracts documented in feature `contracts/` output |
| Data source integrity | ✅ Pass | Reuse existing Supabase/PostgreSQL entities/relations/project models |
| No LLM calls in CI | ✅ Pass | Summary and provider tests will mock provider clients |
| Docker-first validation | ✅ Pass | Quickstart and validation commands run via compose + existing frontend test flow |

### Post-Design Gate Review

| Gate | Status | Evidence |
|------|--------|----------|
| DRY / reuse existing services | ✅ Pass | Uses existing provider abstraction, graph API shape, and project scoping patterns |
| Explicit contracts | ✅ Pass | Added concrete API + frontend interaction contracts for panel, profile, and summaries |
| Observability | ✅ Pass | Summary generation path includes timeout/fallback/retry outcomes suitable for existing logging conventions |
| Documentation freshness | ✅ Pass | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` created for US-08 |

No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/008-ui-and-graph-redesign/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── frontend.md
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
frontend/
├── pages/
│   ├── graph.tsx
│   ├── entities.tsx
│   ├── relations.tsx
│   └── projects/[id]/workspace.tsx
└── src/
    ├── components/
    ├── lib/api.ts
    ├── types/index.ts
    └── __tests__/

ner/
├── models.py
├── serializers.py
├── views.py
├── urls.py
└── services/
    ├── pipeline.py
    └── relation_extractor.py

ingestion/
├── models.py
├── serializers.py
├── views.py
└── urls.py

stakeholder_analysis/
└── urls.py
```

**Structure Decision**: Use the existing Django + Next.js monorepo layout and implement US-08 by extending current graph/workspace views and API endpoints. No new top-level service or frontend app is introduced.

## Complexity Tracking

No constitution exceptions required.
