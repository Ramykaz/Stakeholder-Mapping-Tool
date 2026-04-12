# Stakeholder Analysis Tool

AI-powered stakeholder analysis platform for UNDP. Ingests policy documents, extracts named entities and relationships, builds knowledge graphs, and supports RAG-based reasoning over stakeholder networks.

## Features

### Graph Visualization
- **Node Visual Consistency**: All graph nodes are circles sized by degree (influence score, 28–72 px), border color by entity type, with a visible size legend
- **Theme-Adaptive Canvas**: D3 graph canvas background and label readability update instantly on light/dark theme toggle (no reload)
- **Live Filtering Panel**: Filter entities by type (checkboxes), confidence threshold (slider), and minimum degree (slider) — all client-side, no backend refetch
- **Cluster Layout**: Toggle between default force-directed layout and type-based cluster layout (groups nodes by entity type)
- **Persistent Focus Mode**: Click any node to enter focus mode — dims the rest of the graph, shows 1-hop or 2-hop neighbourhood, opens a side panel with entity details; exit via toolbar button or Escape

### Workspace & Navigation
- **Sidebar Project List**: Project list in sidebar with status indicators (active/draft/archived), entity count, and a three-dot dropdown per project (Edit → settings page, Delete → confirmation modal)
- **Project Cards (Dashboard)**: Projects dashboard with Edit modal (rename + update description inline) and type-to-confirm Delete modal — no more browser `confirm()` dialogs
- **Persistent Concept Note Editor**: "Edit concept note" is always accessible from the sidebar under each project and from the Analyze page
- **Dark Design System**: Full dark UI with light/dark toggle, DM Serif Display + Outfit + DM Mono fonts, CSS design tokens, and a consistent component library

### Analysis Pipeline
- **Document Ingestion**: Upload PDF, DOCX, TXT, or Markdown (`.md`) files (up to 50 MB) with background processing, status badges, and polling
- **Incremental Extraction States**: Project extraction targets only new documents by default, shows per-document extraction state, and supports one-click re-extract per document
- **Document Review Actions**: Per-document review panel with lazy-loaded Entities/Relationships tabs, inline relabel, and delete actions
- **Evidence Integrity**: Document counters and review rows are mention-backed, and evidence excerpts are generated from cleaned text spans that include the referenced entities
- **Web Ingestion Sources**: Add URL, crawl (bounded depth), or pasted text sources that flow into the same document chunking/embedding pipeline
- **Entity Extraction**: Extract PERSON, ORGANIZATION, LOCATION, ROLE, EVENT, and more using LLMs (Groq / OpenAI / Azure OpenAI / Gemini)
- **Relation Extraction**: Identify directional relationships between entities (e.g. REPORTS_TO, EMPLOYS, MANAGES)
- **Joint Extraction + Labels**: Two-pass extraction for entities and relations in a single API call; typed relation labels
- **Entity Deduplication + Aliases**: Save-time exact/acronym/fuzzy dedup, alias tracking, and review workflow for borderline matches
- **Provider Flexibility**: Shared provider abstraction — switch between Groq, OpenAI, Azure OpenAI, and Gemini without code changes

### Generation Workflow
- **SMQ (8 sections)**: Per-project stakeholder mapping questionnaire with section-focused generation and analyst notes
- **Report Generation**: Per-section report generation using semantic retrieval + project context, with stale detection and regeneration controls
- **Personas**: AI persona generation grouped by stakeholder entity type
- **Workplan**: AI workplan generation using Section 6 when available, with fallback to other completed report sections + project context
- **Export**: PDF/DOCX export with conditional appendices for personas and workplan, plus standalone workplan PDF/DOCX export

