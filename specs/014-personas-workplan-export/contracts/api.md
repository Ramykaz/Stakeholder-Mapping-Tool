# API Contracts: US-014 — Personas + Workplan + Workflow + Export

All endpoints follow existing DRF conventions. Base URL: `/api/v1/`. Authentication required. All UUIDs used as PKs.

---

## Workflow Endpoints

### GET `/api/v1/projects/{project_id}/workflow/`

Returns the current workflow step state for the project.

**Response 200**:
```json
{
  "current_step": 3,
  "steps": [
    { "number": 1, "label": "Define initiative", "complete": true, "url": "/projects/{id}/intake" },
    { "number": 2, "label": "Upload documents", "complete": true, "url": "/projects/{id}/documents" },
    { "number": 3, "label": "Run extraction", "complete": false, "url": "/projects/{id}/analyze" },
    { "number": 4, "label": "Review graph", "complete": false, "url": "/projects/{id}" },
    { "number": 5, "label": "Generate report", "complete": false, "url": "/projects/{id}/report" },
    { "number": 6, "label": "Stakeholder table", "complete": false, "url": "/projects/{id}/stakeholders" },
    { "number": 7, "label": "Export", "complete": false, "url": "/projects/{id}/report?tab=export" }
  ]
}
```

---

## Stakeholder Persona Endpoints

### GET `/api/v1/projects/{project_id}/personas/`

Returns all generated personas for the project.

**Response 200**:
```json
{
  "count": 3,
  "results": [
    {
      "id": "uuid",
      "entity_type_id": "uuid",
      "entity_type_label": "Organization",
      "persona_name": "The Policy Architect",
      "archetype_label": "Institutional Champion",
      "demographics": "Mid-to-senior level officials in government ministries...",
      "motivations": [
        "Align national policy with international frameworks",
        "Secure long-term funding for programme sustainability",
        "Build institutional capacity and knowledge transfer"
      ],
      "frustrations": [
        "Slow inter-ministerial coordination slows programme timelines",
        "Insufficient data to justify budget allocations",
        "High staff turnover disrupts institutional memory"
      ],
      "representative_entities": [
        { "id": "uuid", "name": "Ministry of Education" },
        { "id": "uuid", "name": "National Innovation Agency" }
      ],
      "generated_at": "2026-04-03T10:00:00Z"
    }
  ]
}
```

**Response 200 (empty)**: `{ "count": 0, "results": [] }` — no personas generated yet.

---

### POST `/api/v1/projects/{project_id}/personas/generate/`

Trigger async Celery generation of all personas for the project. Replaces existing personas.

**Request body**: `{}` (no body required)

**Response 202**:
```json
{
  "status": "generating",
  "message": "Persona generation started. Poll /personas/ for results."
}
```

**Response 400**: `{ "error": "no_entities", "detail": "No entities extracted for this project yet." }`

---

## Workplan Endpoints

### GET `/api/v1/projects/{project_id}/workplan/`

Returns the full workplan with nested tasks.

**Response 200**:
```json
{
  "project": "uuid",
  "generated": true,
  "components": [
    {
      "id": "uuid",
      "order": 0,
      "title": "Capacity Building and Training",
      "generated_at": "2026-04-03T10:00:00Z",
      "tasks": [
        {
          "id": "uuid",
          "order": 0,
          "task_description": "Design and deliver a 3-day stakeholder engagement workshop...",
          "suggested_owner": "UNDP Programme Officer",
          "timeline": "Q2 2026 — 6 weeks",
          "dependencies": "Stakeholder mapping complete; venue secured",
          "kpis": "80% attendance rate; post-workshop survey score ≥ 4/5",
          "related_entity": {
            "id": "uuid",
            "name": "National Innovation Agency",
            "entity_type": "Organization"
          }
        }
      ]
    }
  ]
}
```

**Response 200 (not generated)**: `{ "project": "uuid", "generated": false, "components": [] }`

---

### GET `/api/v1/projects/{project_id}/workplan/status/`

Returns generation status without full workplan content.

**Response 200**:
```json
{
  "generated": true,
  "section_6_complete": true,
  "component_count": 5,
  "task_count": 18
}
```

