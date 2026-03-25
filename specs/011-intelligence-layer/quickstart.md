# Quickstart: Intelligence Layer (011)

**Branch**: `011-intelligence-layer` | **Date**: 2026-03-24

End-to-end verification scenarios for each user story. Run after implementation to confirm all features work together.

---

## Prerequisites

- Docker stack running: `docker compose up -d`
- At least one project with 2+ documents processed (extraction completed)
- Auth token obtained via `POST /api/v1/auth/login/`

---

## Scenario 1: Semantic Search and NL Query

**Goal**: Confirm search bar uses pgvector, not SQL `icontains`, and NL questions return LLM answers.

1. Open a project map page (`/projects/{id}/map`)
2. Type an entity name that exists in the project (e.g. "UNDP") → nodes should highlight
3. Type a natural language question (e.g. "Who are the main partners in this project?") → confirm:
   - An answer panel appears above the graph
   - Matched entity nodes are highlighted
   - The answer references content from uploaded documents (not a template)
4. Type a query with no matches → confirm "no relevant content found" message

**API check**:
```bash
curl -X POST http://localhost:8000/api/v1/projects/{id}/query/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "Who funds this programme?"}'
# → {"is_nl_query": true, "answer": "...", "entity_ids": [...]}
```

---

## Scenario 2: LLM RAG Entity Summary

**Goal**: Confirm Generate summary calls the LLM and returns grounded content.

1. Click any node on the map → side panel opens
2. Click "Generate summary"
3. Confirm the summary text references actual content from documents (not a hardcoded template like "X is modeled as a Y stakeholder in Z")
4. Click Generate summary again within 24h → response should be instant (served from cache, `"source": "cache"`)
5. Add `"refresh": true` to the API request → confirm a fresh LLM call is made

**API check**:
```bash
curl -X POST http://localhost:8000/api/v1/entities/{entity_id}/summary/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "{project_id}", "refresh": false}'
# → {"summary": "<grounded narrative>", "source": "cache"|"generated"}
```

---

## Scenario 3: Per-Document Extraction Stats

**Goal**: Confirm documents page shows entity/relation counts and expandable top-5 entities.

1. Open `/projects/{id}/documents`
2. Confirm each document with completed extraction shows entity count, relation count, and confidence distribution
3. Click the expand arrow on any document row → confirm top 5 entities are listed with names, types, and confidence scores
4. Confirm documents without completed extraction show a "Not extracted" state, not zeros

**API check**:
```bash
curl http://localhost:8000/api/v1/projects/{id}/documents/?include_stats=true \
  -H "Authorization: Token <token>"
# → each completed doc has "stats": {"entity_count": N, "relation_count": N, ...}
```

---

## Scenario 4: Entity Flagging

**Goal**: Confirm flagging hides entity from graph and updates project header count.

1. Open project map → note the entity count in the project header
2. Click any entity node → side panel opens
3. Click the Flag/Reject button → confirm entity disappears from graph immediately
4. Check the project header → confirm flagged count shows 1
5. Navigate to `/projects/{id}/entities/{entity_id}` → confirm an "Unflag" button is visible
6. Click Unflag → confirm entity reappears on the graph

**API check**:
```bash
curl -X POST http://localhost:8000/api/v1/entities/{entity_id}/flag/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"is_flagged": true}'
# → {"id": "...", "is_flagged": true}
```

---

## Scenario 5: Dedup Review Queue

**Goal**: Confirm project owners can merge or keep-separate without admin access.

1. Open `/projects/{id}/review`
2. Confirm candidate pairs are listed with both entity names, similarity scores, and context snippets
3. Click Merge on one pair → confirm the graph now shows one node for that entity
4. Click Keep separate on another pair → confirm both nodes remain and the pair disappears from the queue
5. Check sidebar → confirm the badge count decrements after each resolution

**API check**:
```bash
# List pending candidates
curl http://localhost:8000/api/v1/projects/{id}/review/ \
  -H "Authorization: Token <token>"

# Resolve one
curl -X POST http://localhost:8000/api/v1/review-candidates/{candidate_id}/resolve/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "merge"}'
```

---

## Scenario 6: Entity Mention Timeline

**Goal**: Confirm timeline shows chronological mentions with context snippets and document links.

1. Click any entity node that appears in multiple documents
2. Scroll to the Timeline section on the entity detail page
3. Confirm entries are sorted by document upload date (oldest first)
4. Confirm each entry shows document name, upload date, and a context snippet from the source chunk
5. Click a document link → confirm navigation to the source document

---

## Scenario 7: Global Entity View

**Goal**: Confirm `/entities` lists cross-project entities sorted by frequency.

1. Create (or have) two projects both mentioning the same entity (e.g. "UNDP")
2. Navigate to `/entities` via the sidebar link
3. Confirm the table is sorted by project count descending
4. Confirm columns: name, type, project count, document count, confidence range
5. Click an entity name → confirm the global profile shows all projects it appears in

---

## Scenario 8: LLM Provider Selection

**Goal**: Confirm project-level provider selection works end-to-end.

1. Open `/projects/{id}/settings`
2. Confirm the provider dropdown shows available providers (active) and unconfigured providers (greyed out, labelled "not configured")
3. Select a different provider (e.g. OpenAI if key is set) and save
4. Check the project workspace sidebar → confirm it shows the newly selected provider name and model
5. Run extraction → confirm the NERRun record stores the new provider name

**API check**:
```bash
# Get available providers
curl http://localhost:8000/api/v1/projects/{id}/providers/ \
  -H "Authorization: Token <token>"

# Update project provider
curl -X PATCH http://localhost:8000/api/v1/projects/{id}/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "model": "gpt-4o-mini"}'
```

---

## Scenario 9: ADR Document

**Goal**: Confirm the ADR exists and contains a clear recommendation.

```bash
cat docs/ADR-graph-library.md
```

Confirm the document:
- Covers edge bundling performance at 500+ nodes
- Covers custom layout support
- Covers animation quality
- Covers bundle size and Next.js SSR compatibility
- Covers estimated migration effort
- Ends with an unambiguous recommendation: "Stay with Cytoscape.js" or "Migrate to D3.js"
