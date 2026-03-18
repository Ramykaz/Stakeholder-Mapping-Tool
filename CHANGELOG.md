# Changelog

All notable changes to this project will be documented in this file.
Follows [Conventional Commits](https://www.conventionalcommits.org/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added — Sprint 2 · US-08: Graph Redesign + Side Panel + Focus/Search + Contextual Summary

**Graph rendering + controls**
- Extended graph payload consumption to use node `style`/`degree` and relation confidence for richer visual encoding.
- Added deterministic node style fallback behavior and payload-driven node/edge scaling.
- Added graph zoom controls (`+`, `-`, `Fit`) and preserved fit/reset support in the shared graph visualizer.

**Entity panel + workspace parity**
- Added reusable `EntitySidePanel` integration to workspace map with close, drill-down, and back-navigation history.
- Added workspace-side summary actions (`Generate` / `Refresh`) using project-scoped contextual summary endpoint.

**Filters, focus, and search**
- Added client-side entity/relation filtering on graph and workspace map views (no refetch).
- Added filtered-visible two-hop focus mode (Shift+click activate, background click reset).
- Added real-time label search with highlight and auto-centering behavior.

**Validation**
- Frontend focused suites: `40 passed` across graph/workspace/api/summary interaction tests.
- Backend focused suites: `6 passed` for graph payload, profile scoping, and contextual summary API contracts.

### Added — Sprint 2 · US-07: Project Model + Concept Note + Scoped Workflows

**Backend domain + migrations**
- Added `Project` and one-to-one `ConceptNote` models in `ingestion`.
- Extended `Document`, `Entity`, and `Relation` with project linkage for scoped operations.
- Added migrations and backfills to map legacy records to a deterministic default project and propagate project context.

**APIs + extraction context**
- Added project CRUD and concept note APIs under `/api/v1/projects/*`.
- Added scoped operational APIs for upload, extraction, entities, and graph:
	- `POST /api/v1/projects/{id}/documents/`
	- `POST /api/v1/projects/{id}/extract-entities/`
	- `GET /api/v1/projects/{id}/entities/`
	- `GET /api/v1/projects/{id}/graph/`
- Added global entity profile endpoint: `GET /api/v1/entities/{id}/`.
- Injected project concept-note text into project-scoped extraction path.

**Frontend**
- Replaced landing page with project dashboard cards.
- Added project creation, workspace, and settings pages.
- Updated upload/entities/graph flows to consume project-scoped APIs.
- Added route guard to prevent upload flow access without project context.

**Validation on rebuilt images**
- Rebuilt services before regression runs using `docker compose up --build -d app frontend`.
- Backend regression: `131 passed`.
- Frontend regression: `53 passed`.

### Added — Sprint 2 · US-06: Entity Deduplication + Alias Review Workflow

**Backend dedup + models**
- Added save-time 3-level dedup flow (exact normalized match, acronym expansion, same-type fuzzy match) in `ner/services/entity_dedup_service.py` and integrated it into extraction pipeline persistence.
- Extended `Entity` with `normalized_name`, `needs_review`, `mention_count_dedup`, and `parent_entity` linkage.
- Added new models: `EntityAlias`, `AcronymMap`, and `EntityReviewCandidate` with migrations + acronym seed defaults.
- Added review candidate resolve actions (`merge` / `keep_separate`) and stale-candidate handling.

**API + frontend**
- Extended entities API payload with aliases, parent metadata, and deduplicated mention count.
- Added review candidate APIs:
	- `GET /api/v1/documents/{id}/entities/review-candidates/`
	- `POST /api/v1/documents/{id}/entities/review-candidates/{candidate_id}/resolve/`
- Updated entities page to render a review banner with per-candidate actions and alias text under canonical names.

**Validation on rebuilt images**
- Rebuilt both services with `docker compose up --build -d app frontend` before validation.
- Backend regression: `131 passed`.
- Frontend regression: `53 passed`.

### Added — Sprint 2 · US-05: Multi-Provider Joint Extraction + Admin Taxonomy

**Extraction Pipeline**
- Joint extraction now runs one provider call per chunk and returns entities + relationships in one pass.
- Added provider abstraction support across Groq, OpenAI, Azure OpenAI, and Gemini.
- Enforced explicit provider configuration errors with remediation guidance and no silent fallback.
- Persistence now keeps only graph-connected entities and canonicalizes non-directional relation duplicates.

**Taxonomy + Admin**
- Added configurable `EntityLabel` and `RelationshipType` models with active/display-order controls.
- Added admin-only taxonomy CRUD APIs and `/admin` frontend management UI.
- Hard delete is blocked for taxonomy rows already referenced by historical extraction data; deactivation is supported.

**Migrations and Quality**
- Added migrations `0008` (taxonomy tables), `0009` (default taxonomy seed), and `0010` (case-insensitive relation dedup).
- Backend validation in rebuilt container passes (`109` tests).

### Added — Sprint 2 · US-02: NER Pipeline + Entity API + Frontend

**Endpoints**
- `POST /api/v1/documents/{id}/extract-entities/` — Extract named entities (PERSON, ORGANIZATION, LOCATION, ROLE) from document chunks using Groq Llama 3. Synchronous; returns HTTP 201 with `entities_created` count. Clean-slate re-extraction on repeat calls.
- `GET /api/v1/documents/{id}/entities/` — Retrieve all entities for a document with canonical names, confidence scores, and raw mentions.
- `GET /api/v1/graph/?document_id={id}` — Retrieve entities formatted as Cytoscape.js nodes for graph visualization.

**NER Pipeline**
- Groq Llama 3.1-8b-instant integration via `groq` Python SDK
- Versioned prompt template at `prompts/ner-extraction-v1.md` with entity type definitions, examples, and confidence scoring guidelines
- Cross-chunk entity deduplication: merges by (canonical_name, document_id, entity_type), aggregates raw_mentions, takes max confidence
- `Entity` model with UUID PK, entity_type choices, canonical_name, raw_mentions (JSONField), confidence (0.0–1.0), FK to Document + Chunk
- Atomic transaction: all entities committed or fully rolled back on failure

**Frontend (Next.js 14)**
- Home page with feature cards and how-it-works section
- Upload page: drag-drop file upload, step indicator (Upload → Extract → View), calls backend synchronously
- Entities page: searchable by document ID, entity type filter, confidence bars, summary stats cards, raw mentions display
- Graph page: Cytoscape.js visualization with dynamic import (ssr:false), force-directed layout, entity-type colored nodes (PERSON=blue, ORG=red, LOCATION=green, ROLE=yellow), confidence slider, node detail panel
- Shared Layout with navigation, ErrorBoundary, ErrorMessage, LoadingSpinner components
- Tailwind CSS styling with custom entity badge classes

**Infrastructure**
- Frontend Docker multi-stage build (Node 20 Alpine)
- `frontend` service in docker-compose.yml (port 3000, depends_on app)
- WhiteNoise 6.6.0 for Django static file serving
- API client timeout increased to 120s for extraction requests
- `@types/cytoscape` for TypeScript support

**Dependencies added**
- Backend: groq 0.9.0, whitenoise 6.6.0
- Frontend: next 14, react 18, axios 1.6, cytoscape 3.28, tailwindcss 3.3, typescript 5.3, @types/cytoscape

**Tests**
- 30 NER backend tests: groq_client (7), deduplicator (5), pipeline (6), views (11 — extract/retrieve/graph)
- 32 ingestion tests continue passing (62 total backend tests)

**Spec**: [`specs/002-ner-pipeline/`](specs/002-ner-pipeline/)

---

### Added — Sprint 1 · US-01: Document Ingestion Pipeline

**Endpoints**
- `POST /api/v1/documents/` — Upload and ingest a PDF, DOCX, or TXT file (max 50 MB). Extracts text, chunks it semantically, generates 384-dim embeddings, and stores all chunks atomically in Supabase.
- `GET /health` — Service liveness and database connectivity check.

**Architecture**
- Django 4.2 project with four registered apps: `ingestion`, `ner`, `reasoning`, `graph`
- `ingestion` app owns `Document` and `Chunk` models (Supabase / PostgreSQL + pgvector)
- Chunking: spaCy sentence segmentation, 200–256 token target, 32–48 token overlap
- Embedding: all-MiniLM-L6-v2 (384-dim, local, loaded as `AppConfig.ready()` singleton)
- pgvector IVFFlat index on `ingestion_chunks.embedding` (cosine, lists=100)
- Atomic transaction: all chunks committed or fully rolled back on failure
- Raw files discarded after processing; only chunks and embeddings persisted

**Infrastructure**
- Docker + Docker Compose local development environment
- Environment-variable-based configuration (`DATABASE_URL`, `GROQ_API_KEY`, `DEBUG`, `ALLOWED_HOSTS`)
- Startup validation: fails fast with named error if required env vars are missing
- pytest + pytest-django test suite with mocked embeddings (no model weights required in CI)

**Dependencies added**
- Django 4.2.16, djangorestframework 3.15.2
- psycopg2-binary 2.9.9, dj-database-url 2.2.0, pgvector 0.3.2
- sentence-transformers 2.7.0, torch 2.2.2, transformers 4.40.2
- spacy 3.7.4, pypdf 4.2.0, python-docx 1.1.2
- gunicorn 21.2.0, pytest 8.1.1, pytest-django 4.8.0

**Spec**: [`specs/001-doc-ingestion-pipeline/`](specs/001-doc-ingestion-pipeline/)
