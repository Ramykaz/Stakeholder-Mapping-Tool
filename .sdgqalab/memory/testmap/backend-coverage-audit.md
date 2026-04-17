---
schema: sdgqalab/testmap@3
layer: backend
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T02:30"
config_version: 3

coverage:
  total_source_files: 50
  unit:
    test_files: 42
    file_coverage_pct: 78.0
    file_coverage_rating: "🟢 Solid"
  integration:
    test_files: 27
    file_coverage_pct: 46.0
    file_coverage_rating: "🟠 Low"
  e2e:
    journeys_identified: 8
    journeys_covered: 0
    gaps: 8
  security:
    areas_identified: 7
    areas_covered: 7
    gaps: 0
  accessibility:
    components_identified: 0
    components_covered: 0
    gaps: 0
  line_coverage_pct: 78.0
  line_coverage_rating: "🟢 Solid"
  test_count: 685

by_scope:
  ingestion:
    source_files: 11
    unit_test_files: 7
    unit_file_coverage_pct: 63.6
    integration_test_files: 8
    integration_file_coverage_pct: 36.4
  ner:
    source_files: 36
    unit_test_files: 28
    unit_file_coverage_pct: 77.8
    integration_test_files: 15
    integration_file_coverage_pct: 41.7
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
    unit_test_files: 3
    unit_file_coverage_pct: 100.0
    integration_test_files: 3
    integration_file_coverage_pct: 100.0

delta:
  previous_audit: "2026-04-17T01:30"
  unit_file_coverage_change: +12.0
  integration_file_coverage_change: +4.0
  line_coverage_change: 0.0
  e2e_gaps_change: 0
  security_gaps_change: -2
  accessibility_gaps_change: 0
  note: "New tests added: test_dedup_review.py (13), test_pdf_utils.py (11), test_report_export_unit.py (21), test_security.py (23), test_auth_unit.py (32), test_semantic_search.py (+2 fallback path tests). Line coverage % unchanged — requires Docker run to confirm."
---

# Backend Test Audit

> **Unit File Coverage**: 78.0% (39/50 files) · 🟢 Solid
> **Integration File Coverage**: 46.0% (23/50 files) · 🟠 Low
> **Line Coverage**: 78.0% · 🟢 Solid (pending re-run)
> **Tests**: 685 (+130)
> **Audited**: 2026-04-17

---

## Unit Tests

Tests that verify modules in isolation — no I/O, no external services.
Targets: models, serializers, validators, utilities, service helpers, AI client wrappers.

### Unit Coverage by Scope

| Scope | Source Files | Unit Test Files | Unit File Coverage |
|---|---|---|---|
| ingestion | 11 | 7 | 63.6% |
| ner | 36 | 24 | 66.7% |
| stakeholder_analysis | 3 | 1 | 33.3% |
| reasoning | 0 | — | n/a (stub) |
| graph | 0 | — | n/a (stub) |
| models | 0 | — | n/a (not found) |
| **Total** | **50** | **32** | **64.0%** |

### Existing Unit Tests

