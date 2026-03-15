# stakeholder-analysis-tool Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-15

## Active Technologies

- Python 3.11 + Django 4.2, Django REST Framework, sentence-transformers, spaCy (`en_core_web_sm`), pypdf, python-docx, psycopg2-binary, pgvector (Python client), gunicorn (001-doc-ingestion-pipeline)
- PostgreSQL 15 + pgvector: relations table with FK cascade deletes; deduplication index on normalized triplets (004-entity-relation-extraction)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

cd src; pytest; ruff check .

## Code Style

Python 3.11: Follow standard conventions

## Recent Changes

- 001-doc-ingestion-pipeline: Added Python 3.11 + Django 4.2, Django REST Framework, sentence-transformers, spaCy (`en_core_web_sm`), pypdf, python-docx, psycopg2-binary, pgvector (Python client), gunicorn
- 004-entity-relation-extraction: Added relations table, extended NERRun with relations_created; reuses existing Groq/OpenAI providers for relation triplet extraction

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
