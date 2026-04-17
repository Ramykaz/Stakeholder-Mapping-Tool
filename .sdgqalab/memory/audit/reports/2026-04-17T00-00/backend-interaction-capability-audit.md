---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: interaction-capability
quality_attribute_name: Interaction Capability (AI)
iso_characteristic: "ISO/IEC 25059 AI System Interaction — controllability, transparency, explainability"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 1
  partial: 2
  fail: 1
  na: 14
  applicable: 4
  score_pct: 50.0
  rating: "🟡 Adequate"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 1
  p3_improvement: 2

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Interaction Capability (AI) Audit — Backend

> **Score**: 50.0% · 🟡 Adequate
> **Results**: 1 pass · 2 partial · 1 fail · 14 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 1
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25059 AI System Interaction

---

## Summary

The backend handles 4 AI interaction checks (the remainder are frontend/UI checks). Graceful AI error communication is in place. No output feedback API endpoint exists, meaning user feedback on AI quality cannot be captured.

---

## Results

### ✅ PASS (1 item)

| Check ID | Item | Evidence |
|----------|------|----------|
| INT-017 | AI error communication | `nl_query.py:202–204`: graceful fallback `'Unable to generate an answer right now. Please try again.'` |

### ⚠️ PARTIAL (2 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| INT-015 | AI transparency (API) | Model name tracked in `NER_DEFAULT_PROVIDER/MODEL` | No `ai_generated: true` flag or model provenance included in API responses | high |
| INT-016 | AI controllability | Extraction run can be stopped; per-document re-extraction supported | No API to cancel in-flight generation tasks; Celery tasks run to completion once started | medium |

### ❌ FAIL (1 item)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| INT-018 | AI output feedback API | No feedback endpoint; no way to capture thumbs up/down on AI responses | medium | P2 |

### 🔍 N/A (14 items)

All UI/UX checks (INT-001 through INT-013, INT-014) are not applicable to the backend API layer.

---

## Remediation Roadmap

### P2 — Important

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| INT-015 | AI provenance in API | Add `"model": provider_name, "ai_generated": true` to AI response envelopes | Quick win |
| INT-018 | Feedback endpoint | Add `POST /api/v1/projects/{id}/feedback/` endpoint to capture AI response quality ratings | Short |

---

## Acceptance Criteria

- [ ] Quality attribute score ≥ 50% — currently 50.0% ✅
