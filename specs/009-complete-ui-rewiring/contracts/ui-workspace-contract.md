# UI Workspace Contract — Feature 009

## Purpose

Define cross-page workspace context and navigation guarantees for upload, graph, entities, relations, and reasoning experiences.

## Canonical Context Tuple

- `project_id` (required for workspace-native pages)
- `document_id` (optional refinement for document-specific views)
- `view` (optional page/view hint)
- `filters` (optional, page-local query parameters)

## Context Source Priority

1. URL query/route params (canonical)
2. Persisted last-active context (fallback only)
3. Safe default state (no-context empty state with guidance)

## Page Contracts

### Upload Page
- Must accept existing navigation patterns.
- Must surface current project context when available.
- Must expose transition links to entities/graph/reasoning after processing terminal states.

### Entities Page
- Must load data by active context tuple.
- Must preserve project/document context in outbound links.
- Must show empty state when no extracted entities exist.

### Relations Page
- Must load by same context tuple semantics as entities/graph.
- Must preserve context when opening relation details or navigating to graph.

### Graph Page
- Must render only data corresponding to active context tuple.
- Must guard against stale responses when context switches mid-load.
- Must provide consistent transition entry to reasoning/related views while preserving context.

### Reasoning Experience
- Must be scoped to active project context and optional document/entity refinement.
- Must expose loading, empty, and recoverable error states consistent with other pages.

## Shared UX State Contract

All rewired pages must implement one of:
- `loading`
- `ready`
- `empty`
- `error`

### `error` state requirements
- Human-readable message
- Optional detail code
- Retry affordance when operation is retryable

### `empty` state requirements
- Explain why no data is shown
- Provide next-action guidance (for example: upload documents, run extraction, switch workspace)

## Navigation Consistency Guarantees

- Shared authenticated shell (top nav + sidebar) appears consistently across primary pages.
- Active workspace indication remains visible and synchronized with route context.
- Cross-page transitions preserve canonical context tuple unless user explicitly switches context.

## Testable Invariants

1. Refreshing a workspace page preserves visible context and does not load cross-workspace data.
2. Navigating between upload/entities/relations/graph/reasoning does not lose `project_id`.
3. Deep links with `document_id` remain resolvable without breaking workspace-level navigation.
4. Empty/error states are actionable and non-blocking for recovery.
