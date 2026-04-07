# Implementation Plan: UX, Graph, Workflow, LLM Reliability, and Web Ingestion

**Branch**: `015-ux-graph-llm-overhaul` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/015-ux-graph-llm-overhaul/spec.md`

## Summary

Deliver US-015 as a coordinated frontend/backend upgrade package: (1) full text visibility and typography correction pass, (2) Cytoscape-to-D3 graph migration with parity interactions and improved readability, (3) workflow stepper/next-step correctness and route fixes, (4) contextual LLM error handling plus sequential/resumable stakeholder generation, (5) call-time multi-provider wiring with connection testing, (6) explicit initiative-profile save and focused SMQ section UX, (7) URL/crawl/paste ingestion into existing document pipeline, and (8) export appendices for personas/workplan with accurate readiness/status reporting.

## Technical Context

**Language/Version**: Python 3.11 (Django 4.2), TypeScript (Next.js 14 / React)
**Primary Dependencies**: Django REST Framework, Celery 5.4.0, pgvector, sentence-transformers, D3 v7, existing LLM providers (Groq/OpenAI/Azure/Gemini), BeautifulSoup + httpx for web ingestion
**Storage**: PostgreSQL 15 (Supabase) as single source of truth
**Testing**: pytest + pytest-django (backend), existing frontend test setup (Jest)
**Target Platform**: Docker Compose local stack (app, worker, frontend, redis)
**Project Type**: Web application (monorepo with Django backend + Next.js frontend)
**Performance Goals**: D3 first render without visible settle animation; report/LLM actions remain responsive with graceful backoff/retry; crawl bounded to max depth/page limits
**Constraints**: Preserve existing graph API contracts; no raw LLM errors surfaced to users; no layout/component-structure changes for typography pass; no LLM network calls in CI tests
**Scale/Scope**: Per-project workflows with up to hundreds of entities/relations, up to 20 stakeholder-note generation items per run, web crawl capped to 20 pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

| Gate | Status | Notes |
|------|--------|-------|
| Spec-driven workflow | PASS | Spec 015 exists and is complete before planning |
| Modularity | PASS | Work split across existing `frontend/`, `ingestion/`, `ner/` modules |
| Explicit contracts | PASS | New/changed endpoints captured in contracts artifact |
| Supabase as source of truth | PASS | New data entities persist in PostgreSQL with migrations |
| No LLM calls in CI | PASS | Plan requires mocking provider calls in backend tests |
| Prompt/version reviewability | PASS | No hidden prompt behavior; provider wiring remains explicit |
| Docker-first delivery | PASS | No changes requiring non-docker runtime path |

### Post-Design Gate Re-check

| Gate | Status | Notes |
|------|--------|-------|
| DRY / KISS / YAGNI | PASS | Shared LLM/provider utilities reused; no duplicate provider stacks |
| Backward-compatible architecture | PASS | Existing endpoints preserved; additive endpoints/fields for new behavior |
| Data migration discipline | PASS | New `WebSource` and related fields modeled with explicit migration path |
| Observability expectations | PASS | LLM error taxonomy and test endpoint provide traceable outcomes |

## Project Structure

### Documentation (this feature)

```text
specs/015-ux-graph-llm-overhaul/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.yaml
└── tasks.md  # created in next phase (/speckit.tasks)
```

### Source Code (repository root)

```text
backend domain modules (existing root packages)
├── ingestion/
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── services/
│   └── migrations/
├── ner/
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── tasks.py
│   ├── services/
│   └── migrations/
└── stakeholder_analysis/
    └── settings.py

frontend/
├── pages/projects/[id]/
│   ├── graph.tsx (or map page equivalent)
│   ├── documents.tsx
│   ├── report.tsx
│   ├── stakeholders.tsx
│   ├── settings.tsx
│   ├── intake.tsx
│   └── smq.tsx
├── src/components/
│   ├── graph/
│   ├── WorkflowStepper.tsx
│   ├── NextStepCard.tsx
│   ├── ReportSectionCard.tsx
│   └── ...
└── src/lib/api.ts
```

**Structure Decision**: Use existing Django + Next.js monorepo structure; implement all changes as additive/refactor updates in current module boundaries without introducing new services.

## Phase 0: Research Output

See [research.md](research.md).

Research resolved:
- D3 migration parity strategy and force-layout pre-settle approach
- Contrast audit and token-application rules without layout changes
- Workflow next-step derivation from existing status API semantics
- LLM error taxonomy mapping and resumable sequential generation model
- Provider call-time instantiation and configuration health-check contract
- Web ingestion safety bounds (depth/page/timeouts/content cleaning)
- Export appendix inclusion rules and readiness consistency

## Phase 1: Design Output

### Data Model
See [data-model.md](data-model.md).

### API Contracts
See [contracts/api.yaml](contracts/api.yaml).

### Validation / Runbook
See [quickstart.md](quickstart.md).

### Agent Context
Updated via `.specify/scripts/bash/update-agent-context.sh copilot`.

## Complexity Tracking

No constitution violations requiring exception.
