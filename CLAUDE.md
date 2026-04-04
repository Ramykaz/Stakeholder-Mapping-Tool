# stakeholder-analysis-tool Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-03

## Active Technologies
- TypeScript (Next.js 14), Python 3.11 (Django 4.2) + React, Cytoscape.js, Django REST Framework, sentence-transformers (all-MiniLM-L6-v2), pgvector, RapidFuzz (011-intelligence-layer)
- PostgreSQL 15 + pgvector (Supabase) — single source of truth (011-intelligence-layer)
- Python 3.11 (Django 4.2), TypeScript (Next.js 14) + Django REST Framework, sentence-transformers (all-MiniLM-L6-v2), pgvector, ReportLab, Groq/OpenAI/Gemini (existing abstraction), RapidFuzz (013-structured-intake-report)
- PostgreSQL 15 + pgvector (Supabase) — all new tables follow existing migration patterns (013-structured-intake-report)
- Python 3.11 (Django 4.2), TypeScript (Next.js 14) + Django REST Framework, Celery 5.4.0 (existing), sentence-transformers (all-MiniLM-L6-v2), pgvector, ReportLab 4.2.5 (existing), python-docx 1.1.2 (existing), Groq/OpenAI/Gemini (existing abstraction) (014-personas-workplan-export)

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
- 014-personas-workplan-export: Added Python 3.11 (Django 4.2), TypeScript (Next.js 14) + Django REST Framework, Celery 5.4.0 (existing), sentence-transformers (all-MiniLM-L6-v2), pgvector, ReportLab 4.2.5 (existing), python-docx 1.1.2 (existing), Groq/OpenAI/Gemini (existing abstraction)
- 013-structured-intake-report: Added Python 3.11 (Django 4.2), TypeScript (Next.js 14) + Django REST Framework, sentence-transformers (all-MiniLM-L6-v2), pgvector, ReportLab, Groq/OpenAI/Gemini (existing abstraction), RapidFuzz
- 011-intelligence-layer: Added TypeScript (Next.js 14), Python 3.11 (Django 4.2) + React, Cytoscape.js, Django REST Framework, sentence-transformers (all-MiniLM-L6-v2), pgvector, RapidFuzz


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
