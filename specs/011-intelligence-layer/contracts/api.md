# API Contracts: Intelligence Layer (011)

**Branch**: `011-intelligence-layer` | **Date**: 2026-03-24

All endpoints require `Authorization: Token <token>` unless noted. All responses are `application/json`.

---

## Modified Endpoints

### POST /api/v1/projects/{id}/query/

Replaces the current SQL substring search with pgvector semantic search + optional NL query.

**Request**
```json
{ "query": "Who are the funders in this ecosystem?" }
```

**Response — entity name lookup (not detected as question)**
```json
{
  "query": "UNDP",
  "is_nl_query": false,
  "answer": null,
  "entity_ids": ["uuid-1", "uuid-2"],
  "count": 2
}
```

**Response — natural language question detected**
```json
{
  "query": "Who are the funders in this ecosystem?",
  "is_nl_query": true,
  "answer": "The key funders in this project are the European Union (EU) and the Bill & Melinda Gates Foundation, both of which provided direct financial support to UNDP's programme activities as documented in the project summary report.",
  "entity_ids": ["uuid-1", "uuid-4", "uuid-9"],
  "count": 3
}
```

**NL question detection rules**: Contains one of `who`, `what`, `where`, `when`, `which`, `how`, `why`, `is`, `are`, `can`, `does` (case-insensitive) OR token count > 3.

**Errors**
- `400` — `query` missing or empty
- `503` — LLM provider unavailable (semantic search result still returned with `answer: null`)

---

### POST /api/v1/entities/{id}/summary/

Replaces template string with LLM RAG summary. Interface unchanged; behavior changes.

**Request**
```json
{ "project_id": "uuid", "refresh": false }
```

**Response (unchanged interface)**
```json
{
  "entity_id": "uuid",
  "project_id": "uuid",
  "summary": "UNDP played a central coordinating role in the AI for Good Hackathon in Uzbekistan, as documented across three project reports. The Programme provided logistical support and convened participating organizations including...",
  "source": "cache",
  "generated_at": "2026-03-24T10:00:00Z",
  "expires_at": "2026-03-25T10:00:00Z"
}
```

**`source` values**: `cache` (served from ContextualEntitySummary) | `generated` (fresh LLM call)

**Errors**
- `400` — `project_id` missing; entity not in project
- `404` — entity not found or not accessible to user
- `503` — LLM provider unavailable and no cached summary exists

---

## New Endpoints

### GET /api/v1/projects/{id}/documents/?include_stats=true

Extends the existing documents list to include per-document extraction stats.

**Response (with `include_stats=true`)**
```json
[
  {
    "id": "uuid",
    "name": "programme_report.pdf",
    "status": "completed",
    "created_at": "2026-03-20T09:00:00Z",
    "stats": {
      "entity_count": 42,
      "relation_count": 18,
      "confidence": {
        "high": 28,
        "medium": 11,
        "low": 3
      },
      "top_entities": [
        { "id": "uuid", "name": "UNDP", "type": "ORGANIZATION", "confidence": 0.97 },
        { "id": "uuid", "name": "Uzbekistan", "type": "LOCATION", "confidence": 0.95 },
        { "id": "uuid", "name": "AI for Good Hackathon", "type": "EVENT", "confidence": 0.91 },
        { "id": "uuid", "name": "Ministry of Digital Technologies", "type": "ORGANIZATION", "confidence": 0.88 },
        { "id": "uuid", "name": "Mirzo Ulugbek", "type": "PERSON", "confidence": 0.82 }
      ]
    }
  }
]
```

**`stats` is `null`** when `status != 'completed'`.

---

### POST /api/v1/entities/{id}/flag/

Flag or unflag an entity.

**Request**
```json
{ "is_flagged": true }
```

**Response**
```json
{
  "id": "uuid",
  "canonical_name": "Irrelevant Corp",
  "is_flagged": true
}
```

