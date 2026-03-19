# Phase 0 Research — Complete UI Polishing and Rewiring

## Decision 1: Use one global design-token source with Tailwind alignment
- **Decision**: Standardize colors, typography, spacing, radii, and status tokens in global CSS variables and map existing utility usage to this token source.
- **Rationale**: A single source avoids drift between ad-hoc CSS and utility-level theme definitions during staged rewiring.
- **Alternatives considered**:
  - Keep existing palette and add parallel token system (rejected: high inconsistency risk).
  - Full one-shot replacement of all styles (rejected: high regression blast radius).

## Decision 2: Rewire using shared authenticated shell components
- **Decision**: Implement consistent authenticated layout as shared shell composition (top nav + sidebar + content frame) while leaving page-level business logic in place.
- **Rationale**: Meets navigation consistency requirements with minimal disruption to existing extraction/analysis flows.
- **Alternatives considered**:
  - Per-page bespoke nav/sidebar implementations (rejected: duplication and drift).
  - Router/architecture migration during rewiring (rejected: out-of-scope and risky).

## Decision 3: Preserve page logic via container/presenter migration
- **Decision**: Keep data-fetching, orchestration, and mutation logic in existing page containers; move visual structure and reusable controls into shared components.
- **Rationale**: Directly satisfies compatibility and no-regression constraints in the feature spec and constitution.
- **Alternatives considered**:
  - Full page rewrites by screen (rejected: difficult parity verification).
  - Immediate global state overhaul (rejected: scope expansion).

## Decision 4: Make URL context canonical with persisted fallback
- **Decision**: Treat URL query context (`project_id`, optional `document_id`) as canonical workspace scope; use lightweight persistence only as refresh recovery.
- **Rationale**: URL-first context supports deep linking and predictable routing, while persistence improves resilience.
- **Alternatives considered**:
  - LocalStorage-only active context (rejected: poor deep-link semantics).
  - In-memory-only active context (rejected: refresh instability).

## Decision 5: Maintain dual API access patterns for compatibility
- **Decision**: Keep project-scoped and document-scoped endpoint usage patterns where currently supported; do not remove legacy deep-link paths during rewiring.
- **Rationale**: Enables incremental migration without breaking existing behavior and tests.
- **Alternatives considered**:
  - Enforce immediate project-only API cutover (rejected: would break existing paths/tests).
  - Keep document-only contracts (rejected: conflicts with workspace-centered UX).

## Decision 6: Centralize async state semantics and error normalization
- **Decision**: Use a shared async-state contract (loading/error/empty/ready) and API-error normalization strategy across upload, entities, graph, relations, and reasoning entry points.
- **Rationale**: Prevents divergent UX and ensures recoverable guidance for all key journeys.
- **Alternatives considered**:
  - Page-specific error handling patterns (rejected: inconsistent user behavior).
  - Backend-wide error envelope rewrite in this feature (rejected: too broad for current scope).

## Decision 7: Guard against stale responses during workspace switching
- **Decision**: Use request cancellation or request-version guards when active workspace context changes mid-load.
- **Rationale**: Prevents cross-workspace data bleed and incorrect rendering in high-latency scenarios.
- **Alternatives considered**:
  - Ignore race conditions (rejected: correctness risk).
  - Block navigation while loading (rejected: poor UX).

## Decision 8: Keep reasoning integration workspace-scoped and non-breaking
- **Decision**: Expose reasoning experience as part of the same workspace context contract without introducing disruptive new backend surfaces in this phase.
- **Rationale**: Satisfies continuity requirements while preserving validated backend behavior.
- **Alternatives considered**:
  - Introduce entirely new reasoning API family now (rejected: contract expansion risk).
  - Keep reasoning isolated from the rewired flow (rejected: fails user-story continuity).

## Clarifications Resolved

All technical-context unknowns are resolved for this phase:
- Language/runtime, dependencies, storage, test strategy, platform, and project type are known.
- Integration pattern and contract strategy are defined and backward-compatible.
- No `NEEDS CLARIFICATION` markers remain for planning.
