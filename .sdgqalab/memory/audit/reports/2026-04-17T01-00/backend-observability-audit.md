---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: observability
quality_attribute_name: Observability
iso_characteristic: "ISO/IEC 25010:2023 Maintainability.Analysability + SRE Golden Signals"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 4
  partial: 7
  fail: 8
  na: 1
  applicable: 19
  score_pct: 39.5
  rating: "🟠 Low"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 7
  p3_improvement: 3

delta:
  previous_audit: "2026-04-17T00:00"
  score_change: +15.8
  new_passes: ["OBS-007", "OBS-009"]
  new_partials: ["OBS-008", "OBS-019"]
---

# Observability Audit — Backend

> **Score**: 39.5% · 🟠 Low
> **Results**: 4 pass · 7 partial · 8 fail · 1 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 3
> **Audited**: 2026-04-17T01:00
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25010:2023 Maintainability.Analysability + SRE Golden Signals
> **Delta**: +15.8 pp from 23.7% (2026-04-17T00:00)

---

## Summary

The P0 blocker (OBS-009 — no unhandled exception capture) has been resolved. `sentry-sdk[django]==2.22.0` is installed and `sentry_sdk.init()` is called in `settings.py` with `dsn=os.getenv('SENTRY_DSN', '')` (dev-safe), `environment`, `traces_sample_rate=0.1`, and `send_default_pii=False`. Error tracking is now in place. The error alerting checks (OBS-007, OBS-008, OBS-019) have improved from FAIL to PASS/PARTIAL. Remaining gaps are operational: structured logging, log aggregation, application metrics, and distributed tracing are not yet in place. These should be addressed in the first sprint post-launch.

---

## Results

### ✅ PASS (4 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| OBS-002 | Log level configuration | `settings.py:167–173`: `LOGGING` config sets `root` level to `INFO` |
| OBS-011 | Infrastructure monitoring (minimal) | `docker-compose.yml:25–30`: healthcheck on `http://localhost:8000/health` with 30s interval |
| OBS-007 | Error tracking service | `requirements.txt:43`: `sentry-sdk[django]==2.22.0` installed |
| OBS-009 | Unhandled exception capture | `settings.py:118–127`: `sentry_sdk.init()` with DSN, environment, traces_sample_rate; all unhandled exceptions captured |

### ⚠️ PARTIAL (7 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| OBS-001 | Structured logging | Django LOGGING config present; console handler active | Plain text format only; no JSON structured logs; no request ID field | medium |
| OBS-003 | Request/response logging | Gunicorn access log to stdout; Django default request logging | No middleware logging all requests with timing, status, user | medium |
| OBS-004 | Error logging with context | `logger.exception()` used in `nl_query.py`, `pipeline.py` | Not systematic across all views; missing user/project context in exception logs | high |
| OBS-006 | Sensitive data filtering | No explicit PII in current log statements; `send_default_pii=False` in Sentry config | No formal log scrubbing for custom log statements | medium |
| OBS-008 | Error alerting | Sentry SDK configured — alert rules can be created in Sentry dashboard | No alert rules configured in code/docs; alerting requires manual Sentry setup | high |
| OBS-016 | LLM call logging | `logger` used in LLM services for step tracing | No structured LLM log format; no model/token tracking | medium |
| OBS-019 | Alerting rules | Sentry SDK provides alerting capability | No explicit alert rule definitions in repo or Sentry export | high |

### ❌ FAIL (8 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| OBS-005 | Log aggregation | Logs go to stdout only; no ELK, Datadog, CloudWatch, or log shipping | medium | P2 |
| OBS-010 | Application metrics | No Prometheus metrics endpoint; no Grafana; no custom metrics | medium | P2 |
| OBS-012 | Database monitoring | No DB query monitoring; no slow query detection | medium | P2 |
| OBS-013 | Uptime monitoring | No external uptime monitor (Pingdom, UptimeRobot, etc.) | medium | P2 |
| OBS-014 | Request correlation IDs | No `X-Request-ID` middleware; no correlation ID in logs | medium | P2 |
| OBS-015 | Distributed tracing | No OpenTelemetry, Jaeger, or Zipkin | low | P3 |
| OBS-017 | AI pipeline monitoring | No pipeline-level metrics (extraction success rate, embedding latency) | medium | P2 |
| OBS-018 | LLM cost tracking | No token count tracking; no cost monitoring per user/project | medium | P2 |

### 🔍 N/A (1 item)

| Check ID | Item | Reason |
|----------|------|--------|
| OBS-020 | Runbook links in alerts | Sentry alert rules not yet configured; runbook exists at `docs/RUNBOOK.md` |

---

## Remediation Roadmap

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| OBS-014 | Correlation IDs | Add `django-request-id` middleware; include `request_id` in all log records | Short |
| OBS-004 | Error context | Add `extra={'user_id': request.user.id, 'project_id': ...}` to all `logger.exception` calls | Short |
| OBS-005 | Log aggregation | Configure Sentry breadcrumbs + structured logging with `python-json-logger` | Short |
| OBS-010 | Application metrics | Add `django-prometheus`; expose `/metrics`; connect to Grafana Cloud | Medium |
| OBS-018 | LLM cost tracking | Log `prompt_tokens + completion_tokens` from provider responses per project | Short |
| OBS-012 | DB monitoring | Enable `LOGGING['loggers']['django.db.backends']` slow query log | Quick win |
| OBS-017 | AI pipeline monitoring | Add custom counters for extraction success/fail rates | Short |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| OBS-001 | Structured logging | Switch to JSON logging with `python-json-logger` | Short |
| OBS-015 | Distributed tracing | Add OpenTelemetry auto-instrumentation | Medium |
| OBS-020 | Runbook links in alerts | Configure Sentry alert rules and link `docs/RUNBOOK.md` | Quick win |

---

## Acceptance Criteria

- [x] OBS-009: Sentry integrated and capturing all exceptions ✅ (resolved)
- [x] OBS-007: Error tracking service installed ✅ (resolved)
- [ ] OBS-004/008/019: Alert rules configured in Sentry with runbook links (P2)
- [ ] Quality attribute score ≥ 50% (🟡 Adequate minimum — currently 39.5% 🟠 Low)
