# Quickstart: Entity + Relation Extraction with Graph Integration

**Feature**: Entity + Relation Extraction with Graph Integration  
**Branch**: `004-entity-relation-extraction`  
**Date**: 2026-03-15

---

## Prerequisites

- Docker and Docker Compose installed
- Git repository cloned
- Groq and/or OpenAI API keys (see `.env.example`)

---

## Local Development Setup

### 1. Environment Configuration

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
# Required for entity+relation extraction
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here  # Optional: only if using OpenAI

# Database (managed by Docker Compose)
DATABASE_URL=postgresql://postgres:postgres@db:5432/stakeholder_analysis
PGVECTOR_EXTENSION=true
```

### 2. Start Services

```bash
docker compose up --build
```

This starts:
- **Backend** (Django): `http://localhost:8000`
- **Frontend** (Next.js): `http://localhost:3000`
- **Database** (PostgreSQL + pgvector): Internal (port 5432 not exposed by default)

### 3. Apply Migrations

```bash
docker compose exec app python manage.py migrate
```

Expected output:
```
Operations to perform:
  Apply all migrations: auth, contenttypes, ingestion, ner
Running migrations:
  Applying ner.0006_add_relations... OK
```

Migration `0006_add_relations` creates:
- `relations` table
- Indexes on (document_id, source_entity_id, target_entity_id, run_id)
- Unique deduplication index on (document, source, normalized_label, target)
- `relations_created` field in `ner_run` table

### 4. Verify Services

**Backend health check**:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "healthy", "database": "connected"}
```

**Frontend**:
Open `http://localhost:3000` in a browser. You should see the upload page.

---

## Usage Flow

### Step 1: Upload a Document

1. Navigate to `http://localhost:3000`
2. Drag-and-drop a PDF, DOCX, or TXT file (max 50 MB)
3. Click "Upload Document"
4. Wait for processing (chunking, embedding) — typically 5-15 seconds

### Step 2: Extract Entities + Relations

After upload, you see two extraction options:

- **Extract Entities** (existing feature) — entities only, no relations
- **Extract Entities + Relations** (NEW) — entities AND relations

**Choose "Extract Entities + Relations"**:
1. Select provider: **Groq** or **OpenAI**
   - Groq: Uses `llama-3.1-8b-instant` (free tier, fast)
   - OpenAI: Choose model (`gpt-4o-mini` recommended for speed; `gpt-5-mini` for quality)
2. Click "Extract Entities + Relations"
3. Wait for extraction (30s–2min depending on document length and provider)

**Progress indicator**:
- Shows "Extracting entities and relations..."
- Displays chunk progress (e.g., "Chunk 3 of 4 processed")

**Completion screen**:
```
✓ Extraction Complete

Found 12 entities and 8 relations in your-document.pdf

Run Metadata:
- Provider: openai
- Model: gpt-4o-mini
- Input tokens: 3420
- Output tokens: 1280
- Cost (USD): 0.002340
- Duration: 8.4s
```

### Step 3: View Graph with Edges

Click **"View Graph"** from the completion screen.

**Graph features**:
- **Nodes**: Entities with type-specific shapes
  - 🔵 Ellipse = PERSON
  - 🔲 Rectangle = ORGANIZATION
  - 🔶 Diamond = LOCATION
  - ⬡ Hexagon = ROLE
- **Edges**: Directional arrows with labels (e.g., "REPORTS_TO", "PARTNERS_WITH")
- **Confidence filter**: Slider to hide low-confidence entities and relations
- **Hover**: Node/edge tooltips show details
- **Layout**: Draggable nodes; auto-layout on load

**Example graph**:
```
   Sarah Chen ──REPORTS_TO──▶ Apex Corp ──PARTNERS_WITH──▶ Ministry of Agriculture
   (ellipse)                   (rectangle)                  (rectangle)
```

### Step 4: View Relations List (API)

Programmatic access to relations:

```bash
curl "http://localhost:8000/api/v1/documents/{document_id}/relations/"
```

