# Feature Specification: Entity Deduplication + Alias System

**Feature Branch**: `006-entity-dedup-aliases`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "US-06: Entity Deduplication + Alias System"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Save Canonical Entities with 3-Level Deduplication (Priority: P1)

As an analyst, I want entity extraction saves to automatically merge duplicates and preserve aliases, so the graph shows one canonical node per real stakeholder without losing mention variants.

**Why this priority**: This is the core value of US-06 and directly improves data quality for every downstream graph, query, and profile workflow.

**Independent Test**: Can be fully tested by running extraction on documents containing exact duplicates, acronyms, and fuzzy variants, then verifying canonical entities, alias rows, and review flags in persisted results.

**Acceptance Scenarios**:

1. **Given** an extracted entity name with an exact normalized match (trimmed/lowercased) and same entity type, **When** entity save runs, **Then** the existing canonical entity is reused via exact-match dedup and no duplicate canonical record is created.
2. **Given** an extracted acronym (for example `UNDP`) of the same entity type as an existing full-form entity, **When** save runs, **Then** the acronym is expanded to its full form for canonical comparison and persisted as an alias on the canonical entity.
3. **Given** a same-type fuzzy name variant with similarity above 0.85, **When** save runs, **Then** it merges into one canonical entity and stores the variant as an alias.
4. **Given** a same-type fuzzy name variant with similarity between 0.70 and 0.85, **When** save runs, **Then** the entity is marked `needs_review=true` and exposed in review candidates for merge/keep action.
5. **Given** two extracted entities with identical text but different entity types, **When** save runs, **Then** they are never merged.

---

### User Story 2 - Preserve Phase Variants and Return Rich Entity Data (Priority: P1)

As an analyst, I want project phase entities (Phase/Stage/Round/year variants) to stay distinct but linked, and I need entity APIs to include aliases and parent links so UI and downstream analysis remain accurate.

**Why this priority**: Entity semantics and API payload quality are required for safe automatic deduplication and reliable project timeline interpretation.

**Independent Test**: Can be tested by ingesting phase-variant names and calling entity endpoints to confirm parent links, alias lists, deduplicated mention counts, and review fields are returned.

**Acceptance Scenarios**:

1. **Given** an entity name containing phase indicators (for example `Phase 1`, `Stage 2`, `Round 3`, or year patterns), **When** save runs, **Then** phase variants remain separate canonical entities and are linked via `parent_entity`.
2. **Given** chunk overlap produces repeated raw mentions, **When** mention counts are computed, **Then** unique mention counts are persisted and returned.
3. **Given** entity endpoints are requested, **When** payloads are returned, **Then** each entity includes aliases, parent reference, `needs_review`, and deduplicated mention count.

---

### User Story 3 - Review Flagged Near-Duplicates in Entity List UI (Priority: P2)

As an analyst, I want a visible review banner and quick actions for ambiguous entity pairs, so I can decide whether to merge or keep separate without leaving the entity list workflow.

**Why this priority**: This is the human-in-the-loop control needed for safe fuzzy deduplication in borderline cases.

**Independent Test**: Can be tested by loading the entities page with flagged candidates and performing merge/keep actions, then verifying list updates and review flags clear appropriately.

**Acceptance Scenarios**:

1. **Given** one or more flagged near-duplicate pairs exist, **When** the entities list page is loaded, **Then** a review banner appears and each candidate shows `Merge` and `Keep Separate` actions.
2. **Given** a user chooses `Merge` for a flagged pair, **When** action is submitted, **Then** one canonical entity remains, aliases are consolidated, and review flags for that pair are resolved.
3. **Given** a user chooses `Keep Separate`, **When** action is submitted, **Then** both entities remain separate and the candidate is marked resolved without auto-merge.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Extracted acronym has multiple possible expansions in `AcronymMap`: deterministic priority is applied and ambiguous mappings are flagged for review.
- Fuzzy similarity equals exact threshold boundaries (0.70, 0.85): behavior is deterministic and documented (`>=0.85` merge, `0.70..0.8499` review).
- Phase token appears in non-phase context (for example organization names containing `Stage`): false positives are prevented by phase-pattern rules and fallback to normal dedup flow.
- Alias text duplicates existing alias on same canonical entity: alias save is idempotent.
- Review candidate references entities that were merged/resolved by another action: stale candidate is ignored and marked resolved.
- Mention dedup across overlapping chunks removes duplicate spans but preserves genuinely distinct occurrences.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

