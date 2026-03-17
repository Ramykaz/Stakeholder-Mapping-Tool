# Quickstart — US-05

## Prerequisites
- Docker Desktop running
- Environment variables configured for at least one provider:
  - `LLM_PROVIDER`
  - Provider key(s) and settings (`GROQ_API_KEY`, `OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_KEY`, `GEMINI_API_KEY`)

## 1) Start the stack
```powershell
docker compose down -v ; docker compose up --build -d
```

## 2) Apply migrations and seed taxonomy
```powershell
docker compose exec app python manage.py migrate
```

Expected outcome:
- `EntityLabel` defaults seeded: Person, Organization, Location, Role, Event, Project
- `RelationshipType` defaults seeded: funded, partnered, participated, implemented, mentored, organized, attended, advised

## 3) Verify admin taxonomy operations
1. Open frontend admin page: `http://localhost:3000/admin`
2. Confirm list displays labels and relationship types with active toggles
3. Create one custom label/type, edit it, deactivate it
4. Attempt deleting an in-use taxonomy row and confirm deletion is blocked with deactivate guidance

## 4) Verify joint extraction behavior
1. Upload a document through existing flow
2. Trigger extraction with a provider/model
3. Confirm per chunk only one provider call is made (via logs)
4. Confirm persisted entities are only those with at least one relationship
5. Confirm non-directional relationship duplicates A-B/B-A collapse to one canonical relation

## 5) Verify credential error UX
1. Select a provider with missing/invalid credentials
2. Trigger extraction
3. Confirm run fails with explicit configuration error and remediation guidance:
   - provide valid credentials
   - or choose another configured provider
4. Confirm no automatic fallback provider is used

## 6) Run tests (required before PR)
```powershell
docker compose build app ; docker compose up -d --force-recreate app
docker compose exec app python manage.py migrate
docker compose exec app pytest -q
Set-Location frontend ; npm test -- --runInBand --watch=false
```

Expected outcome:
- Backend suite passes against the freshly rebuilt backend image.
- `manage.py migrate` reports no pending migrations for current model state.

## 7) Contract checks
- Ensure API responses follow `contracts/api.md`
- Ensure provider normalization follows `contracts/provider-interface.md`
- Ensure admin behavior follows `contracts/admin-taxonomy.md`
