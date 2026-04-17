---
schema: sdgqalab/testmap@3
layer: backend
project: Stakeholder Analysis Tool
audited_at: "2026-04-16T00:00"
config_version: 3

coverage:
  total_source_files: 50
  unit:
    test_files: 29
    file_coverage_pct: 58.0
    file_coverage_rating: "🟡 Adequate"
  integration:
    test_files: 21
    file_coverage_pct: 42.0
    file_coverage_rating: "🟠 Low"
  e2e:
    journeys_identified: 8
    journeys_covered: 0
    gaps: 8
  security:
    areas_identified: 7
    areas_covered: 3
    gaps: 4
  accessibility:
    components_identified: 0
    components_covered: 0
    gaps: 0
  line_coverage_pct: null
  line_coverage_rating: "BLOCKED — Docker Desktop not running; previous audit: 69.0% (2026-04-15)"
  test_count: ~310

by_scope:
  ingestion:
    source_files: 11
    unit_test_files: 5
    unit_file_coverage_pct: 45.5
    integration_test_files: 6
    integration_file_coverage_pct: 54.5
  ner:
    source_files: 36
    unit_test_files: 24
    unit_file_coverage_pct: 66.7
    integration_test_files: 14
    integration_file_coverage_pct: 38.9
  reasoning:
    source_files: 0
    note: "Stub app — no non-infrastructure source files"
  graph:
    source_files: 0
    note: "Stub app — no non-infrastructure source files"
  models:
    source_files: 0
    note: "App directory not found"
  stakeholder_analysis:
    source_files: 3
    unit_test_files: 0
    unit_file_coverage_pct: 0.0
    integration_test_files: 1
    integration_file_coverage_pct: 33.3

delta:
  previous_audit: "2026-04-15T00:00"
  unit_file_coverage_change: +26.1
  integration_file_coverage_change: +8.0
  line_coverage_change: null
  e2e_gaps_change: 0
  security_gaps_change: +1
  accessibility_gaps_change: 0
---

# Backend Test Audit

> **Unit File Coverage**: 58.0% (29/50 files) · 🟡 Adequate
> **Integration File Coverage**: 42.0% (21/50 files) · 🟠 Low
> **Line Coverage**: BLOCKED — Docker Desktop not running. Previous value: 69.0% (2026-04-15).
> **Tests**: ~310 across 65 test files
> **Audited**: 2026-04-16

> **Line coverage blocker**: The backend coverage command (`docker compose exec -T app python -m pytest --cov=...`) requires Docker Desktop to be running. Start Docker and re-run `sdgqalab-testmap` to obtain line coverage. Do NOT treat the previous 69.0% as current — 15+ new test files have been added since that run.

---

## Unit Tests

Tests that verify modules in isolation — no DB, no HTTP, no external LLM calls.
Targets: models, serializers, service helpers, utility functions, management commands.

### Unit Coverage by Scope

| Scope | Source Files | Unit Test Files | Unit File Coverage |
|-------|-------------|-----------------|-------------------|
| ingestion | 11 | 5 | 45.5% |
| ner | 36 | 24 | 66.7% |
| reasoning | 0 | — | n/a |
| graph | 0 | — | n/a |
| models | 0 | — | n/a |
| stakeholder_analysis | 3 | 0 | 0.0% |
| **Total** | **50** | **29** | **58.0%** |

### Existing Unit Tests

