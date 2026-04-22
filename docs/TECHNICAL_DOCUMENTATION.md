# Stakeholder Analysis Tool — Technical Documentation

## 1. Introduction

This document is the technical reference for the Stakeholder Analysis Tool. It is intended for developers, maintainers, DevOps engineers, QA engineers, and technical project leads.

The platform enables document-driven stakeholder intelligence by combining:
- A Next.js frontend for analyst workflows and graph exploration
- A Django REST backend for ingestion, extraction, graph APIs, and admin controls
- PostgreSQL + pgvector for structured and semantic data storage
- Pluggable LLM providers (Groq, OpenAI, Azure OpenAI, Gemini)

---

## 2. System Scope and Objectives

Primary objectives:
- Ingest policy and project documents (PDF, DOCX, TXT, Markdown, web sources)
- Extract entities and directional relationships from unstructured text
- Build and serve a project-scoped knowledge graph
- Support iterative analyst workflows: review, correction, generation, export
- Provide production-ready observability, role-aware access control, and CI automation

Non-goals (current state):
- Full browser E2E automation in CI (currently mostly unit/integration heavy)
- Separate microservices for each domain app (monolithic Django with modular apps)

---

## 3. High-Level Architecture

## 3.1 Runtime components
- Frontend: Next.js 14 + TypeScript (Port 3000)
- Backend: Django 4.2 + DRF on Gunicorn (Port 8000)
- Worker: Celery worker for async/background processing
- Cache/Broker: Redis
- Database: PostgreSQL 15 with pgvector (commonly Supabase in deployment)

## 3.2 Core interaction flow
1. User performs actions in frontend workspace pages
2. Frontend calls backend REST API with token authentication
3. Backend coordinates ingestion, extraction, generation, and graph APIs
4. Backend persists structured data and embeddings in PostgreSQL
5. LLM provider APIs are called through provider abstraction when needed
6. Results are rendered back in graph, tables, and reports

---

## 4. Repository and Code Organization

Top-level structure:
- `frontend/`: Next.js app
- `ingestion/`: Django app for projects, initiative profile/intake, documents, chunks
- `ner/`: Django app for entities, relations, extraction/review/generation workflows
- `reasoning/`: reserved/placeholder app
- `graph/`: graph-oriented app layer (thin integration)
- `stakeholder_analysis/`: Django project settings, URL routing, middleware, auth routes
- `docs/`: architecture, setup, process docs
- `tests/`: additional test material

Key frontend directories:
- `frontend/pages/`: route-level pages
- `frontend/src/components/`: reusable UI modules
- `frontend/src/lib/`: API client and utility logic

Key backend integration points:
- `stakeholder_analysis/urls.py`: root URL registry and API mounting
- `stakeholder_analysis/auth_views.py`: auth/admin API views
- `ner/views.py`: high-volume endpoint orchestration
- `ingestion/views.py`: ingestion and project document workflows

---

## 5. Frontend Technical Design

## 5.1 Framework and patterns
- Framework: Next.js pages router
- Language: TypeScript
- Styling: Tailwind + design-token based theming
- Data access: centralized API client in `frontend/src/lib/api.ts`
- Graph rendering: Cytoscape.js/D3-driven graph interfaces

## 5.2 Security and network policy
- CSP headers are configured in `frontend/next.config.js`
- `connect-src` explicitly permits backend origins and telemetry hosts
- Frontend API base URL is configured via `NEXT_PUBLIC_API_BASE_URL`

## 5.3 Main user workflows implemented in frontend
- Authentication (register/login/logout/profile)
- Project lifecycle (create, edit, delete)
- Initiative profile intake and SMQ-driven workspace setup
- Document upload and extraction trigger
- Graph exploration and focus/filtering
- Entity review and detail pages
- Report generation and export
- Persona and workplan workflows
- Admin taxonomy and user-management surfaces

---

## 6. Backend Technical Design

## 6.1 Framework stack
- Python 3.11
- Django 4.2
- Django REST Framework
- TokenAuthentication + SessionAuthentication
- Gunicorn deployment target

## 6.2 App responsibilities

### ingestion app
Responsibilities:
- Project and initiative-profile (intake) management
- Document ingestion and lifecycle status
- Text extraction and chunking
- Embedding generation and storage

Primary entities:
- Project
- Initiative profile / intake payloads (project-scoped)
- Document
- Chunk

### ner app
Responsibilities:
- Entity and relation persistence
- Extraction orchestration and provider integrations
- Deduplication and review workflow
- Graph payload composition support
- Report/persona/workplan/SMQ generation
- Export (PDF/DOCX)

Primary entities:
- Entity
- Relation
- EntityAlias
- NERRun
- EntityReviewCandidate
- ContextualEntitySummary
- Taxonomy configuration entities

### stakeholder_analysis app
Responsibilities:
- Global settings and middleware
- Root routing
- Authentication and admin APIs
- Celery integration/bootstrap

---

## 7. API Surface (Functional Overview)

Auth and user management:
- `/api/v1/auth/register/`
- `/api/v1/auth/login/`
- `/api/v1/auth/logout/`
- `/api/v1/auth/me/`
- `/api/v1/auth/change-password/`
- `/api/v1/auth/forgot-password/`
- `/api/v1/auth/reset-password/`
- Admin auth endpoints under `/api/v1/auth/admin/*`

Compatibility aliasing:
- Legacy `/api/auth/*` path alias exists alongside canonical `/api/v1/auth/*`

Project and document workflows:
- `/api/v1/projects/` and `/api/v1/projects/{id}/`
- Initiative profile/intake, SMQ, and document endpoints under project scope
- Extraction triggers and per-document re-extraction/status endpoints

