# Tasks: Document Ingestion Pipeline

**Input**: Design documents from `/specs/001-doc-ingestion-pipeline/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api.md ✅ quickstart.md ✅

**Tests**: Included — constitution requires tests before any PR. Sprint 1 gate: ingestion pipeline tests must pass.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- Exact file paths included in every task description

## Path Conventions

Django project at repository root. Source layout:

```
stakeholder-analysis-tool/       ← repo root
├── stakeholder_analysis/         ← Django project package
├── ingestion/                    ← Django app
├── ner/ reasoning/ graph/        ← Stub apps
└── models/                       ← Embedding model volume mount point
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository skeleton, dependency manifest, and container configuration. No Django code yet.

- [ ] T001 Create repository directory structure: `ingestion/`, `ingestion/services/`, `ingestion/tests/`, `ingestion/migrations/`, `ner/`, `reasoning/`, `graph/`, `stakeholder_analysis/`, `models/`, `prompts/`
- [ ] T002 [P] Write `requirements.txt` with all pinned dependencies: Django==4.2.*, djangorestframework, psycopg2-binary, pgvector, sentence-transformers, spacy, pypdf, python-docx, gunicorn, pytest, pytest-django (pin exact versions)
- [ ] T003 [P] Write `Dockerfile`: base `python:3.11-slim`, install system deps (`libpq-dev`), copy and install `requirements.txt`, set `HF_HOME=/app/models`, `WORKDIR /app`, copy source, `CMD gunicorn`
- [ ] T004 [P] Write `docker-compose.yml`: `app` service using Dockerfile, port `8000:8000`, `env_file: .env`, named volume `models:/app/models`, entrypoint runs migrations then gunicorn
- [ ] T005 [P] Write `.env.example` with all required variables and inline comments: `DATABASE_URL`, `GROQ_API_KEY`, `DEBUG`, `ALLOWED_HOSTS`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Django project skeleton and test harness. Must be complete before any user story begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Create Django project package `stakeholder_analysis/`: `__init__.py`, `wsgi.py`, `asgi.py`, `urls.py` (empty router placeholder), `manage.py` at repo root
- [ ] T007 Write `stakeholder_analysis/settings.py`: read `DATABASE_URL` (dj-database-url or manual parse), `GROQ_API_KEY`, `DEBUG`, `ALLOWED_HOSTS` from environment; fail at startup if any required variable is missing; register `INSTALLED_APPS` with `ingestion`, `ner`, `reasoning`, `graph`, `rest_framework`; configure `DATABASES` using psycopg2 backend; set `DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'`; set `DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800` (50 MB)
- [ ] T008 [P] Create stub Django apps `ner/`, `reasoning/`, `graph/`: each needs `apps.py` with `AppConfig`, `__init__.py`, and an empty `migrations/` directory with `__init__.py`
- [ ] T009 [P] Configure pytest: create `pytest.ini` (or `setup.cfg [tool:pytest]`) with `DJANGO_SETTINGS_MODULE=stakeholder_analysis.settings`; create `ingestion/tests/__init__.py` and `conftest.py` with a `db` fixture and an embedder mock fixture that patches `SentenceTransformer` to return fixed 384-dim vectors

**Checkpoint**: `docker compose up` starts the container; `pytest` discovers and runs zero tests without errors.

---

## Phase 3: User Story 1 — Upload and Process a Document (Priority: P1) 🎯 MVP

**Goal**: `POST /api/v1/documents/` accepts a PDF/DOCX/TXT file, extracts text, chunks it, embeds each chunk, and atomically stores Document + Chunks. Returns HTTP 201 with document metadata and chunk count.

**Independent Test**: Upload a real PDF via `curl -X POST http://localhost:8000/api/v1/documents/ -F "file=@sample.pdf"` and verify HTTP 201, `processing_status: "completed"`, and that the `chunks` table contains rows with non-null 384-dim embeddings.

### Tests for User Story 1 ⚠️

> **Write these tests FIRST — ensure they FAIL before implementation begins**