**Deduplication Pipeline**

- **FR-001**: System MUST execute a 3-level deduplication process on every entity save in extraction workflows.
- **FR-002**: Level 1 dedup MUST perform exact match on normalized canonical name (`lower().strip()`) + `entity_type` using `get_or_create` semantics.
- **FR-003**: Level 2 dedup MUST consult an `AcronymMap` table and expand known acronyms to full forms before canonical comparison.
- **FR-004**: When acronym expansion applies, system MUST save the acronym as an alias with source `acronym`.
- **FR-005**: Level 3 dedup MUST use RapidFuzz (`token_sort_ratio` and `partial_ratio`) within same entity type only.
- **FR-006**: If fuzzy similarity is `>=0.85`, entities MUST merge automatically.
- **FR-007**: If fuzzy similarity is `>=0.70` and `<0.85`, entity MUST be flagged `needs_review=true` and review candidate data MUST be created.
- **FR-008**: Entities of different `entity_type` MUST NEVER merge even when names are identical.

**Phase and Alias Model Behavior**

- **FR-009**: Phase variants identified by phase/stage/round/year patterns MUST remain separate canonical entities.
- **FR-010**: Phase variants MUST be linkable to a common parent through `parent_entity`.
- **FR-011**: System MUST store aliases in `EntityAlias` with fields: `entity`, `alias_text`, `source` (`extraction|manual|acronym`), and timestamps.
- **FR-012**: Alias creation MUST be idempotent per canonical entity + alias text.
- **FR-013**: Mention counting MUST deduplicate chunk-overlap artifacts before persisting count fields returned by APIs.

**API and Frontend Contract Updates**

- **FR-014**: Existing entity endpoints MUST include `aliases`, `parent_entity`, `needs_review`, and deduplicated mention count.
- **FR-015**: System MUST expose review candidates for flagged near-duplicates in the document context.
- **FR-016**: System MUST provide review actions to resolve candidate pairs with `merge` or `keep_separate`.
- **FR-017**: Entities list UI MUST show aliases beneath canonical names in smaller text.
- **FR-018**: Entities list UI MUST show a top-level review banner when unresolved review candidates exist.
- **FR-019**: Review banner MUST allow `merge` or `keep separate` action per candidate pair.

**Compatibility and Governance**

- **FR-020**: Feature MUST extend and reuse existing save/extraction flows from specs 002, 004, and 005 rather than introducing a parallel persistence path.
- **FR-021**: Feature MUST preserve existing graph/entity endpoint compatibility for clients not using new fields.
- **FR-022**: Acronym defaults MUST include common UN/development acronyms (for example UNDP, WHO, SDG, UNICEF, FAO) via migration seed data.
- **FR-023**: All dedup/review operations MUST be traceable via structured logs for debugging and auditability.

### Key Entities *(include if feature involves data)*

- **Entity (extended)**: Canonical stakeholder node with `entity_type`, `canonical_name`, deduplicated mention metrics, `needs_review`, and optional `parent_entity` reference.
- **EntityAlias**: Alias record linked to one canonical entity, storing variant text and source (`extraction`, `manual`, `acronym`).
- **AcronymMap**: Reference map of acronym→expansion rows used in save-time normalization.
- **EntityReviewCandidate**: Pending review pair for borderline fuzzy matches, with score, status, and resolver action (`merge` / `keep_separate`).

### Dependencies

- Spec `002-ner-pipeline`
- Spec `004-entity-relation-extraction`
- Spec `005-llm-joint-extraction-labels`

### References

- `docs/NLP_APPROACH.md` (Section 4 deduplication approach)
- `docs/PROJECT_REQUIREMENTS.md`
- `docs/SPRINT_PLAN.md`
- `.specify/memory/constitution.md`

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: At least 95% of exact and acronym duplicate cases in validation corpus resolve to one canonical entity.
- **SC-002**: At least 90% of high-similarity (`>=0.85`) same-type near-duplicates merge correctly without manual intervention.
- **SC-003**: 100% of borderline similarity (`0.70-0.85`) candidates appear in review banner and are actionable via merge/keep actions.
- **SC-004**: Entity endpoints return alias and parent metadata for 100% of entities in documents where such metadata exists.
- **SC-005**: Overlap-deduplicated mention counting reduces duplicate mention inflation by at least 80% on overlap-heavy test documents.
- **SC-006**: No regressions in existing entity+relation extraction contracts from specs 004/005.
