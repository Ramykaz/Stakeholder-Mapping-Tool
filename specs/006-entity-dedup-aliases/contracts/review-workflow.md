# Contract: Entities List Review UX (US-06)

## Purpose
Defines UI behavior for showing aliases and resolving borderline dedup candidates in the entities list page.

## Page
`GET /entities`

## Required UI Elements
1. Aliases shown below canonical entity name in smaller text.
2. Top review banner appears if at least one pending review candidate exists.
3. Per-candidate actions in banner: `Merge` and `Keep Separate`.

## Interaction Rules
- Clicking `Merge` triggers candidate resolve endpoint with `action=merge`.
- Clicking `Keep Separate` triggers candidate resolve endpoint with `action=keep_separate`.
- On success, candidate row disappears from banner and entity list refreshes.
- If zero pending candidates remain, banner hides automatically.

## Error Rules
- Action API failure shows inline error and keeps candidate visible.
- Concurrent/stale candidate resolution returns a user-friendly stale-state message and refreshes candidate list.

## Compatibility
- If backend omits new review endpoints, entity list still renders entities and aliases without banner/actions.
