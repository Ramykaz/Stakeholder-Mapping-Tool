# Stakeholder Analysis Tool

AI-powered stakeholder analysis platform for UNDP. Ingests policy documents, extracts named entities and relationships, builds knowledge graphs, and supports RAG-based reasoning over stakeholder networks.

## Features

- **Document Ingestion**: Upload PDF, DOCX, or TXT files (up to 50MB)
- **Entity Extraction**: Extract PERSON, ORGANIZATION, LOCATION, and ROLE entities using LLMs (Groq/OpenAI)
- **Relation Extraction**: Identify directional relationships between entities (e.g., REPORTS_TO, EMPLOYS, MANAGES)
- **Knowledge Graph Visualization**: Interactive graph with entity nodes (shape-coded by type) and labeled relation edges
- **Dual Extraction Modes**:
  - **Entities Only**: Extract and deduplicate named entities
  - **Entities + Relations**: Two-pass extraction for entities and their relationships
- **Provider Flexibility**: Shared provider abstraction supports Groq, OpenAI, Azure OpenAI, and Gemini model paths
- **Authentication + Roles**: User registration/login with token auth; admin-only taxonomy management
- **Entity Deduplication + Aliases (US-06)**: Save-time exact/acronym/fuzzy dedup, alias tracking, and review workflow for borderline matches

## Tech Stack

