# Changelog

All notable changes to this project will be documented in this file.
Follows [Conventional Commits](https://www.conventionalcommits.org/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

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
