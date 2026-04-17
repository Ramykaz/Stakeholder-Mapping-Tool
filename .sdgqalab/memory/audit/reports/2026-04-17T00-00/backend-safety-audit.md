---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: safety
quality_attribute_name: Safety
iso_characteristic: "ISO/IEC 42001:2023 AI Management + ISO/IEC 23894 AI Risk + ISO/IEC 25059 AI Quality"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 5
  partial: 4
  fail: 7
  na: 4
  applicable: 16
  score_pct: 43.75
  rating: "🟠 Low"

priority_summary:
  p0_blockers: 1
  p1_critical: 4
  p2_important: 3
  p3_improvement: 2

delta:
  previous_audit: null
  score_change: null
  new_passes: []
  new_fails: []
---

# Safety Audit — Backend

> **Score**: 43.75% · 🟠 Low
> **Results**: 5 pass · 4 partial · 7 fail · 4 n/a
> **Blockers**: 1 | **Critical**: 4 | **High**: 3
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 42001:2023 AI Management + ISO/IEC 23894 AI Risk Management

---

## Summary

The backend AI pipeline has a critical gap: model outputs are forwarded directly to users with no content filtering, and there is no AI audit trail, no rate limiting on AI endpoints, and no AI limitation disclosure. RAG-based grounding and graceful error fallbacks are the main safety strengths. As an internal UNDP tool for domain experts, some safety requirements are lower-risk than a public consumer product, but the P0 (no output filtering) and P1 items (rate limiting, limitation disclosure) must be addressed before production deployment.

---

## Results

### ✅ PASS (5 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| SAF-003 | Token/cost limits | `max_tokens` explicitly set on every LLM call: `nl_query.py:201`, `workplan_generator.py:69`, `persona_generator.py:62`, `report_generator.py:299` |
| SAF-008 | AI graceful degradation | `nl_query.py:199–204`: `try/except` returns `'Unable to generate an answer right now. Please try again.'` on failure |
| SAF-009 | Hallucination mitigation | pgvector RAG implemented; `nl_query.py` grounded prompt with retrieved chunks; "No relevant document excerpts found" fallback |
| SAF-014 | Human-in-the-loop for critical actions | Entity extraction is user-triggered; deduplication requires manual review workflow before merge |
| SAF-016 | AI model version tracking | `settings.py:82–90`: `NER_PROVIDER_MODEL_ALLOWLIST` and `NER_DEFAULT_PROVIDER/MODEL` centrally managed |

### ⚠️ PARTIAL (4 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| SAF-002 | Input content filtering | DRF serializer validates query length; empty/whitespace blocked | No content moderation, no prompt injection detection, no jailbreak screening | high |
| SAF-007 | Data privacy in AI pipeline | Users explicitly upload their own documents; data is project-scoped | No PII masking before LLM calls; no `store: false` API flags; no privacy documentation for AI data flows | critical |
| SAF-010 | Deterministic fallback | Generic "Unable to generate" message returned on AI failure | No template-based fallback with useful information; no human handoff path | medium |
| SAF-015 | Audit trail for AI decisions | `logger.exception` captures failures; model name logged in some services | No structured AI audit log (prompt + response + model + user + timestamp); no durable log store; no retention policy | high |

### ❌ FAIL (7 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| SAF-001 | Output content filtering | No output filtering found; model responses returned directly to users | critical | P0 |
| SAF-004 | Rate limiting on AI endpoints | No rate limiting on `/api/v1/projects/{id}/query/` or any generation endpoints | high | P1 |
| SAF-005 | AI risk documentation | No `docs/ai-risk.md`, no model cards, no risk register found | medium | P2 |
| SAF-006 | Bias assessment | No fairlearn/aif360, no demographic analysis, no diverse test fixtures for bias | medium | P2 |
| SAF-011 | AI confidence communication | No confidence scores surfaced in API responses or UI | medium | P2 |
| SAF-012 | AI limitation disclosure | No disclaimers, no system prompt capability boundaries communicated to users | high | P1 |
| SAF-013 | Harmful output warning | No content warnings; safety-filtered or questionable content silently passed through | high | P1 |

