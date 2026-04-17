---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: reliability
quality_attribute_name: Reliability
iso_characteristic: "ISO/IEC 25010:2023 Reliability — fault tolerance, recoverability, availability"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 12
  partial: 7
  fail: 1
  na: 2
  applicable: 20
  score_pct: 77.5
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 4
  p3_improvement: 4

delta:
  previous_audit: "2026-04-17T00:00"
  score_change: +17.5
  new_passes: ["REL-005", "REL-012", "REL-014"]
  new_partials: ["REL-015"]
---

# Reliability Audit — Backend

> **Score**: 77.5% · 🟢 Solid
> **Results**: 12 pass · 7 partial · 1 fail · 2 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 2
> **Audited**: 2026-04-17T01:00
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25010:2023 Reliability
> **Delta**: +17.5 pp from 60.0% (2026-04-17T00:00)

---

## Summary

The three most impactful reliability improvements are in place: `pybreaker` circuit breakers per LLM provider (fail_max=3, reset_timeout=60s) prevent provider outages from cascading, `docker-compose.prod.yml` defines CPU/memory resource limits, and `docs/BACKUP_RECOVERY.md` documents the Supabase backup and recovery procedure. The sole remaining FAIL item (REL-017 zero-downtime deployment) requires a more complex rolling deploy strategy.

---

## Results

### ✅ PASS (12 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| REL-001 | Error handling | `try/except` in LLM services; graceful 400/404/500 responses from DRF |
| REL-002 | Graceful shutdown | Gunicorn handles SIGTERM gracefully; `restart: unless-stopped` in compose |
| REL-003 | Health checks | `docker-compose.yml:25–30` healthcheck on `/health`; `ingestion/urls_health.py` |
| REL-005 | Circuit breaker | `ner/services/provider_runtime.py:36–59`: `_CIRCUIT_BREAKERS` dict with `pybreaker.CircuitBreaker(fail_max=3, reset_timeout=60)` per provider; open circuit raises `ProviderConfigError` |
| REL-006 | Request timeouts | `conn_max_age=600` on DB connection; Gunicorn worker timeout defaults apply |
| REL-007 | DB connection pooling | `dj_database_url.parse(DATABASE_URL, conn_max_age=600)` — persistent connections |
| REL-010 | Async task queue | Celery with Redis broker; extraction/generation dispatched as background tasks |
| REL-012 | Resource limits | `docker-compose.prod.yml`: `deploy.resources.limits` on app/worker services |
| REL-013 | Django migrations | Migration framework in place; `entrypoint.sh` runs migrations before startup |
| REL-014 | Backup strategy | `docs/BACKUP_RECOVERY.md`: Supabase backup policy, point-in-time recovery steps, RTO/RPO targets |
| REL-018 | LLM fallback | `nl_query.py:199–204` falls back gracefully on LLM failure; circuit breaker prevents cascade |
| REL-019 | Embedding model pinned | `all-MiniLM-L6-v2` baked into Docker image at build time; no runtime download |

### ⚠️ PARTIAL (7 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| REL-004 | Retry/backoff | Celery task retries exist for pipeline tasks | No retry on synchronous LLM calls beyond circuit breaker | high |
| REL-008 | Session persistence | Redis used for Celery results; Django cache via Redis | Django sessions use LocMemCache fallback when Redis unavailable | medium |
| REL-009 | Transaction management | Django ORM provides transaction support | No explicit `atomic()` blocks on multi-step entity creation; partial writes possible | high |
| REL-011 | Container restart | `restart: unless-stopped` on all services | No readiness/liveness probe separation | medium |
| REL-015 | Disaster recovery | `docs/BACKUP_RECOVERY.md` covers backup restore | No full DR plan with multi-region failover; recovery tested on paper only | medium |
| REL-016 | Migration safety | Migrations run on startup via entrypoint | Race condition if two containers start simultaneously | high |
| REL-020 | Input validation (AI) | DRF serializers validate API inputs | No validation of LLM response format before parsing | medium |

### ❌ FAIL (1 item)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| REL-017 | Zero-downtime deployment | No rolling deploy strategy; current approach: stop → start (downtime) | medium | P2 |

### 🔍 N/A (2 items)

| Check ID | Item | Reason |
|----------|------|--------|
| REL-006 | Dead letter queue | No explicit DLQ framework; Celery result backend stores failures |
| REL-021 | Idempotency | Most operations are idempotent by design (upsert patterns) |

---

## Remediation Roadmap

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| REL-009 | Transaction management | Add `@transaction.atomic` to multi-step entity/relation creation in `ner/views.py` | Short |
| REL-004 | Retry on sync LLM calls | Add retry loop in `nl_query._call_provider()` for non-circuit-breaker errors | Short |
| REL-016 | Migration lock | Add distributed migration lock using Django cache (SET NX) in `entrypoint.sh` | Short |
| REL-017 | Zero-downtime | Implement blue-green deploy via nginx upstream swap in `docker-compose.prod.yml` | Medium |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| REL-011 | Readiness/liveness | Separate `/health/ready` and `/health/live` endpoints | Quick win |
| REL-020 | LLM response validation | Validate JSON structure of LLM response before parsing | Short |
| REL-008 | Redis failover | Configure Redis Sentinel or Cluster for HA | Large |
| REL-015 | DR testing | Create DR runbook with restore test procedure | Short |

---

## Acceptance Criteria

- [x] REL-005 circuit breaker on LLM calls ✅ (resolved)
- [x] REL-012 resource limits in production compose ✅ (resolved)
- [x] REL-014 backup documentation ✅ (resolved)
- [ ] REL-009 transaction management on multi-step writes (P2)
- [ ] REL-017 zero-downtime deployment (P2)
