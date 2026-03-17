# Contract: Entity API + Review Actions (US-06)

## Scope
Extends existing entity endpoints and adds review actions for near-duplicate candidates.

## 1) Extended entities list payload
`GET /api/v1/documents/{document_id}/entities/`

### Response (`200`)
```json
{
  "document_id": "uuid",
  "entities": [
    {
      "id": "uuid",
      "entity_type": "ORGANIZATION",
      "canonical_name": "United Nations Development Programme",
      "normalized_name": "united nations development programme",
      "aliases": ["UNDP", "UN Development Programme"],
      "parent_entity": null,
      "parent_entity_id": null,
      "needs_review": false,
      "mention_count_dedup": 7,
      "confidence": 0.94
    }
  ],
  "total_count": 1
}
```

### Rules
- `aliases` always present (possibly empty).
- `parent_entity` contains `{id, canonical_name}` or `null`.
- `needs_review` reflects unresolved review-candidate state.

---

## 2) Review candidates list
`GET /api/v1/documents/{document_id}/entities/review-candidates/`

### Response (`200`)
```json
{
  "document_id": "uuid",
  "candidates": [
    {
      "id": "uuid",
      "left_entity": "uuid",
      "left_entity_name": "UNDP",
      "right_entity": "uuid",
      "right_entity_name": "United Nations Development Programme",
      "entity_type": "ORGANIZATION",
      "similarity_score": 0.78,
      "status": "pending",
      "resolved_by": null,
      "resolved_by_username": null,
      "resolved_at": null,
      "created_at": "2026-03-17T11:00:00Z"
    }
  ],
  "total_count": 1
}
```

### Rules
- Only unresolved (`pending`) same-type pairs are returned.
- Empty list when no pending candidates exist.

---

## 3) Resolve candidate action
`POST /api/v1/documents/{document_id}/entities/review-candidates/{candidate_id}/resolve/`

### Request
```json
{
  "action": "merge" | "keep_separate",
  "target_entity_id": "uuid (optional for merge winner selection)"
}
```

### Success (`200`)
```json
{
  "status": "resolved",
  "action": "merge",
  "candidate_id": "uuid"
}
```

### Validation
- Reject invalid actions (`400`).
- Reject stale/resolved candidate actions (`400`) and missing candidates (`404`).
- `merge` consolidates aliases and mentions; `keep_separate` preserves both entities.