### 🔍 N/A (4 items)

| Check ID | Item | Reason |
|----------|------|--------|
| SAF-017 | Agent action boundaries | No agent framework; system uses prompt→response, not tool-calling agents |
| SAF-018 | Agent loop prevention | No agent execution loops |
| SAF-019 | Tool call validation | No LLM tool/function calling |
| SAF-020 | Agent observability | No agent framework |

---

## Remediation Roadmap

### P0 — Blockers (must fix before ANY deployment)

#### SAF-001: Output Content Filtering

**Current state:** All LLM responses are returned directly to the frontend with no filtering step. Harmful, biased, or inappropriate content can reach users.
**Required state:** At minimum, implement a lightweight output review: flag responses containing PII, hate speech, or off-topic content.
**Fix:**
```python
# ner/services/output_filter.py (new file)
import re

SENSITIVE_PATTERNS = [
    r'\b\d{3}-\d{2}-\d{4}\b',   # SSN-like
    r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b',  # email
]

def filter_llm_output(text: str) -> str:
    """Mask obvious PII patterns from LLM output."""
    for pattern in SENSITIVE_PATTERNS:
        text = re.sub(pattern, '[REDACTED]', text, flags=re.IGNORECASE)
    return text
```
**Effort:** Short (basic regex filter) → Medium (integrating OpenAI moderation API)

---

### P1 — Critical (fix before production)

#### SAF-004: Rate Limiting on AI Endpoints

**Current state:** No rate limiting — users can trigger unlimited expensive LLM calls.
**Fix:** Add `django-ratelimit` with per-user limits on generation endpoints (10/min for query, 5/hour for report generation).
**Effort:** Short

#### SAF-012: AI Limitation Disclosure

**Current state:** No system-level disclosure that AI can hallucinate or make errors.
**Fix:** Add an AI disclaimer to the query endpoint's response envelope (e.g., `"ai_disclaimer": "Responses are AI-generated and may contain errors. Always verify against source documents."`) and add a UI banner on first use.
**Effort:** Quick win

#### SAF-013: Harmful Output Warning

**Current state:** No warnings when AI produces potentially sensitive content.
**Fix:** Log flagged responses server-side; add a `content_warning` field to AI response APIs when triggered by output filter.
**Effort:** Short

#### SAF-007: Data Privacy in AI Pipeline (critical+partial → P1)

**Current state:** Full document text sent to external LLM APIs without PII masking.
**Fix:** Implement `presidio-anonymizer` for PII detection in document chunks before LLM calls; document data handling in privacy policy.
**Effort:** Medium

---

### P2 — Important (fix within first sprint post-launch)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| SAF-005 | AI risk documentation | Write `docs/AI_RISKS.md` covering hallucination risk, data freshness, bias, cost overrun, provider dependency | Quick win |
| SAF-006 | Bias assessment | Add diverse test prompts to test suite; document known limitations in AI risk doc | Short |
| SAF-011 | Confidence communication | Include `relevance_score` from pgvector similarity search in query API response | Short |

### P3 — Improvements (backlog)

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| SAF-010 | Deterministic fallback | Create FAQ-based fallback response templates for common query types | Medium |
| SAF-015 | AI audit trail | Add structured AI interaction log table (prompt_hash, response, model, user_id, timestamp) | Medium |

---

## Acceptance Criteria

- [ ] SAF-001 output filter implemented (P0 resolved)
- [ ] SAF-004 rate limiting on AI endpoints (P1 resolved)
- [ ] SAF-012 AI limitation disclosure added (P1 resolved)
- [ ] AI risk documentation written (P2)
- [ ] Quality attribute score ≥ 50% (🟡 Adequate minimum for launch)
