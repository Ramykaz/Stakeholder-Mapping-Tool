# Phase 0 Research — US-07

## Decision 1: Place `Project` and `ConceptNote` in ingestion domain
- Decision: Add `Project` and `ConceptNote` models in `ingestion` app and reuse them across ingestion/NER modules.
- Rationale: `Document` already lives in ingestion; project ownership naturally anchors there and avoids cyclic model ownership.
- Alternatives considered:
  - New standalone `projects` app: rejected for sprint scope and migration overhead.
  - Place models in `ner`: rejected because project ownership starts at upload/document lifecycle.

## Decision 2: Migrate legacy documents via deterministic default project
- Decision: Migration creates (or reuses) one default project and assigns all existing documents with null project to it.
- Rationale: Guarantees no orphan records and preserves continuity for legacy data.
- Alternatives considered:
  - Force manual remapping: rejected due to operational risk and downtime.
  - Leave document.project null permanently: rejected because it breaks project-scoped guarantees.

## Decision 3: Extend entities and relationships with nullable project FK
- Decision: Add nullable project FKs to `Entity` and `Relation` and backfill from linked `Document` during migration.
- Rationale: Enables project-scoped queries and global profile rollups while preserving historical integrity.
- Alternatives considered:
  - Infer project at query time only via joins: rejected for complexity and performance overhead.
  - Non-null FK immediately: rejected due to transition constraints.

## Decision 4: Keep legacy endpoints alive during transition
- Decision: Preserve existing routes and behavior while adding project-scoped endpoints.
- Rationale: Constitution requires explicit contracts and non-breaking transitions for existing clients.
- Alternatives considered:
  - Hard switch to new routes only: rejected as breaking change.

## Decision 5: Concept note context passed through existing provider abstraction
- Decision: Inject project concept note text into extraction calls using existing US-05 provider interface path.
- Rationale: Reuses proven provider abstraction and keeps LLM context handling centralized.
- Alternatives considered:
  - Duplicate provider methods for project mode: rejected as DRY violation.
  - Prompt concatenation in view layer: rejected due to leaky architecture.

## Decision 6: Project dashboard metrics are aggregated server-side per project
- Decision: Return project cards with document/entity counts and update timestamp from backend API.
- Rationale: Keeps frontend simple and ensures one authoritative aggregation source.
- Alternatives considered:
  - Client-side fan-out queries per project: rejected for latency and inconsistency.

## Decision 7: Global entity profile returns project memberships
- Decision: Add `GET /api/v1/entities/{id}/` to include base entity data plus all related projects.
- Rationale: Required by US-07 and supports later side-panel/query specs.
- Alternatives considered:
  - Keep only project-scoped profile routes: rejected because cross-project visibility is explicit requirement.
