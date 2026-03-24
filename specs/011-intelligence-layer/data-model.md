# Data Model: Intelligence Layer (011)

**Branch**: `011-intelligence-layer` | **Date**: 2026-03-24

This document describes all data model changes required for this feature. Changes are minimal — two migrations extend existing models; no new models are introduced.

---

## Schema Changes

### 1. Entity — new `is_flagged` field

**Model**: `ner.Entity` (`ner_entity` table)
**Migration**: `ner/migrations/0xxx_entity_is_flagged.py`

```
Field added:
  is_flagged: BooleanField(default=False, db_index=True)
```

**Semantics**: Set to `True` by a user explicitly rejecting an extracted entity as incorrect or irrelevant. Flagged entities are excluded from:
- Graph API responses (`GET /api/v1/projects/{id}/graph/`)
- Future extraction output for the source document (skip if `is_flagged=True`)
- Entity list views

**Distinct from `needs_review`**: `needs_review` is set by the dedup algorithm (system-generated). `is_flagged` is set by the user (user-generated feedback). Both can be true simultaneously without conflict.

**Backwards compatibility**: Defaults to `False` — all existing entities are unaffected.

---

### 2. Project — new `provider` and `model` fields

**Model**: `ingestion.Project` (`projects` table)
**Migration**: `ingestion/migrations/0xxx_project_provider_model.py`

```
Fields added:
  provider: CharField(max_length=32, blank=True, default='')
  model:    CharField(max_length=64, blank=True, default='')
```

**Semantics**: Stores the project owner's preferred LLM provider and model. Empty string means "use the global `LLM_PROVIDER` environment variable". Valid non-empty values: `groq`, `openai`, `azure_openai`, `gemini`.

**All LLM call sites** (extraction, summary, NL query) read `project.provider or settings.LLM_PROVIDER` to resolve the active provider at call time.

**Backwards compatibility**: Both fields default to `''` — existing projects fall back to the global env var with no change in behavior.

---

## Existing Models Used (No Schema Changes)

### Chunk (`ingestion_chunks`)

Key fields used for semantic search and timeline:
- `id` (UUID PK)
- `document` (FK → Document)
- `text` (TextField) — used for timeline context snippets and NL query RAG
- `embedding` (VectorField 384) — used for cosine similarity search
- `chunk_index` (int) — ordering within document

**Query pattern for semantic search**:
```
Chunk.objects.filter(document__project=project)
  .annotate(distance=CosineDistance('embedding', query_vector))
  .order_by('distance')[:top_k]
```

### EntityReviewCandidate (`ner_entity_review_candidate`)

Existing fields relevant to the review queue UI:
- `left_entity` / `right_entity` (FK → Entity)
- `similarity_score` (float 0.0–1.0)
- `status` — `pending` | `merged` | `kept_separate` | `resolved_stale`
- `document` (FK → Document, used to scope by project via `document__project`)
- `resolved_by` / `resolved_at` — set on resolution

**New API surface**: `GET /api/v1/projects/{id}/review/` and `POST /api/v1/review-candidates/{id}/resolve/` — no model changes.

### ContextualEntitySummary (`ner_contextual_entity_summary`)

Existing fields:
- `entity` / `project` (FK, unique together)
- `summary_text` (TextField) — will be populated by LLM RAG (replacing template string)
- `evidence_hash` (CharField 128) — SHA256 of entity+project+relation IDs; drives cache invalidation
- `generated_by_provider` (CharField) — will now store the provider name used (e.g. `groq`)
- `expires_at` (DateTimeField) — 24h TTL, unchanged

**Change**: `_generate_summary_text()` is replaced; the cache/TTL/hash logic is preserved unchanged.

### NERRun (`ner_run`)

Existing fields used for per-document stats:
- `document_id` (FK → Document)
- `status` (`completed` | `pending` | `failed`)
- `relations_created` (int, nullable)
- `provider` / `model` — for per-document stats display

### Entity (`ner_entity`)

Existing fields used for global entity view:
- `project` (FK → Project)
- `document_id` (FK → Document)
- `canonical_name`, `entity_type`, `confidence`

---

## Relationship Map (affected paths)

```
Project ──────────────────────── [+provider, +model]
  │
  ├── Document
  │     ├── Chunk ──────────────── [embedding: used for semantic search & timeline]
  │     ├── NERRun ──────────────── [relations_created: used for per-doc stats]
  │     └── EntityReviewCandidate  [existing: used for dedup review queue]
  │
  └── Entity ─────────────────── [+is_flagged]
        ├── EntityAlias
        ├── Relation
        └── ContextualEntitySummary [existing cache: LLM output replaces template]
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `Entity.is_flagged` | Boolean; only settable via authenticated user action; not set by extraction pipeline |
| `Project.provider` | Must be one of `''`, `groq`, `openai`, `azure_openai`, `gemini` when non-empty; validated in serializer |
| `Project.model` | Max 64 chars; validated against provider-specific allowlist in serializer |
| `EntityReviewCandidate.status` transition | `pending → merged` or `pending → kept_separate` only; no other transitions allowed via API |