---

### POST `/api/v1/projects/{project_id}/workplan/generate/`

Trigger async Celery generation of the workplan. Requires SMQ Section 6 to be complete.

**Request body**: `{}` (no body required)

**Response 202**:
```json
{
  "status": "generating",
  "message": "Workplan generation started. Poll /workplan/ for results."
}
```

**Response 400**: `{ "error": "section_6_incomplete", "detail": "Section 6 must be complete first." }`

---

## Report Staleness Endpoints

### GET `/api/v1/projects/{project_id}/report/staleness/`

Returns staleness state for all report sections and the stakeholder table.

**Response 200**:
```json
{
  "stale_sections": [2, 3, 5],
  "stakeholder_table_stale": true,
  "new_entity_count": 14
}
```

**Response 200 (nothing stale)**: `{ "stale_sections": [], "stakeholder_table_stale": false, "new_entity_count": 0 }`

---

### PATCH `/api/v1/projects/{project_id}/report/{section_id}/keep/`

Mark a stale section as "keep current version" — resets status to done without changing content.

**Request body**: `{}` (no body required)

**Response 200**: `{ "status": "done", "section_id": "uuid" }`

**Response 400**: `{ "error": "not_stale", "detail": "Section is not in stale status." }`

---

### POST `/api/v1/projects/{project_id}/stakeholders/priority/keep-current/`

Mark the stakeholder table as not stale (keep current version).

**Request body**: `{}` (no body required)

**Response 200**: `{ "status": "ok", "stakeholder_table_stale": false }`

---

## Report Export Endpoints

### GET `/api/v1/projects/{project_id}/report/export/status/`

Returns export readiness information.

**Response 200**:
```json
{
  "can_export": true,
  "complete_sections": 6,
  "total_sections": 8,
  "has_stakeholder_table": true,
  "has_personas": true,
  "section_statuses": [
    { "section_number": 1, "title": "Define the Objectives", "status": "done" },
    { "section_number": 2, "title": "Identify Stakeholders", "status": "done" },
    { "section_number": 3, "title": "Categorize Stakeholders", "status": "stale" },
    { "section_number": 4, "title": "Assess Stakeholder Needs", "status": "pending" }
  ]
}
```

---

### GET `/api/v1/projects/{project_id}/report/export/?format=pdf`

Export the full report as a PDF file.

**Response 200**: Binary PDF stream.
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="{initiative_title}_stakeholder_analysis.pdf"
```

**Response 400**: `{ "error": "no_complete_sections", "detail": "Complete at least one report section to export." }`

---

### GET `/api/v1/projects/{project_id}/report/export/?format=docx`

Export the full report as a DOCX file.

**Response 200**: Binary DOCX stream.
```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="{initiative_title}_stakeholder_analysis.docx"
```

**Response 400**: Same as PDF.

---

## Enriched Entity Endpoint (extension)

### GET `/api/v1/projects/{project_id}/entities/{entity_id}/`

Existing endpoint extended with new fields.

**Additional fields in response**:
```json
{
  "...existing fields...",
  "stakeholder_priority": {
    "rank": 3,
    "category": "Government",
    "priority": "High",
    "priority_reason": "Controls budget allocation for the programme...",
    "ask_request": "Request formal endorsement letter and budget line item inclusion"
  },
  "persona": {
    "archetype_label": "Institutional Champion",
    "persona_name": "The Policy Architect"
  },
  "appears_in_report_sections": [
    { "section_number": 1, "report_chapter_title": "Define the Objectives" },
    { "section_number": 2, "report_chapter_title": "Identify Stakeholders" }
  ]
}
```

All three fields are `null` or empty list `[]` when no data exists.

---

## Error Responses (standard)

```json
{ "error": "error_code", "detail": "Human-readable message" }
```

Common codes for this spec:
- `no_entities` — 400 (persona generation requires extracted entities)
- `section_6_incomplete` — 400 (workplan requires Section 6 complete)
- `no_complete_sections` — 400 (export requires at least one complete section)
- `not_stale` — 400 (keep-current called on non-stale section)
- `project_not_found` — 404
