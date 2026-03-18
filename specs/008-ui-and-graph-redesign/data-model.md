# Data Model — US-08

## 1) Entity Profile (existing read model, extended behavior)

### Purpose
Cross-project canonical stakeholder representation for side panel and global lookup.

### Core Fields
- `id` (UUID)
- `canonical_name` (string, required)
- `entity_type` (enum/string, required)
- `aliases` (array[string])
- `projects` (array of project memberships, access-scoped)
- `relationships` (array of relationship summaries, access-scoped)

### Validation / Rules
- Returned memberships MUST include only projects requester can access.
- Relationship list MUST be constrained to authorized project scope.
- Empty aliases/relationships are valid and must not error.

---

## 2) Project Membership (existing relation concept, read projection)

### Fields
- `project_id` (UUID)
- `project_name` (string)
- `role_hint` (optional string)
- `first_seen_at` (datetime, optional)
- `last_seen_at` (datetime, optional)

### Validation / Rules
- Membership emitted only if entity appears in project-scoped evidence.
- Unauthorized projects are omitted entirely (not masked placeholders).

---

## 3) Relationship Evidence (existing relation model, read projection)

### Fields
- `relation_id` (UUID)
- `source_entity_id` (UUID)
- `target_entity_id` (UUID)
- `relation_type` (string)
- `confidence` (float 0.0–1.0)
- `direction` (enum: `directed|undirected`)
- `supporting_excerpts` (array[string])
- `project_id` (UUID)

### Validation / Rules
- `confidence` drives edge thickness mapping in bounded display range.
- Evidence excerpts may be empty; UI must still render relation row.
- Only authorized project evidence is returned.

---

## 4) Entity Label Style (existing configuration entity)

### Fields
- `entity_type` (string, unique in active config)
- `shape` (string)
- `color` (string token/value)
- `is_active` (boolean)

### Validation / Rules
- If style metadata is missing, fallback style must be applied deterministically.
- Active config only is used for graph rendering.

---

## 5) Contextual Entity Summary (new persisted cache model)

### Proposed Fields
- `id` (UUID, PK)
- `entity` (FK to canonical entity)
- `project` (FK to project)
- `summary_text` (text)
- `evidence_hash` (string, optional)
- `generated_by_provider` (string)
- `generated_at` (datetime)
- `expires_at` (datetime)

### Validation / Rules
- Unique key: (`entity_id`, `project_id`) for active cached record.
- TTL: `expires_at = generated_at + 24h`.
- Manual refresh bypasses cache and replaces stored summary.
- Summary generation request times out at 8 seconds and returns fallback payload if incomplete.

### State Transitions
- `missing` → `ready` (successful generation)
- `ready` → `ready` (manual refresh regeneration)
- `ready` → `expired` (time-based TTL)
- `missing|expired` → `fallback` (timeout/provider failure response path; no blocking UI)

---

## 6) Graph View State (frontend transient model)

### Fields
- `active_entity_types` (set[string])
- `active_relation_types` (set[string])
- `focus_anchor_node_id` (UUID | null)
- `focus_radius_hops` (int, fixed = 2)
- `search_term` (string)
- `panel_entity_history` (array[UUID])

### Validation / Rules
- Focus computation uses currently filtered visible graph only.
- Background click clears focus and restores filtered baseline state.
- Search highlights/centers matching visible nodes without server refetch.
