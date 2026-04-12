# Phase 1 Data Model — US-016

## 1) Document extraction tracking (existing `Document` extended)

Purpose: support incremental extraction and explicit per-document re-extraction.

Fields (new/additive):
- extracted_at: datetime, nullable
- cleaned_text: text, blank/default empty
- raw_text: text, blank/default empty (if not already represented by source content field)

Rules:
- `extracted_at == null` means not yet extracted (eligible for default extraction run).
- `extracted_at != null` means extracted (excluded from default extraction run).
- Re-extract action resets `extracted_at` for the selected document only.

State transitions:
- not_extracted -> extracting -> extracted
- extracting -> failed
- extracted -> extracting (only via explicit re-extract)

## 2) Entity mention provenance (`EntityMention`)

Purpose: document-level evidence integrity and review/edit/delete semantics.

Fields:
- id: UUID
- entity_id: FK -> Entity (required)
- document_id: FK -> Document (required)
- chunk_id: FK -> Chunk (nullable for legacy/backfill cases)
- excerpt: text (cleaned evidence sentence/snippet)
- confidence_score: float (optional per mention)
- created_at: datetime

Rules:
- Every persisted entity in project scope must have >= 1 related mention.
- Mention excerpts must be sourced from cleaned text.
- Deleting a mention can cascade to deleting orphaned entity if it has no remaining mentions.

## 3) Relationship provenance (existing `Relation` extended)

Purpose: document-scoped relationship review/corrections.

Fields (new/additive):
- source_document_id: FK -> Document, nullable (nullable only when relationship evidence spans multiple chunks/documents)
- excerpt: text (cleaned supporting statement/snippet)

Rules:
- Relationship rows returned by document review should resolve to one source document where possible.
- Relationship edit updates label/type without losing provenance metadata.

## 4) Document review projection (read model)

Entity row projection:
- entity_id
- canonical_name
- entity_type
- confidence_score
- mention_count_in_doc
- excerpt

Relationship row projection:
- rel_id
- source_entity_name
- relationship_type
- target_entity_name
- confidence
- excerpt

Rules:
- Values are computed from persisted mention/relation provenance, not inferred from global aggregates.

## 5) Graph integrity constraint (project-scoped)

Purpose: enforce no orphan entities in project graph.

Rule:
- Graph API query must include only entities with >=1 `EntityMention` in the same project/document scope.

Cleanup:
- One-time orphan cleanup command removes project entities without mention evidence.

## 6) Entity contextual summary cache metadata (existing summary model behavior)

Purpose: ensure summary validity after relationship/evidence changes.

Behavioral state:
- valid -> invalidated when relationships or supporting evidence change
- regenerate only when evidence threshold met (>=2 cleaned excerpts and >=2 relationships)

## 7) Mini-graph view model (frontend derived)

Purpose: in-page 1-hop visualization on entity detail.

Derived structure:
- central node: selected entity
- neighbor nodes: direct relationship endpoints
- edges: relationship labels and directionality

Rules:
- Uses existing entity-detail relationship payload.
- No persistence required.
