---
schema: sdgqalab/testmap@3
layer: backend
project: Stakeholder Analysis Tool
audited_at: "2026-04-15T00:00"
config_version: 3

coverage:
  total_source_files: 47
  unit:
    test_files: 14
    file_coverage_pct: 31.9
    file_coverage_rating: "🔴 Critical"
  integration:
    test_files: 32
    file_coverage_pct: 34.0
    file_coverage_rating: "🔴 Critical"
  e2e:
    journeys_identified: 8
    journeys_covered: 0
    gaps: 8
  security:
    areas_identified: 8
    areas_covered: 5
    gaps: 3
  accessibility:
    components_identified: 0
    components_covered: 0
    gaps: 0
  line_coverage_pct: 69.0
  line_coverage_rating: "🟡 Adequate"
  test_count: 259

by_scope:
  ingestion:
    source_files: 10
    unit_test_files: 3
    unit_file_coverage_pct: 30.0
    integration_test_files: 6
    integration_file_coverage_pct: 40.0
  ner:
    source_files: 36
    unit_test_files: 12
    unit_file_coverage_pct: 33.3
    integration_test_files: 25
    integration_file_coverage_pct: 30.6
  stakeholder_analysis:
    source_files: 1
    unit_test_files: 0
    unit_file_coverage_pct: 0.0
    integration_test_files: 1
    integration_file_coverage_pct: 100.0

delta:
  previous_audit: null
  unit_file_coverage_change: null
  integration_file_coverage_change: null
  line_coverage_change: null
  e2e_gaps_change: null
  security_gaps_change: null
  accessibility_gaps_change: null
---

# Backend Test Audit

> **Unit File Coverage**: 31.9% (15/47 files) · 🔴 Critical
> **Integration File Coverage**: 34.0% (16/47 files) · 🔴 Critical
> **Line Coverage**: 69.0% · 🟡 Adequate
> **Tests**: 259 (46 test files — all passing)
> **Audited**: 2026-04-15

Coverage tool: `pytest-cov` 7.1.0 via `docker compose exec -T app python -m pytest --cov=. --cov-report=term-missing`.
`pytest-cov` is not in `requirements.txt` — add `pytest-cov==7.1.0` to pin it.

The 69% line figure is healthy for a project of this complexity. The critical gap
is at the **file coverage** level: large services (`views.py` 4300 lines, 43%;
`report_export.py` 527 lines, 40%; `nl_query.py` 121 lines, 16%) have
integration tests that exercise the happy path but miss error branches and
secondary providers.

---

## Unit Tests

Tests that verify services in isolation — mocked LLM clients, no DB, no I/O.
Targets: service functions, model helpers, utility functions, validators.

### Unit Coverage by Scope

| Scope | Source Files | Unit Test Files | Unit File Coverage |
|-------|-------------|-----------------|-------------------|
| ingestion | 10 | 3 | 30.0% |
| ner | 36 | 12 | 33.3% |
| stakeholder_analysis | 1 | 0 | 0.0% |
| **Total** | **47** | **15** | **31.9%** |

### Existing Unit Tests

| Scope | Test File | Approx. Tests | Modules Covered |
|-------|-----------|---------------|-----------------|
| ingestion | `test_chunker.py` | 5 | `services/chunker.py`: sentence splitting, overlap, edge cases |
| ingestion | `test_embedder.py` | 5 | `services/embedder.py`: encode dimensions, batch calling |
| ingestion | `test_extractor.py` | 11 | `services/extractor.py`: PDF, DOCX, HTML extraction, error handling |
| ner | `test_costing.py` | ~3 | `services/costing.py`: token counting |
| ner | `test_deduplicator.py` | ~4 | `services/deduplicator.py`: merge/deduplicate logic |
| ner | `test_entity_dedup_service.py` | ~6 | `services/entity_dedup_service.py`: scoring, matching |
| ner | `test_groq_client.py` | ~8 | `services/groq_client.py`: extraction, prompt loading, rate-limit |
| ner | `test_openai_client.py` | ~5 | `services/openai_client.py`: extraction, empty content, rate-limit |
| ner | `test_priority.py` | ~8 | `services/priority_table.py`: scoring, sorting, threshold logic |
| ner | `test_relation_deduplicator.py` | ~4 | `services/relation_deduplicator.py`: dangling refs, self-loops |
| ner | `test_relation_extractor.py` | ~6 | `services/relation_extractor.py`: validation, confidence clamping |
| ner | `test_semantic_search.py` | 1 | `services/semantic_search.py`: embed_query returns list |
| ner | `test_smq.py` | ~8 | `services/smq_generator.py`: section generation logic |
| ner | `test_staleness.py` | ~7 | `services/report_staleness.py`: freshness checks |
| ner | `test_text_quality.py` | ~2 | `services/text_quality.py`: markdown stripping, min-specificity |