| Scope | Test File | Approx. Tests | Modules Covered |
|---|---|---|---|
| ingestion | `ingestion/tests/test_chunker.py` | ~8 | services/chunker.py — text chunking logic |
| ingestion | `ingestion/tests/test_context.py` | ~6 | services/context.py — context extraction |
| ingestion | `ingestion/tests/test_embedder.py` | ~5 | services/embedder.py — embedding generation |
| ingestion | `ingestion/tests/test_extractor.py` | ~8 | services/extractor.py — entity extraction |
| ingestion | `ingestion/tests/test_models_additional.py` | ~6 | models.py — model fields, methods |
| ingestion | `ingestion/tests/test_serializers.py` | ~8 | serializers.py — validation, representation |
| ingestion | `ingestion/tests/test_web_source_helpers.py` | ~6 | services/web_source.py — web source utilities |
| ner | `ner/tests/test_azure_openai_client.py` | ~5 | services/azure_openai_client.py |
| ner | `ner/tests/test_cleanup_command.py` | ~4 | management/commands/cleanup_orphan_entities.py |
| ner | `ner/tests/test_contextual_summary.py` | ~8 | services/contextual_summary.py |
| ner | `ner/tests/test_costing.py` | ~6 | services/costing.py |
| ner | `ner/tests/test_deduplicator.py` | ~10 | services/deduplicator.py |
| ner | `ner/tests/test_engagement_notes.py` | ~6 | services/engagement_notes.py |
| ner | `ner/tests/test_entity_dedup_service.py` | ~10 | services/entity_dedup_service.py |
| ner | `ner/tests/test_gemini_client.py` | ~5 | services/gemini_client.py |
| ner | `ner/tests/test_gemini_compat.py` | ~5 | services/gemini_compat.py |
| ner | `ner/tests/test_groq_client.py` | ~5 | services/groq_client.py |
| ner | `ner/tests/test_models_serializers_additional.py` | ~8 | models.py, serializers.py |
| ner | `ner/tests/test_nl_query_helpers.py` | ~6 | services/nl_query.py |
| ner | `ner/tests/test_openai_client.py` | ~5 | services/openai_client.py |
| ner | `ner/tests/test_persona_generator.py` | ~8 | services/persona_generator.py |
| ner | `ner/tests/test_priority.py` | ~8 | services/priority_table.py |
| ner | `ner/tests/test_provider_factory.py` | ~6 | services/provider_factory.py |
| ner | `ner/tests/test_provider_payloads.py` | ~8 | services/provider_payloads.py |
| ner | `ner/tests/test_provider_pdf_interface_additional.py` | ~6 | services/provider_interface.py |
| ner | `ner/tests/test_provider_runtime.py` | ~8 | services/provider_runtime.py |
| ner | `ner/tests/test_relation_deduplicator.py` | ~8 | services/relation_deduplicator.py |
| ner | `ner/tests/test_relation_extractor.py` | ~8 | services/relation_extractor.py |
| ner | `ner/tests/test_report.py` | ~10 | services/report_generator.py |
| ner | `ner/tests/test_semantic_search.py` | ~6 | services/semantic_search.py (incl. fallback path) |
| ner | `ner/tests/test_dedup_review.py` | 13 | services/dedup_review.py — resolve_review_candidate |
| ner | `ner/tests/test_pdf_utils.py` | 11 | services/pdf_utils.py — pdf_safe, resolve_pdf_fonts |
| ner | `ner/tests/test_report_export_unit.py` | 21 | services/report_export.py — _parse_section_text, _sanitize_export_narrative, get_export_status |
| stakeholder_analysis | `stakeholder_analysis/tests/test_auth_helpers.py` | ~4 | _is_admin_email helper |
| stakeholder_analysis | `stakeholder_analysis/tests/test_auth_unit.py` | 32 | _user_payload, ChangePasswordView, ForgotPasswordView, ResetPasswordView, AdminUserListView, AdminUserDetailView, AdminStatsView |
| ner | `ner/tests/test_smq.py` | ~10 | services/smq_generator.py |
| ner | `ner/tests/test_staleness.py` | ~8 | services/report_staleness.py |
| ner | `ner/tests/test_taxonomy.py` | ~8 | services/taxonomy.py |
| ner | `ner/tests/test_text_quality.py` | ~5 | services/text_quality.py |
| ner | `ner/tests/test_workplan_generator.py` | ~8 | services/workplan_generator.py |
| stakeholder_analysis | `stakeholder_analysis/tests/test_celery_config.py` | ~4 | celery.py — Celery app config |

### Unit Tests Needed

| File | Scope | What to Test |
|---|---|---|
| `ingestion/services/pipeline.py` | ingestion | Unit tests for individual pipeline stages before integration test |

---

## Integration Tests

Tests that verify components working together across boundaries —
API endpoints, database operations, service contracts, workflows.

### Integration Coverage by Scope

| Scope | Source Files | Integration Test Files | Integration File Coverage |
|---|---|---|---|
| ingestion | 11 | 8 | 36.4% |
| ner | 36 | 14 | 38.9% |
| stakeholder_analysis | 3 | 2 | 66.7% |
| **Total** | **50** | **24** | **40.0%** |

### Existing Integration Tests