Response:
```json
{
  "relations": [
    {
      "id": "r1",
      "source_entity_id": "e1",
      "source_entity_name": "Sarah Chen",
      "target_entity_id": "e2",
      "target_entity_name": "Apex Corp",
      "label": "REPORTS_TO",
      "confidence": 0.87,
      "run_id": "run1",
      "document_id": "doc1",
      "created_at": "2026-03-15T10:30:00Z"
    }
  ]
}
```

---

## Testing the Feature

### Backend Tests

Run all tests:
```bash
docker compose exec app pytest ner/tests/ -v
```

Relation-specific tests:
```bash
docker compose exec app pytest ner/tests/test_relation_extractor.py -v
docker compose exec app pytest ner/tests/test_relation_deduplicator.py -v
docker compose exec app pytest ner/tests/test_views.py::test_extract_entities_relations -v
```

Expected output:
```
ner/tests/test_relation_extractor.py::test_extract_valid_triplets PASSED
ner/tests/test_relation_extractor.py::test_discard_self_loops PASSED
ner/tests/test_relation_deduplicator.py::test_dedup_by_normalized_label PASSED
ner/tests/test_views.py::test_extract_entities_relations PASSED
```

### Frontend Tests

```bash
cd frontend
npm test
```

Graph-specific tests:
```bash
npm test -- graph.test.tsx
```

Expected output:
```
✓ renders edges with labels (120ms)
✓ applies node shapes based on entity type (95ms)
✓ filters edges by confidence (80ms)
```

---

## Debugging

### No relations extracted (relations_created = 0)

**Possible causes**:
1. Document has fewer than 2 distinct entities → no pairs to relate
2. LLM did not identify meaningful relationships in the text
3. All extracted relations were invalid (self-loops or entity name mismatches)

**Check**:
```bash
# View entities extracted
curl "http://localhost:8000/api/v1/documents/{document_id}/entities/"

# View NER run logs
docker compose logs app | grep "\[NER\]"
```

### Edges not visible in graph

**Possible causes**:
1. Confidence filter is too high → relations are hidden
2. Graph loaded before relations extraction completed
3. Frontend not fetching the extended graph endpoint

**Check**:
- Lower confidence slider to 0.0
- Refresh page after extraction completes
- Inspect network tab: GET `/api/v1/graph/?document_id={id}` should return `edges` array

### Database inspection

```bash
docker compose exec db psql -U postgres -d stakeholder_analysis

-- View relations
SELECT id, label, confidence, source_entity_id, target_entity_id 
FROM relations 
WHERE document_id = '<your-document-id>';

-- View NER runs with relation counts
SELECT id, provider, model, entities_created, relations_created, status 
FROM ner_run 
WHERE document_id = '<your-document-id>' 
ORDER BY created_at DESC;
```

---

## Next Steps

- **Re-run extraction**: Delete document and upload again, or use the "Extract Entities + Relations" button on an existing document (replaces prior extraction)
- **Experiment with providers**: Compare Groq vs OpenAI relation quality
- **Adjust confidence filter**: See how relation quality degrades below 0.7 confidence
- **Large document**: Upload a multi-page policy document to stress-test deduplication across chunks

---

## Rollback (if needed)

To revert the migration and remove the relations feature:

```bash
docker compose exec app python manage.py migrate ner 0005_nerrun_duration_seconds
```

This drops the `relations` table and removes `relations_created` from `ner_run`.

---

## Configuration Reference

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `GROQ_API_KEY` | Groq API key (required for Groq extraction) | None |
| `OPENAI_API_KEY` | OpenAI API key (required for OpenAI extraction) | None |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@db:5432/stakeholder_analysis` |
| `NER_DEFAULT_PROVIDER` | Default provider if not specified | `groq` |
| `NER_PROVIDER_MODEL_ALLOWLIST` | Allowed models per provider (in `settings.py`) | `{'groq': [...], 'openai': [...]}` |

---

## Support

For issues or questions:
1. Check logs: `docker compose logs app | tail -100`
2. Review NER run status: `GET /api/v1/documents/{id}/runs/` (future endpoint)
3. Contact project lead: Ramadan
