# Implementation Plan: Project Model + Concept Note + Full Project API

**Branch**: `007-project-model-concept-note-api` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-project-model-concept-note-api/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Introduce project-scoped domain boundaries across ingestion, extraction, entities, and graph workflows while preserving backward compatibility. Add `Project` and one-to-one `ConceptNote`, migrate legacy records into a default project, expose project and concept note APIs, and restructure frontend flows around project context. Maintain legacy endpoints during transition and thread concept-note context into US-05 provider abstraction for project-scoped extraction.

## Technical Context

**Language/Version**: Python 3.11 (Django backend), TypeScript (Next.js frontend)  
**Primary Dependencies**: Django 4.2, Django REST Framework, existing US-05 provider abstraction (`provider_factory`/provider clients), Next.js 14, React 18  
**Storage**: PostgreSQL (Supabase) with new `Project` and `ConceptNote` tables plus project FKs on existing domain models  
**Testing**: pytest + pytest-django, Jest + React Testing Library  
**Target Platform**: Dockerized Linux containers via Docker Compose  
**Project Type**: Web application (Django API + Next.js frontend)  
**Performance Goals**: Keep project dashboard/list APIs responsive (<300ms typical local/dev p95), no regression in extraction throughput from added context wiring  
**Constraints**: Preserve legacy endpoint compatibility during transition, no data loss in migration, no cross-project leakage, no LLM calls in CI  
**Scale/Scope**: Sprint US-07 scope only (project model, concept note, scoped APIs, dashboard/workspace/settings baseline)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate Review

| Gate | Status | Evidence |
|------|--------|----------|
| Spec-driven workflow | ✅ Pass | US-07 spec exists before implementation tasks |
| Modularity / explicit contracts | ✅ Pass | Project/concept-note/scoped API contracts planned under `contracts/` |
| Supabase/PostgreSQL source of truth | ✅ Pass | Migration plan introduces DB-backed `Project`/`ConceptNote` and FK extensions |
| No LLM calls in CI | ✅ Pass | Concept-note propagation tested with mocked provider paths |
| Docker-first delivery | ✅ Pass | Validation to run in Docker compose backend/frontend flows |
| Simplicity / no parallel architecture | ✅ Pass | Existing apps/endpoints extended, not replaced |

### Post-Design Gate Review

| Gate | Status | Evidence |
|------|--------|----------|
| DRY | ✅ Pass | Reuses existing extraction/provider services with project-context injection |
| Explicit contracts | ✅ Pass | Backward-compatible and project-scoped contracts documented |
| Observability | ✅ Pass | Existing extraction logging preserved; project context included in logs/events |
| Documentation freshness | ✅ Pass | research/data-model/contracts/quickstart generated for US-07 |

No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/007-project-model-concept-note-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
ingestion/
├── models.py
├── serializers.py
├── views.py
└── urls.py

ner/
├── models.py
├── serializers.py
├── views.py
├── urls.py
└── services/
    └── pipeline.py

frontend/
├── pages/
│   ├── index.tsx
│   ├── upload.tsx
│   ├── graph.tsx
│   └── entities.tsx
└── src/
    ├── lib/api.ts
    ├── types/index.ts
    └── components/

stakeholder_analysis/
└── urls.py
```

**Structure Decision**: Extend existing Django apps (`ingestion`, `ner`) and existing Next.js pages/components to introduce project-scoped behavior; avoid creating a parallel backend service or separate frontend app.

## Complexity Tracking

No constitution exceptions required.

## Execution Notes

- US-07 implementation remains on branch `007-project-model-concept-note-api` with backward-compatible legacy routes preserved.
- Validation workflow for this feature is standardized as: rebuild images first, then run backend and frontend regressions.
