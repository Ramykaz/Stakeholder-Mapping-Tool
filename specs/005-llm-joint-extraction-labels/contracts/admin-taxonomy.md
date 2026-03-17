# Contract: Admin Taxonomy UI (`/admin`)

## Purpose
Defines expected UI behavior for managing `EntityLabel` and `RelationshipType`.

## Page
`GET /admin` (frontend route)

## Sections
1. Entity Labels
2. Relationship Types

## Entity Labels UI Contract
Each row must show:
- `name`
- `node_shape`
- `color`
- `active` toggle
- edit action
- delete action

Supported actions:
- create label
- edit label
- activate/deactivate label
- delete label (subject to historical-reference restriction)

## Relationship Types UI Contract
Each row must show:
- `name`
- `directional`
- `color`
- `active` toggle
- edit action
- delete action

Supported actions:
- create type
- edit type
- activate/deactivate type
- delete type (subject to historical-reference restriction)

## Validation Messages
- duplicate name (case-insensitive): reject with clear uniqueness error
- delete blocked due to historical references: show guidance to deactivate
- non-admin access: show authorization error state

## Runtime Semantics
- Changes are effective on next extraction run.
- Inactive rows are excluded from LLM prompt taxonomy.
- Deactivation preserves historical run interpretability.
