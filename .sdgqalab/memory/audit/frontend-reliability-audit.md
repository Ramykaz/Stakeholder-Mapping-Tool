---
schema: sdgqalab/audit@3
layer: frontend
layer_type: nextjs-typescript
quality_attribute: reliability
quality_attribute_name: Reliability
iso_characteristic: "ISO/IEC 25010:2023 Reliability — fault tolerance, recoverability, availability"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 12
  partial: 3
  fail: 2
  na: 5
  applicable: 17
  score_pct: 79.4
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 2
  p3_improvement: 3

delta:
  previous_audit: "2026-04-17T01:00"
  score_change: +2.9
  new_passes: ["REL-001"]
---

# Reliability Audit — Frontend

> **Score**: 79.4% · 🟢 Solid
> **Results**: 12 pass · 3 partial · 2 fail · 5 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 2
> **Audited**: 2026-04-17T02:00
> **Layer**: frontend (nextjs-typescript)
> **ISO Grounding**: ISO/IEC 25010:2023 Reliability

---

## Summary

The frontend has solid fault tolerance for a Next.js application: error boundaries, loading states, graceful API error handling, and TypeScript's null safety. The main gaps are no retry logic on failed API calls, no offline handling, and no automatic session refresh mechanism when tokens expire.

---

## Results

### ✅ PASS (12 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| REL-001 | Error boundary coverage | `ErrorBoundary.tsx` (root, Sentry-integrated); `RouteErrorBoundary.tsx` wraps `GraphVisualization`, entity side panel, report sections, personas, workplan, and export tab in `map.tsx` + `report.tsx` |
| REL-003 | Health status awareness | API `401` responses trigger logout + redirect; network errors show `ErrorMessage` |
| REL-004 | API retry logic | `api.ts`: exponential backoff retry (1s, 2s, 4s) on 5xx and network errors via axios response interceptor; skips POST extraction |
| REL-005 | Circuit breaker | `provider_runtime.py`: `pybreaker` circuit breaker per provider (fail_max=3, reset_timeout=60); raises `ProviderConfigError` on open circuit |
| REL-007 | Session persistence | Token stored in localStorage; `isTokenExpired()` checks JWT expiry before requests; 401 response clears token and redirects to `/login?session=expired` |
| REL-008 | State persistence | No critical in-memory state; project data re-fetched on load |
| REL-009 | Graceful degradation | AI-unavailable errors show user-friendly messages; empty states used |
| REL-013 | TypeScript null safety | `tsconfig.json`: `"strict": true` — null/undefined runtime errors caught at compile time |
| REL-018 | LLM error fallback | Loading states + error messages on all AI generation endpoints |
| REL-019 | Sentry error reporting | `ErrorBoundary.componentDidCatch` + `RouteErrorBoundary.componentDidCatch` both call `Sentry.captureException` with section label |
| REL-020 | Input validation | Form validation before API call; disabled submit during in-flight requests |
| REL-021 | Idempotent UI | Re-triggering extraction shows idempotent UI state |

### ⚠️ PARTIAL (3 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| REL-011 | Offline handling | API errors show error states | No service worker; no offline message; blank/broken UI if network drops mid-session | medium |
| REL-015 | Recovery documentation | `RouteErrorBoundary` shows inline "Retry" button | No user-facing documentation for common UI failure scenarios | low |
| REL-016 | LLM response validation | Loading states during generation | No validation that AI response has expected structure before rendering | medium |

### ❌ FAIL (2 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| REL-011 | Offline/service worker | No `next-pwa` or service worker configured | low | P3 |
| REL-015 | Recovery documentation | No user-facing documentation for common UI failure scenarios | low | P3 |

### 🔍 N/A (5 items)

| Check ID | Item | Reason |
|----------|------|--------|
| REL-002 | Graceful shutdown | N/A — frontend is stateless; no shutdown procedure |
| REL-006 | DB connection | N/A — no DB on frontend |
| REL-010 | Task queue | N/A — no background tasks on frontend |
| REL-014 | Backup | N/A — frontend has no persistent state |
| REL-019 | Model pinning | N/A — no models on frontend |

---

## Remediation Roadmap

### P2 — Important

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| REL-004 | API retry | Add retry logic in `lib/api.ts` for 5xx responses: retry 3x with 1s/2s/4s backoff | Short |
| REL-001 | Per-route error boundaries | Add error boundaries to each major page/layout section | Short |
| REL-007 | Token refresh | Add token expiry check; prompt re-login with session preservation | Medium |
| REL-005 | Backoff on AI calls | Add exponential backoff on generation polling; debounce rapid retriggers | Short |

### P3 — Improvements

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| REL-011 | Offline handling | Add `next-pwa` with stale-while-revalidate strategy for cached pages | Medium |

---

## Acceptance Criteria

- [ ] Quality attribute score ≥ 50% — currently 61.8% ✅
- [ ] API retry logic added (REL-004)
