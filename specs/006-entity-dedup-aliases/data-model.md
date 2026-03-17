# Data Model — US-06

## 1) Entity (extended existing model)

### Added/Updated Fields
- `normalized_name` (string, indexed)
- `needs_review` (boolean, default false)
- `parent_entity` (nullable FK to `Entity`)
- `mention_count_dedup` (integer, default 0)

### Rules
- Canonical uniqueness comparison key: `normalized_name + entity_type`.
- Cross-type merge forbidden.
- Phase variants may link to same `parent_entity` but stay distinct canonical rows.

---

## 2) EntityAlias (new)

### Fields
- `id` (UUID, PK)
- `entity` (FK to canonical `Entity`, cascade delete)
- `alias_text` (string, required)
- `normalized_alias` (string, indexed)
- `source` (enum: `extraction|manual|acronym`)
- `created_at` (datetime)
- `updated_at` (datetime)

### Rules
- Unique per canonical entity and normalized alias.
- Idempotent alias creation.

---

## 3) AcronymMap (new)

### Fields
- `id` (UUID, PK)
- `acronym` (string, unique case-insensitive)
- `expansion` (string, required)
- `active` (boolean, default true)
- `priority` (integer, default 0)
- `created_at` (datetime)
- `updated_at` (datetime)

### Rules
- Seed defaults include UN/development acronyms (UNDP, WHO, SDG, UNICEF, FAO, etc.).
- Multiple expansions can exist with deterministic priority ordering.

---

## 4) EntityReviewCandidate (new)

### Fields
- `id` (UUID, PK)
- `document` (FK)
- `left_entity` (FK to `Entity`)
- `right_entity` (FK to `Entity`)
- `entity_type` (string)
- `similarity_score` (float)
- `status` (enum: `pending|merged|kept_separate|resolved_stale`)
- `resolved_by` (nullable user FK)
- `resolved_at` (nullable datetime)
- `created_at` (datetime)

### Rules
- Only same-type pairs are valid.
- One active pending candidate per entity pair per document.
- Resolved pairs no longer appear in review banner.

---

## 5) Derived/Response Shape (existing entity endpoints)

Entity payload additions:
- `aliases: string[]`
- `parent_entity: { id, canonical_name } | null`
- `needs_review: boolean`
- `mention_count_dedup: number`

Review payload:
- `candidate_id`
- `left_entity`
- `right_entity`
- `similarity_score`
- `actions: [merge, keep_separate]`
