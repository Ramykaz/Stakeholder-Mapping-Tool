# Implementation Plan: Document Ingestion Pipeline

**Branch**: `001-doc-ingestion-pipeline` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-doc-ingestion-pipeline/spec.md`

---

## Summary

Build the foundational Django-based REST API that accepts PDF, DOCX, and TXT file uploads (max 50 MB), extracts text, chunks it semantically using spaCy sentence segmentation, generates 384-dimensional embeddings via a locally-loaded all-MiniLM-L6-v2 model, and stores all chunks atomically in Supabase (PostgreSQL + pgvector). The project also delivers the Django project skeleton (four registered apps: ingestion, ner, reasoning, graph), a Docker Compose local development environment, environment-variable-based configuration, and a `/health` endpoint.

---

## Technical Context

**Language/Version**: Python 3.11
**Primary Dependencies**: Django 4.2, Django REST Framework, sentence-transformers, spaCy (`en_core_web_sm`), pypdf, python-docx, psycopg2-binary, pgvector (Python client), gunicorn
**Storage**: Supabase — PostgreSQL 15 + pgvector extension; IVFFlat index on `chunks.embedding` (cosine metric, lists=100)
**Testing**: pytest, pytest-django; embedding and LLM calls mocked in all tests
**Target Platform**: Linux (Docker container); Docker Compose for local development
**Project Type**: Web service — REST API
**Performance Goals**: 50 MB document fully ingested within 60 seconds; `/health` responds within 1 second
**Constraints**: Max 50 MB upload; synchronous processing (no Celery); raw files discarded after processing; no authentication (MVP)
**Scale/Scope**: MVP — hundreds to low thousands of documents; single gunicorn worker per container; 1.5–2 GB Docker memory limit

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Docker from Day-1 | ✅ Pass | Docker Compose required; no "works on my machine" |
| Supabase as single source of truth | ✅ Pass | All data in Supabase; no local SQLite |
| pgvector enabled | ✅ Pass | FR-012; migration enables extension |
| Schema Migrations | ✅ Pass | Django migrations committed to repo |
| Modularity (4 apps) | ✅ Pass | ingestion, ner, reasoning, graph each self-contained |
| Observability (/health) | ✅ Pass | FR-008; endpoint required |
| KISS / YAGNI | ✅ Pass | Synchronous MVP; no auth; no async; no deduplication |
| Explicit Contracts | ✅ Pass | contracts/api.md defined before implementation |
| Deterministic Builds | ✅ Pass | requirements.txt with pinned versions; no `latest` Docker tags |
| No LLM calls in CI | ✅ Pass | all-MiniLM-L6-v2 is an embedding model; calls mocked in tests |
| Prompts versioned | ✅ N/A | No prompts used in this story |
| Tests before PR | ✅ Required | pytest suite must pass before PR submission |
| Open by Default | ✅ Pass | all-MiniLM-L6-v2 is open-source; no paid embedding API |

**Post-design re-check**: All constitution gates remain satisfied. No violations introduced by Phase 1 design.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-doc-ingestion-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
stakeholder-analysis-tool/
├── manage.py
├── requirements.txt              # All deps pinned
├── Dockerfile
├── docker-compose.yml
├── .env.example                  # Template with all required variables
│
├── stakeholder_analysis/         # Django project package
│   ├── __init__.py
│   ├── settings.py               # Reads all config from environment variables
│   ├── urls.py                   # Registers /health + api/v1/ routes
│   ├── wsgi.py
│   └── asgi.py
│
├── ingestion/                    # Django app — document ingestion
│   ├── apps.py                   # AppConfig: loads embedding model singleton in ready()
│   ├── models.py                 # Document, Chunk models
│   ├── views.py                  # IngestView (POST), HealthView (GET)
│   ├── serializers.py            # DocumentSerializer
│   ├── urls.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── extractor.py          # Text extraction: pypdf, python-docx, plain text
│   │   ├── chunker.py            # spaCy sentence segmentation + token-count verification
│   │   └── embedder.py           # sentence-transformers wrapper (singleton consumer)
│   ├── migrations/
│   │   └── 0001_initial.py       # Creates documents, chunks tables + IVFFlat index
│   └── tests/
│       ├── test_views.py
│       ├── test_extractor.py
│       ├── test_chunker.py
│       └── test_embedder.py
│
├── ner/                          # Django app stub (registered, no models yet)
│   ├── apps.py
│   └── migrations/
│
├── reasoning/                    # Django app stub (registered, no models yet)
│   ├── apps.py
│   └── migrations/
│
├── graph/                        # Django app stub (registered, no models yet)
│   ├── apps.py
│   └── migrations/
│
├── models/                       # Docker volume mount point: all-MiniLM-L6-v2 weights
│
└── prompts/                      # Future: versioned LLM prompt templates (empty for now)
```

**Structure Decision**: Single Django project with the four apps separated as self-contained modules per the constitution's modularity principle. All cross-app communication goes through explicit interfaces (no direct model imports across app boundaries in this story). Source code lives at repository root — no nested `src/` wrapper, matching Django conventions.

---

## Phase 0 — Research

See [research.md](research.md) for full findings. Key decisions:

| Topic | Decision |
|-------|---------|
| Chunk size | 200–256 tokens with 32–48 token overlap |
| Chunking library | spaCy (`en_core_web_sm`) + AutoTokenizer for verification |
| pgvector index | IVFFlat, lists=100, cosine metric, created at migration time |
| Model loading | AppConfig.ready() singleton; local volume mount (HF_HOME=/app/models) |
| Container memory | 1.5–2 GB Docker limit; ~300–400 MB per worker |

---

## Phase 1 — Design Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Data model | [data-model.md](data-model.md) | Document + Chunk entities, state machine, pgvector index spec |
| API contracts | [contracts/api.md](contracts/api.md) | POST /api/v1/documents/, GET /health — request/response schemas |
| Quickstart | [quickstart.md](quickstart.md) | Developer setup guide: env, model download, Docker, first upload |

---

## Complexity Tracking

No constitution violations. No complexity justification required.
