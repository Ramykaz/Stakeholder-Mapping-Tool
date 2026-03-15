# Data Model: Entity + Relation Extraction with Graph Integration

**Branch**: `004-entity-relation-extraction` | **Date**: 2026-03-15
**Phase**: 1 — Design

---

## Entities

### Relation (NEW)

Represents a directional, labeled relationship between two named entities extracted from a document.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, auto-generated | Stable identifier for the relation |
| `document_id` | UUID | NOT NULL, FK → Document(id) ON DELETE CASCADE | Links relation to its source document |
| `run_id` | UUID | NOT NULL, FK → NERRun(id) ON DELETE CASCADE | Ties relation to the specific extraction run |
| `source_entity_id` | UUID | NOT NULL, FK → Entity(id) ON DELETE CASCADE | The first entity in the triplet (subject) |
| `target_entity_id` | UUID | NOT NULL, FK → Entity(id) ON DELETE CASCADE | The second entity in the triplet (object) |
| `label` | VARCHAR(100) | NOT NULL | The relation type/phrase (e.g., "REPORTS_TO", "PARTNERS_WITH") |
| `confidence` | FLOAT | NOT NULL, CHECK (0.0 ≤ confidence ≤ 1.0) | LLM-assigned confidence for this relation |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp of relation creation |

**Uniqueness**: `(document_id, source_entity_id, LOWER(TRIM(label)), target_entity_id)` must be unique — prevents duplicate relations from multiple chunks. Case-insensitive label matching for deduplication.

**Validation**: `source_entity_id ≠ target_entity_id` (enforced by CHECK constraint) — no self-loops allowed.

---

### NERRun (UPDATED)

Extended to track relations_created count for runs that include relation extraction.

**New Field**:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `relations_created` | INTEGER | NULLABLE, DEFAULT NULL | Count of relations extracted in this run; NULL for entity-only runs |

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `relations_created` | INTEGER | NULLABLE, DEFAULT NULL | Count of relations extracted in this run; NULL for entity-only runs |

**Existing fields remain unchanged**: id, document_id, provider, model, status, tokens_input, tokens_output, tokens_cached, cost_usd, duration_seconds, created_at.

**Semantics**:
- `relations_created = NULL` → entity-only run (existing `/extract-entities/` endpoint)
- `relations_created = 0` → entity+relation run that found no valid relations
- `relations_created > 0` → entity+relation run with successfully extracted relations

---

### Entity (UNCHANGED)

No schema changes. Relations reference existing Entity records via FKs.

---

### Document (UNCHANGED)

No schema changes. Relations reference documents for CASCADE cleanup.

---

## Relationships

```
Document  1 ──────────────────── N  Entity
          1 ──────────────────── N  Relation

NERRun    1 ──────────────────── N  Entity
          1 ──────────────────── N  Relation

Entity    1 ──────────────────── N  Relation (as source_entity)
          1 ──────────────────── N  Relation (as target_entity)
```

### Cascade Behavior

- Deleting a **Document** cascades to all its Entities, Relations, and NERRuns
- Deleting an **Entity** cascades to all Relations where it is source or target
- Deleting a **NERRun** cascades to all its Entities and Relations
- Re-running extraction deletes all Relations (and Entities) for the document before persisting new results

---

## State Transitions — Relation Lifecycle

```
extraction triggered
        ↓
  entities extracted
        ↓
relations extracted ────→ valid triplets ────→ deduplicated ────→ persisted
        ↓
  invalid triplets
(source=target or
 entity not found)
        ↓
    discarded
```

| Transition | Trigger | Side Effects |
|------------|---------|--------------|
| Extraction begins | POST /extract-entities-relations/ called | Existing relations for document deleted; NERRun created with status=PENDING, relations_created=NULL |
| Entities extracted | Entity extraction completes successfully | Entity records persisted; entity-level deduplication applied |
| Relations extracted | Relation extraction completes successfully | Relation records validated, deduplicated, and bulk-created; NERRun.relations_created set |
| Run completes | All processing succeeds | NERRun status → COMPLETED; tokens/cost/duration updated |
| Run fails | Any error during extraction | NERRun status → FAILED; full transaction rollback; no partial Entities or Relations persist |