Entity/graph/report workflows:
- Project graph and entity listing endpoints
- Entity profile/summary endpoints
- Review and generation endpoints in `ner` view layer
- Export endpoints for report and workplan outputs

Operational endpoint:
- `/health`

For endpoint-level request/response details, see OpenAPI routes:
- `/api/schema/`
- `/api/schema/swagger-ui/`
- `/api/schema/redoc/`

---

## 8. Data and Processing Pipelines

## 8.1 Ingestion pipeline
1. File/web source accepted
2. Text extracted and normalized
3. Text chunked for semantic/LLM operations
4. Embeddings generated (`all-MiniLM-L6-v2`)
5. Chunks stored in DB with vector data

## 8.2 Extraction pipeline
1. Extraction job triggered per project or document
2. Provider abstraction routes prompt calls to selected LLM
3. Candidate entities/relations returned in structured form
4. Deduplication and alias resolution applied
5. Clean records persisted with run metadata and review candidates

## 8.3 Analyst review loop
1. Analyst inspects entities/relations by document or project
2. Analyst corrects labels/relations or deletes incorrect entries
3. System updates canonical data and associated graph payloads

## 8.4 Generation and export
- Report sections generated from context and project data
- Persona/workplan artifacts generated through provider orchestration
- Export module builds PDF/DOCX documents with optional appendices

---

## 9. Authentication, Authorization, and Security Controls

Implemented controls:
- Token-based API authentication
- Admin-only endpoint gating in auth and taxonomy surfaces
- CSP and browser hardening headers in frontend delivery
- Secure cookie and HTTPS-related settings available in backend settings
- Input validation in serializers/views
- Optional startup warnings for missing provider credentials

Operational guidance:
- Set `DEBUG=False` in production
- Configure strict `ALLOWED_HOSTS` and trusted origins
- Use strong `SECRET_KEY`
- Enforce HTTPS controls via environment settings
- Maintain provider keys in secure secret stores

---

## 10. Configuration and Environment Variables

Critical runtime variables:
- `DATABASE_URL`
- `DEBUG`
- `ALLOWED_HOSTS`
- `SECRET_KEY`
- Provider keys (`GROQ_API_KEY`, `OPENAI_API_KEY`, `AZURE_*`, `GEMINI_API_KEY`)
- Redis/Celery URLs (`REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`)

Frontend variable:
- `NEXT_PUBLIC_API_BASE_URL`

See `README.md` and `docs/SETUP.md` for full setup templates.

---

## 11. Deployment Architecture

## 11.1 Local and staging deployment
- Docker Compose orchestrates frontend, app, worker, redis
- Migrations typically run at container startup (entrypoint-driven)

## 11.2 Production deployment pattern
Recommended:
- Frontend and backend as separate containers/services
- Managed PostgreSQL + pgvector (Supabase-compatible)
- Managed Redis or robust self-hosted Redis
- Reverse proxy/load balancer with TLS termination

Checklist before production rollout:
- Environment vars finalized
- Health endpoint monitored
- CI pipeline green
- Rollback plan and backups validated

---

## 12. Testing and Quality Assurance

## 12.1 Test stack
- Backend: pytest
- Frontend: Jest + React Testing Library
- Linting: Ruff (backend), ESLint (frontend)

## 12.2 Current quality posture (recent runs)
- CI-equivalent backend and frontend suites pass
- Full backend suite has passed in recent cycle
- Coverage is good overall but still has known integration/E2E depth gaps

## 12.3 Coverage caveats
- Frontend currently lacks true browser E2E test harness coverage for full journeys
- Some complex backend orchestration branches remain less covered than ideal

---

## 13. Observability and Operations

Available observability points:
- Structured logging with request correlation support
- Health endpoint for liveness/connectivity
- Optional Sentry integration in frontend/backend pathways
- Optional Prometheus endpoints depending on installed package

Operational commands (examples):
- `docker compose ps`
- `docker compose logs app --tail 200`
- `docker compose logs worker --tail 200`
- `docker compose exec worker celery -A stakeholder_analysis status`

---

## 14. Troubleshooting Guide (Technical)

## 14.1 Frontend cannot call backend
- Verify `NEXT_PUBLIC_API_BASE_URL`
- Verify CSP `connect-src` includes backend origin
- Verify backend container and `/health` are reachable

## 14.2 Extraction/provider failures
- Confirm provider key is set for selected provider
- Validate provider/model settings in project settings page
- Inspect backend logs for provider error details

## 14.3 Backend coverage command fails with cov args
Cause:
- `pytest-cov` missing in runtime image
Resolution:
- Install `pytest-cov` in environment or add to dependency lock/build

## 14.4 Auth path mismatches
- Use canonical `/api/v1/auth/*`
- Legacy `/api/auth/*` should resolve for compatibility but should not be used for new implementations

---

## 15. Technical Debt and Recommended Next Steps

Priority improvements:
1. Add real E2E journey suite (Playwright/Cypress for frontend, end-to-end API scenarios for backend)
2. Increase integration coverage on largest orchestration surfaces (`ner/views.py`, report/export branches)
3. Reduce React test warning noise by wrapping async state updates with proper test synchronization patterns
4. Keep compatibility aliases but standardize all clients and docs on `/api/v1/*`

---

## 16. Glossary

- Entity: Canonical stakeholder node (person/org/role/etc.)
- Relation: Directed edge between entities with typed label
- Chunk: Text segment produced from source docs for embeddings and extraction
- Dedup Review Candidate: Borderline similarity pair requiring analyst decision
- SMQ: Stakeholder Mapping Questionnaire sections

---

## 17. Reference Documents

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/SETUP.md`
- `docs/TESTER_GUIDE.md`
- `SYSTEM_LOGIC.md`