- **Backend**: Python 3.11 · Django 4.2 · Django REST Framework
- **Database**: Supabase (PostgreSQL + pgvector)
- **Embeddings**: all-MiniLM-L6-v2 (local, sentence-transformers)
- **LLM**: Groq (Llama 3) · Ollama (fallback)
- **Infrastructure**: Docker · Docker Compose

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- Git
- A [Supabase](https://supabase.com) project with pgvector enabled

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string |
| `DEBUG` | Yes | `True` for development, `False` for production |
| `ALLOWED_HOSTS` | Yes | Comma-separated list (e.g. `localhost,127.0.0.1`) |
| `GROQ_API_KEY` | Recommended | Groq API key (used by NER/reasoning apps) |
| `OPENAI_API_KEY` | Optional | OpenAI API key (required only when OpenAI provider is selected for NER) |
| `AZURE_OPENAI_ENDPOINT` | Optional | Azure OpenAI endpoint URL (required when Azure provider is selected) |
| `AZURE_OPENAI_DEPLOYMENT` | Optional | Azure OpenAI deployment name (required when Azure provider is selected) |
| `AZURE_OPENAI_API_KEY` | Optional | Azure OpenAI API key (runtime required for Azure extraction calls) |
| `GEMINI_API_KEY` | Optional | Gemini API key (required only when Gemini provider is selected for NER) |
| `ADMIN_EMAIL_DOMAIN` | Optional | Domain required for auto-admin eligibility (default: `undp.org`) |
| `ADMIN_AUTO_ADMIN_EMAILS` | Optional | Comma-separated allowlist for auto-admin registration emails |

## Local Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd stakeholder-analysis-tool
cp .env.example .env
# Edit .env and fill in DATABASE_URL, DEBUG, ALLOWED_HOSTS, GROQ_API_KEY
# Add OPENAI_API_KEY if you plan to run NER with OpenAI models
# Add Azure/Gemini variables if you plan to run those provider paths
```

### 2. Enable pgvector on Supabase

In your Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Download the embedding model (one-time)

```bash
docker compose run --rm app python -c \
  "from sentence_transformers import SentenceTransformer; \
   SentenceTransformer('all-MiniLM-L6-v2').save('/app/models/all-MiniLM-L6-v2')"
```

### 4. Start the stack

```bash
docker compose up
```

Migrations run automatically on startup.

### 5. Verify

```bash
curl http://localhost:8000/health
# → {"status": "healthy", "database": "connected"}
```

## Extract Entities and Relations

### Extract Entities Only

```bash
curl -X POST "http://localhost:8000/api/v1/documents/{document_id}/extract-entities/" \
  -H "Content-Type: application/json" \
  -d '{"provider": "groq", "model": "llama-3.1-8b-instant"}'
# → HTTP 201 with entities_created, tokens, cost_usd
```

### Extract Entities + Relations (Two-Pass)

```bash
curl -X POST "http://localhost:8000/api/v1/documents/{document_id}/extract-entities-relations/" \
  -H "Content-Type: application/json" \
  -d '{"provider": "groq", "model": "llama-3.1-8b-instant"}'
# → HTTP 201 with entities_created, relations_created, tokens, cost_usd
```

### View Relations

```bash
curl "http://localhost:8000/api/v1/documents/{document_id}/relations/"
# → HTTP 200 with array of relation triplets (source, target, label, confidence)
```

### View Knowledge Graph

```bash
curl "http://localhost:8000/api/v1/graph/?document_id={document_id}&confidence_min=0.7"
# → HTTP 200 with nodes (entities) and edges (relations) in Cytoscape.js format
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/documents/` | POST | Upload and ingest a document |
| `/api/v1/auth/register/` | POST | Register user account and return auth token |
| `/api/v1/auth/login/` | POST | Login and return auth token |
| `/api/v1/auth/logout/` | POST | Logout and invalidate current token |
| `/api/v1/auth/me/` | GET | Get authenticated user profile and role |
| `/api/v1/documents/{id}/extract-entities/` | POST | Extract entities only |
| `/api/v1/documents/{id}/extract-entities-relations/` | POST | Extract entities and relations (two-pass) |
| `/api/v1/documents/{id}/entities/` | GET | List entities for a document |
| `/api/v1/documents/{id}/relations/` | GET | List relations for a document |
| `/api/v1/graph/` | GET | Get knowledge graph (nodes + edges) |
| `/health` | GET | Service liveness and DB connectivity |

### Role model

- Regular users: can use upload/extraction/graph workflows
- Admin users (`is_staff=true`): can additionally access `/admin` taxonomy management and related `/api/v1/admin/*` APIs
- Registration is open to both UNDP and non-UNDP users
- Auto-admin on registration happens only when email is both in `ADMIN_AUTO_ADMIN_EMAILS` and under `@ADMIN_EMAIL_DOMAIN`
- Non-admin users are blocked from taxonomy mutation endpoints with authorization errors

Full contract: [`specs/001-doc-ingestion-pipeline/contracts/api.md`](specs/001-doc-ingestion-pipeline/contracts/api.md), [`specs/004-entity-relation-extraction/contracts/`](specs/004-entity-relation-extraction/contracts/)

## Running Tests

```bash
docker compose run --rm app pytest --tb=short
```

Tests use mocked embeddings — no model weights or Groq API key required in CI.

## US-06 Dedup Configuration Notes

- Fuzzy dedup uses RapidFuzz (`token_sort_ratio` + `partial_ratio`) in backend persistence.
- Default thresholds:
  - auto-merge: similarity `>= 0.85`
  - review required: `0.70 <= similarity < 0.85`
- Acronym expansion is database-driven via `AcronymMap` seed data (UNDP, WHO, SDG, UNICEF, FAO, etc.).
- Cross-type entities are never merged (e.g., same text but different `entity_type`).

## Project Structure

```
stakeholder-analysis-tool/
├── stakeholder_analysis/   Django project config
├── ingestion/              Document ingestion app (models, views, services)
├── ner/                    Named entity recognition (future)
├── reasoning/              RAG reasoning (future)
├── graph/                  Knowledge graph (future)
├── models/                 Docker volume: embedding model weights
├── prompts/                Versioned LLM prompt templates
└── specs/                  Feature specifications (spec-driven development)
```

## Specs

This project uses Spec-Kit (spec-driven development). All features are specified before implementation:

- [`specs/001-doc-ingestion-pipeline/`](specs/001-doc-ingestion-pipeline/) — Document ingestion pipeline (US-01)