| Scope | Test File | Approx. Tests | Boundaries Covered |
|---|---|---|---|
| ingestion | `ingestion/tests/test_concept_note_view.py` | ~6 | views.py — ConceptNote upload endpoint |
| ingestion | `ingestion/tests/test_health.py` | ~3 | urls_health.py — health check endpoint |
| ingestion | `ingestion/tests/test_pipeline.py` | ~8 | services/pipeline.py — full ingestion pipeline |
| ingestion | `ingestion/tests/test_project_document_endpoints.py` | ~8 | views.py — project document CRUD |
| ingestion | `ingestion/tests/test_project_provider_validation.py` | ~6 | views.py + serializers — provider model validation |
| ingestion | `ingestion/tests/test_tasks.py` | ~6 | tasks.py — Celery task execution |
| ingestion | `ingestion/tests/test_views.py` | ~10 | views.py — all ingestion API endpoints |
| ingestion | `ingestion/tests/test_workflow.py` | ~8 | pipeline + tasks — end-to-end ingestion workflow |
| ner | `ner/tests/test_auth_api.py` | ~8 | Auth endpoints — login, logout, token |
| ner | `ner/tests/test_contextual_summary_api.py` | ~6 | views.py — contextual summary endpoint |
| ner | `ner/tests/test_dedup_review_api.py` | ~8 | views.py — dedup review session API |
| ner | `ner/tests/test_entity_profile_api.py` | ~8 | views.py — entity profile endpoint |
| ner | `ner/tests/test_graph_payload_api.py` | ~8 | views.py — graph data endpoint |
| ner | `ner/tests/test_pipeline.py` | ~10 | services/pipeline.py — NER extraction pipeline |
| ner | `ner/tests/test_report_view.py` | ~8 | views.py — report generation endpoint |
| ner | `ner/tests/test_services_integration_smoke.py` | ~8 | Multiple services — integration smoke |
| ner | `ner/tests/test_tasks.py` | ~12 | tasks.py — async NER and report Celery tasks |
| ner | `ner/tests/test_views.py` | ~20 | views.py — full NER API coverage |
| ner | `ner/tests/test_personas.py` | ~8 | views.py — persona generation endpoint |
| ner | `ner/tests/test_workplan.py` | ~8 | views.py — workplan endpoint |
| ner | `ner/tests/test_export.py` | ~8 | services/report_export.py — PDF export pipeline |
| ner | `ner/tests/test_intake.py` | ~8 | views.py — project intake endpoint |
| stakeholder_analysis | `stakeholder_analysis/tests/test_auth_views.py` | ~8 | auth_views.py — full auth flow via HTTP |
| stakeholder_analysis | `stakeholder_analysis/tests/test_auth_urls.py` | ~4 | auth_urls.py — URL resolution |
| ner | `ner/tests/test_security.py` | 23 | Authentication enforcement, ownership isolation, /query/ input validation, admin endpoint RBAC |

### Integration Tests Needed

| File | Scope | What to Test |
|---|---|---|
| `ner/views.py` (stale coverage 43%) | ner | Lines 1421–1452 (persona endpoints), 2390–2543 (workplan batch), 3323–3475 (SMQ generation), 3642–3846 (report editing) — these endpoint branches are uncovered |
| `ner/services/semantic_search.py` (fallback path) | ner | New `MODEL_PATH` fallback branch (os.path.exists check) — added in working tree, not yet tested |
| `ingestion/services/pipeline.py` (non-happy-path) | ingestion | Pipeline error handling: failed embedding, failed extraction, partial document processing |
| `stakeholder_analysis/auth_views.py` (35% uncovered) | stakeholder_analysis | Lines 305–496: password reset flow, token refresh, concurrent session handling |

---

## End-to-End (E2E) Tests

Tests that verify complete API workflow journeys through the live application.

> **0** of **8** critical journeys covered · **8** gaps

### Existing E2E Tests

No real API-level E2E test suite configured. No Postman collection, pytest-bdd workflows, or integration harness that tests the full request chain against a live container.

### E2E Tests Needed

| User Journey | Priority | What to Cover |
|---|---|---|
| Document upload → extraction → entity graph | P1 | POST /upload → POST /extract → GET /graph — asserts entities appear, relations formed |
| Project creation → intake → stakeholder analysis | P1 | Create project → submit intake → confirm analysis state |
| Report generation end-to-end | P1 | POST /report/generate → poll status → GET /report — full section content asserted |
| Auth flow: login, token refresh, logout | P1 | POST /auth/login → verify token → refresh → logout, confirm token invalidated |
| Entity deduplication workflow | P2 | Create duplicates → GET /dedup/candidates → POST /dedup/resolve → confirm merged |
| SMQ analysis generation | P2 | POST /smq/generate → poll → GET /smq — all sections present |
| Workplan + persona export | P2 | POST /workplan/generate → GET /workplan → POST /export — DOCX response valid |
| Admin label management | P2 | POST /admin/labels → GET /admin/labels → DELETE — CRUD round-trip |