- [ ] T010 [P] [US1] Write unit tests for text extractor in `ingestion/tests/test_extractor.py`: test PDF extraction (mock pypdf `PdfReader`), DOCX extraction (mock `python-docx` `Document`), TXT extraction (plain string), empty-file returns empty string
- [ ] T011 [P] [US1] Write unit tests for chunker in `ingestion/tests/test_chunker.py`: test that output chunks are ≤256 tokens each, that overlap produces shared tokens between adjacent chunks, that an empty input returns an empty list, that chunks shorter than 50 tokens are merged
- [ ] T012 [P] [US1] Write unit tests for embedder in `ingestion/tests/test_embedder.py`: mock `SentenceTransformer`; assert `encode()` is called with each chunk text; assert output is a list of numpy arrays of shape `(384,)`
- [ ] T013 [P] [US1] Write contract tests for `POST /api/v1/documents/` in `ingestion/tests/test_views.py`: mock ingestion pipeline service; assert HTTP 201 + `DocumentSerializer` fields on success; assert HTTP 413 for >50 MB; assert HTTP 415 for unsupported format; assert HTTP 422 for empty/no-text file; assert HTTP 500 returns structured JSON (not Django traceback)

### Implementation for User Story 1

- [ ] T014 [P] [US1] Create `Document` and `Chunk` models in `ingestion/models.py`: `Document` (UUIDField pk, CharField filename, CharField file_format choices, DateTimeField upload_timestamp auto_now_add, CharField processing_status choices pending/completed/failed default pending, IntegerField chunk_count null blank); `Chunk` (UUIDField pk, ForeignKey Document CASCADE, TextField text, VectorField 384 dim from pgvector, IntegerField chunk_index, IntegerField token_count); `Meta` on Chunk: `unique_together = [('document', 'chunk_index')]`
- [ ] T015 [US1] Generate initial migration `ingestion/migrations/0001_initial.py`: creates `ingestion_documents` and `ingestion_chunks` tables; add raw SQL operation to `CREATE EXTENSION IF NOT EXISTS vector` and `CREATE INDEX chunk_embedding_idx ON ingestion_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)`; verify migration applies cleanly against a test DB
- [ ] T016 [P] [US1] Implement text extractor service in `ingestion/services/extractor.py`: `extract_text(file_obj, file_format: str) -> str`; use `pypdf.PdfReader` for PDF, `docx.Document` for DOCX, `file_obj.read().decode('utf-8', errors='replace')` for TXT; raise `ExtractionError` if result is empty
- [ ] T017 [P] [US1] Implement chunker service in `ingestion/services/chunker.py`: `chunk_text(text: str) -> list[str]`; load `spacy.load('en_core_web_sm')`; split into sentences; group sentences into chunks targeting 200–240 tokens (verified with `AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2')`); apply 32-token overlap; merge chunks <50 tokens into neighbour; return list of chunk strings
- [ ] T018 [P] [US1] Implement embedder service in `ingestion/services/embedder.py`: `embed_chunks(chunks: list[str]) -> list[np.ndarray]`; access the `SentenceTransformer` singleton loaded by `AppConfig`; call `model.encode(chunks, normalize_embeddings=True)`; return list of 384-dim float32 arrays; raise `EmbeddingError` on failure
- [ ] T019 [US1] Configure `ingestion/apps.py` `IngestionConfig.ready()`: load `SentenceTransformer('/app/models/all-MiniLM-L6-v2')` into a module-level singleton `ingestion.services.embedder.MODEL`; set model to `eval()` mode; guard with `apps.registry.ready` flag to prevent double-load during tests
- [ ] T020 [US1] Implement ingestion pipeline orchestrator in `ingestion/services/pipeline.py`: `ingest_document(file_obj, filename, file_format) -> Document`; wrap in `transaction.atomic()`: create `Document(status=pending)`, call `extractor` → `chunker` → `embedder`, bulk-create `Chunk` records, set `Document.processing_status='completed'` and `chunk_count`; on any exception roll back transaction, set status to `failed`, re-raise as `IngestionError`
- [ ] T021 [US1] Create `DocumentSerializer` in `ingestion/serializers.py`: serialize all `Document` fields (id, filename, file_format, upload_timestamp, processing_status, chunk_count); read-only
- [ ] T022 [US1] Implement `IngestView` in `ingestion/views.py`: accept `multipart/form-data` POST; validate file present, size ≤50 MB (HTTP 413), format in {pdf,docx,txt} (HTTP 415); call pipeline; return HTTP 201 + `DocumentSerializer`; catch `ExtractionError` → 422, `IngestionError` → 500; all error responses use `{"error": "..."}` JSON shape
- [ ] T023 [US1] Wire ingestion URLs: create `ingestion/urls.py` with `POST api/v1/documents/ → IngestView`; include in `stakeholder_analysis/urls.py`

