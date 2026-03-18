# Quickstart — US-08

## Prerequisites
- Docker Desktop running
- Existing `.env` configured for backend/frontend
- Branch: `008-ui-and-graph-redesign`

## 1) Build and run services
```powershell
docker compose up --build -d app frontend
```

## 2) Apply migrations (if summary cache model is introduced)
```powershell
docker compose exec app python manage.py migrate
```

## 3) Backend validation
```powershell
docker compose exec app pytest -q
```

### Focused backend checks (recommended)
- Graph payload includes style/degree/confidence fields.
- Entity profile endpoint excludes unauthorized project memberships.
- Summary endpoint behaviors:
  - On-demand only
  - 24h cache hit path
  - `refresh=true` bypass path
  - 8s timeout fallback with retryable response

## 4) Frontend validation
```powershell
Set-Location frontend
npm test -- --runInBand --watch=false
```

### Focused frontend checks (recommended)
- Node click opens side panel with required sections.
- Panel linked-entity drill-down and back navigation works.
- Entity/relation filters update graph instantly without refetch.
- Shift+click focus uses filtered-visible subgraph and resets on background click.
- Search highlights + centers match in real time.
- Summary button triggers on-demand request only; fallback and retry states render correctly.

## 5) Manual smoke flow
1. Open project workspace map.
2. Confirm visual encoding (shape/color/size/edge confidence) renders.
3. Click a node and verify panel content completeness.
4. Apply filters, then activate focus mode and reset.
5. Run search and confirm centering on match.
6. Request summary:
   - First call generates or returns cache.
   - Retry works after simulated timeout/provider failure.
7. Open same entity in another authorized project and confirm profile is access-scoped.

## 6) Regression safety checks
- Legacy graph/entity routes still return valid payloads.
- No cross-project leakage in any entity profile or relationship evidence response.
- CI path uses mocked provider calls only (no live LLM dependency).

## 7) Validation Record (2026-03-18)

Executed focused validation commands and confirmed expected behavior:

- Backend focused suite:
  - `docker compose exec app pytest -q ner/tests/test_graph_payload_api.py ner/tests/test_entity_profile_api.py ner/tests/test_contextual_summary_api.py`
  - Result: `6 passed`

- Frontend focused suite:
  - `npm test -- --runInBand --watch=false src/__tests__/lib/api.test.ts src/__tests__/pages/graph.test.tsx src/__tests__/pages/graph-visuals.test.tsx src/__tests__/pages/graph-focus-filters.test.tsx src/__tests__/pages/workspace-panel.test.tsx src/__tests__/pages/entity-summary.test.tsx`
  - Result: `40 passed`
