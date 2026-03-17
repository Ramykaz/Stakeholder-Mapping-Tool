# Phase 0 Research — US-06

## Decision 1: Dedup executes in existing entity save flow
- Decision: Apply dedup in the current persistence path used by extraction saves (specs 002/004/005), not in a separate batch reconciler.
- Rationale: Preserves compatibility and avoids divergent behavior between extraction modes.
- Alternatives considered:
  - Post-save async dedup job: rejected because it introduces temporary duplicates and stale UI states.
  - New parallel endpoint for dedup-only: rejected as unnecessary architecture expansion.

## Decision 2: Exact-match canonical key uses normalized name + entity type
- Decision: Use normalized canonical key `(canonical_name.lower().strip(), entity_type)` with `get_or_create` semantics.
- Rationale: Aligns with requested Level 1 behavior and guarantees deterministic same-type dedup.
- Alternatives considered:
  - Case-sensitive key: rejected due to avoidable duplicates.
  - Name-only key across types: rejected because cross-type merge is disallowed.

## Decision 3: Acronym expansion is database-driven via AcronymMap
- Decision: Add `AcronymMap` table seeded with common UN/development acronyms (UNDP, WHO, SDG, UNICEF, FAO, etc.).
- Rationale: Keeps acronym policy editable and auditable without code deploys.
- Alternatives considered:
  - Hardcoded dictionary in code: rejected due to poor maintainability.
  - External service lookup: rejected for unnecessary complexity.

## Decision 4: Fuzzy policy uses RapidFuzz thresholds exactly as requested
- Decision: Use `token_sort_ratio` + `partial_ratio` on same-type candidates only, with thresholds:
  - `>= 0.85`: auto-merge
  - `0.70 <= score < 0.85`: create review candidate and mark `needs_review`
- Rationale: Matches required behavior and supports human review for ambiguous cases.
- Alternatives considered:
  - Single fuzzy metric: rejected for lower robustness on token order variation.
  - More aggressive threshold: rejected due to higher false merge risk.

## Decision 5: Review workflow persists candidate pairs and decisions
- Decision: Create `EntityReviewCandidate` records with statuses and actions (`merge`, `keep_separate`) to support UI banner actions.
- Rationale: A per-pair workflow is needed to power explicit user actions and prevent repeated prompts.
- Alternatives considered:
  - Entity-level `needs_review` flag only: rejected because pair-level action context is missing.

## Decision 6: Phase variants stay separate but linked
- Decision: Detect phase/stage/round/year patterns and keep entities separate while linking to `parent_entity`.
- Rationale: Preserves timeline semantics while enabling aggregate navigation.
- Alternatives considered:
  - Merge all phase variants: rejected because it loses phase-specific meaning.
  - No parent link: rejected because related variants become harder to traverse.

## Decision 7: Mention counts deduplicate overlap artifacts
- Decision: Compute and persist mention metrics from unique mention spans/text forms after overlap de-duplication.
- Rationale: Prevents inflated influence/centrality from chunk overlap repetition.
- Alternatives considered:
  - Raw mention count only: rejected due to known overcount artifacts.
