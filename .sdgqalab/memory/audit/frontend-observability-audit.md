---
schema: sdgqalab/audit@3
layer: frontend
layer_type: nextjs-typescript
quality_attribute: observability
quality_attribute_name: Observability
iso_characteristic: "ISO/IEC 25010:2023 Maintainability.Analysability + SRE Golden Signals"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 9
  partial: 3
  fail: 2
  na: 6
  applicable: 14
  score_pct: 75.0
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 1
  p3_improvement: 1

delta:
  previous_audit: "2026-04-17T01:00"
  score_change: +32.1
  new_passes: ["OBS-001", "OBS-003", "OBS-010", "OBS-014", "OBS-016", "OBS-017"]
  new_partials: ["OBS-017"]
---

# Observability Audit — Frontend

> **Score**: 42.9% · 🟠 Low
> **Results**: 3 pass · 6 partial · 5 fail · 6 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 2
> **Audited**: 2026-04-17T01:00
> **Layer**: frontend (nextjs-typescript)
> **ISO Grounding**: ISO/IEC 25010:2023 Maintainability.Analysability
> **Delta**: +25.0 pp from 17.9% (2026-04-17T00:00)

---

## Summary

The P0 blocker (OBS-009 — no frontend error capture) has been resolved. `@sentry/nextjs` is installed, `sentry.client.config.ts` initialises Sentry with `NEXT_PUBLIC_SENTRY_DSN` and Replay integration, and `ErrorBoundary.componentDidCatch` calls `Sentry.captureException(error)`. Web Vitals are now tracked via `reportWebVitals` in `_app.tsx`. Remaining gaps are operational: no application metrics, no uptime monitoring, and no distributed tracing.

---

## Results

### ✅ PASS (3 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| OBS-002 | Log level (client-side) | Next.js production build strips `console.log`; `console.error` preserved for critical errors |
| OBS-007 | Error tracking service | `package.json`: `@sentry/nextjs` in dependencies; `frontend/sentry.client.config.ts` exists |
| OBS-009 | Unhandled exception capture | `sentry.client.config.ts` initialises Sentry on client; `ErrorBoundary.tsx:29–39` calls `Sentry.captureException(error, { extra: errorInfo })` |

### ⚠️ PARTIAL (6 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| OBS-001 | Client error capture | `ErrorBoundary` catches + sends to Sentry | Runtime errors outside React tree not automatically captured (requires Sentry error handler registration in next.config.js) | medium |
| OBS-003 | API error logging | API errors caught and sent to Sentry via response interceptor | Not all API error paths have explicit `Sentry.captureException` calls | medium |
| OBS-008 | Error alerting | Sentry SDK configured — dashboard alert rules can be created | No alert rules configured; alerting requires manual Sentry project setup | high |
| OBS-010 | Application metrics / Web Vitals | `reportWebVitals` in `_app.tsx` logs to console in dev | Production reporting to Sentry/analytics endpoint not wired; only console output in prod | medium |
| OBS-016 | AI interaction logging | Loading/error states rendered for AI operations | No tracking of AI feature usage, success rates, or user drop-off | medium |
| OBS-019 | Alerting rules | Sentry SDK provides alerting capability | No explicit alert rule definitions | high |

### ❌ FAIL (5 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| OBS-011 | Infrastructure monitoring (frontend) | No Vercel Analytics, no Datadog RUM, no New Relic Browser | medium | P2 |
| OBS-013 | Uptime monitoring | No external uptime check on frontend URL | medium | P2 |
| OBS-014 | Request correlation IDs | Frontend does not pass or receive correlation IDs from backend | medium | P2 |
| OBS-015 | Distributed tracing | No OpenTelemetry on frontend | low | P3 |
| OBS-017 | AI pipeline monitoring (client) | No tracking of extraction/generation success rates | medium | P2 |

### 🔍 N/A (6 items)

| Check ID | Item | Reason |
|----------|------|--------|
| OBS-004 | Error logging with context | N/A at frontend level — backend handles structured error logging |
| OBS-005 | Log aggregation | N/A — client-side logs not aggregated |
| OBS-006 | Sensitive data filtering | N/A — no server-side logging on frontend |
| OBS-012 | DB monitoring | N/A — no database on frontend layer |
| OBS-018 | LLM cost tracking | N/A — LLM calls go through backend |
| OBS-020 | Runbook links | N/A — no alert rules configured yet |

---

## Remediation Roadmap

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| OBS-010 | Web Vitals reporting | Wire `reportWebVitals` to send metrics to Sentry Performance or a `/api/vitals` endpoint | Short |
| OBS-014 | Correlation IDs | Include `X-Request-ID` header in all `apiClient` calls; log correlation ID on errors | Short |
| OBS-017 | AI usage tracking | Add Sentry performance spans around extraction/generation API calls | Short |
| OBS-008/019 | Alert rules | Configure Sentry alert thresholds (error rate, new issues) in Sentry dashboard | Quick win |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| OBS-015 | Distributed tracing | Enable Sentry performance monitoring for Next.js page transitions | Short |
| OBS-011 | Frontend RUM | Consider Vercel Analytics (zero-config) for Core Web Vitals tracking | Quick win |

---

## Acceptance Criteria

- [x] OBS-009: Sentry integrated on frontend ✅ (resolved)
- [x] OBS-007: Error tracking service installed ✅ (resolved)
- [ ] OBS-008/019: Alert rules configured in Sentry (P2)
- [ ] OBS-010: Web Vitals sent to Sentry/analytics (P2)
- [ ] Quality attribute score ≥ 50% (🟡 Adequate minimum — currently 42.9% 🟠 Low)