**Checkpoint**: `pytest ingestion/tests/` passes. `curl -X POST .../api/v1/documents/ -F file=@sample.pdf` returns HTTP 201 with chunk_count > 0.

---

## Phase 4: User Story 2 — Health Check Verification (Priority: P2)

**Goal**: `GET /health` returns HTTP 200 + `{"status":"healthy","database":"connected"}` when the service is running and the database is reachable; returns HTTP 503 + `{"status":"unhealthy","database":"unreachable"}` otherwise.

**Independent Test**: `curl http://localhost:8000/health` returns HTTP 200 JSON within 1 second. Stop the database and confirm HTTP 503.

### Tests for User Story 2 ⚠️

- [ ] T024 [P] [US2] Write tests for `GET /health` in `ingestion/tests/test_health.py`: mock `django.db.connection.ensure_connection` success → assert HTTP 200 `{"status":"healthy","database":"connected"}`; mock it raising `OperationalError` → assert HTTP 503 `{"status":"unhealthy","database":"unreachable"}`

### Implementation for User Story 2

- [ ] T025 [US2] Implement `HealthView` in `ingestion/views.py`: `GET /health`; attempt `connection.ensure_connection()`; return HTTP 200 `{"status":"healthy","database":"connected"}` on success; return HTTP 503 `{"status":"unhealthy","database":"unreachable"}` on `OperationalError`; no authentication required
- [ ] T026 [US2] Register `/health` route in `stakeholder_analysis/urls.py` (unversioned, outside `/api/v1/`)

**Checkpoint**: `pytest ingestion/tests/test_health.py` passes. `curl http://localhost:8000/health` returns HTTP 200 within 1 second.

---

## Phase 5: User Story 3 — Local Development Environment Setup (Priority: P3)

**Goal**: A developer can clone the repo, copy `.env.example` to `.env`, fill in credentials, run `docker compose up`, and successfully call `POST /api/v1/documents/` — all within 10 minutes, no extra steps.

**Independent Test**: Fresh clone → `cp .env.example .env` (fill values) → `docker compose up` → all containers start, migrations apply, `GET /health` returns 200, `POST /api/v1/documents/` with a sample PDF returns 201.

### Tests for User Story 3 ⚠️

- [ ] T027 [P] [US3] Write test for missing environment variable startup failure in `ingestion/tests/test_settings.py`: temporarily unset a required env var in a subprocess invocation of Django's system check; assert the process exits with a non-zero code and the error message names the missing variable

### Implementation for User Story 3

- [ ] T028 [US3] Add startup env-var validation to `stakeholder_analysis/settings.py`: for each required variable (`DATABASE_URL`, `DEBUG`, `ALLOWED_HOSTS`), raise `ImproperlyConfigured("Missing required environment variable: {VAR}")` if not set or empty; `GROQ_API_KEY` should emit a warning but not block startup (not needed by ingestion)
- [ ] T029 [P] [US3] Complete `Dockerfile`: add `RUN python -m spacy download en_core_web_sm` after pip install; add `ENTRYPOINT` script that runs `python manage.py migrate --no-input` then `exec gunicorn stakeholder_analysis.wsgi:application --bind 0.0.0.0:8000 --workers 1 --timeout 120`
- [ ] T030 [P] [US3] Complete `docker-compose.yml`: finalize `models` named volume mount, `env_file: .env`, healthcheck on `/health`, `restart: unless-stopped`; add comment block explaining one-time model download command
- [ ] T031 [US3] Verify end-to-end quickstart: follow every step in `specs/001-doc-ingestion-pipeline/quickstart.md` from a clean Docker environment; fix any step that fails; update `quickstart.md` if steps have changed

**Checkpoint**: `docker compose up` from a clean clone + `.env` file produces a fully functional API within the documented 10-minute setup time.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Developer experience, code quality, and sprint gate validation.

