# Implementation Plan: Incremental Extraction, Document Review, and Evidence Integrity

**Branch**: `016-document-extraction-integrity` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-document-extraction-integrity/spec.md`

## Summary

Deliver US-016 as a data-integrity and reviewability upgrade across ingestion, extraction, graph, and entity-detail UX: (1) incremental extraction based on document extraction state, (2) document-level entity/relationship review and corrections, (3) strict no-orphan entity enforcement, (4) pre-extraction cleaning pipeline with raw/cleaned text separation, (5) evidence-grounded contextual summaries, and (6) in-page entity mini-graph traversal.

## Technical Context

**Language/Version**: Python 3.11 (Django 4.2), TypeScript (Next.js 14 / React)  
**Primary Dependencies**: Django REST Framework, Celery 5.4.0, pgvector, sentence-transformers, D3 v7, existing NER dedup services  
**Storage**: PostgreSQL 15 (Supabase) as single source of truth  
**Testing**: pytest + pytest-django (backend), Jest (frontend)  
**Target Platform**: Docker Compose services (app, worker, frontend, redis)
**Project Type**: Web application (Django API + Next.js frontend)  
**Performance Goals**: Extraction skips already-processed docs by default; review panel data loads lazily per opened document; no regression to existing extraction throughput for new documents  
**Constraints**: Preserve existing dedup semantics; maintain backward compatibility for current graph/report APIs where possible; no LLM network calls in CI; all schema changes via migrations  
**Scale/Scope**: Project-level document batches with mixed extracted/unextracted states, entity and relationship correction at document granularity, one-hop mini-graph per entity detail view

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

| Gate | Status | Notes |
|------|--------|-------|
| Spec-driven workflow | PASS | Spec 016 exists before implementation |
| Modularity | PASS | Changes stay within `ingestion/`, `ner/`, and `frontend/` module boundaries |
| Explicit contracts | PASS | New document-review APIs will be captured in contracts artifact |
| Supabase as source of truth | PASS | New extraction/evidence fields modeled in PostgreSQL with migrations |
| No LLM calls in CI | PASS | Summary/generation tests remain mocked in CI paths |
| Prompt/version reviewability | PASS | Prompt-level summary guidance updates remain in versioned prompts |
| Docker-first delivery | PASS | Local and validation flows remain Docker Compose based |

### Post-Design Gate Re-check

| Gate | Status | Notes |
|------|--------|-------|
| DRY / KISS / YAGNI | PASS | Reuses existing extraction, dedup, and entity-detail data flows with additive constraints |
| Backward-compatible architecture | PASS | Existing core routes retained; additive document-review routes and metadata fields |
| Data migration discipline | PASS | `Document` and mention/relationship provenance changes are migration-backed |
| Observability expectations | PASS | Extraction and correction paths keep explicit status signaling and error states |

## Project Structure

### Documentation (this feature)

```text
specs/016-document-extraction-integrity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.yaml
└── tasks.md
```

### Source Code (repository root)

```text
ingestion/
├── models.py
├── serializers.py
├── views.py
├── services/
│   ├── extractor.py
│   ├── pipeline.py
│   └── web_source.py
└── migrations/

ner/
├── models.py
├── serializers.py
├── views.py
├── urls.py
├── services/
│   ├── pipeline.py
│   ├── relation_extractor.py
│   ├── contextual_summary.py
│   └── semantic_search.py
└── migrations/

frontend/
├── pages/
│   ├── projects/[id]/documents.tsx
│   └── projects/[id]/entities/[entityId].tsx
└── src/components/
    ├── GraphVisualization.tsx
    └── [document review UI blocks]
```

**Structure Decision**: Use existing Django + Next.js monorepo structure and extend current ingestion/NER/review paths with additive data fields, APIs, and inline frontend review components.

## Phase 0: Research Output

See [research.md](research.md).

Research resolves:
- Incremental extraction boundary and explicit re-extraction trigger pattern
- Evidence provenance modeling strategy for entity mentions and relationships
- Orphan-entity integrity enforcement points (save path, query path, cleanup path)
- Text cleaning policy order and web-source stricter cleaning heuristics
- Context summary evidence packaging and invalidation behavior
- Mini-graph rendering strategy using existing entity detail relationship payload

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
