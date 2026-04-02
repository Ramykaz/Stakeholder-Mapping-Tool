# API Contracts: US-013 — Structured Initiative Intake + SMQ + RAG Report

All endpoints follow existing DRF conventions. Base URL: `/api/v1/`. Authentication required (session/token). All UUIDs used as PKs.

---

## Initiative Profile Endpoints

### GET `/api/v1/projects/{project_id}/intake/`
Retrieve the initiative profile for a project. Returns the ConceptNote content as `core_objectives` fallback if no InitiativeProfile exists yet.

**Response 200**:
```json
{
  "id": "uuid",
  "project": "uuid",
  "initiative_name": "AI for Good Hackathon",
  "geography": "Uzbekistan",
  "thematic_area": "Youth Employment",
  "core_objectives": "The initiative aims to...",
  "expected_outcomes": "Expected outcomes include...",
  "stakeholder_focus": "Focus on government bodies and NGOs",
  "updated_at": "2026-04-02T10:00:00Z"
}
```

**Response 404**: No project found (project does not exist or user lacks access).

---

### PUT `/api/v1/projects/{project_id}/intake/`
Create or update the initiative profile (upsert). All fields are optional.

**Request body**: Same structure as GET response (minus `id`, `project`, `updated_at`).

**Response 200**: Updated initiative profile (same as GET 200).

**Response 400**: Validation error (e.g., `initiative_name` exceeds 255 chars).

---

## Extraction Guidance Endpoints

### GET `/api/v1/projects/{project_id}/guidance/`
List all extraction guidance items for a project, ordered by `order`.

**Response 200**:
```json
{
  "count": 2,
  "results": [
    {"id": "uuid", "text": "Focus on funding relationships", "order": 0},
    {"id": "uuid", "text": "Treat 'the Lab' as 'UNDP SDG AI Lab'", "order": 1}
  ]
}
```

---

### POST `/api/v1/projects/{project_id}/guidance/`
Add a new guidance item.

**Request body**:
```json
{"text": "Ignore references to 'the general public'", "order": 2}
```

**Response 201**: Created guidance item.

**Response 400**: `text` is blank.

---

### PATCH `/api/v1/projects/{project_id}/guidance/{guidance_id}/`
Update text or order of a guidance item.

**Response 200**: Updated item.

---

### DELETE `/api/v1/projects/{project_id}/guidance/{guidance_id}/`
Delete a guidance item.

**Response 204**: No content.

---

### POST `/api/v1/projects/{project_id}/guidance/reorder/`
Bulk-reorder guidance items.

**Request body**:
```json
{"order": ["uuid1", "uuid2", "uuid3"]}
```

**Response 200**: `{"status": "reordered"}`

---

## SMQ Template Endpoints

### GET `/api/v1/smq/template/`
Retrieve the active SMQ template with all sections.

**Response 200**:
```json
{
  "id": "uuid",
  "title": "Stakeholder Mapping Questionnaire",
  "sections": [
    {
      "id": "uuid",
      "section_number": 1,
      "title": "Define the Objectives",
      "question_prompts": "What is the core mission...",
      "order": 0
    },
    ...
  ]
}
```

---

## SMQ Response Endpoints

### GET `/api/v1/projects/{project_id}/smq/`
Retrieve all SMQ answers for a project. Returns empty `answers` array if none exist yet.

**Response 200**:
```json
{
  "id": "uuid",
  "project": "uuid",
  "answers": [
    {
      "id": "uuid",
      "section_id": "uuid",
      "section_number": 1,
      "section_title": "Define the Objectives",
      "answer_text": "The initiative aims to...",
      "ai_generated": true,
      "is_stale": false,
      "last_generated_at": "2026-04-02T10:00:00Z"
    }
  ]
}
```

---

### PUT `/api/v1/projects/{project_id}/smq/{section_id}/`
Save (create or update) a manual answer for one section.

**Request body**:
```json
{"answer_text": "The initiative aims to reduce youth unemployment by 20%..."}
```

**Response 200**: Updated answer object.

---

### POST `/api/v1/projects/{project_id}/smq/{section_id}/generate/`
Trigger AI generation for one SMQ section. Runs synchronously (single LLM call). Returns immediately with the generated answer.

