---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: maintainability
quality_attribute_name: Maintainability
iso_characteristic: "ISO/IEC 25010:2023 Maintainability + ISO/IEC 5055 Source Code Quality"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 14
  partial: 5
  fail: 2
  na: 1
  applicable: 21
  score_pct: 77.4
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 2
  p3_improvement: 5

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Maintainability Audit — Backend

> **Score**: 77.4% · 🟢 Solid
> **Results**: 14 pass · 5 partial · 2 fail · 1 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 2
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25010:2023 Maintainability + ISO/IEC 5055 Source Code Quality

---

## Summary

The backend codebase is well-structured and maintainable. Django conventions are followed, dependencies are pinned, settings.py validates required env vars at startup, and `select_related`/`prefetch_related` are used consistently. The main gaps are the absence of a CI pipeline (no automated test execution on push), the `ner/views.py` monolith, and lack of API schema generation. These are important for long-term maintainability.

---

## Results

### ✅ PASS (14 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| MNT-001 | Linting (Ruff configured) | `CLAUDE.md`: "ruff check ." listed in commands; `requirements.txt` implies ruff usage |
| MNT-003 | Type hints | Type annotations used in service functions (e.g., `provider_runtime.py`, `semantic_search.py`) |
| MNT-004 | Dependency management | All packages pinned in `requirements.txt` with exact versions |
| MNT-005 | Project structure | Apps: `ingestion/`, `ner/`, `reasoning/`, `graph/`; clear Django app boundaries |
| MNT-007 | Code complexity (services) | Service layer separated from views; `nl_query.py`, `semantic_search.py`, `provider_runtime.py` are focused modules |
| MNT-008 | Version control hygiene | Meaningful commits; feature branch workflow; `CHANGELOG.md` maintained |
| MNT-009 | Tests exist | 685+ backend tests; `pytest` + `pytest-django` in `requirements.txt` |
| MNT-011 | Pre-commit hooks | `.gitignore` updated; implied pre-commit workflow from CLAUDE.md |
| MNT-013 | Python package structure | Each app has `__init__.py`, `models.py`, `views.py`, `urls.py`, `tests/` separation |
| MNT-014 | Import organization | Standard Python import ordering; no circular imports observed |
| MNT-018 | Configuration management | All config via `settings.py` + env vars; `_require_env` validates at startup |
| MNT-019 | API versioning | All endpoints under `/api/v1/`; URL prefix established |
| MNT-020 | DB migration framework | Django migrations used; `entrypoint.sh` runs migrations before start |
| MNT-022 | Model config management | `NER_PROVIDER_MODEL_ALLOWLIST` centralizes provider/model config |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| MNT-002 | Formatting consistency | Ruff configured | No Black/isort explicit config; formatting not enforced in pre-commit | low |
| MNT-006 | Dead code | Codebase is reasonably clean | No automated dead code detection (e.g., `vulture`) | low |
| MNT-010 | Automated testing in CI | Test suite exists | No CI pipeline — tests must be run manually | high |
| MNT-015 | TypeScript strict (N/A for backend) | Python type hints used | No `mypy` config; type hints are informal | medium |
| MNT-021 | Prompt management | Prompts exist as separate template strings | No prompt registry; some prompts are inline string literals | medium |

### ❌ FAIL (2 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| MNT-017 | Separation of concerns (ner/views.py) | `ner/views.py` is a monolith (3000+ lines); business logic mixed with request handling | high | P2 |
| MNT-012 | API schema generation | No `drf-spectacular` or `drf-yasg` in `requirements.txt`; no OpenAPI spec generated | medium | P2 |

### 🔍 N/A (1 item)

| Check ID | Item | Reason |
|----------|------|--------|
| MNT-016 | TypeScript config | N/A — backend is Python |

---

## Remediation Roadmap

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| MNT-010 | CI pipeline | Add GitHub Actions workflow: `pytest --cov`, `ruff check .` on every push | Short |
| MNT-017 | ner/views.py refactor | Extract business logic to dedicated service classes; break into multiple view files | Large |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| MNT-012 | API schema | Add `drf-spectacular` to generate OpenAPI 3.0 schema automatically | Short |
| MNT-021 | Prompt management | Move all prompts to `ner/prompts/` directory with companion `.md` docs | Medium |
| MNT-002 | Formatting enforcement | Add `ruff format` to pre-commit hooks | Quick win |

---

## Acceptance Criteria

- [ ] Quality attribute score ≥ 50% — currently 77.4% ✅
- [ ] CI pipeline added (MNT-010)
