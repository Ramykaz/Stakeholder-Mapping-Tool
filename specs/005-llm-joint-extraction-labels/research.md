# Phase 0 Research — US-05

## Decision 1: Use one shared provider interface for joint extraction
- Decision: Define a single provider interface method that accepts `chunk_text`, nullable `concept_note`, active `entity_labels`, and active `relationship_types`, and returns one normalized JSON payload containing both entities and relationships.
- Rationale: Meets FR-001/FR-002/FR-003, removes two-pass orchestration complexity, and enforces identical invocation across Groq/OpenAI/Azure/Gemini.
- Alternatives considered:
  - Keep provider-specific method signatures: rejected because it duplicates orchestration and weakens contract consistency.
  - Keep two-pass extraction (entities then relations): rejected because US-05 explicitly requires one call per chunk and no orphan entities.

## Decision 2: Centralize retries, rate limiting, and cost tracking in abstraction layer
- Decision: Move/retain retry policy, 429 handling, and token-cost accounting in shared provider service wrappers used by all providers.
- Rationale: Preserves behavior from spec 003 while preventing provider drift and duplicated logic.
- Alternatives considered:
  - Reimplement retries per provider file: rejected due to DRY violations and inconsistent operational behavior risk.
  - Handle retries at view layer only: rejected because provider-specific API errors require provider-aware normalization.

## Decision 3: Add Azure OpenAI and Gemini as first-class providers
- Decision: Extend provider factory with `azure_openai` and `gemini` implementations conforming to shared interface; keep Azure slot selectable with endpoint/deployment readiness even if key is absent.
- Rationale: Required by FR-005/FR-006 and sprint requirements; keeps provider switching operationally simple.
- Alternatives considered:
  - Add stubs only without factory integration: rejected because run-time behavior and contract tests must include all providers.
  - Feature-flag providers out of runtime selection: rejected because explicit provider choice is part of acceptance coverage.

## Decision 4: Persist only connected entities and canonicalize non-directional relations
- Decision: Save entities only when referenced by at least one retained relation; for `directional=false`, normalize entity pair ordering and store one canonical relation.
- Rationale: Directly satisfies orphan-node elimination and clarified A-B/B-A dedup semantics.
- Alternatives considered:
  - Save all extracted entities and filter only in graph rendering: rejected because this keeps disconnected DB state and violates FR-009.
  - Store mirrored relation rows for non-directional types: rejected because it complicates deduplication and analytics.

## Decision 5: Taxonomy management is admin-only with soft-retire lifecycle
- Decision: Restrict `/admin` taxonomy mutations to authenticated admin users; block hard delete if referenced historically; allow deactivation for future runs.
- Rationale: Matches clarification outcomes, protects historical data integrity, and keeps extraction behavior auditable over time.
- Alternatives considered:
  - Allow any authenticated user to mutate taxonomy: rejected due to governance and extraction quality risks.
  - Allow hard delete of referenced taxonomy rows: rejected due to broken historical references and reporting instability.

## Decision 6: Credential failures are explicit and actionable, with no silent fallback
- Decision: Fail extraction immediately when selected provider credentials are missing/invalid; return remediation guidance: fix credentials or choose another provider.
- Rationale: Aligns with clarification and constitution observability requirements; prevents hidden provider changes.
- Alternatives considered:
  - Auto-fallback to default provider: rejected due to non-deterministic behavior and governance concerns.
  - Queue until credentials exist: rejected for MVP due to increased operational/state complexity.

## Decision 7: Keep REST contract surface explicit for planning and implementation
- Decision: Document contracts for joint extraction invocation, taxonomy CRUD, and provider payload normalization in `contracts/`.
- Rationale: Supports constitution requirement for explicit contracts and reduces ambiguity before `/speckit.tasks`.
- Alternatives considered:
  - Skip contract docs and rely on implementation discovery: rejected due to higher implementation and review churn.
