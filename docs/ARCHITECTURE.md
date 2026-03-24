# System Architecture — UNDP Stakeholder Analysis Tool



## 1. Purpose

The UNDP Stakeholder Analysis Tool ingests policy documents and produces an interactive knowledge graph of entities (people, organisations, roles, locations, etc.) and their relationships. Users upload PDFs, DOCX, or text files; an LLM extracts structured data; and the result is browsable as a network graph with search, filtering, and entity profiles.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│           Next.js 14 (React, TypeScript, Cytoscape.js)          │
│           Port 3000                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST JSON  (token auth)
                             │ http://127.0.0.1:8000/api/v1/
┌────────────────────────────▼────────────────────────────────────┐
│                        Django 4.2 / DRF                         │
│            Gunicorn 2 workers × 2 threads  Port 8000            │
│   ┌─────────────┐  ┌──────┐  ┌───────────┐  ┌───────────────┐  │
│   │  ingestion  │  │ ner  │  │ reasoning │  │    graph      │  │
│   └──────┬──────┘  └──┬───┘  └─────┬─────┘  └───────┬───────┘  │
│          │            │            │                │           │
│          └────────────┴────────────┴────────────────┘           │
│                          shared models / ORM                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ psycopg2
┌────────────────────────────▼────────────────────────────────────┐
│            PostgreSQL 15  +  pgvector extension                 │
│            (Supabase-compatible; hosted remotely in prod)       │
└─────────────────────────────────────────────────────────────────┘
                             ▲
                    LLM API calls (HTTPS)
          Groq / OpenAI / Azure OpenAI / Google Gemini
```

Everything runs in Docker Compose locally. In production the frontend and backend are separate containers; the database is external (Supabase or managed PostgreSQL).

---

## 3. Repository Structure

```
stakeholder-analysis-tool/
├── backend/                    # (tests, migrations live here)
├── docs/                       # Documentation (you are here)
├── frontend/                   # Next.js 14 app
│   ├── pages/                  # File-based routing
│   │   ├── index.tsx           # Landing page
│   │   ├── login.tsx           # Auth page
│   │   ├── projects/           # Project list + workspace
│   │   │   └── [id]/           # Dynamic project workspace
│   │   │       ├── index.tsx   # Overview / concept note
│   │   │       ├── documents.tsx
│   │   │       ├── analyze.tsx # Extraction trigger
│   │   │       ├── map.tsx     # Graph view
│   │   │       ├── entities.tsx
│   │   │       └── relations.tsx
│   │   └── admin/              # Admin dashboard
│   └── src/
│       ├── components/         # Shared UI components
│       │   ├── layout/         # TopNavigation, SideNav
│       │   └── GraphVisualization.tsx
│       ├── lib/                # API client, route helpers
│       └── styles/globals.css  # Design system tokens
├── ingestion/                  # Django app — docs & projects
├── ner/                        # Django app — entities & relations
├── reasoning/                  # Django app — (placeholder)
├── graph/                      # Django app — (placeholder)
├── stakeholder_analysis/       # Django project (settings, urls)
├── tests/                      # pytest test suite (150 tests)
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## 4. Frontend Architecture

**Framework**: Next.js 14, TypeScript, Tailwind CSS
**Graph**: Cytoscape.js (dynamically imported — no SSR)
**Auth**: Token stored in `localStorage`; passed as `Authorization: Token <token>` header

### Page → API mapping

| Page | Route | Key API calls |
|------|-------|---------------|
| Landing | `/` | None |
| Login / Register | `/login` | `POST /api/v1/auth/login/`, `POST /api/v1/auth/register/` |
| Projects list | `/projects` | `GET /api/v1/projects/` |
| Project overview | `/projects/[id]` | `GET /api/v1/projects/[id]/`, `GET/PUT /api/v1/projects/[id]/concept-note/` |
| Documents | `/projects/[id]/documents` | `GET /api/v1/projects/[id]/documents/`, `POST` upload |
| Analyze | `/projects/[id]/analyze` | `POST /api/v1/projects/[id]/extract-entities/` |
| Map (graph) | `/projects/[id]/map` | `GET /api/v1/projects/[id]/graph/` |
| Entities | `/projects/[id]/entities` | `GET /api/v1/projects/[id]/entities/` |
| Relations | `/projects/[id]/relations` | `GET /api/v1/projects/[id]/entities/` (relations embedded) |
| Admin | `/admin` | `GET /api/v1/projects/`, user management |

