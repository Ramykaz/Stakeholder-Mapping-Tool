# Data Model — US-05

## 1) EntityLabel

Represents a configurable entity classification category passed to LLM extraction.

### Fields
- `id` (UUID, PK)
- `name` (string, required, unique case-insensitive)
- `description` (text, optional)
- `node_shape` (string, required)
- `color` (string, required)
- `active` (boolean, default `true`)
- `display_order` (integer, required, default incremental)
- `created_at` (datetime)
- `updated_at` (datetime)

### Validation Rules
- `name` must be unique case-insensitive across all rows.
- `node_shape` must be from allowed shape set used by graph renderer.
- `color` must match accepted color token/format policy used in frontend.
- `display_order` must be non-negative.

### Lifecycle
- `active=true` → included in extraction input taxonomy.
- `active=false` → excluded from future extraction, retained for historical references.
- hard delete allowed only when no historical references exist.

---

## 2) RelationshipType

Represents a configurable relationship taxonomy item passed to LLM extraction.

### Fields
- `id` (UUID, PK)
- `name` (string, required, unique case-insensitive)
- `description` (text, optional)
- `directional` (boolean, default `true`)
- `color` (string, required)
- `active` (boolean, default `true`)
- `display_order` (integer, required, default incremental)
- `created_at` (datetime)
- `updated_at` (datetime)

### Validation Rules
- `name` must be unique case-insensitive.
- `display_order` must be non-negative.
- at least one `active=true` relationship type required for joint extraction to run.

### Lifecycle
- `active=true` → included in extraction input taxonomy.
- `active=false` → excluded from future extraction, historical references retained.
- hard delete blocked if referenced by historical extraction records.

---

## 3) ProviderExtractionRequest (service-level contract entity)

Normalized request shape sent to any provider implementation.

### Fields
- `chunk_text` (string, required)
- `concept_note` (string, nullable)
- `entity_labels` (array of strings, required, non-empty)
- `relationship_types` (array of objects `{name, directional}`, required, non-empty)
- `provider` (enum: `groq|openai|azure_openai|gemini`)
- `model` (string, required)

### Validation Rules
- must reject empty `entity_labels` or empty `relationship_types`.
- selected provider must be configured and credential-valid at runtime.

---

## 4) ProviderExtractionResult (service-level contract entity)

Normalized single-call response shape used by persistence pipeline.

### Fields
- `entities` (array)
  - `text` (string)
  - `label` (string from active EntityLabel set)
  - `confidence` (float 0..1, optional)
- `relationships` (array)
  - `source_text` (string)
  - `type` (string from active RelationshipType set)
  - `target_text` (string)
  - `confidence` (float 0..1, optional)

### Validation Rules
- relationship `source_text` and `target_text` must resolve to extracted entities for persistence.
- for relationship types with `directional=false`, `(source,target)` is canonicalized into sorted pair before dedup.
- unresolved relations are discarded.

---

## 5) Persistence Constraints on Existing Entities

This feature applies persistence rules to existing `Entity` and `Relation` records from prior specs.

### Constraints
- save only entities that participate in at least one saved relationship.
- for non-directional relationship types, persist one canonical relation record (A-B == B-A).
- maintain run linkage to existing `NERRun` records and usage/cost metadata.

---

## Seed Data

### EntityLabel defaults
1. Person
2. Organization
3. Location
4. Role
5. Event
6. Project

### RelationshipType defaults
1. funded
2. partnered
3. participated
4. implemented
5. mentored
6. organized
7. attended
8. advised
