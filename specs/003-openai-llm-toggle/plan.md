# Implementation Plan: Multi-LLM NER Selection

**Branch**: `003-openai-llm-toggle` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-openai-llm-toggle/spec.md`

## Summary

Add optional OpenAI support to the existing Groq-based NER flow by introducing a provider abstraction in the backend pipeline, keeping Groq as default behavior, and adding frontend controls for provider/model selection per extraction run. Persist per-run metadata (provider, model, tokens, cached tokens, cost) in a new `NER_RUN` table so each document can retain multiple extraction runs and show run history with usage/cost transparency. Maintain current downstream JSON shape and relation-pipeline compatibility by enforcing provider output normalization to the existing Groq-compatible schema.

## Technical Context

**Language/Version**: Python 3.11 (Django backend), TypeScript/React (Next.js frontend)  
**Primary Dependencies**: Django 4.2, Django REST Framework, groq SDK (existing), OpenAI Python SDK (new), pytest/pytest-django, axios, Next.js  
**Storage**: PostgreSQL (Supabase) via Django ORM; new `NER_RUN` relational table linked to documents  
**Testing**: pytest + pytest-django backend tests, Jest frontend tests, mocked LLM responses (no live LLM in CI)  
**Target Platform**: Dockerized Linux services (backend and frontend) for local dev and staging  
**Project Type**: Web application (REST backend + Next.js frontend)  
**Performance Goals**: Preserve current extraction latency profile for Groq path; OpenAI path adds no extra round trips beyond provider call; run metadata available in extraction response and history APIs immediately after completion  
**Constraints**: Keep existing Groq behavior unchanged; preserve existing entity output schema; cost computed server-side; API keys sourced from `.env`; synchronous extraction flow remains in MVP  
**Scale/Scope**: Multiple NER runs per document, two new OpenAI models (`gpt-5-mini`, `gpt-5-nano`), cost/usage visibility per run and in document run history

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Spec-Driven workflow | PASS | Spec exists at `specs/003-openai-llm-toggle/spec.md` before implementation |
| Modularity | PASS | Provider abstraction keeps `ner/services` modular and isolates provider logic |
| Explicit contracts | PASS | API/frontend contracts defined in `contracts/` for new request/response fields |
| Observability | PASS | Per-run provider/model/token/cost metadata expands LLM observability requirements |
| Supabase/PostgreSQL source of truth | PASS | `NER_RUN` persisted in PostgreSQL via Django migrations |
| Schema migrations committed | PASS | New table and model changes planned via Django migration(s) |
| No LLM calls in CI | PASS | Tests use mocked Groq/OpenAI client responses |
| Prompts versioned | PASS | Existing `prompts/ner-extraction-v1.md` retained across providers |
| Open by default | PASS (justified) | Groq remains default/free path; OpenAI is optional and explicitly justified for improved model quality |
| KISS / YAGNI | PASS | Reuses current chunking/batching flow; no queueing/celery introduced |

**Post-design re-check**: PASS. Phase 1 artifacts maintain all constitution gates without introducing violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-openai-llm-toggle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── frontend.md
└── tasks.md                # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
stakeholder-analysis-tool/
├── ner/
│   ├── models.py                    # add NER_RUN model + run linkage updates
│   ├── serializers.py               # add run serializers + extraction response fields
│   ├── views.py                     # accept provider/model; return run metadata
│   ├── urls.py                      # add run-history endpoint(s)
│   ├── services/
│   │   ├── pipeline.py              # provider-agnostic orchestration
│   │   ├── groq_client.py           # existing logic preserved via provider adapter
│   │   ├── openai_client.py         # new OpenAI provider integration
│   │   ├── provider_factory.py      # provider/model selection and validation
│   │   └── costing.py               # server-side token cost calculation
│   ├── migrations/
│   └── tests/
├── frontend/
│   ├── src/lib/api.ts               # add provider/model params + run-history calls
│   ├── src/types/index.ts           # add NER run metadata types
│   ├── pages/upload.tsx             # provider/model selectors and extraction metadata display
│   └── pages/entities.tsx           # run history, provider/model, token/cost display
├── prompts/
│   └── ner-extraction-v1.md         # unchanged prompt contract reused by both providers
└── stakeholder_analysis/settings.py # read OPENAI_API_KEY and provider config
```

**Structure Decision**: Keep the existing Django + Next.js monorepo structure. Add provider abstraction and run tracking inside the current `ner` app to avoid cross-app complexity and keep behavior changes localized.

## Phase 0 — Research

Research outcomes are documented in [research.md](research.md), covering:

- Provider abstraction strategy and compatibility with existing Groq behavior.
- OpenAI usage-token handling and robust server-side cost calculation with nullable usage fields.
- Backward-compatible API/frontend integration for multiple runs per document.

## Phase 1 — Design Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Data model | [data-model.md](data-model.md) | Defines `NER_RUN` entity, relationships, and validation |
| API contract | [contracts/api.md](contracts/api.md) | Defines provider/model request fields and run metadata responses |
| Frontend contract | [contracts/frontend.md](contracts/frontend.md) | Defines UI behavior and client API interfaces |
| Quickstart | [quickstart.md](quickstart.md) | Provides local configuration, test flow, and API examples |

## Complexity Tracking

No constitution violations requiring complexity exceptions.
