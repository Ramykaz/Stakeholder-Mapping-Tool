# Contract: Graph + Entity Panel + Summary APIs (US-08)

## Scope
Defines API behavior for graph rendering metadata, access-scoped entity profiles, and on-demand contextual summaries with cache/timeout semantics.

## 1) Project Graph Payload (extended)

### `GET /api/v1/projects/{project_id}/graph/`
Returns project-scoped graph with style-ready data for rendering.

#### Response `200`
```json
{
  "project_id": "uuid",
  "nodes": [
    {
      "id": "entity-uuid",
      "label": "UNDP",
      "entity_type": "ORGANIZATION",
      "degree": 12,
      "style": {
        "shape": "rectangle",
        "color": "#2563eb"
      }
    }
  ],
  "edges": [
    {
      "id": "relation-uuid",
      "source": "entity-uuid",
      "target": "entity-uuid-2",
      "relation_type": "PARTNERED_WITH",
      "label": "partnered with",
      "confidence": 0.82
    }
  ],
  "totals": {
    "nodes": 58,
    "edges": 91
  }
}
```

#### Rules
- Must be project-scoped and owner-authorized.
- Missing style metadata must be represented via deterministic fallback style values.

---

## 2) Access-Scoped Entity Profile

### `GET /api/v1/entities/{entity_id}/profile/`
Returns cross-project entity profile constrained to requester's authorized projects.

#### Query Params
- `project_id` (optional): preferred current context for ordering/priority.

#### Response `200`
```json
{
  "id": "entity-uuid",
  "canonical_name": "UNDP",
  "entity_type": "ORGANIZATION",
  "aliases": ["United Nations Development Programme"],
  "projects": [
    {"id": "project-a", "name": "Sudan Water Resilience"}
  ],
  "relationships": [
    {
      "relation_id": "rel-uuid",
      "project_id": "project-a",
      "source_entity_id": "entity-uuid",
      "target_entity_id": "entity-uuid-2",
      "relation_type": "FUNDS",
      "confidence": 0.77,
      "supporting_excerpts": ["UNDP funded..."]
    }
  ]
}
```

#### Response `404`
Entity not found or not accessible.

#### Rules
- Must never include unauthorized project memberships or relationships.
- Empty arrays are valid for aliases/relationships.

---

## 3) On-Demand Contextual Summary

### `POST /api/v1/entities/{entity_id}/summary/`
Generate or return cached contextual summary for (`entity_id`, `project_id`).

#### Request
```json
{
  "project_id": "project-uuid",
  "refresh": false
}
```

#### Behavior
- `refresh=false`: return cached summary if not expired (<24h), otherwise regenerate.
- `refresh=true`: bypass cache and regenerate immediately.
- Hard timeout at 8 seconds for provider generation.

#### Response `200` (cache hit)
```json
{
  "entity_id": "entity-uuid",
  "project_id": "project-uuid",
  "summary": "UNDP acts as...",
  "source": "cache",
  "generated_at": "2026-03-18T10:00:00Z",
  "expires_at": "2026-03-19T10:00:00Z"
}
```

#### Response `200` (fresh generation)
```json
{
  "entity_id": "entity-uuid",
  "project_id": "project-uuid",
  "summary": "UNDP acts as...",
  "source": "provider",
  "generated_at": "2026-03-18T10:05:00Z",
  "expires_at": "2026-03-19T10:05:00Z"
}
```

#### Response `503` (timeout/fallback)
```json
{
  "entity_id": "entity-uuid",
  "project_id": "project-uuid",
  "summary": null,
  "fallback_message": "Summary unavailable right now. Try again.",
  "retryable": true,
  "reason": "timeout_or_provider_unavailable"
}
```

#### Rules
- Endpoint is on-demand only; no auto-generation on panel open.
- Fallback response must be non-blocking and retryable.
- CI tests must mock provider calls.