### Unit Tests Needed

| File | Scope | What to Test |
|------|-------|--------------|
| `ingestion/services/context.py` | ingestion | Context assembly, token budget truncation (currently 13% coverage) |
| `ingestion/services/pipeline.py` | ingestion | Pipeline orchestration: chunk → embed → store steps in isolation (currently 13%) |
| `ingestion/services/web_source.py` | ingestion | URL fetch, content extraction, error handling (currently 14%) |
| `ingestion/serializers.py` | ingestion | Validation rules, nested write/read logic |
| `ner/services/gemini_client.py` | ner | Gemini extraction, rate-limit, API key error (currently 12%) |
| `ner/services/gemini_compat.py` | ner | Compatibility shim logic, model mapping (currently 19%) |
| `ner/services/nl_query.py` | ner | Query parsing, intent detection, entity resolution (currently 16%) |
| `ner/services/engagement_notes.py` | ner | Note generation, template rendering (currently 16%) |
| `ner/services/azure_openai_client.py` | ner | Azure-specific auth, endpoint construction (currently 17%) |
| `ner/services/provider_payloads.py` | ner | Payload builders for each provider — currently **0% coverage**, directly impacts extraction quality |
| `ner/services/provider_runtime.py` | ner | Runtime provider selection, fallback logic (currently 60%) |
| `ner/services/provider_factory.py` | ner | Factory registration, provider lookup, error on unknown |
| `ner/services/taxonomy.py` | ner | Taxonomy lookup, category validation (currently 57%) |
| `ner/services/contextual_summary.py` | ner | Summary generation, template rendering (currently 44%) |
| `ner/services/workplan_generator.py` | ner | Phase generation, template logic (currently 53%) |
| `ner/services/persona_generator.py` | ner | Persona assembly, attribute mapping (currently 54%) |
| `ner/management/commands/cleanup_orphan_entities.py` | ner | Orphan detection, dry-run mode, batch delete |
| `stakeholder_analysis/auth_views.py` | stakeholder_analysis | Password validation, email uniqueness, token rotation |

---

## Integration Tests

Tests that verify components working across DB, task queue, and API boundaries.

### Integration Coverage by Scope

| Scope | Source Files | Integration Test Files | Integration File Coverage |
|-------|-------------|----------------------|--------------------------|
| ingestion | 10 | 6 | 40.0% |
| ner | 36 | 25 | 30.6% |
| stakeholder_analysis | 1 | 1 | 100.0% |
| **Total** | **47** | **32** | **34.0%** |

### Existing Integration Tests

| Scope | Test File | Approx. Tests | Boundaries Covered |
|-------|-----------|---------------|--------------------|
| ingestion | `test_views.py` | 9 | IngestView: upload, format detection, DB record creation, auth required |
| ingestion | `test_concept_note_view.py` | 1 | Concept note save/load endpoint |
| ingestion | `test_project_document_endpoints.py` | 6 | Project-scoped document list, delete |
| ingestion | `test_project_provider_validation.py` | 2 | Provider model validation on project |
| ingestion | `test_workflow.py` | 4 | Workflow status: steps computed from DB state |
| ingestion | `test_health.py` | 3 | `/health` endpoint responses |
| ner | `test_views.py` | ~50 | NER endpoints: extract, entity list/detail, graph, relations |
| ner | `test_auth_api.py` | ~12 | Auth endpoints: register, login, logout, token, 2FA |
| ner | `test_contextual_summary_api.py` | ~6 | Contextual summary: generate, cache, errors |
| ner | `test_dedup_review_api.py` | ~5 | Dedup review: approve/reject merge candidates |
| ner | `test_document_review_integrity.py` | ~5 | Extraction state machine, document status transitions |
| ner | `test_edge_cases.py` | ~15 | Multi-provider edge cases, empty doc, large doc, Unicode |
| ner | `test_entity_flag.py` | ~4 | Entity flag/unflag API |
| ner | `test_entity_profile_api.py` | ~4 | Entity profile detail, relations |
| ner | `test_entity_review_candidates.py` | ~4 | Review candidate generation |
| ner | `test_export.py` | ~7 | Report export: PDF generation, section inclusion |
| ner | `test_graph_payload_api.py` | ~3 | Graph payload: node/edge structure |
| ner | `test_guidance.py` | ~5 | Guidance text generation, project-level |
| ner | `test_intake.py` | ~6 | Intake profile save, validation, project linking |
| ner | `test_llm_settings.py` | ~5 | LLM settings CRUD, provider override |
| ner | `test_pipeline.py` | ~8 | Pipeline orchestration: extraction + NER + storage |
| ner | `test_report.py` | ~10 | Report generation, section ordering, SMQ linking |
| ner | `test_report_view.py` | ~5 | Report view endpoint, section status |
| ner | `test_personas.py` | ~8 | Persona generation API, template rendering |
| ner | `test_workplan.py` | ~8 | Workplan generation API, phase structure |
| ner | `test_staleness.py` | ~7 | Staleness check API, trigger conditions |