**Response 200**:
```json
{
  "section_id": "uuid",
  "answer_text": "Based on the project documents...",
  "ai_generated": true,
  "chunk_ids_used": ["uuid1", "uuid2", "uuid3"],
  "citations": [
    {"doc_name": "Report 2024.pdf", "chunk_id": "uuid", "snippet": "..."}
  ]
}
```

**Response 503**: LLM unavailable (rate limit or error) with `{"error": "..."}`.

---

## Report Generation Endpoints

### GET `/api/v1/projects/{project_id}/report/`
Get current status and content of all report sections.

**Response 200**:
```json
{
  "project": "uuid",
  "sections": [
    {
      "section_id": "uuid",
      "section_number": 1,
      "section_title": "Define the Objectives",
      "status": "done",
      "generated_text": "Based on the uploaded documents...",
      "citations": [...],
      "generated_at": "2026-04-02T10:00:00Z",
      "error_message": null
    },
    {
      "section_id": "uuid",
      "section_number": 2,
      "section_title": "Identify Stakeholders",
      "status": "pending",
      "generated_text": "",
      "citations": [],
      "generated_at": null,
      "error_message": null
    }
  ]
}
```

---

### POST `/api/v1/projects/{project_id}/report/generate/`
Trigger generation of one or all sections. Spawns ThreadPoolExecutor tasks. Returns immediately.

**Request body** (generate all):
```json
{"sections": "all"}
```

**Request body** (generate specific section):
```json
{"sections": ["uuid_section_1", "uuid_section_3"]}
```

**Response 202**: Generation queued.
```json
{
  "status": "generating",
  "sections_queued": 8,
  "message": "Generation started. Poll /report/ for status."
}
```

**Response 400**: No extracted documents in project.

---

### POST `/api/v1/projects/{project_id}/report/regenerate/{section_id}/`
Reset a specific section to `pending` and re-trigger generation.

**Response 202**: `{"status": "generating", "section_id": "uuid"}`

---

### GET `/api/v1/projects/{project_id}/report/export/pdf/`
Export the full report as PDF. Only returns PDF if all sections are in `done` status; otherwise returns error.

**Response 200**: Binary PDF file download.
`Content-Type: application/pdf`
`Content-Disposition: attachment; filename="stakeholder-report-{project_name}.pdf"`

**Response 409**: One or more sections are not yet generated.
```json
{"error": "sections_incomplete", "pending_sections": [2, 3]}
```

---

## Stakeholder Priority Table Endpoints

### GET `/api/v1/projects/{project_id}/stakeholders/priority/`
Returns entities ranked by `priority_score = degree × avg_confidence`. Filterable by type.

**Query params**:
- `entity_type` (optional): filter to specific type (Person, Organization, etc.)
- `page` (optional): page number (default 1, 50 per page)

**Response 200**:
```json
{
  "count": 47,
  "page": 1,
  "total_pages": 1,
  "results": [
    {
      "rank": 1,
      "entity_id": "uuid",
      "name": "UNDP SDG AI Lab",
      "entity_type": "Organization",
      "mention_count": 12,
      "avg_confidence": 0.94,
      "degree": 8,
      "priority_score": 7.52,
      "engagement_note": null
    }
  ]
}
```

---

### POST `/api/v1/projects/{project_id}/stakeholders/priority/generate-notes/`
Trigger background AI generation of engagement notes for all entities in the priority table.

**Response 202**: `{"status": "generating", "entity_count": 47}`

---

### GET `/api/v1/projects/{project_id}/stakeholders/priority/export/csv/`
Export priority table as CSV.

**Response 200**: CSV file download.
`Content-Type: text/csv`
`Content-Disposition: attachment; filename="stakeholder-priority-{project_name}.csv"`

CSV columns: `rank,name,entity_type,mention_count,avg_confidence,degree,priority_score,engagement_note`

---

## Error Responses (standard)

All endpoints follow this error shape:
```json
{"error": "error_code", "detail": "Human-readable message"}
```

Common error codes:
- `project_not_found` — 404
- `no_documents` — 400 (action requires extracted documents)
- `llm_error` — 503 (LLM call failed after retries)
- `validation_error` — 400 (field validation failed)
