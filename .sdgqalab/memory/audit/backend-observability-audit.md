---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: observability
quality_attribute_name: Observability
iso_characteristic: "ISO/IEC 25010:2023 Maintainability.Analysability + SRE Golden Signals"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 2
  partial: 5
  fail: 12
  na: 1
  applicable: 19
  score_pct: 23.7
  rating: "🔴 Critical"

priority_summary:
  p0_blockers: 1
  p1_critical: 3
  p2_important: 5
  p3_improvement: 3

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Observability Audit — Backend

> **Score**: 23.7% · 🔴 Critical
> **Results**: 2 pass · 5 partial · 12 fail · 1 n/a
> **Blockers**: 1 | **Critical**: 3 | **High**: 5
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25010:2023 Maintainability.Analysability + SRE Golden Signals

---

## Summary

The backend has virtually no production observability. Logging goes to stdout only with no structured format, no error tracking service (Sentry), no application metrics, no distributed tracing, and no alerting. In production, any incident would require direct log inspection on the container. The healthcheck endpoint is the only operational signal available. This is the most critical quality gap in the project and is a production blocker.

---

## Results

### ✅ PASS (2 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| OBS-002 | Log level configuration | `settings.py:167–173`: `LOGGING` config sets `root` level to `INFO` |
| OBS-011 | Infrastructure monitoring (minimal) | `docker-compose.yml:25–30`: healthcheck on `http://localhost:8000/health` with 30s interval |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| OBS-001 | Structured logging | Django LOGGING config present; console handler active | Plain text format only; no JSON structured logs; no request ID field; no log levels per module | medium |
| OBS-003 | Request/response logging | Gunicorn access log to stdout; Django default request logging | No middleware logging all requests with timing, status, user; no structured access log format | medium |
| OBS-004 | Error logging with context | `logger.exception()` used in `nl_query.py`, `pipeline.py` | Not systematic across all views; missing user/project context in exception logs | high |
| OBS-006 | Sensitive data filtering | No explicit PII in current log statements | No formal log scrubbing; if PII leaks into logs it would not be caught | high |
| OBS-016 | LLM call logging | `logger` used in LLM services for step tracing | No structured LLM log format; no prompt/response capture; no model/token tracking | medium |

### ❌ FAIL (12 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| OBS-009 | Unhandled exception capture | No Sentry, Datadog, Rollbar, or equivalent; exceptions go to stdout only | critical | P0 |
| OBS-007 | Error tracking service | No error tracking dependency in `requirements.txt` | high | P1 |
| OBS-008 | Error alerting | No alerting configured; no PagerDuty, Opsgenie, or equivalent | high | P1 |
| OBS-019 | Alerting rules | No alert rule definitions found | high | P1 |
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
| OBS-020 | Runbook links in alerts | No alerts exist to link runbooks to |

---

## Remediation Roadmap

### P0 — Blockers (must fix before ANY deployment)

#### OBS-009: Unhandled Exception Capture

**Current state:** Unhandled exceptions in production go to Gunicorn stderr/stdout and are never tracked. There is no way to know what errors users are experiencing.
**Required state:** All unhandled exceptions must be captured by an error tracking service.
**Fix:**
```python
# requirements.txt — add:
sentry-sdk==2.x.x

# settings.py — add at module level:
import sentry_sdk
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,
        environment='production' if not DEBUG else 'development',
    )

# .env.example — add:
# SENTRY_DSN=https://your-key@sentry.io/project-id
```
**Effort:** Quick win

---

### P1 — Critical (fix before production)

#### OBS-007 / OBS-008 / OBS-019: Error Tracking and Alerting

**Fix:** Once Sentry is integrated (OBS-009 fix), configure Sentry alert rules for new error events, error rate spikes, and performance degradation. Set up email/Slack notifications.
**Effort:** Quick win (after OBS-009 done)

---

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| OBS-004 | Error logging with context | Add `extra={'user_id': request.user.id, 'project_id': ...}` to all `logger.exception` calls | Short |
| OBS-005 | Log aggregation | Configure Sentry breadcrumbs + structured logging; consider Datadog or Logtail for log shipping | Medium |
| OBS-010 | Application metrics | Add `django-prometheus` or `statsd`; expose `/metrics` endpoint | Medium |
| OBS-014 | Correlation IDs | Add `django-request-id` middleware; include request_id in all log records | Short |
| OBS-018 | LLM cost tracking | Log `prompt_tokens + completion_tokens` from provider responses; aggregate per project | Short |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| OBS-001 | Structured logging | Switch to JSON logging with `python-json-logger` | Short |
| OBS-015 | Distributed tracing | Add OpenTelemetry auto-instrumentation | Medium |
| OBS-017 | AI pipeline monitoring | Add custom metrics: extraction success rate, avg entities/doc, embedding latency | Medium |

---

## Acceptance Criteria

- [ ] OBS-009: Sentry (or equivalent) integrated and capturing all exceptions (P0 resolved)
- [ ] OBS-007/008/019: Alerting configured in error tracking tool (P1 resolved)
- [ ] Quality attribute score ≥ 50% (🟡 Adequate minimum for launch)
- [ ] No critical-severity items in FAIL state
