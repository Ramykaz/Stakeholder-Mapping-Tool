# stakeholder-analysis-tool Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-07

## Active Technologies
- Python 3.11 (Django backend), TypeScript (Next.js frontend) + Django 4.2, Django REST Framework, groq SDK, openai SDK, httpx, Next.js 14, React 18, Cytoscape.js (005-llm-joint-extraction-labels)
- PostgreSQL 15 + pgvector (existing DB; new label/type catalog tables and relation persistence rule updates) (005-llm-joint-extraction-labels)

- Python 3.11 (backend); Node.js 20 LTS (frontend) (004-entity-relation-extraction)

## Project Structure

```text
src/
tests/
```

## Commands

cd src [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] pytest [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] ruff check .

## Code Style

Python 3.11 (backend); Node.js 20 LTS (frontend): Follow standard conventions

## Recent Changes
- 005-llm-joint-extraction-labels: Added Python 3.11 (Django backend), TypeScript (Next.js frontend) + Django 4.2, Django REST Framework, groq SDK, openai SDK, httpx, Next.js 14, React 18, Cytoscape.js

- 004-entity-relation-extraction: Added Python 3.11 (backend); Node.js 20 LTS (frontend)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