- [ ] T032 [P] Write `README.md` at repo root: project overview, prerequisites, env var table, one-time model download command, `docker compose up` instructions, how to run tests, link to `specs/001-doc-ingestion-pipeline/quickstart.md`
- [ ] T033 [P] Add `.gitignore`: Python (`__pycache__/`, `*.pyc`, `*.pyo`), Django (`.env`, `db.sqlite3`), model volume contents (`models/`), pytest cache (`.pytest_cache/`), coverage (`.coverage`)
- [ ] T034 [P] Configure linter in `setup.cfg` or `pyproject.toml`: add `flake8` (or `ruff`) with `max-line-length=120`; run against all Python files; fix all reported issues
- [ ] T035 Run full test suite in Docker: `docker compose run --rm app pytest --tb=short`; all tests must pass; fix any failures before marking this task complete
- [ ] T036 [P] Add `CHANGELOG.md` entry for Sprint 1 delivery of US-01 (Document Ingestion Pipeline): feature summary, endpoints added, dependencies introduced — per constitution changelog requirement

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — all T001–T005 can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 complete — **blocks all user stories**
- **User Stories (Phases 3–5)**: All depend on Phase 2 completion
  - US1 (P1), US2 (P2), US3 (P3) can proceed in parallel once Phase 2 is done
  - Priority order for single developer: US1 → US2 → US3
- **Polish (Phase 6)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Starts after Phase 2 — no dependency on US1; `HealthView` is a separate class in the same `views.py` file
- **US3 (P3)**: Starts after Phase 2 — depends on US1 being complete (needs a working endpoint to validate the dev setup end-to-end)

### Within Each User Story

- Tests written and confirmed failing **before** implementation begins (T010–T013 before T014+)
- Models before services (T014 before T016–T018)
- Migration after models (T015 after T014)
- AppConfig after embedder service (T019 after T018)
- Pipeline after all services (T020 after T016, T017, T018, T019)
- Views after serializer and pipeline (T022 after T021, T020)
- URLs after views (T023 after T022)

### Parallel Opportunities

Within Phase 1: T002, T003, T004, T005 all parallel after T001
Within Phase 2: T008, T009 parallel after T006, T007
Within US1 tests: T010, T011, T012, T013 all parallel
Within US1 services: T016, T017, T018 parallel after T014

---

## Parallel Example: User Story 1

```
# After T014 (models) and T015 (migration) complete:

Parallel service batch:
  T016 — extractor.py (no deps on T017/T018)
  T017 — chunker.py   (no deps on T016/T018)
  T018 — embedder.py  (no deps on T016/T017)

Then sequentially:
  T019 — apps.py (depends on T018 module existing)
  T020 — pipeline.py (depends on T016, T017, T018, T019)
  T021 — serializers.py (parallel with T020 if different developer)
  T022 — views.py (depends on T020, T021)
  T023 — urls.py (depends on T022)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T009) — **do not skip**
3. Complete Phase 3: US1 (T010–T023)
4. **STOP and VALIDATE**: `pytest ingestion/tests/` passes; `curl POST .../api/v1/documents/` returns 201
5. Demo to Ramadan; proceed to US2 only after US1 sign-off

### Incremental Delivery

1. Setup + Foundational → container boots, migrations apply
2. US1 → working document ingestion → **Sprint 1 MVP**
3. US2 → health endpoint → production monitoring-ready
4. US3 → validated dev setup → onboarding-ready
5. Polish → README, lint, changelog → PR-ready

### Parallel Team Strategy

After Phase 2 complete:
- **Developer A**: US1 (T010–T023) — ingestion pipeline
- **Developer B**: US2 (T024–T026) — health endpoint
- Developer B can start US3 (T027–T031) once US1 is merged

---

## Notes

- `[P]` = different files, no unresolved dependencies — safe to run concurrently
- `[Story]` label maps each task to a user story for traceability and sprint planning
- Each user story is independently completable and testable
- Tests must FAIL before implementation; commit test files separately
- Commit after each task or logical group; PRs per user story phase
- Stop at any checkpoint to validate story independently before the next phase
- Model weights must be downloaded to the `models/` volume before `docker compose up` will serve embedding requests — see `quickstart.md` Step 2