| Scope | Test File | Approx. Tests | Modules Covered |
|-------|-----------|---------------|-----------------|
| ingestion | test_chunker.py | ~8 | services/chunker.py — text splitting, overlap |
| ingestion | test_embedder.py | ~6 | services/embedder.py — sentence-transformer embedding |
| ingestion | test_context.py | ~6 | services/context.py — context window helpers |
| ingestion | test_web_source_helpers.py | ~8 | services/web_source.py — URL fetch, HTML extraction |
| ingestion | test_serializers.py | ~6 | serializers.py — field validation, project FK |
| ner | test_costing.py | ~8 | services/costing.py — token cost calculation |
| ner | test_openai_client.py | ~8 | services/openai_client.py — request/response shaping |
| ner | test_azure_openai_client.py | ~6 | services/azure_openai_client.py — Azure endpoint calls |
| ner | test_groq_client.py | ~6 | services/groq_client.py — Groq request shaping |
| ner | test_gemini_client.py | ~6 | services/gemini_client.py — Gemini request shaping |
| ner | test_gemini_compat.py | ~6 | services/gemini_compat.py — compatibility shim |
| ner | test_deduplicator.py | ~10 | services/deduplicator.py — fuzzy dedup logic |
| ner | test_entity_mention_count_dedup.py | ~6 | services/deduplicator.py — mention-count weighting |
| ner | test_relation_deduplicator.py | ~8 | services/relation_deduplicator.py |
| ner | test_entity_dedup_service.py | ~10 | services/entity_dedup_service.py — dedup pipeline |
| ner | test_entity_phase_linking.py | ~6 | services/entity_dedup_service.py — phase linking |
| ner | test_acronym_map_seed.py | ~4 | services/entity_dedup_constants.py — acronym map |
| ner | test_taxonomy.py | ~8 | services/taxonomy.py — label/type resolution |
| ner | test_text_quality.py | ~8 | services/text_quality.py — quality scoring |
| ner | test_provider_factory.py | ~8 | services/provider_factory.py — provider selection |
| ner | test_provider_payloads.py | ~10 | services/provider_payloads.py — prompt building |
| ner | test_provider_runtime.py | ~8 | services/provider_runtime.py — execution/retry |
| ner | test_nl_query_helpers.py | ~8 | services/nl_query.py — query parsing |
| ner | test_contextual_summary.py | ~6 | services/contextual_summary.py — summary generation |
| ner | test_engagement_notes.py | ~6 | services/engagement_notes.py |
| ner | test_persona_generator.py | ~6 | services/persona_generator.py |
| ner | test_staleness.py | ~6 | services/report_staleness.py |
| ner | test_priority.py | ~6 | services/priority_table.py |
| ner | test_workplan_generator.py | ~6 | services/workplan_generator.py |
| ner | test_cleanup_command.py | ~4 | management/commands/cleanup_orphan_entities.py |

### Unit Tests Needed

| File | Scope | What to Test |
|------|-------|--------------|
| `ingestion/models.py` | ingestion | Model field defaults, `__str__`, custom manager methods |
| `ner/models.py` | ner | Entity/Relation `__str__`, index constraints, `is_flagged` default |
| `ner/serializers.py` | ner | Serializer field validation, read-only fields, nested write |
| `ner/services/pdf_utils.py` | ner | PDF extraction, page count handling, error on encrypted PDF |
| `ner/services/provider_interface.py` | ner | Abstract interface contract — subclass compliance test |
| `stakeholder_analysis/auth_views.py` | stakeholder_analysis | Token validation logic isolated from HTTP layer |
| `stakeholder_analysis/auth_urls.py` | stakeholder_analysis | URL pattern resolution (reverse/resolve) |

---

## Integration Tests

Tests that verify components working across boundaries — Django test client,
database transactions, Celery task dispatch, and service orchestration.

### Integration Coverage by Scope

| Scope | Source Files | Integration Test Files | Integration File Coverage |
|-------|-------------|----------------------|--------------------------|
| ingestion | 11 | 6 | 54.5% |
| ner | 36 | 14 | 38.9% |
| reasoning | 0 | — | n/a |
| graph | 0 | — | n/a |
| models | 0 | — | n/a |
| stakeholder_analysis | 3 | 1 | 33.3% |
| **Total** | **50** | **21** | **42.0%** |

### Existing Integration Tests

