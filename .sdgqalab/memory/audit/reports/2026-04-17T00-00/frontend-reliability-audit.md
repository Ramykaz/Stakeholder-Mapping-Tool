---
schema: sdgqalab/audit@3
layer: frontend
layer_type: nextjs-typescript
quality_attribute: reliability
quality_attribute_name: Reliability
iso_characteristic: "ISO/IEC 25010:2023 Reliability — fault tolerance, recoverability, availability"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 8
  partial: 5
  fail: 4
  na: 5
  applicable: 17
  score_pct: 61.8
  rating: "🟡 Adequate"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 4
  p3_improvement: 5

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Reliability Audit — Frontend

> **Score**: 61.8% · 🟡 Adequate
> **Results**: 8 pass · 5 partial · 4 fail · 5 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 4
> **Audited**: 2026-04-17
> **Layer**: frontend (nextjs-typescript)
> **ISO Grounding**: ISO/IEC 25010:2023 Reliability

---

## Summary

The frontend has solid fault tolerance for a Next.js application: error boundaries, loading states, graceful API error handling, and TypeScript's null safety. The main gaps are no retry logic on failed API calls, no offline handling, and no automatic session refresh mechanism when tokens expire.

---

## Results

### ✅ PASS (8 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| REL-001 | Error handling | `ErrorBoundary.tsx` catches rendering errors; `lib/api.ts` catches all API errors |
| REL-003 | Health status awareness | API `401` responses trigger logout + redirect; network errors show `ErrorMessage` |
| REL-008 | State persistence | No critical in-memory state; project data re-fetched on load |
| REL-009 | Graceful degradation | AI-unavailable errors show user-friendly messages; empty states used |
| REL-013 | TypeScript null safety | `tsconfig.json`: `"strict": true` — null/undefined runtime errors caught at compile time |
| REL-018 | LLM error fallback | Loading states + error messages on all AI generation endpoints |
| REL-020 | Input validation | Form validation before API call; disabled submit during in-flight requests |
| REL-021 | Idempotent UI | Re-triggering extraction shows idempotent UI state |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| REL-001 | Error boundary coverage | Root-level ErrorBoundary present | No per-route error boundaries for isolated failures | high |
| REL-004 | API retry logic | `api.ts` handles 401 with logout | No automatic retry on 5xx or network errors; user must manually refresh | high |
| REL-007 | Session persistence | Token stored in localStorage survives reload | No token refresh mechanism; expired tokens require manual re-login | medium |
| REL-011 | Offline handling | API errors show error states | No service worker; no offline message; blank/broken UI if network drops mid-session | medium |
| REL-016 | LLM response validation | Loading states during generation | No validation that AI response has expected structure before rendering | medium |

### ❌ FAIL (4 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| REL-004 | Network retry | No `retry` logic on fetch calls; single attempt only | high | P2 |
| REL-005 | Circuit breaker | No exponential backoff; AI errors cause immediate failure display | medium | P2 |
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
