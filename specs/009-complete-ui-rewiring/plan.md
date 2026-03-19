# Implementation Plan: Complete UI Polishing and Rewiring

**Branch**: `009-complete-ui-rewiring` | **Date**: 2026-03-19 | **Spec**: `/specs/009-complete-ui-rewiring/spec.md`
**Input**: Feature specification from `/specs/009-complete-ui-rewiring/spec.md`

## Summary

Rewire the end-to-end analyst UX (upload → graph/entities/relations → reasoning) into a consistent workspace-centered experience while preserving existing backend behavior and API compatibility. Implementation uses an incremental shell-first approach: establish global design tokens and shared layout components first, then migrate pages to shared contracts, maintain URL-first workspace context with safe persistence fallback, and standardize loading/error/empty states without changing core extraction or reasoning semantics.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript + React/Next.js pages router (frontend)  
**Primary Dependencies**: Django 4.2, Django REST Framework, Next.js, React, Tailwind CSS, Cytoscape stack in frontend graph modules  
**Storage**: PostgreSQL 15 (Supabase-compatible) + pgvector; existing Django models/migrations  
**Testing**: `pytest` (backend), Jest + React Testing Library (frontend)  
**Target Platform**: Dockerized Linux services for backend/frontend; modern web browsers for UI  
**Project Type**: Full-stack web application  
**Performance Goals**: Preserve current interactive UX and processing transparency while avoiding additional round trips/regressions from rewiring  
**Constraints**: No breaking API contract changes; preserve existing validated business logic; no LLM calls in CI; maintain deployability in Docker  
**Scale/Scope**: Rewire tasks 0–13 across shared UI shell, page-level flows, API/state integration, and regression-proof compatibility across authenticated analysis pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase-0 Gate Review

- **Spec-Driven workflow**: PASS — feature spec exists and is complete in `/specs/009-complete-ui-rewiring/spec.md`.
- **Modularity and explicit contracts**: PASS — design isolates UI shell/components from existing pipeline modules and adds contract docs under this feature spec.
- **Simplicity (KISS/YAGNI)**: PASS — plan preserves existing endpoints and business behavior; no unnecessary platform migration.
- **Testing before PR**: PASS — quickstart includes targeted backend/frontend test gates before PR.
- **Docker-first and deterministic delivery**: PASS — validation commands run in existing docker-compose and pinned dependency setup.
- **LLM governance**: PASS — no new runtime LLM dependence introduced by this rewiring plan.

### Post-Phase-1 Gate Re-check

- **Contracts documented**: PASS — compatibility and UI/workspace contracts captured in `/specs/009-complete-ui-rewiring/contracts/`.
- **Data/state model explicit**: PASS — entities, relationships, transitions, and validations captured in `data-model.md`.
- **Incremental and reviewable change**: PASS — quickstart defines staged rollout and verification checkpoints.
- **No unjustified constitution violations**: PASS — no exceptions required.

## Project Structure

### Documentation (this feature)

```text
specs/009-complete-ui-rewiring/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-compatibility.md
│   └── ui-workspace-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
ingestion/
├── models.py
├── views.py
├── serializers.py
└── tests/

ner/
├── models.py
├── views.py
├── serializers.py
├── services/
└── tests/

reasoning/
└── apps.py

graph/
└── apps.py

frontend/
├── pages/
│   ├── upload.tsx
│   ├── graph.tsx
│   ├── entities.tsx
│   ├── relations.tsx
│   └── projects/[id]/workspace.tsx
├── src/
│   ├── components/
│   ├── lib/
│   ├── pages/
│   ├── styles/
│   └── __tests__/
└── jest.config.js
```

**Structure Decision**: Keep the existing monorepo web-application structure. Implement rewiring as focused changes in `frontend/` shared styles/layout/components and page containers, with only compatibility-oriented backend touchpoints in existing app modules (`ingestion/`, `ner/`) where required by spec tasks.

## Complexity Tracking

No constitution violations identified; complexity exceptions are not required.
