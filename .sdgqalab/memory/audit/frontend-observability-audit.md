---
schema: sdgqalab/audit@3
layer: frontend
layer_type: nextjs-typescript
quality_attribute: observability
quality_attribute_name: Observability
iso_characteristic: "ISO/IEC 25010:2023 Maintainability.Analysability + SRE Golden Signals"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 1
  partial: 3
  fail: 10
  na: 6
  applicable: 14
  score_pct: 17.9
  rating: "🔴 Critical"

priority_summary:
  p0_blockers: 1
  p1_critical: 2
  p2_important: 4
  p3_improvement: 2

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Observability Audit — Frontend

> **Score**: 17.9% · 🔴 Critical
> **Results**: 1 pass · 3 partial · 10 fail · 6 n/a
> **Blockers**: 1 | **Critical**: 2 | **High**: 4
> **Audited**: 2026-04-17
> **Layer**: frontend (nextjs-typescript)
> **ISO Grounding**: ISO/IEC 25010:2023 Maintainability.Analysability

---

## Summary

The frontend has no client-side error tracking, no performance monitoring, and no frontend observability infrastructure. The ErrorBoundary component catches rendering failures silently, but without Sentry (or equivalent), these failures are invisible in production. No frontend analytics, no web vitals tracking, and no user session monitoring exist.

---

## Results

### ✅ PASS (1 item)

| Check ID | Item | Evidence |
|----------|------|----------|
| OBS-002 | Log level (client-side) | Next.js production build strips `console.log`; `console.error` preserved for critical errors |

### ⚠️ PARTIAL (3 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| OBS-001 | Client error capture | `ErrorBoundary.tsx` catches rendering errors | Errors are displayed to users but not sent to any error tracking service | medium |
| OBS-003 | API error logging | API error responses caught in `lib/api.ts` interceptor | Errors logged to `console.error` only; not captured in any observability tool | medium |
| OBS-016 | AI interaction logging (client) | Loading states and error states rendered for AI operations | No tracking of AI feature usage, success rates, or user drop-off | medium |

### ❌ FAIL (10 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| OBS-009 | Unhandled exception capture | `ErrorBoundary` catches silently; no Sentry/LogRocket integration | critical | P0 |
| OBS-007 | Error tracking service | No `@sentry/nextjs`, `logrocket`, or equivalent in `package.json` | high | P1 |
| OBS-010 | Application metrics / Web Vitals | No `web-vitals`, no Core Web Vitals reporting | medium | P2 |
| OBS-011 | Infrastructure monitoring (frontend) | No Vercel Analytics, no Datadog RUM, no New Relic Browser | medium | P2 |
| OBS-013 | Uptime monitoring | No external uptime check on frontend URL | medium | P2 |
| OBS-014 | Request correlation IDs | Frontend does not pass or receive correlation IDs from backend | medium | P2 |
| OBS-015 | Distributed tracing | No OpenTelemetry or Datadog APM on frontend | low | P3 |
| OBS-017 | AI pipeline monitoring (client) | No tracking of extraction/generation success rates | medium | P2 |
| OBS-008 | Error alerting | No alerting from frontend errors | high | P1 |
| OBS-019 | Alerting rules | No frontend alert definitions | high | P1 |

### 🔍 N/A (6 items)

| Check ID | Item | Reason |
|----------|------|--------|
| OBS-004 | Error logging with context | N/A at frontend level — backend handles structured error logging |
| OBS-005 | Log aggregation | N/A — client-side logs not aggregated |
| OBS-006 | Sensitive data filtering | N/A — no server-side logging on frontend |
| OBS-012 | DB monitoring | N/A — no database on frontend layer |
| OBS-018 | LLM cost tracking | N/A — LLM calls go through backend |
| OBS-020 | Runbook links | N/A — no alerts exist |

---

## Remediation Roadmap

### P0 — Blockers

#### OBS-009: Frontend Error Capture

**Current state:** `ErrorBoundary` catches rendering errors but silently discards them. JS runtime errors, unhandled promise rejections, and React component crashes are invisible in production.
**Fix:**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```
Then update `ErrorBoundary.tsx`:
```typescript
import * as Sentry from '@sentry/nextjs';
// In componentDidCatch:
Sentry.captureException(error, { extra: errorInfo });
```
**Effort:** Quick win

### P1 — Critical

#### OBS-007/008/019: Error Tracking + Alerting

**Fix:** Sentry Next.js integration (from P0 fix) provides automatic error alerts. Configure alert thresholds in Sentry dashboard.
**Effort:** Quick win

### P2 — Important

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| OBS-010 | Web Vitals | Add `web-vitals` to `_app.tsx` or `next.config.js`; report to Sentry or Vercel Analytics | Quick win |
| OBS-014 | Correlation IDs | Include `X-Request-ID` header in all `apiClient` calls; log correlation ID in error captures | Short |
| OBS-017 | AI usage tracking | Add Sentry performance spans around extraction/generation API calls | Short |

### P3 — Improvements

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| OBS-015 | Distributed tracing | Add Sentry performance monitoring for Next.js | Short |

---

## Acceptance Criteria

- [ ] OBS-009: Sentry (or equivalent) integrated on frontend (P0 resolved)
- [ ] All rendering and runtime errors captured and alerted (P1 resolved)
- [ ] Quality attribute score ≥ 50% (🟡 Adequate minimum for launch)
