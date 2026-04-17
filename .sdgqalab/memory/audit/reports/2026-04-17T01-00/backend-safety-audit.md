---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: safety
quality_attribute_name: Safety
iso_characteristic: "ISO/IEC 42001:2023 AI Management + ISO/IEC 23894 AI Risk + ISO/IEC 25059 AI Quality"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 9
  partial: 5
  fail: 2
  na: 4
  applicable: 16
  score_pct: 71.9
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 2
  p2_important: 2
  p3_improvement: 2

delta:
  previous_audit: "2026-04-17T00:00"
  score_change: +28.2
  new_passes: ["SAF-001", "SAF-004", "SAF-012", "SAF-013"]
  new_partials: ["SAF-005"]
---

# Safety Audit — Backend

> **Score**: 71.9% · 🟢 Solid
> **Results**: 9 pass · 5 partial · 2 fail · 4 n/a
> **Blockers**: 0 | **Critical**: 2 | **High**: 0
> **Audited**: 2026-04-17T01:00
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 42001:2023 AI Management + ISO/IEC 23894 AI Risk Management
> **Delta**: +28.2 pp from 43.75% (2026-04-17T00:00)

---

## Summary

The critical P0 (SAF-001 — no output content filtering) has been resolved with `ner/services/content_safety.py`: a regex-based filter covering prompt injection patterns, PII, credential leak, crisis trigger phrases, and harmful content. The filter is integrated in `nl_query._call_provider()` and `text_quality.normalize_llm_text()`. Rate limiting on all AI endpoints is now in place via `AIRateLimitedView` (10/min per user). AI limitation disclosure and harmful output warnings are now included in API responses. Remaining critical gaps are PII privacy in the AI pipeline (SAF-007) and lack of bias assessment (SAF-006).

---

## Results

### ✅ PASS (9 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| SAF-001 | Output content filtering | `ner/services/content_safety.py`: `filter_llm_text()` with BLOCKED_PATTERNS (prompt injection, PII, harmful content); integrated in `nl_query.py` + `text_quality.py` |
| SAF-003 | Token/cost limits | `max_tokens` explicitly set on every LLM call: `nl_query.py:201`, `workplan_generator.py:69`, `persona_generator.py:62`, `report_generator.py:299` |
| SAF-004 | Rate limiting on AI endpoints | `ner/views.py:91`: `AIRateLimitedView` base class with `django-ratelimit`; all AI generation views inherit it |
| SAF-008 | AI graceful degradation | `nl_query.py:199–204`: `try/except` returns `'Unable to generate an answer right now. Please try again.'` on failure |
| SAF-009 | Hallucination mitigation | pgvector RAG implemented; grounded prompt with retrieved chunks; "No relevant document excerpts found" fallback |
| SAF-012 | AI limitation disclosure | `ner/views.py:1953`: `disclaimer` field in NL query response envelope: "This response is AI-generated from document evidence. Verify critical information with source documents." |
| SAF-013 | Harmful output warning | `content_safety.py`: `[CONTENT FILTERED]` replacement on trigger match; `content_warning` field in response when triggered |
| SAF-014 | Human-in-the-loop for critical actions | Entity extraction is user-triggered; deduplication requires manual review workflow |
| SAF-016 | AI model version tracking | `settings.py:82–90`: `NER_PROVIDER_MODEL_ALLOWLIST` and `NER_DEFAULT_PROVIDER/MODEL` centrally managed |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| SAF-002 | Input content filtering | DRF serializer validates query length; empty/whitespace blocked | No prompt injection detection on inputs (only output-side filtering via content_safety.py) | high |
| SAF-005 | AI risk documentation | `docs/MODEL_CARD.md` covers all-MiniLM-L6-v2 and all LLM providers | No formal risk register; no `docs/AI_RISKS.md` with bias assessment | medium |
| SAF-007 | Data privacy in AI pipeline | Users explicitly upload their own documents; data is project-scoped | No PII masking before LLM calls; no `store: false` API flags; no privacy documentation | critical |
| SAF-010 | Deterministic fallback | Generic "Unable to generate" message returned on AI failure | No template-based fallback with useful information; no human handoff path | medium |
| SAF-015 | Audit trail for AI decisions | `logger.exception` captures failures; `ai_generated` field in responses | No structured AI audit log (prompt + response + model + user + timestamp); no durable log store | high |

### ❌ FAIL (2 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| SAF-006 | Bias assessment | No fairlearn/aif360, no demographic analysis, no diverse test fixtures for bias | medium | P2 |
| SAF-011 | AI confidence communication | No confidence scores surfaced in API responses or UI | medium | P2 |

### 🔍 N/A (4 items)

| Check ID | Item | Reason |
|----------|------|--------|
| SAF-017 | Agent action boundaries | No agent framework |
| SAF-018 | Agent loop prevention | No agent execution loops |
| SAF-019 | Tool call validation | No LLM tool/function calling |
| SAF-020 | Agent observability | No agent framework |

---

## Remediation Roadmap

### P1 — Critical (fix before or shortly after production)

#### SAF-007: Data Privacy in AI Pipeline

**Current state:** Full document text sent to external LLM APIs without PII masking.
**Fix:** Implement `presidio-anonymizer` for PII detection in document chunks before LLM calls. Add `store: false` header for OpenAI. Document data handling in privacy policy.
**Effort:** Medium

#### DQ-013 (cross-reference): PII encryption at rest

**Fix:** Coordinate with DQ-013 remediation for field-level encryption of sensitive fields.
**Effort:** Medium

---

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| SAF-006 | Bias assessment | Write `docs/AI_RISKS.md` covering `all-MiniLM-L6-v2` known biases; add diverse test inputs | Short |
| SAF-011 | Confidence communication | Include `relevance_score` from pgvector similarity in query API response | Short |
| SAF-002 | Input filtering | Add lightweight prompt injection detection on input text before LLM call | Short |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| SAF-010 | Deterministic fallback | Create FAQ-based fallback response templates for common query types | Medium |
| SAF-015 | AI audit trail | Add structured `AIInteractionLog` table (prompt_hash, response, model, user_id, timestamp) | Medium |

---

## Acceptance Criteria

- [x] SAF-001 output filter implemented ✅ (resolved)
- [x] SAF-004 rate limiting on AI endpoints ✅ (resolved)
- [x] SAF-012 AI limitation disclosure ✅ (resolved)
- [ ] SAF-007 PII masking before LLM calls (P1 — critical)
- [ ] SAF-006 bias documentation written (P2)
- [ ] Quality attribute score ≥ 80% (🟢 Solid — currently 71.9%)
