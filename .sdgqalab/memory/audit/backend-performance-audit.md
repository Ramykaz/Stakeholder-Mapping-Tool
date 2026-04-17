---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: performance-efficiency
quality_attribute_name: Performance Efficiency
iso_characteristic: "ISO/IEC 25023 Performance Efficiency — time behaviour, resource utilisation"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T01:00"
config_version: 2

score:
  pass: 12
  partial: 5
  fail: 3
  na: 2
  applicable: 20
  score_pct: 72.5
  rating: "🟢 Solid"

priority_summary:
  p0_blockers: 0
  p1_critical: 1
  p2_important: 2
  p3_improvement: 3

delta:
  previous_audit: "2026-04-17T01:00"
  score_change: +2.5
  new_passes: []
  new_partials: ["PER-004"]
---

# Performance Efficiency Audit — Backend

> **Score**: 62.5% · 🟡 Adequate
> **Results**: 10 pass · 5 partial · 5 fail · 2 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 5
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25023 Performance Efficiency

---

## Summary

The backend uses `select_related`/`prefetch_related` consistently to avoid N+1 queries, Celery for async processing, and persistent DB connections. The main performance gaps are no caching layer (Redis is available but not used for API response caching), no pagination on entity list endpoints, Gunicorn running only 2 workers, and no query logging for slow query detection.

---

## Results

### ✅ PASS (10 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| PER-001 | N+1 query prevention | `ner/views.py`: `select_related('parent_entity')`, `prefetch_related('aliases')` used throughout |
| PER-005 | Async processing | Celery tasks for extraction/generation; no blocking work in request handlers |
| PER-006 | DB connection pooling | `conn_max_age=600` in `settings.py:140` |
| PER-007 | DB query optimization (indexes) | pgvector index for semantic search; UUID PKs indexed; FKs have indexes |
| PER-009 | Embedding batch processing | `ingestion/services/embedder.py`: batch embedding with SentenceTransformer |
| PER-010 | Vector search optimization | pgvector `cosine_similarity` search; dimension validated at 384 |
| PER-014 | Request/response size limits | `DATA_UPLOAD_MAX_MEMORY_SIZE=52MB`; chunked document processing |
| PER-015 | Static file serving | WhiteNoise serves static files efficiently; compression enabled |
| PER-018 | LLM token optimization | `max_tokens` limits on every call; concise prompts |
| PER-020 | Serialization | DRF serializers produce efficient JSON; no over-fetching by default |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| PER-002 | DB query optimization | `select_related` + `prefetch_related` | No query profiling (`django-debug-toolbar`); slow query threshold unknown | medium |
| PER-003 | Caching | Redis available; `KEY_PREFIX` configured | No cache decorators on expensive endpoints; entity lists re-queried on every request | high |
| PER-004 | Pagination | DRF pagination configured | Not all list endpoints paginated; entity list may return unbounded results | high |
| PER-011 | Container resource allocation | `GUNICORN_WORKERS=2, THREADS=2` configured | No CPU/memory resource limits in Docker Compose | medium |
| PER-012 | Horizontal scaling | Stateless design | Only 2 Gunicorn workers; single Celery worker; no auto-scaling | medium |

### ❌ FAIL (5 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| PER-003 | Response caching | No cache decorators; no ETags; no HTTP cache headers | high | P2 |
| PER-004 | Pagination on list endpoints | Entity list endpoint returns all results for project; no cursor/page limit | high | P2 |
| PER-008 | API compression | No gzip/brotli middleware configured; large JSON responses uncompressed | medium | P2 |
| PER-013 | DB query logging | No `LOGGING['loggers']['django.db.backends']` slow query config | medium | P2 |
| PER-019 | LLM response streaming | LLM responses buffered fully before returning to client; no streaming | medium | P3 |

### 🔍 N/A (2 items)

| Check ID | Item | Reason |
|----------|------|--------|
| PER-016 | CDN | CDN is a deployment concern; no CDN for API responses |
| PER-017 | Browser caching | N/A — backend serves API not browser assets |

---

## Remediation Roadmap

### P2 — Important

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| PER-003 | Cache expensive endpoints | Add `@cache_page(60*5)` to entity list / graph payload endpoints | Short |
| PER-004 | Pagination | Add `PageNumberPagination` to entity/relation list views; default page_size=50 | Short |
| PER-008 | Gzip compression | Add `GZipMiddleware` to MIDDLEWARE list in settings.py | Quick win |
| PER-013 | Slow query logging | Add `django.db.backends` logger at DEBUG level for dev; log queries >100ms | Quick win |

### P3 — Improvements

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| PER-019 | LLM streaming | Implement SSE streaming for report/persona generation | Large |

---

## Acceptance Criteria

- [ ] Quality attribute score ≥ 50% — currently 62.5% ✅
- [ ] Pagination added to list endpoints (PER-004)
