# Quickstart: Multi-LLM NER Selection

## 1) Configure Environment

Set these variables in `.env` (or your deployment secret store):

- `DATABASE_URL`
- `DEBUG`
- `ALLOWED_HOSTS`
- `GROQ_API_KEY`
- `OPENAI_API_KEY`

`OPENAI_API_KEY` is required only when selecting OpenAI provider in extraction.

## 2) Build and Run Django Backend

```bash
docker compose build app
docker compose up -d app
```

Apply migrations in the container:

```bash
docker compose run --rm --entrypoint /bin/sh app -lc "python manage.py migrate"
```

## 3) Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## 4) Validate API Behavior

Trigger extraction with OpenAI model selection:

```bash
curl -X POST "http://localhost:8000/api/v1/documents/<document_uuid>/extract-entities/" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","model":"gpt-5-mini"}'
```

Expected extraction response includes:

- `provider`
- `model`
- `run_id`
- `tokens_input`
- `tokens_output`
- `tokens_cached`
- `cost_usd`

Fetch run history for a document:

```bash
curl "http://localhost:8000/api/v1/documents/<document_uuid>/runs/"
```

Expected response includes:

- `document_id`
- `runs` (ordered newest-first)
- `total_count`

## 5) Verify Frontend Flows

1. Upload a document in Upload page.
2. Choose provider (`Groq` or `OpenAI`).
3. If `OpenAI`, choose model (`gpt-5-mini` or `gpt-5-nano`).
4. Run extraction and confirm `Run Metadata` panel shows provider/model/tokens/cost.
5. Open Entities page and confirm `Extraction Runs` panel lists each run independently.

## 6) Test Commands and Current Results

Frontend suites used for this feature:

```bash
cd frontend
npm test -- --runInBand src/__tests__/pages/upload.test.tsx src/__tests__/pages/entities.test.tsx src/__tests__/lib/api.test.ts
```

Result (2026-03-15):

- `3 passed`
- `33 tests passed`

Backend suites used for this feature in Django container environment:

```bash
docker compose build app
docker compose run --rm --entrypoint /bin/sh app -lc "pytest ner/tests/test_views.py ner/tests/test_pipeline.py ner/tests/test_openai_client.py ner/tests/test_costing.py"
```

Result (2026-03-15):

- `31 passed`
- `0 failed`

## 7) Regression Checklist

- Groq remains default when provider/model are omitted.
- OpenAI extraction returns Groq-compatible entity structure for downstream consumers.
- Cost/token fields are returned when usage is available.
- Cost/token fields are nullable without failing extraction.
- Multiple extraction runs for a single document are retained and listed via run-history endpoint/UI.