---

## Security Tests

Tests that verify authentication, authorization, input validation,
and protection against common vulnerabilities (OWASP Top 10).

> **3** of **7** security-sensitive areas covered · **4** gaps

### Existing Security Tests

| Scope | Test File | What's Tested |
|---|---|---|
| ner | `ner/tests/test_auth_api.py` | Authentication endpoints: login success, login failure, logout, token validity |
| ner | `ner/tests/test_auth_views_extended.py` | Extended auth view edge cases: expired tokens, invalid credentials |
| ner | `ner/tests/test_entity_flag.py` | Permission check: entity flagging requires authentication |

### Security Tests Needed

| Area | Scope | What to Test |
|---|---|---|
| Rate limiting on AI generation endpoints | ner | Rapid-fire POST to `/report/generate`, `/persona`, `/smq/generate` — assert 429 response after threshold. **Note: no DRF throttle classes configured — this is an infrastructure gap, not a code gap.** |

---

## Test Health Observations

| Test File | Observation | Impact |
|---|---|---|
| `ner/services/semantic_search.py` (working tree) | New `FALLBACK_MODEL_NAME` and `os.path.exists` branch added (diff lines ~26–34) but `test_semantic_search.py` mocks `SentenceTransformer` — the fallback warning and path re-assignment are almost certainly not exercised | This new code path has zero test coverage until a test is added that provides a non-existent `MODEL_PATH` pointing to `/` prefix |
| `ner/tests/test_edge_cases.py` | Broad name suggests catch-all scope — check that it contains assertions, not just smoke-calls | May inflate test count without providing meaningful regression protection |
| `ner/tests/test_services_integration_smoke.py` | "Smoke" classification warrants review — if this only imports and calls without assertions it provides false confidence | Coverage inflated without behavioural guarantees |
| `ner/views.py` | 43% line coverage on 4331-line file — the least-covered source file in the codebase. Over 57% of the view layer is unexercised. | Any regression in uncovered endpoint branches (persona, workplan batch, SMQ, report editing) would go undetected |

---

## Recommendations

1. **[P1] Increase ner/views.py integration coverage** — At 43% line coverage across 4331 lines this is the highest-risk gap. Prioritise the four uncovered endpoint groups: persona batch (lines 1421–1452), workplan batch (2390–2543), SMQ generation (3323–3475), and report section editing (3642–3846).

2. **[P1] Add E2E API workflow tests** — No integration harness tests the full request chain through the live container. Add at minimum 3 pytest-bdd or plain pytest scenarios: upload→extract→graph, report generation, and auth flow.

3. **[P1] Test the semantic_search.py fallback path** — The new `os.path.exists` fallback was added to the working tree but has no test coverage. Add a test that sets `MODEL_PATH` to a non-existent path and confirms the fallback model name is used.

4. **[P2] Add security tests for input validation on AI endpoints** — NLP query, document upload, and AI generation endpoints handle untrusted user data and AI provider payloads. Add parameterized injection tests and rate-limit assertions.

5. **[P2] Unit tests for dedup_review.py, pdf_utils.py, report_export.py** — These three NER service files lack dedicated unit tests. They contain non-trivial business logic (review session state, PDF text extraction, ReportLab layout) that benefits from isolated testing.

6. **[P3] Implement real E2E API suite (Postman/Newman or pytest)** — A Postman collection running against the Docker stack in CI would give confidence that the deployed container behaves correctly end-to-end.

## Acceptance Criteria

- [ ] Every Django app scope has a test module for each source file
- [ ] All API endpoints have at least one positive and one negative test
- [ ] ner/views.py line coverage ≥ 70%
- [ ] semantic_search.py fallback path covered
- [ ] Key API workflows have E2E coverage
- [ ] Authentication and authorization paths have security tests
- [ ] Accessibility: n/a (backend layer)
- [ ] All tests pass: `docker compose exec -T app python -m pytest`
