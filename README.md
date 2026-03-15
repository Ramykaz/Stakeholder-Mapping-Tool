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
- **Provider Flexibility**: Choose between Groq (Llama 3) or OpenAI (GPT-4o/GPT-5) models

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

## Local Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd stakeholder-analysis-tool
cp .env.example .env
# Edit .env and fill in DATABASE_URL, DEBUG, ALLOWED_HOSTS, GROQ_API_KEY
# Add OPENAI_API_KEY if you plan to run NER with OpenAI models
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
| `/api/v1/documents/{id}/extract-entities/` | POST | Extract entities only |
| `/api/v1/documents/{id}/extract-entities-relations/` | POST | Extract entities and relations (two-pass) |
| `/api/v1/documents/{id}/entities/` | GET | List entities for a document |
| `/api/v1/documents/{id}/relations/` | GET | List relations for a document |
| `/api/v1/graph/` | GET | Get knowledge graph (nodes + edges) |
| `/health` | GET | Service liveness and DB connectivity |

Full contract: [`specs/001-doc-ingestion-pipeline/contracts/api.md`](specs/001-doc-ingestion-pipeline/contracts/api.md), [`specs/004-entity-relation-extraction/contracts/`](specs/004-entity-relation-extraction/contracts/)

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