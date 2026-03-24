# Implementation Plan: Intelligence Layer

**Branch**: `011-intelligence-layer` | **Date**: 2026-03-24 | **Spec**: [specs/011-intelligence-layer/spec.md](specs/011-intelligence-layer/spec.md)
**Input**: Feature specification from `/specs/011-intelligence-layer/spec.md`

## Summary

This feature activates the intelligence capabilities that already have partial infrastructure in the codebase but are either unconnected (pgvector embeddings never queried), hardcoded (template-based entity summaries), or admin-only (dedup review queue). It delivers: pgvector semantic search replacing the SQL `icontains` search; real LLM RAG summaries wired to the existing cache; per-document extraction stats on the documents page; entity flagging (`is_flagged` field); a project-owner-accessible dedup review page; a chronological entity mention timeline; NL query via LLM RAG on the map search bar; a global `/entities` page; the D3 vs Cytoscape ADR document; and per-project LLM provider selection stored on the Project model.

All changes extend the existing stack — no new infrastructure, no new major dependencies.

## Technical Context

**Language/Version**: TypeScript (Next.js 14), Python 3.11 (Django 4.2)
**Primary Dependencies**: React, Cytoscape.js, Django REST Framework, sentence-transformers (all-MiniLM-L6-v2), pgvector, RapidFuzz
**Storage**: PostgreSQL 15 + pgvector (Supabase) — single source of truth
**Testing**: Jest (frontend), Pytest (backend); LLM calls mocked in CI
**Target Platform**: Web (modern browsers), Docker Compose
**Project Type**: Web application (monorepo: Django backend + Next.js 14 frontend)
**Performance Goals**: Semantic search results in <2s for projects with up to 500 documents; entity flag removes node in <500ms; global entities page loads in <3s for up to 20 projects
**Constraints**: No LLM calls in CI (mock all providers); no new paid APIs; must extend existing rewired UI (spec 009/010); two Django migrations required (Entity.is_flagged, Project.provider+model)
**Scale/Scope**: Up to 10k nodes/edges per graph; up to 500 documents per project for semantic search

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Spec-driven (spec written before implementation) | ✓ PASS | spec.md complete |
| No new unreviewed paid APIs | ✓ PASS | No new APIs; extends existing Groq/OpenAI/Azure/Gemini abstraction |
| All LLM calls mocked in CI | ✓ PASS | Existing mock pattern from spec 005 extended |
| Simplicity — no premature abstraction | ✓ PASS | Extends existing provider protocol; no new abstraction layers |
| Schema migrations versioned | ✓ PASS | Two migrations: Entity.is_flagged, Project.provider+model |
| Prompts versioned in prompts/ | ✓ PASS | Two new prompt templates: entity_summary_rag.txt, nl_query_rag.txt |
| Open-source stack only | ✓ PASS | sentence-transformers already in stack; no new dependencies |
| Tests before PR | ✓ PASS | Test-after acceptable per constitution; tests required before PR |
| DRY — no duplicate logic | ✓ PASS | Reuses existing JointExtractionProvider protocol, run_with_retry, ContextualEntitySummary cache |

**Post-design re-check**: ✓ PASS — all design decisions stay within existing architecture. The `Chunk` model's existing `VectorField(dimensions=384)` is used directly; no new embedding infrastructure required.

## Project Structure

### Documentation (this feature)

```text
specs/011-intelligence-layer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── ingestion/
│   ├── models.py                   ← Project model: add provider, model fields
│   └── migrations/                 ← New migration: 0xxx_project_provider_model.py
├── ner/
│   ├── models.py                   ← Entity model: add is_flagged field
│   ├── migrations/                 ← New migration: 0xxx_entity_is_flagged.py
│   ├── views.py                    ← ProjectQueryView (semantic search + NL query)
│   │                                  EntitySummaryView (LLM RAG)
│   │                                  EntityFlagView (new)
│   │                                  DeduplicationReviewView (new, project-scoped)
│   │                                  GlobalEntityListView (new)
│   │                                  EntityTimelineView (new)
│   │                                  ProjectProviderView (new)
│   ├── serializers.py              ← New serializers for review, flag, timeline, global entities
│   ├── urls.py                     ← New routes for all new views
│   └── services/
│       ├── semantic_search.py      ← New: pgvector cosine similarity query over Chunk embeddings
│       ├── contextual_summary.py   ← Extend: replace _generate_summary_text with LLM RAG call
│       └── nl_query.py             ← New: NL question detection + LLM RAG answer generation
├── prompts/
│   ├── entity_summary_rag.txt      ← New: RAG summarization prompt template
│   └── nl_query_rag.txt            ← New: NL query answer prompt template
└── tests/
    ├── test_semantic_search.py     ← New
    ├── test_entity_flag.py         ← New
    ├── test_dedup_review_api.py    ← New
    ├── test_entity_timeline.py     ← New
    ├── test_global_entities.py     ← New
    └── test_nl_query.py            ← New

frontend/
├── pages/
│   ├── entities/
│   │   └── index.tsx               ← New: global /entities page
│   └── projects/[id]/
│       ├── map.tsx                 ← Extend: NL query result panel + semantic search integration
│       ├── documents.tsx           ← Extend: per-document stats + expandable rows
│       ├── review.tsx              ← New: /projects/{id}/review dedup queue page
│       └── settings.tsx            ← Extend: provider selection dropdown
└── src/
    ├── components/
    │   ├── GraphVisualization.tsx  ← Extend: NL answer panel above graph
    │   └── layout/
    │       └── Sidebar.tsx         ← Extend: global Entities link + dedup badge + provider display
    └── lib/
        └── api.ts                  ← Extend: semantic search, flag, review, timeline, global entities, provider APIs
```

**Structure Decision**: Monorepo — backend (Django) + frontend (Next.js 14 pages router). All new backend logic goes into `ner/` services as focused modules. Frontend pages follow the existing pattern at `frontend/pages/` (not under src/). New services `semantic_search.py` and `nl_query.py` are self-contained; `contextual_summary.py` is extended in-place.

## Complexity Tracking

No constitution violations. The two new Django migrations and two new prompt templates are required by the spec and represent the minimum change needed. The semantic search service reuses the existing `Chunk.embedding` field and `all-MiniLM-L6-v2` model already in the Docker volume — no new infrastructure.