### Design System

CSS custom properties (`--bg`, `--bg2`, `--bg3`, `--border`, `--accent`, `--teal`, `--purple`, `--amber`, `--coral`, `--text`, `--text2`, `--text3`) defined on `:root` (dark mode default) and overridden in `[data-theme="light"]`. Theme persisted in `localStorage` and toggled via sun/moon button in `TopNavigation`.

Fonts: **DM Serif Display** (headings), **Outfit** (body), **DM Mono** (labels/code).

---

## 5. Backend Architecture

**Framework**: Django 4.2 + Django REST Framework
**Auth**: `rest_framework.authtoken` — per-user tokens, returned on login
**CORS**: Allowed from `localhost:3000` and `127.0.0.1:3000`
**Static files**: WhiteNoise
**Server**: Gunicorn with 2 workers × 2 threads

### Django Apps

#### `ingestion` — Document pipeline & project management

| Model | Purpose |
|-------|---------|
| `Project` | Top-level workspace (UUID PK, owner FK, name, status) |
| `ConceptNote` | 1:1 with Project — markdown text + optional file attachment |
| `Document` | Uploaded file metadata (filename, format, status, chunk_count) |
| `Chunk` | Text segment with 384-dim vector embedding (pgvector) |

**Key flows:**
- `POST /api/v1/projects/[id]/documents/` → file saved, document record created, chunking task triggered
- Chunking: spaCy `en_core_web_sm` used **only** for sentence boundary detection when splitting text into chunks
- Each chunk embedded with `all-MiniLM-L6-v2` (sentence-transformers) → stored in `Chunk.embedding` VectorField

#### `ner` — Entity & relation extraction

| Model | Purpose |
|-------|---------|
| `NERRun` | Audit log per extraction (provider, model, cost, duration, token counts) |
| `Entity` | Canonical entity (type, canonical_name, confidence, project FK) |
| `Relation` | Directed triplet (source → label → target, confidence) |
| `EntityAlias` | Alternative names for an entity (supports acronym expansion) |
| `AcronymMap` | Global acronym → expansion table |
| `EntityReviewCandidate` | Near-duplicate pairs flagged for human review |
| `ContextualEntitySummary` | Cached entity summary text with expiry |
| `EntityLabel` | Admin-configurable entity type definitions |
| `RelationshipType` | Admin-configurable relation type definitions |

**Key flows** (see Section 6 for full data flow):
- Extraction triggered per-project or per-document
- LLM produces JSON: `{ entities: [...], relations: [...] }`
- Three-layer deduplication applied before persistence

#### `graph` — Graph data API (thin layer)

Provides `GET /api/v1/projects/[id]/graph/` — queries Entity + Relation tables and serialises to Cytoscape-compatible `{ nodes: [], edges: [] }` JSON. Node size is proportional to connection degree.

#### `reasoning` — (Placeholder)

Reserved for future semantic querying / RAG reasoning features. Currently provides no active endpoints.

---

## 6. Data Flow

### 6.1 Document Ingestion

```
User uploads file
       │
       ▼
POST /api/v1/projects/[id]/documents/
       │
       ▼
DocumentIngestionView
  ├── Save file to disk
  ├── Create Document record (status=pending)
  ├── Parse text: pypdf / python-docx / plain text
  ├── Split into chunks
  │     └── spaCy en_core_web_sm → sentence boundaries
  │         Chunk target: ~400 tokens, 50-token overlap
  ├── For each chunk:
  │     └── all-MiniLM-L6-v2 → 384-dim vector
  │         Save Chunk(text, embedding, chunk_index)
  └── Update Document(status=completed, chunk_count=N)
```

