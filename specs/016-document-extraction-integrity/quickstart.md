# Quickstart Validation — US-016

## Implementation Tracking Notes
- Mark tasks complete in specs/016-document-extraction-integrity/tasks.md as each scenario below is validated.
- Suggested backend sanity check:
  - `docker compose run --rm --entrypoint python app manage.py check`
- Suggested focused backend tests:
  - `docker compose run --rm --entrypoint pytest app ingestion/tests/test_views.py ner/tests/test_views.py ner/tests/test_contextual_summary_api.py -q`
- Suggested frontend validation:
  - `cd frontend && npm test -- --runInBand`

## Preconditions
- App, worker, frontend, and redis are running via Docker Compose.
- A project exists with at least 3 documents (mix of extracted and unextracted).
- At least one extracted document contains entities and relationships.

## 1) Incremental extraction behavior
1. Open project Documents page.
2. Verify action label reads `Extract N new documents` and `N` matches documents with no extraction timestamp.
3. Trigger extraction.
4. Verify only previously unextracted documents move through extraction states.

Expected:
- Existing extracted documents are skipped by default.
- Newly extracted documents show `Extracted` state and extraction timestamp.

## 2) Re-extract one document
1. On a processed document row, click `Re-extract this document`.
2. Verify only that row transitions to extracting state.
3. Wait for completion.

Expected:
- Only selected document is reprocessed.
- Other document extraction states remain unchanged.

## 3) Document-level review panel
1. Expand one processed document review panel.
2. Open `Entities` tab and verify columns for canonical name, type, confidence, excerpt.
3. Open `Relationships` tab and verify source -> type -> target, confidence, excerpt.
4. Edit one relationship type and one entity name/type; delete one false-positive row.

Expected:
- Review data loads lazily on first panel open.
- Edits/deletes apply immediately to graph-backed data.

## 4) Orphan integrity
1. Remove final mention for a low-support entity via document review.
2. Refresh project graph.

Expected:
- Entity is absent from graph if no mentions remain.
- No graph response includes entities with zero mentions.

Operational runbook command:
- `docker compose run --rm --entrypoint python app manage.py cleanup_orphan_entities`
- Scoped cleanup: `docker compose run --rm --entrypoint python app manage.py cleanup_orphan_entities --project-id <project_uuid>`

## 5) Cleaning pipeline verification
1. Upload or re-extract a document containing URLs, nav fragments, and markup-like noise.
2. Inspect excerpts in document review and entity detail.

Expected:
- Excerpts do not show URLs/navigation/code-like noise.
- Cleaned text is the source for extraction and displayed evidence.

## 6) Context summary quality
1. Open entity detail for entity with strong evidence (>=2 excerpts and >=2 relationships).
2. Generate or refresh summary.
3. Edit/delete one supporting relationship and reload.

Expected:
- Summary is project-specific and evidence-grounded.
- Summary cache invalidates on relationship change.
- Low-evidence entities show insufficiency message instead of generic summary.

## 7) Mini-graph traversal
1. Open entity detail for connected entity.
2. Verify mini-graph appears between stats and relationships.
3. Click a neighbor node.

Expected:
- Static 1-hop radial mini-graph renders with labels.
- Click navigates to neighbor entity detail.
- For disconnected entities, show `No connections extracted from documents yet.`

## Suggested regression commands
- Backend targeted checks:
  - `docker compose run --rm --entrypoint pytest app ingestion/tests ner/tests -q`
- Frontend targeted checks:
  - `cd frontend && npm test -- --runInBand`

## Validation Completion Checklist
- [ ] Incremental extraction behavior verified
- [ ] Re-extract single document verified
- [ ] Document review panel + inline edits/deletes verified
- [ ] Orphan cleanup + graph integrity verified
- [ ] Cleaned-text evidence excerpts verified
- [ ] Contextual summary insufficiency + refresh verified
- [ ] Mini-graph render/click-through/no-connections verified