### Integration Tests Needed

| File | Scope | What to Test |
|------|-------|--------------|
| `ingestion/services/pipeline.py` | ingestion | Full ingestion pipeline integration: PDF → chunks → embeddings → DB (only 13% line coverage) |
| `ingestion/services/web_source.py` | ingestion | Web source fetch → parse → ingest (only 14%) |
| `ingestion/tasks.py` | ingestion | Celery task dispatch, retry on failure, task result storage |
| `ner/tasks.py` | ner | Celery task: extraction task trigger, progress updates, error callback (35%) |
| `ner/views.py` (large sections) | ner | 1090 uncovered lines; newer endpoints (personas, workplan, export) partially untested |
| `ner/services/report_export.py` | ner | DOCX export format, section formatting, citation embedding (40%) |
| `ner/services/relation_extractor.py` | ner | Full extraction with real fixtures: valid/invalid relation shapes (35%) |
| `stakeholder_analysis/auth_views.py` | stakeholder_analysis | Password reset, change-password endpoint, token expiry (43%) |

---

## End-to-End (E2E) Tests

Tests that verify complete API workflows end-to-end through the actual stack.

> **0** of **8** critical journeys covered · **8** gaps

### Existing E2E Tests

No E2E framework is configured (no `cypress/`, `playwright/`, `e2e/` directory found).

### E2E Tests Needed

| User Journey | Priority | What to Cover |
|-------------|----------|---------------|
| Document ingest → extraction → entity graph | P1 | Upload file → poll status → verify entities and relations stored |
| User auth flow: register → login → protected route | P1 | Register user → login → access auth-required endpoint → logout → 401 |
| Full report generation: intake → SMQ → report | P1 | Create project → fill intake → trigger extraction → generate sections → verify report |
| Entity deduplication workflow | P2 | Extract doc → identify duplicates → review → approve merge → assert merged entity |
| Export pipeline: PDF and DOCX | P2 | Generate report → trigger export → verify file content includes all sections |
| Project lifecycle: create → configure → delete | P2 | Create project → set provider/model → add doc → delete → verify cascade clean |
| Semantic search end-to-end | P3 | Submit NL query → verify ranked entity results match query intent |
| Persona and workplan generation | P3 | Trigger persona generation → verify all personas have required fields |