### 6.2 Entity & Relation Extraction

```
POST /api/v1/projects/[id]/extract-entities/
       │
       ▼
ProjectEntityExtractionView
  ├── For each chunk in project:
  │     ├── Build prompt: chunk text + entity type definitions
  │     ├── Call LLM (Groq / OpenAI / Azure / Gemini)
  │     │     Returns: { entities:[{name, type, confidence}],
  │     │                relations:[{source, label, target, confidence}] }
  │     └── Stage raw results
  │
  ├── Three-layer deduplication:
  │     Layer 1: Exact match on normalized_name (lowercase, strip punctuation)
  │     Layer 2: AcronymMap expansion (e.g. "UNDP" → "United Nations Development Programme")
  │     Layer 3: RapidFuzz fuzzy match
  │               score ≥ 0.85 → auto-merge
  │               0.70–0.85   → EntityReviewCandidate (human review queue)
  │               score < 0.70 → new entity
  │
  ├── Persist Entity / EntityAlias / Relation records
  ├── Create NERRun (audit log with cost, tokens, duration)
  └── Return extraction summary
```

### 6.3 Graph Query

```
GET /api/v1/projects/[id]/graph/
       │
       ▼
Query Entity table → project FK
  ├── Annotate with degree (count of relations)
  ├── Serialise to nodes: { id, label, entity_type, confidence,
  │                         degree, node_size, shape, color }
Query Relation table → project FK
  └── Serialise to edges: { id, source, target, label, confidence,
                             edge_width }
Response: { nodes: [...], edges: [...] }
```

### 6.4 Entity Summary

```
GET /api/v1/entities/[id]/summary/
       │
       ▼
Check ContextualEntitySummary cache (expires_at)
  │
  ├── Cache hit → return cached summary_text
  │
  └── Cache miss:
        Query all Relations where source or target = entity
        Build template string:
          "[Name] is a [TYPE]. They are involved in:
           - [relation_label] [target_name]  (× N relations)"
        Save to ContextualEntitySummary with TTL
        Return summary_text

NOTE: No LLM is called for entity summaries. This is template-based only.
```

### 6.5 Graph Search (current)

```
GET /api/v1/projects/[id]/entities/?q=<query>
       │
       ▼
Entity.objects.filter(canonical_name__icontains=query)
  └── SQL LIKE query only — embeddings are NOT used at query time

NOTE: pgvector embeddings are stored but never queried.
      Semantic/similarity search is a known gap.
```

---

## 7. LLM Provider Abstraction

Four providers are supported. The active provider is selected per-request (defaulting to Groq).

| Provider | Default model | Key |
|----------|--------------|-----|
| Groq | `llama-3.1-8b-instant` | `GROQ_API_KEY` |
| OpenAI | `gpt-4o-mini` | `OPENAI_API_KEY` |
| Azure OpenAI | `gpt-5-mini` | `AZURE_OPENAI_*` vars |
| Google Gemini | `gemini-1.5-flash` | `GEMINI_API_KEY` |

Provider/model combinations are validated against an allowlist in `settings.py` before dispatch. The frontend currently hardcodes Groq — provider selection UI is a known gap.

---

## 8. Database Schema Overview

```
auth_user
    │
    ├─< Project (owner FK)
    │       │
    │       ├── ConceptNote (1:1)
    │       │
    │       ├─< Document
    │       │       └─< Chunk (embedding: vector[384])
    │       │
    │       ├─< Entity (project FK)
    │       │       ├─< EntityAlias
    │       │       └── parent_entity (self FK, for merged entities)
    │       │
    │       └─< Relation (source FK Entity, target FK Entity)
    │
    └── Token (auth token, 1:1 with User)

NERRun (document FK)
    ├─< Entity (run FK)
    └─< Relation (run FK)

EntityReviewCandidate (left/right Entity FK)
ContextualEntitySummary (entity FK, project FK)
AcronymMap (global, no project FK)
EntityLabel (global config)
RelationshipType (global config)
```

