---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: interaction-capability
quality_attribute_name: Interaction Capability (AI)
iso_characteristic: "ISO/IEC 25010:2023 Interaction Capability + ISO/IEC 42001:2023 AI UX"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 3
  partial: 1
  fail: 0
  na: 14
  applicable: 4
  score_pct: 87.5
  rating: "🏆 Exemplary"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 0
  p3_improvement: 1

delta:
  previous_audit: "2026-04-17T00:00"
  score_change: +37.5
  new_passes: ["INT-015", "INT-018"]
---

# Interaction Capability (AI) Audit — Backend

> **Score**: 87.5% · 🏆 Exemplary
> **Results**: 3 pass · 1 partial · 0 fail · 14 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 0
> **Audited**: 2026-04-17T01:00
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25010:2023 Interaction Capability + ISO/IEC 42001:2023 AI UX
> **Delta**: +37.5 pp from 50.0% (2026-04-17T00:00)

---

## Summary

Both previously failing interaction capability checks are now resolved. The NL query response envelope now includes `ai_generated: true`, `model`, `provider`, and a `disclaimer` field (INT-015 AI transparency). The AI feedback endpoint `POST /api/v1/projects/{id}/ai-feedback/` is implemented with the `AIFeedback` model supporting thumbs-up/down/flag and context type tracking (INT-018). Remaining gap is AI response controllability (no cancel for in-flight generation).

---

## Results

### ✅ PASS (3 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| INT-015 | AI transparency (API) | `ner/views.py:1944–1953`: NL query response includes `ai_generated: true`, `model`, `disclaimer`; extraction views include `ai_generated`, `provider` |
| INT-017 | AI error communication | `nl_query.py:202–204`: graceful fallback `'Unable to generate an answer right now. Please try again.'` |
| INT-018 | AI output feedback API | `ner/models.py:713`: `AIFeedback` model (project, user, feedback_type, context_type, comment); `POST /api/v1/projects/{id}/ai-feedback/` endpoint |

### ⚠️ PARTIAL (1 item)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| INT-016 | AI controllability | Extraction run can be stopped; per-document re-extraction supported | No API to cancel in-flight Celery generation tasks; tasks run to completion once started | medium |

### ❌ FAIL (0 items)

_No failing checks._

### 🔍 N/A (14 items)

All UI/UX checks (INT-001 through INT-013, INT-014) are not applicable to the backend API layer.

---

## Remediation Roadmap

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| INT-016 | Task cancellation | Add Celery task revocation endpoint; store `task_id` per generation request | Medium |

---

## Acceptance Criteria

- [x] INT-015 AI provenance in API responses ✅ (resolved)
- [x] INT-018 AI feedback endpoint ✅ (resolved)
- [ ] INT-016 cancel in-flight generation (P3)
