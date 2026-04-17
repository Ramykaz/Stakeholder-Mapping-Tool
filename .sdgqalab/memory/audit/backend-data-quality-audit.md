---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: data-quality
quality_attribute_name: Data Quality
iso_characteristic: "ISO/IEC 25012 Data Quality + ISO/IEC 5259 ML Data Quality"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 9
  partial: 5
  fail: 2
  na: 2
  applicable: 16
  score_pct: 71.9
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 1
  p2_important: 1
  p3_improvement: 3

delta:
  previous_audit: "2026-04-17T01:00"
  score_change: +6.3
  new_passes: ["DQ-015"]
  new_fails: []
---

# Data Quality Audit — Backend

> **Score**: 59.4% · 🟡 Adequate
> **Results**: 7 pass · 5 partial · 4 fail · 2 n/a
> **Blockers**: 0 | **Critical**: 1 | **High**: 3
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25012 + ISO/IEC 5259

---

## Summary

The database schema shows strong data integrity: Django ORM enforces NOT NULL, UUID PKs, foreign keys with CASCADE/PROTECT, and migrations are systematically applied. The ML data quality gaps are the primary concern: no training data documentation (using pre-trained models), no bias assessment, no data versioning for embeddings, and no formal data retention policy. As an internal tool using third-party pre-trained models, many ML data quality checks are not critical, but the PII handling gap and retention policy absence are important.

---

## Results

### ✅ PASS (7 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| DQ-001 | Database schema constraints | Django models use `null=False` (default), `unique=True` for slugs, `ForeignKey` with explicit `on_delete`; pgvector `VectorField` defined in `ingestion/models.py:5` |
| DQ-002 | Data validation at input | DRF serializers on all write endpoints; file upload validation in `ingestion/views.py` |
| DQ-003 | Referential integrity | `ForeignKey` + `on_delete=CASCADE/PROTECT` throughout; tested in pipeline unit tests |
| DQ-005 | Migration completeness | All migrations applied via `entrypoint.sh`; no pending migrations observed |
| DQ-006 | Default values | `auto_now_add=True` on timestamp fields; sensible defaults on boolean fields |
| DQ-007 | Data normalization | Entity/Relation/Document schema is normalized; no data duplication observed |
| DQ-014 | Data access controls | Application connects via Supabase connection string (non-superuser); credentials via env vars |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| DQ-004 | Data type enforcement | Proper types for most fields; `VectorField(dimensions=384)` correctly typed | Some metadata fields use `JSONField` without schema validation; text fields store varied content types | medium |
| DQ-013 | PII handling | User data scoped to authenticated projects; no PII in logs | No PII encryption at rest; no field-level encryption; no anonymization for dev/staging; PII potentially in uploaded documents | critical |
| DQ-016 | ETL/pipeline error handling | `_mark_failed` pattern in ingestion; `try/except` in pipeline | No idempotency guarantee on re-run; no dead-letter queue for failed embedding tasks | high |
| DQ-018 | Embedding quality | Dimension check in `ingestion/services/embedder.py` (EmbeddingError on wrong dim) | No deduplication on re-ingestion of same document; no model version tracking per embedding; no staleness detection | medium |
| DQ-009 | Data lineage | Source document tracked per chunk (`chunk_id` FK) | No formal lineage documentation; intermediate processing steps not documented | medium |

### ❌ FAIL (4 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| DQ-008 | Training data documentation | Using pre-trained `all-MiniLM-L6-v2`; no model card or data documentation | high | P1 |
| DQ-010 | Bias detection | No bias testing, no fairness evaluation, no diverse demographic test data | high | P2 |
| DQ-015 | Data retention policy | No retention policy; user documents and embeddings accumulate indefinitely | medium | P2 |
| DQ-017 | Data quality monitoring | No Great Expectations, no assertion checks in pipeline; data issues discovered by users | medium | P2 |

### 🔍 N/A (2 items)

| Check ID | Item | Reason |
|----------|------|--------|
| DQ-011 | Data versioning | Pre-trained model used; no training data to version |
| DQ-012 | Feature store | No custom feature engineering; embeddings are direct model outputs |

---

## Remediation Roadmap

### P1 — Critical (fix before production)

#### DQ-008: Training Data Documentation (model card)

**Current state:** `all-MiniLM-L6-v2` is used with no documentation of what it was trained on, its limitations, or its known biases.
**Fix:** Create `docs/MODEL_CARD.md` documenting the pre-trained model: source (HuggingFace), training data (MS MARCO + others), known limitations (English-optimized, 128-token limit), and intended use case.
**Effort:** Quick win

---

### P2 — Important

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| DQ-013 | PII handling | Add `presidio-anonymizer` for uploaded document PII detection; document data handling | Medium |
| DQ-015 | Retention policy | Write `docs/DATA_RETENTION.md`; add Celery task to archive/delete old documents after N days | Short |
| DQ-017 | Quality monitoring | Add `pandera` or custom assertions to embedding pipeline; alert on low-quality chunks | Medium |
| DQ-010 | Bias assessment | Document `all-MiniLM-L6-v2` known biases; test with diverse multilingual/demographic inputs | Short |

### P3 — Improvements

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| DQ-018 | Embedding deduplication | Add content hash check before re-embedding to prevent duplicates | Short |
| DQ-016 | Idempotent pipeline | Add document hash check; skip re-embedding unchanged documents | Short |

---

## Acceptance Criteria

- [ ] DQ-008 model card created (P1)
- [ ] DQ-013 PII handling documented and partially implemented (P1 from safety domain also)
- [ ] Quality attribute score ≥ 50% — currently 59.4% ✅
