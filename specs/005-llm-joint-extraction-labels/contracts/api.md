# Contract: REST API (US-05)

## Scope
Defines API behavior required for joint extraction and taxonomy management.

## 1) Trigger joint extraction
`POST /api/v1/documents/{document_id}/extract-entities-relations/`

### Request
```json
{
  "provider": "groq|openai|azure_openai|gemini",
  "model": "string"
}
```

### Success Response (`201`)
```json
{
  "run_id": "uuid",
  "document_id": "uuid",
  "provider": "openai",
  "model": "gpt-5-mini",
  "entities_created": 12,
  "relations_created": 15,
  "usage": {
    "input_tokens": 9500,
    "cached_input_tokens": 0,
    "output_tokens": 2100,
    "cost_usd": 0.0192
  },
  "status": "completed"
}
```

### Credential Failure (`400` or `422`)
```json
{
  "error": {
    "code": "PROVIDER_CONFIG_ERROR",
    "message": "Selected provider is not configured correctly.",
    "remediation": [
      "Provide valid credentials and provider settings for the selected provider",
      "Or choose another configured provider/model"
    ]
  }
}
```

### Behavioral Requirements
- One provider call per chunk.
- No automatic provider fallback.
- Persist only entities that are part of at least one saved relationship.
- Non-directional relation types are canonicalized so reversed duplicates persist once.
- Taxonomy activation state is enforced at extraction time (inactive values are excluded).

---

## 2) EntityLabel admin endpoints (admin-only)
- `GET /api/v1/admin/entity-labels/`
- `POST /api/v1/admin/entity-labels/`
- `PATCH /api/v1/admin/entity-labels/{id}/`
- `DELETE /api/v1/admin/entity-labels/{id}/`

### List Response (`200`)
```json
[
  {
    "id": "uuid",
    "name": "Person",
    "description": "Individual stakeholder",
    "node_shape": "hexagon",
    "color": "#2563eb",
    "active": true,
    "display_order": 1
  }
]
```

### Delete Behavior
- If referenced historically: block hard delete with validation error + deactivate guidance.
- If not referenced: hard delete allowed.

---

## 3) RelationshipType admin endpoints (admin-only)
- `GET /api/v1/admin/relationship-types/`
- `POST /api/v1/admin/relationship-types/`
- `PATCH /api/v1/admin/relationship-types/{id}/`
- `DELETE /api/v1/admin/relationship-types/{id}/`

### Additional Field
- `directional` (boolean)

### Canonicalization Rule
- For `directional=false`, reversed pairs are equivalent and persisted as one canonical relation.

---

## 4) Authorization contract
- Non-admin authenticated user: `403` for all create/update/delete taxonomy operations.
- Unauthenticated user: authentication error for protected admin endpoints.
