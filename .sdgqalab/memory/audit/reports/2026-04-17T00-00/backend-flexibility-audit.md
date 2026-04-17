---
schema: sdgqalab/audit@3
layer: backend
layer_type: python-django-ml
quality_attribute: flexibility
quality_attribute_name: Flexibility
iso_characteristic: "ISO/IEC 25023 Flexibility — adaptability, scalability, installability"
project: Stakeholder Analysis Tool
audited_at: "2026-04-17T00:00"
config_version: 2

score:
  pass: 8
  partial: 5
  fail: 4
  na: 1
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

# Flexibility Audit — Backend

> **Score**: 61.8% · 🟡 Adequate
> **Results**: 8 pass · 5 partial · 4 fail · 1 n/a
> **Blockers**: 0 | **Critical**: 0 | **High**: 4
> **Audited**: 2026-04-17
> **Layer**: backend (python-django-ml)
> **ISO Grounding**: ISO/IEC 25023 Flexibility

---

## Summary

The backend has good flexibility foundations: a multi-provider LLM abstraction with runtime-configurable providers, Docker Compose for local development, a comprehensive `.env.example`, and Celery for async processing. Key gaps are the missing Docker `USER` directive, no IaC, no load balancer config in the repository, and no feature flag mechanism. The stateless design is mostly achieved through external Supabase DB.

---

## Results

### ✅ PASS (8 items)

| Check ID | Item | Evidence |
|----------|------|----------|
| FLX-003 | Environment-based configuration | `settings.py:15–22` validates required env vars at startup; `.env.example` documents all variables |
| FLX-005 | Stateless application design | No local file writes for shared state; sessions in Redis; uploads to DB; external Supabase DB |
| FLX-007 | Database scalability | `conn_max_age=600` in `settings.py:140`; pgvector + PostgreSQL with Supabase managed pooling |
| FLX-008 | Async task queue | Celery 5.4.0 with Redis broker; extraction/generation/report tasks dispatched asynchronously |
| FLX-011 | Plugin/extension | Django middleware chain; Django signals available; app separation enables modular extension |
| FLX-013 | Setup documentation | `README.md`: Prerequisites, Environment Variables, Quick Start sections with docker compose commands |
| FLX-017 | LLM provider abstraction | `ner/services/provider_runtime.py`: `_call_provider` wraps all providers; runtime provider selection via `NER_PROVIDER_MODEL_ALLOWLIST` |
| FLX-018 | Model configuration flexibility | `NER_DEFAULT_PROVIDER`, `NER_DEFAULT_MODEL`, `NER_PROVIDER_MODEL_ALLOWLIST` all env-configurable in `settings.py` |

### ⚠️ PARTIAL (5 items)

| Check ID | Item | What Passes | What's Missing | Severity |
|----------|------|-------------|----------------|----------|
| FLX-001 | Containerization | `Dockerfile` uses `python:3.11-slim`; `.dockerignore` exists | Single-stage build (not multi-stage); no `USER` directive (runs as root) | high |
| FLX-002 | Docker Compose | `docker-compose.yml` with all services (app, worker, redis, frontend) | No `docker-compose.prod.yml` or `docker-compose.override.yml` for dev vs prod separation | medium |
| FLX-004 | Multi-environment support | Dev settings via DEBUG env var; SECURE_SSL_REDIRECT/HSTS auto-switch | No separate production docker-compose; no staging configuration | high |
| FLX-006 | Horizontal scaling | Stateless design; Celery workers scale independently | No distributed lock for cron/periodic tasks; migrations run on every instance start | high |
| FLX-014 | Dependency abstraction | LLM providers abstracted via `_call_provider`; good separation | File storage (PDFs) stored in DB as text only — no object storage abstraction | medium |

### ❌ FAIL (4 items)

| Check ID | Item | Evidence | Severity | Priority |
|----------|------|----------|----------|----------|
| FLX-009 | Load balancer configuration | No nginx config in repository; no Kubernetes manifests | medium | P2 |
| FLX-010 | Feature flags | No feature flag mechanism found | low | P3 |
| FLX-015 | Infrastructure as Code | No Terraform, Pulumi, or CloudFormation files found | medium | P2 |
| FLX-016 | CI/CD pipeline portability | No CI/CD pipeline | low | P3 |

### 🔍 N/A (1 item)

| Check ID | Item | Reason |
|----------|------|--------|
| FLX-012 | API contract stability | API versioned at v1 but no formal OpenAPI spec — assessed under Compatibility |

---

## Remediation Roadmap

### P2 — Important

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| FLX-001 | Multi-stage Dockerfile | Add `builder` stage for pip install; `runtime` stage copies only artifacts; add USER | Short |
| FLX-004 | Production compose | Create `docker-compose.prod.yml` with nginx, production env overrides, no volume mounts | Medium |
| FLX-006 | Horizontal scaling | Add distributed migration lock in entrypoint; document single-worker Celery limitation | Short |
| FLX-009 | Load balancer | Add nginx service to `docker-compose.prod.yml` with SSL termination and rate limiting | Medium |

### P3 — Improvements

| Check ID | Item | Fix Summary | Effort |
|----------|------|------------|--------|
| FLX-010 | Feature flags | Use env vars as lightweight feature flags; document in `.env.example` | Quick win |
| FLX-015 | IaC | Create Terraform module for Supabase + Docker host provisioning | Large |
| FLX-016 | CI/CD | Add GitHub Actions for build + push + deploy | Medium |

---

## Acceptance Criteria

- [ ] Quality attribute score ≥ 50% — currently 61.8% ✅
- [ ] FLX-001 Dockerfile multi-stage + USER added (security + flexibility win)
