# Phase 0 Research — UX, Graph, Workflow, LLM Reliability, and Web Ingestion

## Decision 1: Typography/contrast remediation strategy
- Decision: Apply a token-based contrast audit pass only on listed targets, enforcing minimum 12px label/body text and preserving existing layout structure.
- Rationale: Meets accessibility/readability requirements without causing layout regressions or component churn.
- Alternatives considered:
  - Global theme rewrite: rejected (too risky, broad unintended UI impact).
  - Per-page hardcoded colors: rejected (violates design-token consistency, harder to maintain).

## Decision 2: Graph migration implementation approach
- Decision: Replace Cytoscape rendering with D3 force graph in-place behind existing page/props/API contracts; preserve interaction semantics and external callbacks.
- Rationale: Delivers required migration and visual improvements while minimizing integration risk with surrounding panels and filters.
- Alternatives considered:
  - Keep Cytoscape and style tweak only: rejected (explicit migration requirement).
  - New separate graph page: rejected (breaks route parity and workflow continuity).

## Decision 3: Initial graph stabilization behavior
- Decision: Run force simulation pre-iterations before first visible paint and render settled positions; no visible settle animation.
- Rationale: Satisfies readability/perceived-performance requirement and prevents user confusion from moving target nodes.
- Alternatives considered:
  - Animate stabilization in-view: rejected (explicitly disallowed).

## Decision 4: Workflow next-step correctness model
- Decision: Derive next-step card exclusively from workflow status response and current page context; remove hardcoded step assumptions.
- Rationale: Prevents stale UI logic and guarantees consistency with backend progression state.
- Alternatives considered:
  - Frontend-only static mapping: rejected (already proven incorrect in dynamic cases).

## Decision 5: LLM error-handling taxonomy
- Decision: Standardize UI-facing error classes into rate-limit (amber banner), timeout (busy-provider message), and generic provider/config failure, for all listed AI actions.
- Rationale: Converts opaque failures into actionable guidance and consistent UX.
- Alternatives considered:
  - Keep per-feature custom messages: rejected (inconsistent UX, maintenance burden).

## Decision 6: Sequential stakeholder-note generation + resume
- Decision: Replace bulk generation behavior with sequential capped generation (max 20) and resumable progression state.
- Rationale: Reduces provider burst failures and improves transparency/progress feedback.
- Alternatives considered:
  - Keep bulk task and only add retries: rejected (still poor user control/observability on partial failure).

## Decision 7: Provider wiring and health-check contract
- Decision: Enforce provider resolution at call time for every LLM call path; add dedicated settings test endpoint returning provider, model, status, error_message, latency_ms.
- Rationale: Ensures provider switch applies immediately and is verifiable before expensive operations.
- Alternatives considered:
  - Cached provider instances at startup: rejected (prevents immediate switching, causes stale config behavior).

## Decision 8: Initiative profile + SMQ UX model
- Decision: Move to explicit profile save-only flow with unsaved-change guard; SMQ edited in single-section focus mode with separate notes context.
- Rationale: Improves data integrity and authoring focus while preserving generated-content separation.
- Alternatives considered:
  - Autosave-on-blur retention: rejected (causes accidental persistence and ambiguous state).

## Decision 9: Web ingestion scope controls
- Decision: Introduce `WebSource` pipeline with strict crawl limits (depth<=2, pages<=20) and readable-content extraction, then hand off to existing Document chunk/extraction path.
- Rationale: Adds required source flexibility without introducing separate processing stack.
- Alternatives considered:
  - Unlimited crawl depth/pages: rejected (cost/safety/perf risk).
  - Store raw web content outside Document pipeline: rejected (breaks parity requirement).

## Decision 10: Export appendices inclusion policy
- Decision: Export appendices are conditional by data presence; TOC and export status reflect actual inclusion including new `has_workplan` signal.
- Rationale: Avoids empty sections and keeps exported report truthful and predictable.
- Alternatives considered:
  - Always include empty appendices: rejected (low-quality deliverable, misleading readiness).
