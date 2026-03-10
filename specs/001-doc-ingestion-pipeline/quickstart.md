# Quickstart: Document Ingestion Pipeline

**Branch**: `001-doc-ingestion-pipeline` | **Date**: 2026-03-10

Get the local development environment running and ingest your first document in under 10 minutes.

---

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose v2)
- Git
- A Supabase project with pgvector enabled (see step 3)

---

## Steps

### 1. Clone and configure environment

```bash
git clone <repo-url>
cd stakeholder-analysis-tool
cp .env.example .env
```

Edit `.env` and fill in the required values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string (with `?sslmode=require`) |
| `GROQ_API_KEY` | Your Groq API key (used by NER/reasoning apps; not required for ingestion) |
| `DEBUG` | `True` for local development, `False` for production |
| `ALLOWED_HOSTS` | Comma-separated list, e.g. `localhost,127.0.0.1` |

### 2. Download the embedding model

Run this once to download the model weights to your local volume:

```bash
docker compose run --rm app python -c \
  "from sentence_transformers import SentenceTransformer; \
   SentenceTransformer('all-MiniLM-L6-v2').save('/app/models/all-MiniLM-L6-v2')"
```

This saves ~90 MB to the `models/` volume. Subsequent `docker compose up` calls load from disk — no network required.

### 3. Enable pgvector on Supabase

In your Supabase project dashboard, open the SQL editor and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Verify with:

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 4. Start the stack

```bash
docker compose up
```

All services start. On first run, Django applies migrations automatically (creates the `documents` and `chunks` tables with the IVFFlat index).

### 5. Verify the health endpoint

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status": "healthy", "database": "connected"}
```

### 6. Ingest a document

```bash
curl -X POST http://localhost:8000/api/v1/documents/ \
  -F "file=@/path/to/your/document.pdf"
```

Expected response (HTTP 201):

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "filename": "document.pdf",
  "file_format": "pdf",
  "upload_timestamp": "2026-03-10T09:14:00Z",
  "processing_status": "completed",
  "chunk_count": 42
}
```

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `database: unreachable` on /health | `DATABASE_URL` wrong or pgvector not enabled | Verify `.env` and run the pgvector SQL above |
| HTTP 415 on upload | File format not supported | Use `.pdf`, `.docx`, or `.txt` |
| HTTP 413 on upload | File exceeds 50 MB | Use a smaller file |
| HTTP 422 on upload | File contains no extractable text | Ensure the PDF has a text layer (not scanned-image-only) |
| `Model not found` at startup | Model volume not populated | Re-run step 2 |

---

## Running Tests

```bash
docker compose run --rm app pytest
```

All tests run against a test database. LLM/embedding calls are mocked in the test suite — no real API keys or model weights needed for CI.

---

## Project Layout

```
stakeholder-analysis-tool/
├── manage.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── stakeholder_analysis/        # Django project config
│   ├── settings.py
│   └── urls.py
├── ingestion/                   # Document ingestion app
│   ├── apps.py                  # Loads embedding model singleton
│   ├── models.py                # Document, Chunk
│   ├── views.py                 # POST /api/v1/documents/, GET /health
│   ├── services/
│   │   ├── extractor.py         # PDF/DOCX/TXT text extraction
│   │   ├── chunker.py           # spaCy sentence chunking
│   │   └── embedder.py          # sentence-transformers wrapper
│   ├── migrations/
│   └── tests/
├── ner/                         # Named entity recognition (future)
├── reasoning/                   # RAG reasoning (future)
├── graph/                       # Knowledge graph (future)
└── models/                      # Docker volume: embedding model weights
```
