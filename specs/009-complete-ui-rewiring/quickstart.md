# Quickstart — Complete UI Polishing and Rewiring

## Goal

Implement the complete dark design system UI rewire (spec 009) across all 7 phases while preserving existing backend logic and API compatibility.

## Prerequisites

- Docker Desktop running
- Repository root: `c:\Users\ramad\dev\UNDP\stakeholder-analysis-tool`
- Branch: `009-complete-ui-rewiring`

## Bring up stack

```powershell
docker compose down ; docker compose up --build -d
```

## Implementation Sequence (Phase Summary)

| Phase | Scope | Status |
|-------|-------|--------|
| 1 — Setup | Shared types, route helpers, workspace context | ✓ Done |
| 2 — Foundational | CSS design tokens, fonts, TopNavigation, Sidebar, entityTypes, uiState | ✓ Done |
| 3 — US1 | Landing, login/register, projects dashboard | ✓ Done |
| 4 — US2 | Concept note setup, document upload/status, document error tracking | ✓ Done |
| 5 — US3 | Map page, dark graph, entity panel, NL query, entity detail page | ✓ Done |
| 6 — US4 | EmptyState + ErrorMessage components, stale-response guards | ✓ Done |
| 7 — Polish | README, API docs, validation sign-off | ✓ Done |

## Verification Gates

### Backend — 2026-03-19

```
docker compose exec app python -m pytest -q
```

**Result**: `150 passed in 179.64s` ✓

### Frontend build — 2026-03-19

```
docker compose build frontend
```

**Result**: Next.js 14 compiled successfully, all pages static/SSR ✓

### New API endpoints verified

| Endpoint | Smoke result |
|----------|-------------|
| `POST /api/v1/projects/{id}/query/` | URL resolves; returns 200 with entity_ids + answer |
| `DELETE /api/v1/projects/{id}/documents/{doc_id}/` | Registered in ingestion/urls.py |
| `GET /api/v1/projects/{id}/documents/{doc_id}/status/` | Registered in ingestion/urls.py |
| `GET /api/v1/entities/{id}/profile/` | Returns confidence field (added to serializer) |

## Manual Smoke Checklist

- [ ] Landing page redirects authenticated users to `/projects`
- [ ] Login (split-panel) → register form with password strength meter
- [ ] Projects dashboard: card grid, create modal, delete with confirm
- [ ] New project → `/projects/{id}/setup` concept note with autosave
- [ ] Setup → `/projects/{id}/documents` drag/drop upload, status polling
- [ ] Documents "Build the graph" gated on at least one `completed` doc
- [ ] `/projects/{id}/map` loads graph, toolbar overlays, tab navigation
- [ ] Node click opens entity side-panel with type badge + confidence bar
- [ ] "View full entity detail →" navigates to `/projects/{id}/entities/{id}`
- [ ] Entity detail page: aliases, contextual summary, relationships list
- [ ] NL query bar: type query → matching nodes highlighted
- [ ] "Reasoning →" button in map banner → workspace page
- [ ] Workspace "← Graph Map" link → back to map
- [ ] Empty-state components render on no-data paths
- [ ] ErrorMessage component renders on API failure paths

## Completion Criteria

- All 66 tasks implemented across 7 phases
- 150 backend tests pass with no regressions
- Frontend builds cleanly (Next.js 14, no TypeScript/ESLint errors)
- Compatibility contracts and data model satisfied
- Dark design system applied consistently across all rewired routes
