# Quickstart — US-07

## Prerequisites
- Docker Desktop running
- `.env` configured for existing backend/frontend stack
- Branch: `007-project-model-concept-note-api`

## 1) Rebuild and start services
```powershell
docker compose up --build -d app frontend
```

## 2) Apply migrations
```powershell
docker compose exec app python manage.py migrate
```

## 3) Verify default project migration
```powershell
docker compose exec app python manage.py shell -c "from ingestion.models import Project, Document; print('projects', Project.objects.count()); print('docs_without_project', Document.objects.filter(project__isnull=True).count())"
```
Expected:
- `projects >= 1`
- `docs_without_project == 0`

## 4) Validate project + concept note API flow
1. `POST /api/v1/projects/` create project.
2. `POST /api/v1/projects/{id}/concept-note/` save context.
3. `GET /api/v1/projects/{id}/concept-note/` verify persisted data.

## 5) Validate scoped upload/extraction/read flow
1. Upload via `POST /api/v1/projects/{id}/documents/`.
2. Trigger extraction via `POST /api/v1/projects/{id}/extract-entities/`.
3. Read scoped entities/graph via:
   - `GET /api/v1/projects/{id}/entities/`
   - `GET /api/v1/projects/{id}/graph/`
4. Confirm no cross-project records are returned.

## 6) Validate global entity profile
- `GET /api/v1/entities/{entity_id}/`
- Confirm response includes all project memberships for entity.

## 7) Regression tests (required)
```powershell
docker compose exec app pytest -q
Set-Location frontend ; npm test -- --runInBand --watch=false
```

## 7.1) Validation log (latest)
- Rebuild command run before test execution:
   - `docker compose up --build -d app frontend`
- Backend regression:
   - Command: `docker compose exec app pytest -q`
   - Result: `131 passed in 135.51s`
- Frontend regression:
   - Command: `npm test -- --runInBand --watch=false`
   - Result: `4 passed suites, 53 passed tests`

## 8) Backward compatibility check
- Call existing legacy endpoints used by prior specs.
- Verify they still return valid responses during transition.
