# Stakeholder Analysis Tool

AI-powered stakeholder analysis platform for UNDP. Ingests policy documents, extracts named entities, builds knowledge graphs, and supports RAG-based reasoning over stakeholder networks.

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

## Local Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd stakeholder-analysis-tool
cp .env.example .env
# Edit .env and fill in DATABASE_URL, DEBUG, ALLOWED_HOSTS, GROQ_API_KEY
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

## Ingest a Document

```bash
curl -X POST http://localhost:8000/api/v1/documents/ \
  -F "file=@/path/to/document.pdf"
# → HTTP 201 with document id and chunk_count
```

Accepted formats: `.pdf`, `.docx`, `.txt` (max 50 MB).

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/documents/` | POST | Upload and ingest a document |
| `/health` | GET | Service liveness and DB connectivity |

Full contract: [`specs/001-doc-ingestion-pipeline/contracts/api.md`](specs/001-doc-ingestion-pipeline/contracts/api.md)

## Running Tests

```bash
docker compose run --rm app pytest --tb=short
```

Tests use mocked embeddings — no model weights or Groq API key required in CI.

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