> No E2E framework exists. For a Django API, **pytest with `requests`** or
> **`httpx`** against a live test server (`pytest-django`'s `live_server` fixture)
> is the lowest-friction option and integrates with the existing pytest setup.

---

## Security Tests

> **5** of **8** security-sensitive areas covered · **3** gaps

### Existing Security Tests

| Scope | Test File | What's Tested |
|-------|-----------|---------------|
| stakeholder_analysis | `test_auth_api.py` | Register/login/logout endpoints; token issuance; 400 on bad credentials |
| ingestion | `test_views.py` | 401 when no auth token on upload; 403 when project not owned |
| ingestion | `test_project_provider_validation.py` | Invalid provider/model rejected at API layer |
| ner | `test_views.py` | Auth required on extraction endpoints; project ownership enforced |
| ner | `test_edge_cases.py` | Empty document, oversized document, Unicode characters in extraction |

### Security Tests Needed

| Area | Scope | What to Test |
|------|-------|--------------|
| SQL injection via query params | ner | Crafted entity filter params (e.g., `?type=ORG' OR '1'='1`) — ORM should reject, verify 400 not 500 |
| LLM prompt injection | ner | Document containing adversarial prompts (e.g., "Ignore previous instructions…") — verify extraction output does not contain injected instructions |
| Celery task authorization | ingestion/ner | Verify tasks only execute for the owning user's project; task ID cannot be hijacked cross-user |

---

## Test Health Observations

| Test File | Observation | Impact |
|-----------|-------------|--------|
| `ner/tests/test_semantic_search.py` | Only 1 test (`test_embed_query_returns_list`). The semantic search endpoint (lines 66-75 in `semantic_search.py`) is untested — the service is called but not the ranked-results path. | Search quality regressions invisible to test suite |
| `ner/tests/test_text_quality.py` | 2 test functions for a 36-line service. Happy path only — no tests for very long strings, non-ASCII content, or strings already meeting the minimum specificity threshold. | Edge-case regressions in text cleaning undetected |
| `ner/services/provider_payloads.py` | **0% coverage**. This file builds the system prompt and user message for every LLM provider. No test exercises any payload builder. Changes to prompts are currently untestable. | LLM extraction quality regressions fully invisible |
| `ingestion/services/pipeline.py` | 13% coverage despite being the main ingestion orchestrator. The only covered lines are the import-time constants; the actual pipeline steps are untested. | Silent failures in chunking→embedding→storage pipeline |
| `ner/services/engagement_notes.py` | 16% coverage (119 statements). Likely new/recent addition with no tests yet added. | Engagement note generation fully unobservable |
| `ner/tasks.py` | 35% coverage. The Celery task body (lines 29-84) is not covered — only the task decorator import lines. Async task failures would not be caught. | Task dispatch/retry bugs invisible |

---

## Recommendations

1. **[P1] Add unit tests for `ner/services/provider_payloads.py`** — This is 0% covered and directly controls what is sent to every LLM provider. A payload change breaking extraction would be completely invisible. Tests should assert prompt structure, system/user message split, and that no provider-specific keys leak into other providers' payloads.

2. **[P1] Add `pytest-cov==7.1.0` to `requirements.txt`** — Currently installed ad-hoc via pip; not pinned. Lock it so Docker rebuilds don't silently drop coverage tooling.

3. **[P1] Test the Celery tasks in `ingestion/tasks.py` and `ner/tasks.py`** — Use `@pytest.mark.django_db` + mocked Celery (`CELERY_TASK_ALWAYS_EAGER=True`) to run tasks synchronously in tests. Current 35% and 50% coverage means async failure modes are entirely dark.

4. **[P1] Add unit tests for `ingestion/services/pipeline.py`** — The orchestration pipeline is 13% covered. Mock the `chunker`, `embedder`, and DB layer and verify: normal flow, extractor failure, embedding failure, DB write failure. This is the highest-value test gap in the ingestion scope.

5. **[P2] Extend `test_groq_client.py` / `test_openai_client.py` to cover Gemini and Azure** — `gemini_client.py` (12%) and `azure_openai_client.py` (17%) are used as provider fallbacks but almost untested. Parallel test structure to the Groq/OpenAI tests.

6. **[P2] Add integration tests for `ner/services/report_export.py`** — At 40% line coverage (527 statements), the PDF/DOCX generation paths are largely untested. Use `reportlab`/`python-docx` in-memory generation to assert section content without filesystem I/O.

7. **[P2] Set up E2E tests with pytest + `live_server`** — The full extraction pipeline (upload → NER → graph) has no end-to-end coverage. Use `pytest-django`'s `live_server` fixture with `httpx` to exercise the real stack against an in-memory SQLite database.

8. **[P3] Expand `test_semantic_search.py`** — The semantic search ranked-result path (6 uncovered lines at 66-75) is the actual user-facing feature. Add tests for: no results, single result, ranked multi-result, query with special characters.

## Acceptance Criteria

- [ ] `pytest-cov==7.1.0` added to `requirements.txt`
- [ ] `ner/services/provider_payloads.py` has ≥ 80% line coverage
- [ ] `ingestion/services/pipeline.py` has ≥ 60% line coverage
- [ ] `ingestion/tasks.py` and `ner/tasks.py` each have ≥ 60% line coverage
- [ ] `ner/services/gemini_client.py` has ≥ 60% line coverage
- [ ] All API endpoints have at least one authenticated and one unauthenticated test
- [ ] E2E smoke test exists for upload → extraction → graph journey
- [ ] All 259 existing tests continue to pass: `docker compose exec -T app python -m pytest`
