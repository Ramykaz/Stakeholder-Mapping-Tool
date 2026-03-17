# Implementation Plan: LLM Provider Abstraction + Joint Extraction + Configurable Labels

**Branch**: `005-llm-joint-extraction-labels` | **Date**: 2026-03-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-llm-joint-extraction-labels/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the current two-pass entity-then-relationship extraction with a single provider call per chunk through a shared LLM provider abstraction that supports Groq, OpenAI, Azure OpenAI, and Gemini. Preserve existing retry/rate-limit/cost accounting behaviors from spec 003 inside the shared abstraction, and enforce persistence rules from clarified requirements: no orphan entities, canonical storage for non-directional relations, and explicit failure messaging for missing/invalid credentials without automatic provider fallback. Add database-managed `EntityLabel` and `RelationshipType` catalogs with admin CRUD at `/admin`, default seeds, and next-run activation semantics.

## Technical Context

**Language/Version**: Python 3.11 (Django backend), TypeScript (Next.js frontend)  
**Primary Dependencies**: Django 4.2, Django REST Framework, groq SDK, openai SDK, httpx, Next.js 14, React 18, Cytoscape.js  
**Storage**: PostgreSQL 15 + pgvector (existing DB; new label/type catalog tables and relation persistence rule updates)  
**Testing**: pytest + pytest-django (backend), Jest + React Testing Library (frontend), LLM integrations mocked in tests  
**Target Platform**: Dockerized Linux services via Docker Compose (backend API + frontend UI)  
**Project Type**: Web application (monorepo-style Django + Next.js)  
**Performance Goals**: One LLM call per chunk for joint extraction; maintain extraction latency at or below prior two-pass aggregate; retain run-level usage and cost capture for 95%+ successful runs  
**Constraints**: No silent provider fallback on credential errors; admin-only taxonomy management; referenced labels/types cannot be hard deleted; non-directional relations stored as canonical single pair  
**Scale/Scope**: Sprint US-05 scope only; extends existing 002/003/004 flows without introducing new services or replacing existing document ingestion architecture

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate Review

| Gate | Status | Evidence |
|------|--------|----------|
| Spec-driven workflow | ✅ Pass | `spec.md` finalized with clarifications and measurable requirements before planning |
| Modularity / explicit contracts | ✅ Pass | Shared provider abstraction contract and API contracts planned in `contracts/` |
| Supabase/PostgreSQL as source of truth | ✅ Pass | All new state in Django migrations backed by PostgreSQL tables |
| Prompts versioned | ✅ Pass | Joint extraction prompt contract remains in versioned `prompts/` files |
| No LLM calls in CI | ✅ Pass | Test strategy keeps provider calls mocked for backend and frontend tests |
| Docker-first delivery | ✅ Pass | Execution and validation remain through existing Docker Compose workflow |
| Simplicity / no parallel architecture | ✅ Pass | Existing 003/004 logic is refactored, not rebuilt into separate pipeline |

### Post-Design Gate Review

| Gate | Status | Evidence |
|------|--------|----------|
| DRY / shared logic | ✅ Pass | Retry/rate-limit/cost logic centralized in provider abstraction, reused by all providers |
| Backward-compatible contracts | ✅ Pass | Existing extraction consumers retain normalized JSON contract via adapter layer |
| Observability | ✅ Pass | Run-level provider/model/usage/cost/error state retained and extended for new providers |
| Test-before-PR readiness | ✅ Pass | Quickstart includes required pytest/Jest/docker checks before PR |

No constitution violations identified; no exceptions required.

## Project Structure

### Documentation (this feature)

```text
specs/005-llm-joint-extraction-labels/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api.md
│   ├── provider-interface.md
│   └── admin-taxonomy.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
frontend/
├── pages/
│   └── admin.tsx                        # NEW: taxonomy admin UI route
└── src/
    ├── components/                      # UPDATED: admin forms/tables
    ├── lib/api.ts                       # UPDATED: taxonomy CRUD + extraction config API calls
    └── __tests__/                       # UPDATED: admin and API behavior tests

ner/
├── models.py                            # UPDATED: EntityLabel, RelationshipType model definitions
├── serializers.py                       # UPDATED: taxonomy and joint extraction serializers
├── views.py                             # UPDATED: admin taxonomy endpoints + extraction error messaging
├── urls.py                              # UPDATED: taxonomy/admin/joint extraction routes
├── services/
│   ├── provider_factory.py              # UPDATED: includes Azure OpenAI + Gemini selection
│   ├── pipeline.py                      # UPDATED: single-call joint extraction orchestration
│   ├── costing.py                       # UPDATED/REUSED: shared cost accounting hooks
│   ├── groq_client.py                   # UPDATED: implements shared interface
│   ├── openai_client.py                 # UPDATED: implements shared interface
│   ├── azure_openai_client.py           # NEW: shared interface implementation
│   ├── gemini_client.py                 # NEW: shared interface implementation
│   └── relation_deduplicator.py         # UPDATED: canonicalization for non-directional types
├── migrations/                          # NEW: taxonomy tables + seed + constraints
└── tests/                               # UPDATED: provider abstraction, taxonomy CRUD, persistence rules

prompts/
├── ner-extraction-v1.md                 # UPDATED: joint extraction contract instructions
└── relation-extraction-v1.md            # DEPRECATED/REWIRED usage as applicable

docs/
└── SPRINT_PLAN.md                       # REFERENCE ONLY
```

**Structure Decision**: Existing Django + Next.js web app structure is retained and extended in place (`ner/` + `frontend/`), avoiding new service boundaries and preserving compatibility with specs 002/003/004.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
