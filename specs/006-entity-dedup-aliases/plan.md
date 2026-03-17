# Implementation Plan: Entity Deduplication + Alias System

**Branch**: `006-entity-dedup-aliases` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-entity-dedup-aliases/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extend existing entity persistence from specs 002/004/005 with a save-time 3-level deduplication pipeline: exact normalized match, acronym expansion via database-managed acronym map, and same-type fuzzy merge/review thresholds using RapidFuzz. Add alias persistence (`EntityAlias`), phase hierarchy linking (`parent_entity`), overlap-aware mention counting, and review-candidate workflows surfaced in entity APIs and the entities list UI banner with merge/keep actions.

## Technical Context

**Language/Version**: Python 3.11 (Django backend), TypeScript (Next.js frontend)  
**Primary Dependencies**: Django 4.2, Django REST Framework, RapidFuzz, PostgreSQL/pgvector stack, Next.js 14, React 18  
**Storage**: PostgreSQL (Supabase-compatible) with new alias/acronym/review entities and extensions to existing entity schema  
**Testing**: pytest + pytest-django, Jest + React Testing Library  
**Target Platform**: Dockerized Linux services via Docker Compose  
**Project Type**: Web application (Django API + Next.js frontend)  
**Performance Goals**: Dedup logic runs inline for each saved entity without materially increasing extraction runtime; entity list render remains responsive with alias/review metadata  
**Constraints**: No LLM calls in CI; preserve existing endpoint compatibility; never merge across entity types; keep phase variants separate but linked  
**Scale/Scope**: Sprint US-06 only, extending entity save and list workflows across existing 002/004/005 paths

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate Review

| Gate | Status | Evidence |
|------|--------|----------|
| Spec-driven workflow | ✅ Pass | US-06 spec is defined before implementation tasks |
| Modularity / explicit contracts | ✅ Pass | API and review-action contracts added under `contracts/` |
| Supabase/PostgreSQL source of truth | ✅ Pass | Alias/acronym/review models are DB-backed and migrated |
| No LLM calls in CI | ✅ Pass | Dedup logic is deterministic and testable with mocked extraction inputs |
| Docker-first delivery | ✅ Pass | Validation uses existing Dockerized backend/frontend test workflow |
| Simplicity / no parallel architecture | ✅ Pass | Extends existing save path; no duplicate extraction pipeline introduced |

### Post-Design Gate Review

| Gate | Status | Evidence |
|------|--------|----------|
| DRY | ✅ Pass | Single dedup service reused by all entity persistence entry points |
| Explicit contracts | ✅ Pass | Entity payload and review action contracts documented |
| Observability | ✅ Pass | Review decisions and merge paths captured via structured logs |
| Documentation freshness | ✅ Pass | quickstart, data-model, contracts and plan artifacts generated |

No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/006-entity-dedup-aliases/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── review-workflow.md
└── tasks.md             # Created by /speckit.tasks
```

### Source Code (repository root)

```text
ner/
├── models.py
├── serializers.py
├── views.py
├── services/
│   ├── deduplicator.py
│   ├── pipeline.py
│   └── [new] entity_dedup_service.py
├── migrations/
└── tests/

frontend/
├── pages/
│   └── entities.tsx
├── src/
│   ├── lib/api.ts
│   └── components/
└── src/__tests__/
```

**Structure Decision**: Use existing Django app (`ner`) and existing entities list frontend page; add focused models/services/endpoints instead of creating a parallel app.

## Complexity Tracking

No constitution exceptions required.

