# Research: Entity + Relation Extraction with Graph Integration

**Branch**: `004-entity-relation-extraction` | **Date**: 2026-03-15
**Phase**: 0 — Unknowns resolved before design

---

## Topic 1: Relation Extraction Prompting Strategy for LLMs

### Decision 1.1 — Single-Pass vs Two-Pass Extraction
**Decision**: Two-pass extraction (entities first, then relations referencing extracted entities)

**Rationale**: The two-pass approach ensures relation triplets only reference entities that actually exist in the entity store. The first pass produces a stable entity set with canonical names; the second pass receives this list and must only emit (entity1, label, entity2) triplets where both entity1 and entity2 appear in the provided list. This prevents dangling references and simplifies validation.

**Alternatives considered**:
- Single-pass (extract entities + relations in one LLM call): Higher risk of mismatched entity names between the entity extraction and relation ends; requires complex post-hoc entity name matching; increases prompt complexity
- Three-pass (entities → deduplicate → relations): Adds deduplication latency between extraction phases; minimal accuracy gain for the added complexity

### Decision 1.2 — Relation Extraction Scope (Per-Chunk vs Document-Wide)
**Decision**: Per-chunk relation extraction with cross-chunk deduplication

**Rationale**: Reuses the existing chunking infrastructure from document ingestion. Each chunk is processed independently for relation extraction (same pattern as entity extraction), and relations are deduplicated after all chunks are processed. This maintains consistency with the existing pipeline architecture and avoids loading entire documents into LLM context (which would exceed context windows for long documents).

**Alternatives considered**:
- Document-wide extraction (send full document text): Exceeds LLM context limits for policy documents; defeats the purpose of chunking
- Window-based extraction (overlapping windows of entities): More complex; minimal accuracy improvement for stakeholder analysis use case

### Decision 1.3 — Relation Label Vocabulary (Controlled vs Free-Form)
**Decision**: Guided free-form labels with uppercase normalization

**Rationale**: A controlled vocabulary (e.g., EMPLOYS, REPORTS_TO, LOCATED_IN) would improve consistency but requires domain-specific ontology design upfront, which is out of scope for MVP. Instead, the prompt instructs the model to use short, meaningful, uppercase labels (1-3 words) and provides 6-8 examples. Deduplication normalizes labels by lowercasing and trimming whitespace, giving near-controlled consistency without rigid constraints.

**Alternatives considered**:
- Strict controlled vocabulary (15-20 predefined relations): Requires ontology design; limits discovery of domain-specific relations that weren't anticipated
- Fully unconstrained labels: Produces inconsistent labels ("works for" vs "employed by" vs "employed_at"), making deduplication and visualization noisy

### Decision 1.4 — Relation Confidence Scoring
**Decision**: LLM-returned confidence + validation boost/penalty

**Rationale**: The LLM is prompted to return a confidence score (0.0–1.0) for each relation triplet based on textual evidence strength. Relations where both entities have ≥0.7 entity confidence get a +0.05 boost; relations with dangling references or same-source-and-target get discarded (confidence = 0). This mirrors the entity extraction confidence model and provides interpretable scores for filtering.