All primary keys are UUIDs. Relations table has FK cascade deletes. A partial unique index prevents duplicate normalised triplets within the same project.

---

## 9. Authentication & Authorisation

- **Registration**: `POST /api/v1/auth/register/` — creates User + Token
- **Login**: `POST /api/v1/auth/login/` — accepts username **or email**; returns `{ token, user }`. Token stored client-side in `localStorage`.
- **All API endpoints**: require `Authorization: Token <token>` header (DRF TokenAuthentication)
- **Admin flag**: `user.is_admin` (stored on Django `User.is_staff`). UNDP email-domain users are auto-promoted to admin via `ADMIN_EMAIL_DOMAIN` setting.
- **Object-level auth**: Projects are owned by a user; only owner (or admin) can modify. Enforced in view logic.

---

## 10. Infrastructure

### Docker Compose (local / CI)

```yaml
services:
  app:       # Django + Gunicorn, port 8000
  frontend:  # Next.js dev server, port 3000
             # (production build: next start)
```

The database is **external** — `DATABASE_URL` environment variable points to PostgreSQL. Locally this is typically Supabase or a local PostgreSQL instance.

### Build highlights (Dockerfile)

- Base: `python:3.11-slim`
- PyTorch: CPU-only build to save ~600 MB image size
- spaCy model `en_core_web_sm` baked in at build time
- Embedding model `all-MiniLM-L6-v2` baked in at build time (`HF_HOME=/app/models`)
- Entrypoint: `migrate` → `gunicorn` (no separate worker process)

### Environment variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SECRET_KEY` | Yes | dev-insecure | Override in production |
| `DEBUG` | Yes | — | `False` in production |
| `ALLOWED_HOSTS` | Yes | — | Comma-separated hostnames |
| `GROQ_API_KEY` | Recommended | — | Default NER provider |
| `OPENAI_API_KEY` | Optional | — | Alternative provider |
| `AZURE_OPENAI_*` | Optional | — | Azure OpenAI provider |
| `GEMINI_API_KEY` | Optional | — | Google Gemini provider |
| `ADMIN_EMAIL_DOMAIN` | Optional | `undp.org` | Auto-admin email domain |
| `HF_HOME` | Optional | `/app/models` | Embedding model cache |

---

## 11. Known Gaps & Technical Debt

These are documented gaps relevant to understanding current system behaviour:

| Gap | Impact | Description |
|-----|--------|-------------|
| **Embeddings unused at query time** | Low recall | `Chunk.embedding` (pgvector) is stored but never queried. Search uses SQL `LIKE` only — no semantic similarity. |
| **No async extraction** | UX / timeouts | Project-wide extraction runs synchronously in the request/response cycle. Large projects risk HTTP timeouts. No Celery/task queue. |
| **Template-based entity summary** | Limited insight | `GET /entities/[id]/summary/` returns a template string — no LLM reasoning about the entity. |
| **Provider hardcoded in frontend** | Inflexibility | `analyze.tsx` hardcodes `provider: 'groq'`. Backend supports 4 providers but UI offers no choice. |
| **No file storage abstraction** | Infra coupling | Uploaded files stored on local disk inside the container — lost on container restart. No S3/object storage integration. |
| **graph / reasoning apps empty** | Future scope | These Django apps are scaffolded but contain no active logic. |
| **No rate limiting** | Security | API endpoints have no per-user rate limits. |
| **No email verification** | Security | Registration creates an active account immediately with no email confirmation step. |

---

## 12. Test Suite

```
tests/
├── test_ingestion.py     # Document upload, chunking, project CRUD
├── test_ner.py           # Entity extraction, dedup, relations
├── test_auth.py          # Login, register, token validation
└── ...
```

Run with: `cd src && pytest`
Total: 150 tests (all passing as of the latest spec)

Framework: `pytest-django` with a test PostgreSQL database (pgvector extension required).
