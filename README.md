# Stakeholder Analysis Tool

AI-powered stakeholder analysis platform for UNDP. Ingests policy documents, extracts named entities and relationships, builds knowledge graphs, and supports RAG-based reasoning over stakeholder networks.

## Features

### Graph Visualization
- **Node Visual Consistency**: All graph nodes are circles sized by degree (influence score, 28–72 px), border color by entity type, with a visible size legend
- **Theme-Adaptive Canvas**: Cytoscape canvas background and label outlines update instantly on light/dark theme toggle (no reload)
- **Live Filtering Panel**: Filter entities by type (checkboxes), confidence threshold (slider), and minimum degree (slider) — all client-side, no backend refetch
- **Cluster Layout**: Toggle between default force-directed layout and type-based cluster layout (groups nodes by entity type)
- **Persistent Focus Mode**: Click any node to enter focus mode — dims the rest of the graph, shows 1-hop or 2-hop neighbourhood, opens a side panel with entity details; exit via toolbar button or Escape

### Workspace & Navigation
- **Sidebar Project List**: Project list in sidebar with status indicators (active/draft/archived), entity count, and a three-dot dropdown per project (Edit → settings page, Delete → confirmation modal)
- **Project Cards (Dashboard)**: Projects dashboard with Edit modal (rename + update description inline) and type-to-confirm Delete modal — no more browser `confirm()` dialogs
- **Persistent Concept Note Editor**: "Edit concept note" is always accessible from the sidebar under each project and from the Analyze page
- **Dark Design System**: Full dark UI with light/dark toggle, DM Serif Display + Outfit + DM Mono fonts, CSS design tokens, and a consistent component library

### Analysis Pipeline
- **Document Ingestion**: Upload PDF, DOCX, or TXT files (up to 50 MB) with background processing, status badges, and polling
- **Entity Extraction**: Extract PERSON, ORGANIZATION, LOCATION, ROLE, EVENT, and more using LLMs (Groq / OpenAI / Azure OpenAI / Gemini)
- **Relation Extraction**: Identify directional relationships between entities (e.g. REPORTS_TO, EMPLOYS, MANAGES)
- **Joint Extraction + Labels**: Two-pass extraction for entities and relations in a single API call; typed relation labels
- **Entity Deduplication + Aliases**: Save-time exact/acronym/fuzzy dedup, alias tracking, and review workflow for borderline matches
- **Provider Flexibility**: Shared provider abstraction — switch between Groq, OpenAI, Azure OpenAI, and Gemini without code changes

### Project Management
- **Project-Scoped Workflow**: Create project → write concept note → upload documents → run extraction → explore graph map
- **Concept Note API**: Store and retrieve free-text project context; used to guide extraction and reasoning
- **Authentication + Roles**: Split-panel login/register with token auth; admin-only taxonomy management
- **Entity Detail Pages**: Per-entity profile with confidence bar, aliases, contextual AI summary, and relationships

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14 · TypeScript · Cytoscape.js · CSS Design Tokens |
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

### 3. Download the embedding model (one-time)

```bash
docker compose run --rm app python -c \
  "from sentence_transformers import SentenceTransformer; \
   SentenceTransformer('all-MiniLM-L6-v2').save('/app/models/all-MiniLM-L6-v2')"
```

### 4. Start the stack

```bash
docker compose up -d
```

Migrations run automatically on startup. The frontend is available at `http://localhost:3000` and the API at `http://localhost:8000`.

### 5. Verify

```bash
curl http://localhost:8000/health
# → {"status": "healthy", "database": "connected"}
```

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page — redirects to `/projects` when signed in |
| `/login` | Split-panel sign-in / register |
| `/projects` | Projects dashboard with card grid (Edit + Delete modals) |
| `/projects/{id}/setup` | Concept note editor — always editable, accessible from sidebar |
| `/projects/{id}/documents` | Document upload, list, and processing status |
| `/projects/{id}/analyze` | Extraction controls + link back to concept note editor |
| `/projects/{id}/map` | Interactive graph map (filter panel, focus mode, NL query, legend) |
| `/projects/{id}/settings` | Project settings (rename, description, LLM provider selection) |
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
| `/api/v1/projects/{id}/documents/{doc_id}/` | DELETE | Delete a project document |
| `/api/v1/projects/{id}/documents/{doc_id}/status/` | GET | Poll processing status |
| `/api/v1/projects/{id}/extract-entities/` | POST | Run entity extraction for all project documents |
| `/api/v1/projects/{id}/entities/` | GET | List all entities in project scope |
| `/api/v1/projects/{id}/graph/` | GET | Project knowledge graph (nodes + edges, Cytoscape.js format) |
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
docker compose run --rm app pytest --tb=short
```

Tests use mocked embeddings — no model weights or API keys required in CI.

## Project Structure

```
stakeholder-analysis-tool/
├── backend/
│   ├── stakeholder_analysis/   Django project config
│   ├── ingestion/              Document ingestion (models, views, services)
│   ├── ner/                    Named entity recognition + relation extraction
│   ├── reasoning/              RAG reasoning
│   ├── graph/                  Knowledge graph API
│   ├── models/                 Docker volume: embedding model weights
│   └── prompts/                Versioned LLM prompt templates
├── frontend/
│   ├── pages/                  Next.js pages router (app routes)
│   │   └── projects/[id]/      Per-project workspace pages
│   └── src/
│       ├── components/         React components (GraphVisualization, Sidebar, …)
│       ├── lib/                Utilities (cytoscapeStyle, graphFocus, uiState, api)
│       └── types/              Shared TypeScript types
└── specs/                      Feature specifications (spec-driven development)
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
| [001-doc-ingestion-pipeline](specs/001-doc-ingestion-pipeline/) | Document ingestion — upload, parse, embed PDF/DOCX/TXT |
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
