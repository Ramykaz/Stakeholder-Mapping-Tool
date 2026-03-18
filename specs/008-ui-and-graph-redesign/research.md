# Phase 0 Research — US-08

## Decision 1: Keep graph UX as an in-place enhancement of existing pages
- Decision: Extend existing graph/workspace pages and graph API payloads instead of creating a new graph workflow.
- Rationale: Satisfies FR-001 and aligns with constitution principles (KISS/YAGNI) while preserving current user pathways.
- Alternatives considered:
  - New dedicated graph application: rejected as unnecessary complexity and migration risk.
  - Hard replacement route: rejected due to backward-compatibility and adoption risk.

## Decision 2: Dynamic node style derives from existing label configuration metadata
- Decision: Use active entity label configuration (`shape`, `color`) as source of truth for node visual style.
- Rationale: Reuses existing admin-configured taxonomy system and avoids hard-coded frontend visual rules.
- Alternatives considered:
  - Frontend-only style mapping table: rejected due to duplication and drift risk.
  - Provider-derived style tags: rejected because visual semantics should remain product-configured, not model-generated.

## Decision 3: Node size uses bounded degree-based scaling
- Decision: Compute node size from visible graph connection count with clamped min/max bounds.
- Rationale: Communicates centrality while avoiding unreadable extremes on dense/sparse graphs.
- Alternatives considered:
  - Constant node size: rejected because it hides structural salience.
  - Unbounded proportional scaling: rejected due to poor legibility in outlier-heavy graphs.

## Decision 4: Focus mode runs on currently filtered visible subgraph
- Decision: Two-hop focus neighborhood is computed after filter application (visible nodes/edges only).
- Rationale: Matches clarified UX semantics and user mental model for layered graph exploration.
- Alternatives considered:
  - Compute focus on full graph then apply filters: rejected due to confusing hidden-node influence.
  - Disable focus while filters are active: rejected because it removes a required exploratory capability.

## Decision 5: Side panel drill-down uses client-side navigation stack
- Decision: Maintain panel-local history stack for linked-entity drill-down and back navigation.
- Rationale: Keeps interactions immediate and avoids route churn while preserving context.
- Alternatives considered:
  - URL-based deep-link for every click: rejected for UX overhead in rapid exploration mode.
  - No back stack: rejected because it weakens multi-hop analyst workflows.

## Decision 6: Cross-project profile API enforces access-scoped memberships
- Decision: Return only projects/relationships the requester is authorized to access.
- Rationale: Prevents data leakage and remains consistent with existing project ownership controls.
- Alternatives considered:
  - Admin-only full visibility and scoped results for others: deferred as non-required branching complexity.
  - Global visibility for all users: rejected for security/privacy risk.

## Decision 7: Contextual summary generation is on-demand with persistent cache
- Decision: Trigger summary only on explicit user action; cache by entity+project for 24h with manual refresh bypass.
- Rationale: Balances responsiveness, cost, and determinism during live review sessions.
- Alternatives considered:
  - Auto-generate on panel open: rejected for cost/latency amplification.
  - No cache: rejected due to repeated provider load and variable latency.
  - Infinite cache: rejected due to stale insight risk.

## Decision 8: Summary timeout/failure contract is non-blocking and retryable
- Decision: Enforce 8-second timeout for summary generation, return fallback response with explicit retry affordance.
- Rationale: Preserves panel usability and gives clear recovery behavior under provider slowness.
- Alternatives considered:
  - Indefinite waiting: rejected due to blocking UX.
  - Mandatory async job queue for all summaries: rejected as avoidable architecture overhead for current scope.

## Decision 9: Testing strategy emphasizes deterministic local/CI behavior
- Decision: Add/adjust frontend interaction tests (filters, focus, panel states) and backend API tests with mocked provider responses.
- Rationale: Meets constitution requirement of test coverage before PR while preserving no-LLM-calls-in-CI rule.
- Alternatives considered:
  - Manual-only verification: rejected as non-repeatable.
  - Live-provider integration tests in CI: rejected by constitution constraints.