**Validation Gates** (before a relation is persisted):
1. `source_entity_id` and `target_entity_id` must both reference Entity records in the same document
2. `source_entity_id ≠ target_entity_id` (no self-loops)
3. Confidence must be in [0.0, 1.0]
4. Label must be non-empty and ≤100 characters

Relations failing any gate are discarded (logged but not persisted).

---

## Database Indexes

### Relation Indexes

```sql
-- Deduplication + uniqueness enforcement
CREATE UNIQUE INDEX relations_dedup_idx
  ON relations (document_id, source_entity_id, LOWER(TRIM(label)), target_entity_id);

-- Query performance (find all relations for a document)
CREATE INDEX relations_document_id_idx
  ON relations (document_id);

-- Query performance (find all relations where entity X is source)
CREATE INDEX relations_source_entity_idx
  ON relations (source_entity_id);

-- Query performance (find all relations where entity X is target)
CREATE INDEX relations_target_entity_idx
  ON relations (target_entity_id);

-- Run linkage (find all relations from a specific extraction run)
CREATE INDEX relations_run_id_idx
  ON relations (run_id);
```

**Dedup index rationale**: The unique index on (document, source, normalized_label, target) enforces that the same triplet cannot be inserted twice, even if multiple chunks extract it. Using `LOWER(TRIM(label))` in the index expression handles case and whitespace variations ("REPORTS TO" vs "reports to" vs "  Reports To  ") as duplicates.

---

## Django App Ownership

| Model | Django App | Changes |
|-------|-----------|---------|
| `Relation` | `ner` | NEW |
| `NERRun` | `ner` | UPDATED (add relations_created field) |
| `Entity` | `ner` | UNCHANGED |
| `Document` | `ingestion` | UNCHANGED |
| `Chunk` | `ingestion` | UNCHANGED |

---

## Migration Plan

**Migration file**: `ner/migrations/0006_add_relations.py`

**Operations**:
1. Add `relations_created` field to `ner_run` table (nullable INTEGER DEFAULT NULL)
2. Create `relations` table with all fields and constraints
3. Create indexes on relations table (document_id, source_entity_id, target_entity_id, run_id, dedup)
4. Add CHECK constraint `source_entity_id != target_entity_id`
5. Add foreign keys with CASCADE deletes

**Rollback**: All operations are additive; rollback is safe (no existing data affected).

---

## Example Data

### After entity+relation extraction on a document

**Entities**:
| id | canonical_name | entity_type | confidence |
|----|----------------|-------------|------------|
| e1 | Sarah Chen | PERSON | 0.92 |
| e2 | Apex Corp | ORGANIZATION | 0.88 |
| e3 | Ministry of Agriculture | ORGANIZATION | 0.85 |

**Relations**:
| id | source_entity_id | target_entity_id | label | confidence |
|----|------------------|------------------|-------|------------|
| r1 | e1 | e2 | REPORTS_TO | 0.87 |
| r2 | e2 | e3 | PARTNERS_WITH | 0.79 |

**NERRun**:
| entities_created | relations_created | provider | model | status |
|------------------|-------------------|----------|-------|--------|
| 3 | 2 | openai | gpt-4o-mini | completed |

**Graph Representation** (Cytoscape nodes + edges):
```javascript
{
  nodes: [
    { data: { id: 'e1', label: 'Sarah Chen', shape: 'ellipse', confidence: 0.92 } },
    { data: { id: 'e2', label: 'Apex Corp', shape: 'rectangle', confidence: 0.88 } },
    { data: { id: 'e3', label: 'Ministry of Agriculture', shape: 'rectangle', confidence: 0.85 } },
  ],
  edges: [
    { data: { id: 'r1', source: 'e1', target: 'e2', label: 'REPORTS_TO', confidence: 0.87 } },
    { data: { id: 'r2', source: 'e2', target: 'e3', label: 'PARTNERS_WITH', confidence: 0.79 } },
  ]
}
```
