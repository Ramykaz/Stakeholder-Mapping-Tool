# AI Risk Assessment

**Project:** UNDP Stakeholder Analysis Tool
**Owner:** SDG AI Lab
**Effective Date:** 2026-04-17
**Review Cycle:** Annual or when AI components change

---

## 1. Purpose

This document identifies and assesses the AI-specific risks associated with the Stakeholder
Analysis Tool. It covers the pre-trained embedding model, the LLM providers used for
extraction and generation, and the AI-powered features exposed to users.

---

## 2. AI Components

| Component | Type | Model | Version | Use Case |
|-----------|------|-------|---------|----------|
| Sentence embedding | Pre-trained | `all-MiniLM-L6-v2` | 2.x (HuggingFace) | Document chunking, semantic search |
| NER extraction | External LLM | Groq Llama 3.1, OpenAI GPT-4o, Azure OpenAI, Gemini 2.0 Flash | Per provider | Entity/relation extraction |
| NL query | External LLM | Same as above | Per project config | Natural language answers over documents |
| Report generation | External LLM | Same as above | Per project config | Stakeholder report sections |
| Persona generation | External LLM | Same as above | Per project config | Stakeholder persona archetypes |
| Workplan generation | External LLM | Same as above | Per project config | Engagement task planning |

---

## 3. Risk Register

### 3.1 Embedding Model — `all-MiniLM-L6-v2`

| Risk ID | Risk | Likelihood | Impact | Mitigation |
|---------|------|-----------|--------|------------|
| EMB-001 | **English-language bias**: Model was trained primarily on English text (MS MARCO, Wikipedia, news). Non-English documents will produce lower-quality embeddings and worse search results. | Medium | Medium | Document limitation in MODEL_CARD.md; advise users to work with English translations |
| EMB-002 | **128-token context limit**: Documents are chunked to fit, but entities spanning chunk boundaries may be missed. | High | Medium | Chunking is set to 512 tokens with 50-token overlap to minimise boundary misses |
| EMB-003 | **Western/OECD bias in training data**: Training corpus over-represents Western institutional documents; may under-perform on Global South development terminology. | Medium | Medium | Acknowledged; users should review extraction results; alternative models tested periodically |
| EMB-004 | **Stale embeddings**: Re-ingesting updated documents does not automatically re-embed previous chunks. | Medium | Low | Users can re-ingest documents; pipeline checks document hash |

### 3.2 LLM Extraction and Generation

| Risk ID | Risk | Likelihood | Impact | Mitigation |
|---------|------|-----------|--------|------------|
| LLM-001 | **Hallucinated entities**: LLMs may invent entity names or relationships not in source documents. | Medium | High | RAG architecture grounds answers in retrieved chunks; extraction prompts specify "only extract from provided text"; `relevance_score` in query responses indicates grounding quality |
| LLM-002 | **Prompt injection via documents**: Malicious document content may attempt to override system prompt instructions. | Low | High | `content_safety.py` output filter; `sanitize_entity_text` on query inputs; extraction prompts use structured JSON output |
| LLM-003 | **PII leakage via LLM output**: LLMs may echo sensitive information from document context in unexpected ways. | Medium | High | `content_safety.py` scans for PII patterns (SSN, credit card, credentials) and replaces with `[CONTENT FILTERED]` |
| LLM-004 | **Provider-specific demographic bias**: LLMs may reflect social biases in training data, producing biased characterisations of stakeholder groups. | Medium | Medium | Output filtering for harmful content; human review workflow recommended for final deliverables; users should critically review AI-generated personas and priorities |
| LLM-005 | **Cost overrun**: Unconstrained extraction over large document sets may incur unexpected LLM API costs. | Medium | Low | `max_tokens` set on all calls; rate limiting on AI endpoints (10/min per user); cost tracking via token usage logging |
| LLM-006 | **Provider outage / degraded quality**: External LLM provider may be unavailable or return degraded output. | Low | Medium | Circuit breaker (3 failures/60s) in `provider_runtime.py`; per-provider rate-limit handling; graceful error messages |
| LLM-007 | **Context window overflow**: Very large documents may exceed provider context limits, causing truncation. | Medium | Medium | Documents chunked before sending; each chunk processed independently; chunk overlap preserves cross-boundary context |

### 3.3 Stakeholder Prioritization (AI-Scored)

| Risk ID | Risk | Likelihood | Impact | Mitigation |
|---------|------|-----------|--------|------------|
| PRI-001 | **Frequency-based bias**: Entities mentioned more frequently are scored higher, regardless of actual stakeholder importance. | High | Medium | Priority algorithm combines mention frequency, confidence, and graph degree; AI-generated `priority_reason` field explains ranking |
| PRI-002 | **Exclusion of implicit stakeholders**: Stakeholders referenced indirectly may not be extracted as entities. | Medium | High | Users can manually add entities; extraction guidance feature allows directing the model toward under-identified groups |

---

## 4. Known Biases in `all-MiniLM-L6-v2`

The `all-MiniLM-L6-v2` model is distilled from `microsoft/mpnet-base` and fine-tuned on:
- MS MARCO (web search relevance)
- Wikipedia passages
- Reddit posts, news articles, and books

**Known limitations:**
- Optimised for English; degrades on other languages
- Over-represents Western/OECD institutional writing styles
- Gender-neutral pronouns in some languages may not embed correctly
- No domain adaptation for international development / humanitarian contexts

**Assessment for this use case:** Low-to-medium risk for UNDP use cases. The tool is designed
to surface entities mentioned in documents; embedding quality affects recall, not fabrication.
Users should review extraction results critically.

---

## 5. Bias Testing

No formal fairness evaluation has been conducted. The following tests are recommended:

| Test | Description | Priority |
|------|-------------|----------|
| Multilingual recall | Test extraction on UN documents in French, Spanish, Arabic | P2 |
| Gender distribution | Check if male-coded names are extracted at higher rates than female-coded names | P2 |
| Geographic coverage | Compare extraction quality on documents from different regions | P3 |

---

## 6. Human Oversight

All AI outputs in this tool are advisory only and subject to human review:
- Entity extractions can be deleted, merged, or corrected by users
- Stakeholder priorities can be overridden via engagement notes
- Report sections are fully editable before export
- Personas are not automatically applied to any decisions

---

## 7. Residual Risks (Accepted)

| Risk | Acceptance Rationale |
|------|---------------------|
| English-language embedding bias | Tool targets English-language UNDP documents; acceptable for intended use case |
| LLM demographic bias in personas | Persona output is advisory; explicit human review required before use in planning |
| No real-time bias monitoring | Internal tool; manual quarterly review of sample outputs is planned |

---

## 8. Review and Contact

This risk register is reviewed:
- Annually as part of the standard review cycle
- When a new LLM provider or model is added
- After any reported incident involving AI output quality

Contact: SDG AI Lab — raise an issue in the project repository.
