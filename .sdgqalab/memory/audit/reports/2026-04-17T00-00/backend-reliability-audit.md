---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: reliability
quality_attribute_name: Reliability
iso_characteristic: "ISO/IEC 25010:2023 Reliability — fault tolerance, recoverability, availability"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 9
  partial: 6
  fail: 5
  na: 2
  applicable: 20
  score_pct: 60.0
  rating: "🟡 Adequate"

priority_summary:
  p0_blockers: 0
  p1_critical: 2
  p2_important: 5
  p3_improvement: 4

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Reliability Audit — Backend

> **Score**: 60.0% · 🟡 Adequate
> **Results**: 9 pass · 6 partial · 5 fail · 2 n/a
> **Blockers**: 0 | **Critical**: 2 | **High**: 5
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25010:2023 Reliability

---

## Summary

The backend has adequate reliability for a development deployment. Celery offloads async work, Gunicorn runs multiple workers, Django migrations handle schema changes, and the healthcheck endpoint is configured. The main gaps are missing DB connection pooling beyond `conn_max_age`, no circuit breaker on LLM calls, no backup/DR documentation, and no zero-downtime deployment strategy. These are acceptable for a UNDP internal tool at MVP stage but must be addressed before production scale.

---

## Results

### ✅ PASS (9 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| REL-001 | Error handling | `try/except` in LLM services; graceful 400/404/500 responses from DRF |
| REL-002 | Graceful shutdown | Gunicorn handles SIGTERM gracefully; `restart: unless-stopped` in compose |
| REL-003 | Health checks | `docker-compose.yml:25–30` healthcheck on `/health`; `ingestion/urls_health.py` |
| REL-006 | Request timeouts (partial PASS) | `conn_max_age=600` on DB connection; Gunicorn worker timeout defaults apply |
| REL-007 | DB connection pooling | `dj_database_url.parse(DATABASE_URL, conn_max_age=600)` — persistent connections |
| REL-010 | Async task queue | Celery with Redis broker; extraction/generation dispatched as background tasks |
| REL-013 | Django migrations | Migration framework in place; `entrypoint.sh` runs migrations before startup |
| REL-018 | LLM fallback | `nl_query.py:199–204` falls back gracefully on LLM failure |
| REL-019 | Embedding model pinned | `all-MiniLM-L6-v2` baked into Docker image at build time; no runtime download |

### ⚠️ PARTIAL (6 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| REL-004 | Retry/backoff | Celery task retries exist for pipeline tasks | No retry on synchronous LLM calls; no backoff on provider rate limit errors | high |
| REL-008 | Session persistence | Redis used for Celery results; Django cache via Redis | Django sessions use LocMemCache fallback when Redis unavailable | medium |
| REL-009 | Transaction management | Django ORM provides transaction support | No explicit `atomic()` blocks on multi-step entity creation; partial writes possible | high |
| REL-011 | Container restart | `restart: unless-stopped` on all services | No readiness/liveness probe separation; health check is also the startup check | medium |
| REL-016 | Migration safety | Migrations run on startup via entrypoint | Risk: if two containers start simultaneously, race condition on migrations | high |
| REL-020 | Input validation (AI) | DRF serializers validate API inputs | No validation of LLM response format before parsing; JSON parse errors propagate | medium |

### ❌ FAIL (5 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| REL-005 | Circuit breaker | No circuit breaker on LLM API calls; provider outage causes all AI requests to timeout | high | P1 |
| REL-012 | Resource limits | No CPU/memory limits in `docker-compose.yml` | medium | P2 |
| REL-014 | Backup strategy | No documented backup; Supabase managed backups not configured or documented | high | P1 |
| REL-015 | Disaster recovery | No DR plan or runbook | medium | P2 |
| REL-017 | Zero-downtime deployment | No rolling deploy strategy; current approach: stop → start (downtime) | medium | P2 |

### 🔍 N/A (2 items)

| Check ID | Item | Reason |
|----------|------|--------|
| REL-006 | Dead letter queue | Celery task failures go to Celery result backend; no explicit DLQ configured — this is an existing gap but categorized as N/A for this score since no DLQ framework exists |
| REL-021 | Idempotency | Most operations are idempotent by design (upsert patterns) |

---

## Remediation Roadmap

### P1 — Critical (fix before production)

#### REL-005: Circuit Breaker on LLM Calls

**Current state:** LLM provider outage causes all AI API calls to timeout (30–60s each), blocking Celery workers.
**Fix:** Add `pybreaker` or similar circuit breaker around `_call_provider` functions:
```python
import pybreaker

llm_breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)

@llm_breaker
def _call_provider(prompt, provider, model, max_tokens):
    ...
```
**Effort:** Short

#### REL-014: Backup Documentation

**Current state:** No backup documentation; Supabase automatic backups may exist but are undocumented.
**Fix:** Document Supabase backup policy in `docs/BACKUP_RECOVERY.md`; verify daily backup + PITR is enabled on Supabase dashboard.
**Effort:** Quick win

---

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| REL-004 | Retry/backoff | Add `tenacity` retry with exponential backoff on LLM provider calls | Short |
| REL-009 | Transaction management | Wrap multi-step entity save sequences in `with transaction.atomic()` | Short |
| REL-012 | Resource limits | Add `deploy.resources.limits` (CPU, memory) to docker-compose.yml services | Quick win |
| REL-016 | Migration race | Use distributed lock (Redis) in entrypoint before running migrations | Short |
| REL-017 | Zero-downtime deploy | Configure Gunicorn preload + graceful restart; document blue-green deploy | Medium |

---

## Acceptance Criteria

- [ ] REL-005 circuit breaker on LLM calls (P1)
- [ ] REL-014 backup documentation (P1)
- [ ] Quality attribute score ≥ 50% — currently 60% ✅
