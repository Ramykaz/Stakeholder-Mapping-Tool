# API Compatibility Contract — Feature 009

## Purpose

Define compatibility rules for frontend rewiring while preserving existing backend behavior and endpoint families.

## Contract Rules

1. Existing stable endpoints used by current pages remain supported during rewiring.
2. Project-scoped flows are preferred when available; document-scoped paths remain valid for deep links and legacy navigation.
3. Response shape tolerance is handled in frontend normalization (no broad backend envelope rewrite in this feature).
4. Error responses must remain recoverable in UI (message + retry path where applicable).

## Endpoint Families in Scope

### Ingestion
- **Upload document**: `POST /api/v1/documents/`
- **List documents**: `GET /api/v1/documents/` (supports project context where implemented)
- **Document metadata/status retrieval**: existing document endpoints remain unchanged

### NER / Entities / Relations / Graph
- **Extraction start/status**: existing NER run endpoints remain unchanged
- **Entity listing**: project- and/or document-scoped endpoints remain supported where currently exposed
- **Relation listing**: project- and/or document-scoped endpoints remain supported where currently exposed
- **Graph data retrieval**: existing graph retrieval contracts remain unchanged

### Reasoning
- Existing project-scoped reasoning/contextual summary behavior remains unchanged; rewiring may alter presentation and routing only.

## Backward-Compatibility Guarantees

- No mandatory request-field additions for existing client flows.
- No breaking removal of existing response fields relied upon by current frontend pages/tests.
- Optional fields may be added only if safely ignorable by legacy clients.
- Existing status values (`queued`, `processing`/`running`, `completed`, `failed`) remain semantically compatible.

## Error Mapping Contract

UI contract for normalized error object:
- `message` (required for display)
- `code` (optional)
- `status` (optional)
- `retryable` (derived by client/page policy)

Backend is not required to emit this exact shape; frontend adapter layer is responsible for normalization.

## Verification Checklist

- Existing upload flow succeeds without API contract changes.
- Existing extraction trigger and polling/status flow remains functional.
- Entities/relations/graph views function for both project and deep-linked document contexts.
- Reasoning entry points remain available for active workspace context.
- Existing backend and frontend test suites remain green after rewiring.