**Errors**
- `403` — user does not have access to this entity's project
- `404` — entity not found

---

### GET /api/v1/projects/{id}/review/

List pending duplicate review candidates for a project.

**Response**
```json
{
  "count": 3,
  "results": [
    {
      "id": "uuid",
      "left_entity": { "id": "uuid", "name": "United Nations Development Programme", "type": "ORGANIZATION" },
      "right_entity": { "id": "uuid", "name": "UN Development Programme", "type": "ORGANIZATION" },
      "similarity_score": 0.78,
      "mention_context": "The UN Development Programme has been working with local partners since 2021...",
      "status": "pending"
    }
  ]
}
```

---

### POST /api/v1/review-candidates/{id}/resolve/

Resolve a duplicate candidate pair.

**Request**
```json
{ "action": "merge" }
```
or
```json
{ "action": "keep_separate" }
```

**Response**
```json
{
  "id": "uuid",
  "status": "merged",
  "canonical_entity": { "id": "uuid", "name": "United Nations Development Programme" },
  "resolved_at": "2026-03-24T12:00:00Z"
}
```

**Errors**
- `400` — `action` not one of `merge` | `keep_separate`; candidate already resolved
- `403` — user is not the project owner
- `404` — candidate not found

---

### GET /api/v1/entities/{id}/timeline/?project_id={project_id}

Returns chronological document mentions for an entity within a project.

**Response**
```json
{
  "entity_id": "uuid",
  "project_id": "uuid",
  "timeline": [
    {
      "document_id": "uuid",
      "document_name": "inception_report_2024.pdf",
      "uploaded_at": "2024-01-15T08:30:00Z",
      "context_snippet": "...the AI for Good Hackathon, organized by UNDP in partnership with local tech hubs, brought together over 200 participants..."
    },
    {
      "document_id": "uuid",
      "document_name": "programme_summary_q2.pdf",
      "uploaded_at": "2024-06-30T12:00:00Z",
      "context_snippet": "...UNDP continued to facilitate knowledge transfer sessions building on outcomes from the hackathon..."
    }
  ]
}
```

**Errors**
- `400` — `project_id` query param missing
- `403` — user does not have access to this entity or project
- `404` — entity not found

---

### GET /api/v1/entities/

Global entity list (cross-project, sorted by frequency).

**Query params**: `?page=1&page_size=50&type=ORGANIZATION`

**Response**
```json
{
  "count": 348,
  "next": "/api/v1/entities/?page=2",
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "canonical_name": "UNDP",
      "entity_type": "ORGANIZATION",
      "project_count": 8,
      "document_count": 23,
      "confidence_min": 0.72,
      "confidence_max": 0.99
    }
  ]
}
```

---

### GET /api/v1/projects/{id}/providers/

Returns available LLM providers for the current environment (used to populate provider dropdown).

**Response**
```json
{
  "current_provider": "groq",
  "current_model": "llama-3.1-8b-instant",
  "providers": [
    { "id": "groq", "label": "Groq (Llama 3)", "available": true, "models": ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"] },
    { "id": "openai", "label": "OpenAI", "available": true, "models": ["gpt-4o-mini", "gpt-4.1-mini"] },
    { "id": "azure_openai", "label": "Azure OpenAI", "available": false, "models": [] },
    { "id": "gemini", "label": "Google Gemini", "available": false, "models": [] }
  ]
}
```

`available: false` means the corresponding API key env var is not set.

---

### PATCH /api/v1/projects/{id}/

Existing endpoint extended to accept `provider` and `model` fields.

**Request**
```json
{ "provider": "openai", "model": "gpt-4o-mini" }
```

**Response** — standard project object with new fields:
```json
{
  "id": "uuid",
  "name": "AI for Good Uzbekistan",
  "provider": "openai",
  "model": "gpt-4o-mini",
  ...
}
```

**Errors**
- `400` — provider not in allowed list; model not valid for the given provider; provider not available (API key not set)