| Scope | Test File | Approx. Tests | Boundaries Covered |
|-------|-----------|---------------|--------------------|
| ingestion | test_views.py | ~10 | Document upload, project CRUD endpoints |
| ingestion | test_concept_note_view.py | ~8 | Concept note submit, validation |
| ingestion | test_project_document_endpoints.py | ~10 | Document list, delete, status |
| ingestion | test_health.py | ~4 | urls_health.py health-check endpoint |
| ingestion | test_workflow.py | ~8 | Full pipeline: upload → chunk → embed → DB |
| ingestion | test_extractor.py | ~8 | services/extractor.py — extraction pipeline |
| ingestion | test_pipeline.py | ~8 | services/pipeline.py — pipeline orchestration |
| ingestion | test_tasks.py | ~6 | tasks.py — Celery task dispatch |
| ingestion | test_project_provider_validation.py | ~6 | Provider/model validation on project create |
| ner | test_entity_profile_api.py | ~10 | Entity detail, alias, mention count endpoints |
| ner | test_graph_payload_api.py | ~8 | Graph JSON payload, edge/node structure |
| ner | test_dedup_review_api.py | ~8 | Dedup review queue, approve/reject API |
| ner | test_entity_flag.py | ~6 | Entity flag/unflag endpoint |
| ner | test_semantic_search.py | ~8 | NL semantic search endpoint |
| ner | test_contextual_summary_api.py | ~8 | Contextual summary generation endpoint |
| ner | test_export.py | ~8 | Report PDF/DOCX export endpoint |
| ner | test_report.py | ~10 | Report section generation, status polling |
| ner | test_report_view.py | ~8 | Report API endpoints, section update |
| ner | test_smq.py | ~10 | SMQ question/answer CRUD endpoints |
| ner | test_personas.py | ~8 | Persona generation endpoint, list |
| ner | test_workplan.py | ~8 | Workplan generation, section list |
| ner | test_pipeline.py | ~8 | NER pipeline end-to-end execution |
| ner | test_views.py | ~10 | General NER view endpoints |
| stakeholder_analysis | test_auth_api.py | ~10 | Login, register, token refresh, logout |
| stakeholder_analysis | test_auth_views_extended.py | ~8 | Invalid tokens, expired sessions, edge cases |

### Integration Tests Needed

| File | Scope | What to Test |
|------|-------|--------------|
| `ingestion/models.py` | ingestion | Model cascade deletes, DB-level constraints, migration integrity |
| `ingestion/services/chunker.py` | ingestion | Integration with real PDF/DOCX input (not just unit-level text) |
| `ingestion/services/embedder.py` | ingestion | Embedding written to pgvector column — round-trip test |
| `ingestion/services/context.py` | ingestion | Context assembly with realistic entity graph |
| `ingestion/services/web_source.py` | ingestion | Live fetch mocked at `requests` level, HTML → chunks flow |
| `ner/models.py` | ner | FK cascade deletes, dedup index uniqueness, project scoping |
| `ner/serializers.py` | ner | API serializer round-trip — create via API, read back |
| `ner/services/pdf_utils.py` | ner | PDF extraction integrated into report export pipeline |
| `ner/services/azure_openai_client.py` | ner | Client exercised via provider_runtime integration test |
| `ner/services/costing.py` | ner | Cost tallied across a real extraction run |
| `ner/services/deduplicator.py` | ner | Dedup against DB-persisted entities (not in-memory list) |
| `ner/services/gemini_client.py` | ner | Client exercised via provider_factory switching test |
| `ner/services/gemini_compat.py` | ner | Compat shim exercised with real Gemini-format response |
| `ner/services/groq_client.py` | ner | Client exercised via provider_runtime |
| `ner/services/openai_client.py` | ner | Client exercised via provider_runtime |
| `ner/services/priority_table.py` | ner | Priority table generated for a project with real entities |
| `ner/services/provider_factory.py` | ner | Factory selects correct client for each provider setting |
| `ner/services/provider_interface.py` | ner | All concrete clients implement the interface contract |
| `ner/services/provider_payloads.py` | ner | Payload fed into mock client — full pipeline smoke test |
| `ner/services/provider_runtime.py` | ner | Runtime executes extraction with mocked HTTP; retry logic |
| `ner/services/relation_deduplicator.py` | ner | Relation dedup persisted to DB, canonical refs correct |
| `ner/services/report_staleness.py` | ner | Staleness flag set when entity graph changes post-report |
| `ner/services/taxonomy.py` | ner | Taxonomy seed applied, label resolution via DB |
| `ner/services/text_quality.py` | ner | Quality filter gates low-quality extracts at pipeline level |
| `stakeholder_analysis/celery.py` | stakeholder_analysis | Celery app config — broker URL, task autodiscovery |

---

## End-to-End (E2E) Tests

API workflow journeys tested through the full application stack.

> **0** of **8** critical API journeys covered · **8** gaps

> No E2E test framework detected. The backend has no Pytest integration-level E2E suite (distinct from unit/integration tests that use the Django test client). A dedicated journey test module using Docker Compose + real Postgres is recommended.

### Existing E2E Tests

None — no E2E framework or journey test suite configured.

### E2E Tests Needed