**Alternatives considered**:
- Binary confidence (relation exists or doesn't): Loses granularity; no ability to filter low-quality relations
- Entity confidence average: Ignores relation-specific evidence; two high-confidence entities may have a weak relationship assertion

---

## Topic 2: Relation Deduplication Strategy

### Decision 2.1 — Deduplication Key
**Decision**: (source_entity_id, normalized_label, target_entity_id) as composite key

**Rationale**: The composite key uniquely identifies a directional relation. `normalized_label` is the lowercase, whitespace-trimmed version of the original label (e.g., "REPORTS TO" → "reports to"). If two chunks both extract ("Sarah Chen", "reports to", "Apex Corp"), only one relation record is created. The highest-confidence instance wins.

**Alternatives considered**:
- Unordered pair (entity1, entity2): Loses directionality; "Sarah reports to Apex" becomes indistinguishable from "Apex reports to Sarah"
- Include chunk_id in key: Prevents deduplication across chunks; same relation extracted from 3 chunks creates 3 duplicate records

### Decision 2.2 — Label Normalization Depth
**Decision**: Shallow normalization (lowercase + trim) only; no synonym resolution

**Rationale**: Synonym resolution ("employed by" → "works for") requires either an ontology or semantic similarity, both of which add significant complexity for marginal gain at MVP scale. Shallow normalization handles case and whitespace inconsistencies, removing the bulk of duplicates. Synonym resolution is deferred to post-MVP if user feedback indicates it's needed.

**Alternatives considered**:
- Semantic label matching (embed labels, cluster by similarity): High complexity; requires training or loading a sentence model just for label matching; premature optimization
- Manual synonym dictionary (10-15 common mappings): Requires manual curation; incomplete coverage; easier to add post-MVP if specific cases emerge

### Decision 2.3 — Conflict Resolution (Multiple Confidences for Same Triplet)
**Decision**: Retain highest-confidence instance; discard others

**Rationale**: If ("Sarah Chen", "reports to", "Apex Corp") appears in chunk 1 with confidence 0.8 and chunk 3 with confidence 0.6, keep the 0.8 instance. The higher confidence indicates stronger textual evidence. This is consistent with entity deduplication behavior.

**Alternatives considered**:
- Average confidence across duplicates: Lower confidence if one chunk has weak evidence; doesn't reflect the fact that the relation was strongly evidenced at least once
- Merge raw mentions (list all chunk IDs): Adds complexity; not currently surfaced in the UI; YAGNI

---

## Topic 3: Graph Rendering — Node Shapes + Edge Labels

### Decision 3.1 — Node Shape Mapping
**Decision**: Fixed shape-per-type mapping using Cytoscape.js built-in shapes

```javascript
const SHAPE_MAP = {
  'PERSON': 'ellipse',
  'ORGANIZATION': 'rectangle',
  'LOCATION': 'diamond',
  'ROLE': 'hexagon',
};
```

**Rationale**: Cytoscape.js supports these shapes natively without custom rendering. The mapping is semantically intuitive (people = organic ellipse, organizations = structured rectangle, locations = distinctive diamond, roles = badge-like hexagon). Users can distinguish entity types at a glance without reading labels.

**Alternatives considered**:
- Custom SVG shapes: Requires additional rendering logic; increases complexity; minimal visual benefit over built-ins
- Color-only differentiation: Less effective than shape for colorblind users; shape + color provides redundant encoding (accessibility best practice)

### Decision 3.2 — Edge Label Positioning
**Decision**: Cytoscape.js edge label with `'text-rotation': 'autorotate'` and `'text-margin-y': -10`

**Rationale**: Edge labels follow the edge angle and sit slightly above the edge line, keeping them readable even for diagonal edges. The `autorotate` ensures labels don't appear upside-down. This is a Cytoscape built-in capability requiring only stylesheet configuration.

**Alternatives considered**:
- Fixed horizontal labels: Readable only on horizontal edges; rotated edges have illegible labels
- No labels (tooltip only): Forces user to hover/click every edge; reduces visual information density; fails the "meaningful at a glance" criterion

### Decision 3.3 — Edge Directionality Rendering
**Decision**: `'target-arrow-shape': 'triangle'` in Cytoscape stylesheet

**Rationale**: Arrows visually encode direction. "Sarah Chen → reports to → Apex Corp" has the arrow pointing toward Apex Corp, indicating Sarah is the subordinate. This is standard graph notation and requires no additional code beyond the stylesheet.

**Alternatives considered**:
- Undirected edges (no arrows): Loses directional semantics; "reports to" vs "supervises" become indistinguishable
- Bidirectional arrows: Only meaningful if the relation is symmetric, which most stakeholder relations are not

---

## Topic 4: API Contract — Extending vs New Endpoint

### Decision 4.1 — Extraction Endpoint Design
**Decision**: New endpoint POST `/api/v1/documents/{id}/extract-entities-relations/` alongside existing POST `/api/v1/documents/{id}/extract-entities/`

**Rationale**: The two endpoints serve distinct use cases (entity-only vs entity+relation extraction). Keeping them separate avoids bloating the existing endpoint with optional parameters and preserves backward compatibility. Callers explicitly choose the extraction mode.

**Alternatives considered**:
- Single endpoint with `?mode=entities_only|entities_relations` query param: Clutters the existing endpoint; requires conditional logic throughout the pipeline; violates single-responsibility
- Extend existing endpoint with `include_relations=true` body param: Same issues; plus it's a breaking change if `include_relations` becomes required in the future

### Decision 4.2 — Graph Endpoint Extension
**Decision**: Extend existing GET `/api/v1/graph/?document_id={id}` to include an `edges` array when relations exist

**Rationale**: The graph endpoint already returns nodes; adding edges maintains semantic cohesion. The response structure becomes `{ nodes: [...], edges: [...] }`. If no relations exist for the document, `edges` is an empty array, maintaining backward compatibility with entity-only documents.

**Alternatives considered**:
- New endpoint `/api/v1/graph/edges/?document_id={id}`: Forces frontend to make two calls for a single graph; doubles network round-trips; creates split-brain behavior if one call succeeds and the other fails

---

## Topic 5: Relation Storage — New Table vs JSON in Entity

### Decision 5.1 — Storage Structure
**Decision**: New `relations` table with FKs to `entities`

**Rationale**: Relations are first-class entities with their own lifecycle (created, deleted, queried independently). A dedicated table supports efficient querying ("all relations where source_entity = X"), indexing by entity FKs, and straightforward CASCADE deletion when entities are deleted. Storing as JSON in the entity table would require expensive JSON parsing and makes foreign key relationships impossible.

**Alternatives considered**:
- JSON array in Entity table: No referential integrity; can't query "all relations involving entity X" without full table scan; can't cascade delete when entities are removed
- Graph database (Neo4j, etc.): Over-engineered for MVP; adds operational complexity; PostgreSQL with FKs is sufficient

### Decision 5.2 — Relation Table Schema
**Decision**:

```sql
CREATE TABLE relations (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES ner_run(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT different_entities CHECK (source_entity_id != target_entity_id)
);

CREATE INDEX relations_document_id_idx ON relations(document_id);
CREATE INDEX relations_source_entity_idx ON relations(source_entity_id);
CREATE INDEX relations_target_entity_idx ON relations(target_entity_id);
CREATE UNIQUE INDEX relations_dedup_idx ON relations(document_id, source_entity_id, LOWER(TRIM(label)), target_entity_id);
```

**Rationale**:
- `run_id` ties each relation to the extraction run that produced it (same pattern as entities)
- CASCADE on all FKs ensures orphaned relations are cleaned up when documents, runs, or entities are deleted
- `different_entities` CHECK constraint enforces no self-loops at the database level
- Unique index on (document, source, normalized_label, target) enforces deduplication declaratively
- Indexes on entity FKs enable fast "find all relations involving entity X" queries

**Alternatives considered**:
- No CHECK constraint on different_entities: Allows invalid self-loops; must validate in application code, which is error-prone
- No unique index: Deduplication must happen in Python; database can accumulate duplicates if service logic has bugs; index enforces data integrity

---

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|-----------|
| Extraction approach | Two-pass: entities first, then relations referencing extracted entities |
| Relation scope | Per-chunk extraction with cross-chunk deduplication |
| Label vocabulary | Guided free-form with uppercase, 1-3 words, normalized for deduplication |
| Confidence scoring | LLM-returned + validation boost; highest of duplicates retained |
| Deduplication key | (source_entity_id, normalized_label, target_entity_id) |
| Node shapes | Fixed map — PERSON=ellipse, ORGANIZATION=rectangle, LOCATION=diamond, ROLE=hexagon |
| Edge labels | Cytoscape autorotate labels, triangle arrow for direction |
| API approach | New extraction endpoint; extend existing graph endpoint with edges array |
| Storage | New `relations` table with FKs, CASCADE deletes, unique dedup index |
