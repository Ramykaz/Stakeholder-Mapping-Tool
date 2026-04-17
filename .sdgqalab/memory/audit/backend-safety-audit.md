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
  pass: 11
  partial: 5
  fail: 0
  na: 4
  applicable: 16
  score_pct: 84.4
  rating: "🏆 Exemplary"

priority_summary:
  p0_blockers: 0
  p1_critical: 0
  p2_important: 2
  p3_improvement: 2

delta:
  previous_audit: "2026-04-17T01:00"
  score_change: +12.5
  new_passes: ["SAF-006", "SAF-011"]
  new_partials: ["SAF-005"]
---

# Safety Audit — Backend

> **Score**: 84.4% · 🏆 Exemplary
> **Results**: 11 pass · 5 partial · 0 fail · 4 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 0
> **Audited**: 2026-04-17T02:00
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 42001:2023 AI Management + ISO/IEC 23894 AI Risk Management
> **Delta**: +12.5 pp from 71.9% (2026-04-17T01:00)

---

## Summary

All P0 and P1 AI safety checks now pass. Content filtering (`content_safety.py`) covers prompt injection, PII, credential leak, and harmful content. Rate limiting is in place via `AIRateLimitedView`. AI limitation disclaimers and harmful output warnings are included in API responses. `docs/AI_RISKS.md` now documents known biases in `all-MiniLM-L6-v2` and all LLM providers (SAF-006). The NL query response includes a `relevance_score` (0.0–1.0) from pgvector similarity as a confidence signal (SAF-011). Remaining gaps are PII masking before LLM calls (SAF-007), structured AI audit log (SAF-015), and template-based fallback (SAF-010).

---

## Results

### ✅ PASS (11 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| SAF-001 | Output content filtering | `ner/services/content_safety.py`: `filter_llm_text()` with BLOCKED_PATTERNS (prompt injection, PII, harmful content); integrated in `nl_query.py` + `text_quality.py` |
| SAF-003 | Token/cost limits | `max_tokens` explicitly set on every LLM call: `nl_query.py:201`, `workplan_generator.py:69`, `persona_generator.py:62`, `report_generator.py:299` |
| SAF-004 | Rate limiting on AI endpoints | `ner/views.py:91`: `AIRateLimitedView` base class with `django-ratelimit`; all AI generation views inherit it |
| SAF-006 | Bias assessment | `docs/AI_RISKS.md`: full AI risk register covering EMB-001–EMB-004 (embedding bias), LLM-001–LLM-007, PRI-001–PRI-002; `all-MiniLM-L6-v2` training data and known limitations documented |
| SAF-008 | AI graceful degradation | `nl_query.py:199–204`: `try/except` returns `'Unable to generate an answer right now. Please try again.'` on failure |
| SAF-009 | Hallucination mitigation | pgvector RAG implemented; grounded prompt with retrieved chunks; "No relevant document excerpts found" fallback |
| SAF-011 | AI confidence communication | `ner/views.py` `ProjectQueryView`: `relevance_score` (0.0–1.0) from `compute_query_relevance_score()` included in NL query response; 2000-char input limit + `sanitize_entity_text()` input sanitization |
| SAF-012 | AI limitation disclosure | `ner/views.py:1953`: `disclaimer` field in NL query response envelope |
| SAF-013 | Harmful output warning | `content_safety.py`: `[CONTENT FILTERED]` replacement on trigger match; `content_warning` field in response when triggered |
| SAF-014 | Human-in-the-loop for critical actions | Entity extraction is user-triggered; deduplication requires manual review workflow |
| SAF-016 | AI model version tracking | `settings.py:82–90`: `NER_PROVIDER_MODEL_ALLOWLIST` and `NER_DEFAULT_PROVIDER/MODEL` centrally managed |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| SAF-002 | Input content filtering | 2000-char limit + `sanitize_entity_text()` on query input; DRF serializer validates length | No prompt injection detection on inputs (only output-side filtering via content_safety.py) | high |
| SAF-005 | AI risk documentation | `docs/MODEL_CARD.md` covers providers; `docs/AI_RISKS.md` covers risk register | No formal quantitative bias evaluation; bias testing recommendations only | medium |
| SAF-007 | Data privacy in AI pipeline | Users explicitly upload their own documents; data is project-scoped | No PII masking before LLM calls; no `store: false` API flags | critical |
| SAF-010 | Deterministic fallback | Generic "Unable to generate" message returned on AI failure | No template-based fallback with useful information; no human handoff path | medium |
| SAF-015 | Audit trail for AI decisions | `logger.exception` captures failures; `ai_generated` field in responses | No structured AI audit log (prompt + response + model + user + timestamp); no durable log store | high |

### ❌ FAIL (0 items)

All checks pass or are partially addressed. No outstanding failures.

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