### Project Management
- **Project-Scoped Workflow**: Create project → write concept note → upload documents → run extraction → explore graph map
- **Concept Note API**: Store and retrieve free-text project context; used to guide extraction and reasoning
- **Authentication + Roles**: Split-panel login/register with token auth; admin-only taxonomy management
- **Entity Detail Pages**: Per-entity profile with confidence bar, aliases, contextual AI summary, and relationships
- **Entity Mini-Graph**: Static 1-hop neighborhood mini-graph on entity detail with click-through navigation

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14 · TypeScript · D3.js · CSS Design Tokens |
| **Backend** | Python 3.11 · Django 4.2 · Django REST Framework |
| **Database** | PostgreSQL 15 + pgvector (via Supabase) |
| **Embeddings** | all-MiniLM-L6-v2 (local, sentence-transformers) |
| **LLM Providers** | Groq (Llama 3) · OpenAI · Azure OpenAI · Gemini |
| **Infrastructure** | Docker · Docker Compose |

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- Git
- A [Supabase](https://supabase.com) project with pgvector enabled

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string |
| `SECRET_KEY` | Yes (prod) | Django secret key (must not use dev default in production) |
| `DEBUG` | Yes | `True` for development, `False` for production |
| `ALLOWED_HOSTS` | Yes | Comma-separated list (e.g. `localhost,127.0.0.1`) |
| `GROQ_API_KEY` | Recommended | Groq API key (default LLM provider for NER/reasoning) |
| `OPENAI_API_KEY` | Optional | Required only when OpenAI provider is selected for NER |
| `AZURE_OPENAI_ENDPOINT` | Optional | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | Optional | Azure OpenAI deployment name |
| `AZURE_OPENAI_API_KEY` | Optional | Azure OpenAI API key |
| `GEMINI_API_KEY` | Optional | Required only when Gemini provider is selected for NER |
| `ADMIN_EMAIL_DOMAIN` | Optional | Domain required for auto-admin eligibility (default: `undp.org`) |
| `ADMIN_AUTO_ADMIN_EMAILS` | Optional | Comma-separated allowlist for auto-admin registration emails |
| `SECURE_SSL_REDIRECT` | Recommended (prod) | Redirect HTTP to HTTPS |
| `SECURE_HSTS_SECONDS` | Recommended (prod) | HSTS max-age (set `31536000` for production) |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | Recommended (prod) | Include subdomains in HSTS |
| `SECURE_HSTS_PRELOAD` | Optional (prod) | Enable HSTS preload flag |
| `SESSION_COOKIE_SECURE` | Recommended (prod) | Send session cookie over HTTPS only |
| `CSRF_COOKIE_SECURE` | Recommended (prod) | Send CSRF cookie over HTTPS only |
| `CSRF_TRUSTED_ORIGINS` | Optional | Comma-separated trusted origins for cross-site POSTs |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Public frontend URL used for sitemap/robots links |
| `REDIS_URL` | Recommended | Redis URL used by cache/background jobs (default: `redis://redis:6379/0`) |
| `CELERY_BROKER_URL` | Recommended | Celery broker URL (default: `redis://redis:6379/0`) |
| `CELERY_RESULT_BACKEND` | Recommended | Celery result backend URL (default: `redis://redis:6379/0`) |

## Local Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd stakeholder-analysis-tool
cp .env.example .env
# Edit .env — fill in DATABASE_URL, DEBUG, ALLOWED_HOSTS, GROQ_API_KEY
# Add OPENAI_API_KEY / Azure / Gemini variables for those provider paths
```

### 2. Enable pgvector on Supabase

In your Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Build and start the stack

```bash
docker compose up --build -d
```

Migrations run automatically on startup. The embedding model is baked into the Docker image, so no manual model download step is required.

Frontend: `http://localhost:3000`  
API: `http://localhost:8000`

### 4. Verify

```bash
curl http://localhost:8000/health
# → {"status": "healthy", "database": "connected"}

docker compose ps
# app should become healthy
```

## Deploy on a New Machine (Docker)

1. Install Docker + Docker Compose v2 and Git.
2. Clone repo and create env file:

```bash
git clone <repo-url>
cd stakeholder-analysis-tool
cp .env.example .env
```

3. Set production-safe values in `.env`:
  - `DEBUG=False`
  - `SECRET_KEY=<strong-random-secret>`
  - `ALLOWED_HOSTS=<your-domain-or-ip>`
  - `SECURE_SSL_REDIRECT=True`
  - `SECURE_HSTS_SECONDS=31536000`
  - `SECURE_HSTS_INCLUDE_SUBDOMAINS=True`
  - `SESSION_COOKIE_SECURE=True`
  - `CSRF_COOKIE_SECURE=True`
  - `CSRF_TRUSTED_ORIGINS=https://<your-domain>`
  - `NEXT_PUBLIC_SITE_URL=https://<your-domain>`

4. Start services:

```bash
docker compose up --build -d
```

5. Validate runtime:

```bash
curl http://localhost:8000/health
docker compose ps
docker compose logs app --tail 100
docker compose logs worker --tail 100
docker compose logs redis --tail 100
```

If you deploy behind a reverse proxy (Nginx/Caddy/Cloud load balancer), terminate TLS there and forward traffic to ports `3000` (frontend) and `8000` (backend).

## Background Jobs (Celery + Redis)

This project uses Celery workers for asynchronous generation tasks and Redis as broker/result backend.

- Compose services:
  - `redis` (port `6379`)
  - `worker` (Celery worker process)
- Defaults in `docker-compose.yml`:
  - `CELERY_BROKER_URL=redis://redis:6379/0`
  - `CELERY_RESULT_BACKEND=redis://redis:6379/0`

Useful checks:

```bash
docker compose ps
docker compose logs worker --tail 100
docker compose logs redis --tail 100
docker compose exec worker celery -A stakeholder_analysis status
```

If you run Redis outside Compose, set `REDIS_URL`, `CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND` in `.env` to your external Redis endpoint.

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page — redirects to `/projects` when signed in |
| `/login` | Split-panel sign-in / register |
| `/projects` | Projects dashboard with card grid (Edit + Delete modals) |
| `/projects/{id}/setup` | Concept note editor — always editable, accessible from sidebar |
| `/projects/{id}/documents` | Document upload (`.pdf`, `.docx`, `.txt`, `.md`), web sources, and processing status |
| `/projects/{id}/analyze` | Extraction controls + link back to concept note editor |
| `/projects/{id}/map` | Interactive graph map (filter panel, focus mode, NL query, legend) |
| `/projects/{id}/settings` | Project settings (rename, description, LLM provider/model selection + connection test) |
| `/projects/{id}/entities/{entityId}` | Entity detail — aliases, AI summary, relationships, timeline, unflag |
| `/projects/{id}/review` | Dedup review queue — merge or keep-separate for borderline entity pairs |
| `/entities` | Global entity view across all projects, sorted by cross-project frequency |

## API Reference

### Auth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register/` | POST | Register user and return auth token |
| `/api/v1/auth/login/` | POST | Login and return auth token |
| `/api/v1/auth/logout/` | POST | Logout and invalidate current token |
| `/api/v1/auth/me/` | GET | Authenticated user profile and role |

### Projects

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/projects/` | GET, POST | List / create projects |
| `/api/v1/projects/{id}/` | GET, PATCH, DELETE | Project detail / update / delete |
| `/api/v1/projects/{id}/concept-note/` | GET, POST | Read / upsert concept note |
| `/api/v1/projects/{id}/documents/` | GET, POST | List / upload project documents |
| `/api/v1/projects/{id}/web-sources/` | GET, POST | List / create web ingestion sources (url/crawl/paste) |
| `/api/v1/projects/{id}/web-sources/{webSourceId}/` | DELETE | Delete a web ingestion source |
| `/api/v1/projects/{id}/documents/{doc_id}/` | DELETE | Delete a project document |
| `/api/v1/settings/llm/test/` | GET | Test selected provider/model connectivity (`provider`, `model` query params) |
| `/api/v1/projects/{id}/documents/{doc_id}/status/` | GET | Poll processing status |
| `/api/v1/projects/{id}/documents/{doc_id}/reextract/` | POST | Re-run extraction for one document |
| `/api/v1/projects/{id}/extract-entities/` | POST | Run entity extraction for new (unextracted) project documents |
| `/api/v1/projects/{id}/documents/{doc_id}/entities/` | GET | Document review entities (confidence, mentions, excerpt) |
| `/api/v1/projects/{id}/documents/{doc_id}/relationships/` | GET | Document review relationships (source, label, target, excerpt) |
| `/api/v1/projects/{id}/documents/{doc_id}/entities/{entity_id}/` | DELETE | Remove document entity mention and cleanup orphans |
| `/api/v1/projects/{id}/documents/{doc_id}/relationships/{rel_id}/` | PATCH, DELETE | Relabel or delete a document relationship |
| `/api/v1/projects/{id}/workplan/export/` | GET | Download standalone workplan export (`format=pdf|docx`) |
| `/api/v1/projects/{id}/entities/` | GET | List all entities in project scope |
| `/api/v1/projects/{id}/entities/{entity_id}/` | GET, PATCH | Entity detail and canonical correction |
| `/api/v1/projects/{id}/graph/` | GET | Project knowledge graph (nodes + edges for D3 frontend rendering) |
| `/api/v1/projects/{id}/query/` | POST | NL keyword search — returns matching entity IDs + answer |

### Entities & Graph

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/entities/{id}/profile/` | GET | Entity profile — aliases, relationships, projects |
| `/api/v1/entities/{id}/summary/` | POST | Generate contextual AI summary for an entity |
| `/api/v1/documents/{id}/extract-entities-relations/` | POST | Two-pass extraction (entities + relations) |
| `/api/v1/documents/{id}/relations/` | GET | Relation triplets for a document |
| `/api/v1/graph/` | GET | Document-scoped knowledge graph (legacy) |
| `/health` | GET | Service liveness and DB connectivity |

## Extract Entities and Relations

### Entities Only

```bash
curl -X POST "http://localhost:8000/api/v1/projects/{id}/extract-entities/" \
  -H "Authorization: Token <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"provider": "groq", "model": "llama-3.1-8b-instant"}'
# → HTTP 201 with entities_created, tokens, cost_usd
```

### Entities + Relations (Two-Pass)

```bash
curl -X POST "http://localhost:8000/api/v1/documents/{document_id}/extract-entities-relations/" \
  -H "Authorization: Token <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"provider": "groq", "model": "llama-3.1-8b-instant"}'
# → HTTP 201 with entities_created, relations_created, tokens, cost_usd
```

### View Knowledge Graph

```bash
curl "http://localhost:8000/api/v1/projects/{id}/graph/" \
  -H "Authorization: Token <your-token>"
# → HTTP 200 with nodes (entities) and edges (relations) in Cytoscape.js format
```

## Running Tests

```bash
# Backend
docker compose run --rm --entrypoint pytest app -q

# Frontend (runtime frontend image is production-only, so run tests in a Node container)
docker run --rm -v "${PWD}/frontend:/app" -w /app node:20 sh -lc "npm ci; npm test -- --runInBand"
```

Tests use mocked embeddings — no model weights or API keys required in CI.

## Recommended First Run Workflow

1. Create a project and complete the initiative profile.
2. Upload sources from the Documents page (`.pdf`, `.docx`, `.txt`, `.md`) or add URL/crawl/paste sources.
3. Run extraction from Analyze.
4. Review graph relationships from Map.
5. Complete SMQ sections and generate report sections.
6. Generate stakeholder table, personas, and workplan.
7. Export final report as PDF or DOCX.

## Project Structure

```
stakeholder-analysis-tool/
├── stakeholder_analysis/       Django project config
├── ingestion/                  Document ingestion (models, views, services)
├── ner/                        Entity/relation extraction + generation services
├── reasoning/                  Reasoning module
├── graph/                      Graph app module
├── prompts/                    Versioned LLM prompt templates
├── models/                     Docker volume: embedding model weights
├── frontend/
│   ├── pages/                  Next.js pages router
│   │   └── projects/[id]/      Per-project workspace pages
│   └── src/
│       ├── components/         React components
│       ├── lib/                API + utility modules
│       └── types/              Shared TypeScript types
└── specs/                      Spec-driven feature docs
```

## Role Model

- **Regular users**: upload/extraction/graph workflows
- **Admin users** (`is_staff=true`): additionally access `/admin` taxonomy management and `/api/v1/admin/*` APIs
- Registration is open; auto-admin is granted only when email matches both `ADMIN_AUTO_ADMIN_EMAILS` and `@ADMIN_EMAIL_DOMAIN`

## Entity Deduplication Configuration

- Fuzzy dedup uses RapidFuzz (`token_sort_ratio` + `partial_ratio`)
- Auto-merge threshold: similarity `>= 0.85`
- Review-required band: `0.70 <= similarity < 0.85`
- Acronym expansion is database-driven via `AcronymMap` seed data (UNDP, WHO, SDG, UNICEF, FAO, …)
- Cross-type entities are never merged (e.g. same text but different `entity_type`)

## Specs

This project uses [Spec-Kit](https://github.com/SDG-AI-Lab/speckit) (spec-driven development). All features are specified and planned before implementation:

| Spec | Feature |
|------|---------|
| [001-doc-ingestion-pipeline](specs/001-doc-ingestion-pipeline/) | Document ingestion — upload, parse, embed PDF/DOCX/TXT/MD |
| [002-ner-pipeline](specs/002-ner-pipeline/) | Named entity recognition pipeline (spaCy + LLM) |
| [003-openai-llm-toggle](specs/003-openai-llm-toggle/) | Multi-provider LLM toggle (Groq / OpenAI / Azure / Gemini) |
| [004-entity-relation-extraction](specs/004-entity-relation-extraction/) | Relation extraction — directional triplets with confidence scores |
| [005-llm-joint-extraction-labels](specs/005-llm-joint-extraction-labels/) | Joint entity + relation extraction with typed labels |
| [006-entity-dedup-aliases](specs/006-entity-dedup-aliases/) | Entity deduplication, alias tracking, and review workflow |
| [007-project-model-concept-note-api](specs/007-project-model-concept-note-api/) | Project model, concept note API, and project-scoped endpoints |
| [008-ui-and-graph-redesign](specs/008-ui-and-graph-redesign/) | Dark design system — fonts, tokens, component library, graph canvas |
| [009-complete-ui-rewiring](specs/009-complete-ui-rewiring/) | Full UI rewiring — sidebar, workspace flow, light/dark toggle |
| [010-graph-visualization-fixes](specs/010-graph-visualization-fixes/) | Graph node sizing, theme-adaptive canvas, live filters, focus mode, project CRUD modals |
| [011-intelligence-layer](specs/011-intelligence-layer/) | Semantic search (pgvector), LLM RAG summaries, entity flagging, dedup review queue, entity timeline, NL query, global entity view, per-project LLM provider selection |
| [013-structured-intake-report](specs/013-structured-intake-report/) | Structured initiative intake and report context pipeline |
| [014-personas-workplan-export](specs/014-personas-workplan-export/) | Persona/workplan generation and export workflows |
| [015-ux-graph-llm-overhaul](specs/015-ux-graph-llm-overhaul/) | UX overhaul for graph and LLM-assisted project workflows |
| [016-document-extraction-integrity](specs/016-document-extraction-integrity/) | Incremental extraction, document review integrity, cleaned evidence, and mini-graph enhancements |