| User Journey | Priority | What to Cover |
|-------------|----------|---------------|
| Full ingestion pipeline | P1 | Upload document → chunk → embed → entities persisted in pgvector |
| Entity extraction + dedup | P1 | Extract via LLM (mocked) → dedup applied → review queue populated |
| Report generation end-to-end | P1 | Trigger report → sections queued → Celery task completes → sections available |
| Auth token lifecycle | P1 | Register → login → access protected endpoint → refresh → logout |
| NL query search | P2 | Free-text query → semantic search → ranked results returned |
| SMQ workflow | P2 | SMQ template seeded → answers submitted → saved per project |
| Workplan generation | P2 | Workplan triggered → tasks generated → exported to DOCX |
| Web source ingestion | P3 | URL submitted → fetched → chunked → embedded → stored |

---

## Security Tests

> **3** of **7** security-sensitive areas covered · **4** gaps

### Existing Security Tests

| Scope | Test File | What's Tested |
|-------|-----------|---------------|
| stakeholder_analysis | test_auth_api.py | Login with valid/invalid credentials, token refresh, logout |
| stakeholder_analysis | test_auth_views_extended.py | Expired tokens, malformed headers, brute-force edge cases |
| ner | test_entity_profile_api.py | Authenticated endpoint — 401 for unauthenticated requests |

### Security Tests Needed

| Area | Scope | What to Test |
|------|-------|--------------|
| Input validation on free-text search | ner | NL query endpoint: SQL metacharacters, excessively long queries, null bytes |
| File upload security | ingestion | SSRF via web source URL (private IPs rejected), malicious PDF (fuzz pypdf), oversized files |
| Rate limiting | stakeholder_analysis | Repeated login attempts trigger throttle (if DRF throttling is configured) |
| Authorization on project-scoped endpoints | ner | User A cannot read/write User B's project entities or reports |

---

## Test Health Observations

No systemic anti-patterns observed in the backend test suite. The test files follow consistent naming conventions, use Django's `TestCase`/`APITestCase`, and most have clear assertion statements. The new untracked test files (15 in `ner/tests/`, 5 in `ingestion/tests/`) follow the same pattern. No no-assertion or happy-path-only issues detected from structural analysis.

One structural note: `ner/tests/factories.py` is a fixture/factory helper, not a test file — it should remain excluded from test counts and is correctly placed.

---

## Recommendations

1. **[P1] Start Docker and re-run coverage to get current line coverage.** The previous 69.0% is from before 15+ new test files were added. Fresh line data will show the real current state and likely reveal gaps the structural analysis cannot see.

2. **[P1] Add integration tests for `ingestion/models.py` and `ner/models.py`.** Both model files have zero direct test coverage. Models are the foundation — cascade delete behaviour, unique constraints, and project-scoping logic should be verified at the DB level.

3. **[P2] Add cross-project authorization tests.** No existing test verifies that user A cannot access user B's project. This is a critical auth gap for a multi-tenant tool. Add parametrised tests covering all project-scoped endpoints.

4. **[P2] Add integration tests for 9 uncovered ingestion service files.** The services (chunker, embedder, context, web_source) have unit tests but no integration tests verifying their output is correctly persisted. An `ingestion/tests/test_pipeline_integration.py` that exercises the full path from upload to pgvector write would cover most of these at once.

5. **[P2] Add input validation security tests for NL query and search endpoints.** The semantic search endpoint accepts free-text input from authenticated users — verify it handles SQL metacharacters, null bytes, and max-length payloads gracefully.

6. **[P3] Add E2E journey tests using Docker Compose + pytest.** A `tests/e2e/` directory with a `conftest.py` that spins up the full stack would allow end-to-end journey validation without a separate test framework.

7. **[P3] Activate `reasoning` and `graph` apps or remove from config scopes.** Both apps contain only `apps.py` + migrations — no source files. Either implement them (they appear to be placeholders for planned features) or remove from `config.yml` scopes to avoid confusing future audits.

## Acceptance Criteria

- [ ] Docker running; `docker compose exec -T app python -m pytest --cov=. --cov-report=term-missing` exits 0
- [ ] Line coverage ≥ 69.0% (matches previous baseline) after new tests are run
- [ ] `ingestion/models.py` and `ner/models.py` have dedicated test files
- [ ] At least one cross-user authorization test per project-scoped resource type
- [ ] Input validation test for NL query endpoint (malformed input)
- [ ] All tests pass: `docker compose exec -T app python -m pytest`
