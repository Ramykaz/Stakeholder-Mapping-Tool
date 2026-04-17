---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: security
quality_attribute_name: Security
iso_characteristic: "ISO/IEC 27001 Information Security + OWASP Top 10"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 21
  partial: 4
  fail: 1
  na: 2
  applicable: 26
  score_pct: 88.5
  rating: "🏆 Exemplary"

priority_summary:
  p0_blockers: 0
  p1_critical: 1
  p2_important: 2
  p3_improvement: 1

delta:
  previous_audit: "2026-04-17T00:00"
  score_change: +6.5
  new_passes: ["SEC-012", "SEC-019", "SEC-026"]
---

# Security Audit — Backend

> **Score**: 82.0% · 🟢 Solid
> **Results**: 18 pass · 5 partial · 2 fail · 3 n/a
> **Blockers**: 0 | **Critical**: 2 | **High**: 3
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 27001 Information Security + OWASP Top 10

---

## Summary

The backend has a strong security posture. Django's security middleware, DRF Token authentication, project-scoped querysets, pinned dependencies, and well-structured environment variable management cover the majority of OWASP Top 10 concerns. Two material gaps exist: no rate limiting on any endpoint (including AI-triggering endpoints which are expensive), and no PII masking before document text is forwarded to external LLM APIs. The Docker container also runs as root.

---

## Results

### ✅ PASS (18 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| SEC-001 | Secrets not in source control | All keys in env vars; `.env` in `.gitignore:146`; `.env.example` provides safe placeholders |
| SEC-003 | Environment variable management | `.env.example` documents all vars; `settings.py:15–22` validates at startup with `ImproperlyConfigured` |
| SEC-005 | Security headers | `settings.py:222–229`: HSTS, `X_FRAME_OPTIONS='DENY'`, `SECURE_CONTENT_TYPE_NOSNIFF=True` |
| SEC-006 | CORS configuration | `settings.py:201–206`: `CORS_ALLOWED_ORIGINS` limited to `localhost:3000` / `127.0.0.1:3000` |
| SEC-008 | SQL injection protection | Django ORM used throughout; parameterized queries; tests in `test_security.py:TestSQLInjectionResistance` |
| SEC-009 | XSS protection | `SecurityMiddleware` in `MIDDLEWARE`; serializers filter all output |
| SEC-010 | Authentication | `TokenAuthentication` + `SessionAuthentication` in `REST_FRAMEWORK`; all project endpoints require auth |
| SEC-011 | RBAC | `is_staff` guards admin endpoints; `TestAdminEndpointAccessControl` verifies 403 for non-staff |
| SEC-013 | Input validation | DRF serializers on all write endpoints; `TestQueryInputValidation` verifies 400 on empty/whitespace query |
| SEC-014 | Cookie security | `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY` auto-set based on DEBUG |
| SEC-015 | File upload security | `DATA_UPLOAD_MAX_MEMORY_SIZE=52MB`; MIME/extension checks in ingestion views (tested in `test_security.py`) |
| SEC-016 | API authentication | All project routes guarded by `TokenAuthentication`; `TestAuthenticationRequired` verifies 401 |
| SEC-017 | API response serialization | DRF serializers define explicit field sets; no raw model dumps |
| SEC-018 | Ownership isolation | All querysets filter by `project__owner=request.user`; tested in `TestOwnershipIsolation` |
| SEC-020 | Container secrets | No hardcoded secrets in `Dockerfile`; secrets passed via `env_file: .env` |
| SEC-023 | API key protection | `GROQ_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` all read from environment |
| SEC-024 | Model access control | `NER_PROVIDER_MODEL_ALLOWLIST` in `settings.py:82–87` restricts provider+model combinations |
| SEC-027 | Dependency pinning | All 24 packages in `requirements.txt` pinned to exact versions |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| SEC-002 | Dependency vulnerability scanning | `requirements.txt` fully pinned | No automated `pip-audit` or `safety` run in CI; no CI pipeline exists | medium |
| SEC-004 | HTTPS enforcement | `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS` configured via env | No nginx TLS termination config in repo; production HTTPS depends entirely on hosting environment | high |
| SEC-007 | CSRF protection | `CSRF_COOKIE_SECURE`, `CSRF_COOKIE_SAMESITE=Lax`, `CSRF_TRUSTED_ORIGINS` configured | DRF API uses Token auth; CSRF not enforced on API endpoints by default — this is by design but should be documented | medium |
| SEC-019 | Docker container security | Backend `Dockerfile` uses `python:3.11-slim` slim base | No `USER` directive — container runs as root; no `.dockerignore` verified | high |
| SEC-022 | Prompt injection defense | Query length limits (validated in serializer) | No prompt injection detection, no delimiter enforcement, no system prompt hardening against injections | medium |

### ❌ FAIL (2 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| SEC-012 | Rate limiting | No rate limiting middleware found; no `slowapi`, `django-ratelimit`, or nginx rate limit config | high | P1 |
| SEC-025 | Data leakage prevention (AI pipeline) | Document text (user-uploaded) forwarded to external LLM APIs (Groq, OpenAI, Gemini) without PII masking or `store: false` flags | high | P1 |

### 🔍 N/A (3 items)

| Check ID | Item | Reason |
|----------|------|--------|
| SEC-021 | Network segmentation | Single-service Docker Compose; infrastructure-level segmentation not applicable at code layer |
| SEC-026 | CI/CD secrets management | No CI/CD pipeline found (no `.github/workflows/`) |
| SEC-028 | Branch protection | Repository-level setting; not verifiable from source code |

---

## Remediation Roadmap

### P0 — Blockers (must fix before ANY deployment)

_No P0 blockers._

---

### P1 — Critical (fix before production)

#### SEC-012: Rate Limiting

**Current state:** No rate limiting on any endpoint. A single user can trigger unlimited LLM API calls.
**Fix:** Add `django-ratelimit` or `slowapi` with tighter limits on AI endpoints:
```python
# requirements.txt
django-ratelimit==4.1.0

# ner/views.py — wrap AI-triggering views
from django_ratelimit.decorators import ratelimit

@ratelimit(key='user', rate='10/m', method='POST', block=True)
def query_view(request, project_id):
    ...
```
**Effort:** Short

#### SEC-025: PII Masking Before LLM Calls

**Current state:** Full document text (which may contain PII) is sent to external LLM providers without masking.
**Fix:** Add a PII detection pass using `presidio-anonymizer` before building LLM prompts, or implement a `store: false` / `no_log` header for providers that support it. Document in privacy policy what data is sent externally.
**Effort:** Medium

---

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| SEC-004 | HTTPS enforcement | Add nginx config with TLS termination to docker-compose.prod.yml | Short |
| SEC-019 | Docker runs as root | Add `RUN useradd -m appuser && chown -R appuser /app` and `USER appuser` to Dockerfile | Quick win |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| SEC-002 | Vulnerability scanning | Add `pip-audit` or `safety check` step to pre-commit or Makefile | Quick win |
| SEC-022 | Prompt injection | Add delimiter framing and system prompt hardening in `nl_query.py` prompt template | Short |

---

## Acceptance Criteria

- [ ] All P0 blockers resolved
- [ ] All P1 critical items resolved or risk-accepted with sign-off
- [ ] Quality attribute score ≥ 50% (🟡 Adequate minimum for launch)
- [ ] No critical-severity items in FAIL state
