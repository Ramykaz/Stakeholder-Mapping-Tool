# Quickstart — US-06

## Prerequisites
- Docker Desktop running
- Backend/frontend dependencies installed through existing compose flow

## 1) Start stack
```powershell
docker compose down -v ; docker compose up --build -d
```

## 2) Apply migrations
```powershell
docker compose exec app python manage.py migrate
```

## 3) Validate acronym seed
```powershell
docker compose exec app python manage.py shell -c "from ner.models import AcronymMap; print(AcronymMap.objects.filter(active=True).count())"
```
Expected: non-zero rows including UNDP/WHO/SDG/UNICEF/FAO.

## 4) Run extraction and verify dedup behavior
1. Upload a document with repeated names, acronym/full-form pairs, and near-duplicates.
2. Trigger extraction endpoint as normal.
3. Call entities endpoint and confirm:
   - aliases returned
   - parent links returned for phase variants
   - deduplicated mention counts returned
   - review flags present for borderline fuzzy matches

## 5) Verify review workflow in UI
1. Open entities page for the document.
2. Confirm review banner appears when pending candidates exist.
3. Execute `Merge` on one pair and `Keep Separate` on another.
4. Refresh and verify candidates resolve correctly.

## 6) Run tests (required)
```powershell
docker compose exec app pytest -q
Set-Location frontend ; npm test -- --runInBand --watch=false
```

### Latest validation run (2026-03-17)
- Rebuild step used before test execution:

```powershell
docker compose up --build -d app frontend
```

- Backend regression:

```powershell
docker compose exec app pytest -q
```

Result: **PASS** (`131 passed`).

- Frontend regression:

```powershell
npm test -- --runInBand --watch=false
```

Result: **PASS** (`53 passed`, `4 suites passed`).

## 7) Contract check
- Ensure entity endpoint payload includes aliases, parent refs, review flag, mention_count_dedup.
- Ensure review action endpoints support both `merge` and `keep_separate` outcomes.
- Ensure entities page displays the review banner and action buttons when `review-candidates` API returns pending items.
