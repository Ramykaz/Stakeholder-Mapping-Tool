# Contract: Project + Concept Note + Scoped APIs (US-07)

## Scope
Adds project lifecycle APIs, concept note APIs, project-scoped upload/extraction/read APIs, and global entity profile while keeping legacy routes functional.

## 1) Project CRUD

### `POST /api/v1/projects/`
Create project.

#### Request
```json
{
  "name": "Sudan Water Resilience",
  "description": "Stakeholder mapping for 2026 concept note",
  "status": "active"
}
```

#### Response `201`
```json
{
  "id": "uuid",
  "name": "Sudan Water Resilience",
  "description": "Stakeholder mapping for 2026 concept note",
  "status": "active",
  "document_count": 0,
  "entity_count": 0,
  "created_at": "2026-03-17T12:00:00Z",
  "updated_at": "2026-03-17T12:00:00Z"
}
```

### `GET /api/v1/projects/`
List projects with card metrics.

### `GET /api/v1/projects/{id}/`
Retrieve one project.

### `PATCH /api/v1/projects/{id}/`
Partial update for `name`, `description`, `status`.

### `DELETE /api/v1/projects/{id}/`
Delete project per retention policy.

---

## 2) Concept Note

### `POST /api/v1/projects/{id}/concept-note/`
Create/update project concept note.

#### Request (multipart or json)
```json
{
  "content": "Context used by extraction providers",
  "attachment": "(optional file)"
}
```

#### Response `200|201`
```json
{
  "project_id": "uuid",
  "content": "Context used by extraction providers",
  "attachment_url": "https://.../optional",
  "updated_at": "2026-03-17T12:05:00Z"
}
```

### `GET /api/v1/projects/{id}/concept-note/`
Retrieve current concept note for project.

---

## 3) Project-Scoped Operational Endpoints

### `POST /api/v1/projects/{id}/documents/`
Upload document inside project context.

#### Response `201`
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "filename": "concept-note.txt",
  "file_format": "txt",
  "upload_timestamp": "2026-03-17T12:10:00Z",
  "processing_status": "completed",
  "chunk_count": 1
}
```

### `POST /api/v1/projects/{id}/extract-entities/`
Run extraction for project-scoped document(s); concept note context is injected into provider path.

#### Request
```json
{
  "document_id": "uuid",
  "provider": "groq",
  "model": "llama-3.1-8b-instant"
}
```

#### Response `201`
```json
{
  "status": "completed",
  "project_id": "uuid",
  "document_id": "uuid",
  "entities_created": 12,
  "relations_created": 8,
  "run_id": "uuid"
}
```

### `GET /api/v1/projects/{id}/entities/`
Return only entities from the specified project.

#### Response `200`
```json
{
  "project_id": "uuid",
  "entities": [
    {
      "id": "uuid",
      "entity_type": "ORGANIZATION",
      "canonical_name": "UNDP",
      "confidence": 0.97
    }
  ],
  "total_count": 1
}
```

### `GET /api/v1/projects/{id}/graph/`
Return only graph nodes/edges from the specified project.

#### Response `200`
```json
{
  "project_id": "uuid",
  "nodes": [
    {
      "id": "uuid-node",
      "label": "UNDP",
      "data": {
        "id": "uuid-node",
        "label": "UNDP",
        "entity_type": "ORGANIZATION",
        "shape": "rectangle",
        "confidence": 0.97
      }
    }
  ],
  "edges": [
    {
      "data": {
        "id": "uuid-edge",
        "source": "uuid-node",
        "target": "uuid-node-2",
        "label": "PARTNERED_WITH",
        "confidence": 0.82
      }
    }
  ],
  "total_nodes": 2,
  "total_edges": 1
}
```

---

## 4) Global Entity Profile

### `GET /api/v1/entities/{id}/`
Return entity details plus all projects where the entity appears.

#### Response `200`
```json
{
  "id": "uuid",
  "canonical_name": "UNDP",
  "entity_type": "ORGANIZATION",
  "projects": [
    {"id": "uuid-a", "name": "Sudan Water Resilience"},
    {"id": "uuid-b", "name": "Climate Adaptation Portfolio"}
  ]
}
```

---

## 5) Backward Compatibility Rules

- Legacy endpoints remain available during transition.
- Legacy payload contracts remain compatible.
- Legacy records are auto-linked to default project by migration.
- New project-scoped endpoints are additive and do not remove existing routes.
