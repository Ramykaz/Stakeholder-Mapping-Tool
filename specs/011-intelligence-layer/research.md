# Research: Intelligence Layer (011)

**Branch**: `011-intelligence-layer` | **Date**: 2026-03-24

This document resolves all technical unknowns identified during planning. All decisions are based on direct codebase inspection of the existing implementation.

---

## 1. Semantic Search Infrastructure

**Question**: Does pgvector infrastructure exist and is it ready to query?

**Decision**: Use the existing `Chunk` model's `VectorField(dimensions=384)` directly. No schema changes to chunks required.

**Finding**: The `Chunk` model in `ingestion/models.py` already has `embedding = VectorField(dimensions=384)` populated at ingestion time. The `all-MiniLM-L6-v2` model is already loaded into the Docker volume at `/app/models/all-MiniLM-L6-v2`. The `ProjectQueryView` currently does `Entity.objects.filter(canonical_name__icontains=query)` — it ignores chunks entirely. The fix is to add a `semantic_search.py` service that:
1. Loads the model from the local volume (no download needed)
2. Embeds the query at query time: `model.encode([query])[0]`
3. Runs a pgvector cosine similarity query over `Chunk` objects scoped to the project's documents
4. Extracts entity IDs from the returned chunks via the `Chunk → Entity` relationship

**pgvector query pattern** (using `pgvector-django`'s `CosineDistance`):
```python
from pgvector.django import CosineDistance
chunks = Chunk.objects.filter(
    document__project=project
).annotate(
    distance=CosineDistance('embedding', query_vector)
).order_by('distance')[:top_k]
```

**Alternatives considered**:
- Elasticsearch/OpenSearch: Rejected — no existing infrastructure, adds major dependency
- SQL LIKE search (current): Rejected — ignores all stored embeddings, poor recall on natural language

---

## 2. Entity Flagging Field

**Question**: Does `Entity.is_flagged` exist?

**Decision**: Add a new `is_flagged = models.BooleanField(default=False, db_index=True)` to the Entity model. Do NOT repurpose `needs_review`.

**Finding**: The Entity model has `needs_review = models.BooleanField(default=False)` which is used internally by the dedup pipeline to mark entities for the review queue — it has a different semantic meaning than "user explicitly rejected this entity". A separate `is_flagged` field is needed to avoid collisions. One migration required.

**Alternatives considered**:
- Repurpose `needs_review`: Rejected — `needs_review` is set by the dedup algorithm, not by users. Conflating the two would break the dedup review queue logic.
- Soft-delete (status field): Rejected — the spec is explicit about a boolean flag; a status field adds unnecessary complexity.

---

## 3. Project-Level Provider Fields

**Question**: Does `Project.provider` and `Project.model` exist?

**Decision**: Add `provider = models.CharField(max_length=32, blank=True, default='')` and `model = models.CharField(max_length=64, blank=True, default='')` to the `Project` model in `ingestion/models.py`. One migration required.

**Finding**: The `Project` model has no provider or model fields. The `NERRun` model has `provider` and `model` fields but these are per-extraction-run audit records, not per-project preferences. An empty string default means "fall back to the global `LLM_PROVIDER` env var" — no breaking change for existing projects.

**Provider availability detection**: A new `GET /api/v1/projects/{id}/providers/` endpoint will check which environment variables are set (`GROQ_API_KEY`, `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY`, `GEMINI_API_KEY`) and return a structured list with available/unavailable status per provider. The frontend never reads env vars directly.

**Alternatives considered**:
- Per-user provider preference: Rejected — spec says per-project; teams may have different projects with different compliance requirements
- Global env var only: Current state; rejected because spec requires project-level selection

---

## 4. LLM RAG for Entity Summaries

**Question**: What exists in the summary pipeline and what needs to change?

**Decision**: Replace `_generate_summary_text()` in `ner/services/contextual_summary.py` with a new function that retrieves chunks via pgvector semantic search and calls the LLM provider.

**Finding**: `_generate_summary_text()` currently constructs a template string from entity relations and the concept note. The `ContextualEntitySummary` model (cache), the `get_or_generate_summary()` function, the `expires_at` 24h TTL, and the `evidence_hash` (SHA256 of entity + project + relation IDs) all exist and work correctly. Only the text generation function needs to be replaced. The cache, TTL, and invalidation logic are preserved as-is.

**RAG approach for summaries**:
1. Embed `entity.canonical_name` using `all-MiniLM-L6-v2`
2. Retrieve top-K chunks from the project's documents via cosine similarity
3. Build prompt: retrieved chunk texts + entity metadata + concept note → send to LLM via existing `JointExtractionProvider` abstraction (or a new `SummarizationProvider` protocol following the same pattern)
4. Store result in `ContextualEntitySummary` via existing `_upsert_cache()`

**Prompt template**: `prompts/entity_summary_rag.txt` — versioned per constitution.

**Alternatives considered**:
- Replace entire summary service: Rejected — the cache, TTL, and evidence-hash logic are correct and should be preserved
- Use a different embedding for entity name lookup: Rejected — consistency with ingestion is critical; same model must be used

---

## 5. NL Query Detection and LLM RAG

**Question**: How to detect NL questions vs. entity name lookups?

**Decision**: A query is classified as a natural language question if it contains a question word (`who`, `what`, `where`, `when`, `which`, `how`, `why`, `is`, `are`, `can`, `does`) OR has more than 3 tokens after splitting on whitespace.

**Finding**: The current `ProjectQueryView` returns entity IDs and a plain-text answer string assembled from entity names. The new flow: if NL question detected → semantic search for top-K chunks → send chunks + query to LLM → return `{answer, entity_ids, is_nl_query: true}`. If not NL → semantic search for entity IDs only → return `{entity_ids, is_nl_query: false}`. The frontend already highlights nodes from `entity_ids`; only the answer panel display is new.

**NL query prompt template**: `prompts/nl_query_rag.txt` — versioned.

**Alternatives considered**:
- ML-based intent classifier: Rejected — overkill for this use case; simple heuristic is sufficient and testable
- Always run LLM (even for entity name lookups): Rejected — unnecessary cost and latency for simple lookups

---

## 6. Dedup Review Queue — Existing Infrastructure

**Question**: Does the `EntityReviewCandidate` model exist and what API is needed?

**Decision**: Build a new `GET /api/v1/projects/{id}/review/` endpoint and a `POST /api/v1/review-candidates/{candidate_id}/resolve/` endpoint. No model changes needed.

**Finding**: `EntityReviewCandidate` fully exists with `status` (pending/merged/kept_separate/resolved_stale), `left_entity`, `right_entity`, `similarity_score`, `resolved_by`, and `resolved_at`. The model is scoped per `document` (FK). The project scope is inferred via `document__project`. The existing Django admin surfaces this — this spec adds a project-owner-accessible REST API and frontend page. The `EntityReviewCandidate` is linked to documents, not projects directly; the query will be `EntityReviewCandidate.objects.filter(document__project=project, status='pending')`.

**Merge logic**: When a user resolves as Merge, the backend: picks the left entity as canonical (or higher-confidence one), moves all relations from the right entity to the left entity, adds the right entity's `canonical_name` as an `EntityAlias` on the left, soft-deletes or deactivates the right entity, sets `status='merged'`. This logic will be implemented in a new `resolve_review_candidate()` service function.

---

## 7. Entity Mention Timeline

**Question**: What data exists for the timeline?

**Decision**: Build `GET /api/v1/entities/{id}/timeline/?project_id={id}` that queries the `Chunk` model. Each chunk has a reference to its `Document` (with `created_at` upload date). The timeline is assembled by finding all chunks that contain the entity's `canonical_name` in their text, ordered by `document.created_at`.

**Finding**: There is no explicit `EntityMention` model. Chunks store the raw text; entity-to-chunk relationships exist via `Entity.chunk_id` (FK to Chunk) and `Entity.document_id` (FK to Document). The simplest approach: filter `Chunk.objects.filter(document__project=project, text__icontains=entity.canonical_name).select_related('document').order_by('document__created_at')`. The context snippet is a 280-character slice of `chunk.text` around the first mention.

**Alternatives considered**:
- Add a dedicated EntityMention model: Rejected — adds a migration and backfill complexity; the chunk text + entity name lookup achieves the same result without schema changes
- Use Entity.raw_mentions JSONField: Contains surface forms from text but no chunk/document references — insufficient for timeline

---

## 8. Per-Document Extraction Stats

**Question**: Can entity/relation counts be derived from existing models?

**Decision**: Annotate the document list with counts from `NERRun` and `Entity` models. No new model fields needed.

**Finding**: `NERRun` has `relations_created` (int, nullable). `Entity` objects are linked to documents via `document_id` FK. Per-document stats can be computed with:
- Entity count: `Entity.objects.filter(document_id=doc.id, run__status='completed').count()`
- Relation count: `NERRun.objects.filter(document_id=doc.id, status='completed').aggregate(total=Sum('relations_created'))['total'] or 0`
- Confidence distribution: three buckets — high (≥0.8), medium (0.5–0.8), low (<0.5)
- Top 5 entities: `Entity.objects.filter(document_id=doc.id).order_by('-confidence')[:5]`

The documents list API (`GET /api/v1/projects/{id}/documents/`) needs a `?include_stats=true` query parameter to return this data without impacting baseline performance.

---

## 9. Global Entity View

**Question**: What query supports the global entities page?

**Decision**: `GET /api/v1/entities/` (global, no project scope) returns all entities the authenticated user has access to, annotated with cross-project frequency.

**Finding**: The existing `Entity` model has `project` FK. A global query with annotations:
```python
Entity.objects.filter(
    project__owner=request.user  # or project__documents__document__project__owner
).annotate(
    project_count=Count('project', distinct=True),
    document_count=Count('document_id', distinct=True),
    confidence_min=Min('confidence'),
    confidence_max=Max('confidence'),
).order_by('-project_count')
```

The existing `/api/v1/entities/{id}/profile/` endpoint (global entity profile) will serve the detail view — no new endpoint needed for the detail page.

---

## 10. D3.js vs Cytoscape.js ADR

**Decision**: Recommend **staying with Cytoscape.js**. Produce `docs/ADR-graph-library.md`.

**Rationale** (based on research):
- **Edge bundling at 500+ nodes**: Cytoscape.js handles 1k–10k nodes via WebGL renderer (`cytoscape-canvas`) without layout degradation. D3 edge bundling requires `d3-force` + custom bundling (significant engineering effort).
- **Custom layout support**: Cytoscape.js has `cytoscape-cose-bilkent` (force-directed with clustering), `cytoscape-cola` (constraint-based), and direct layout plugins. D3 requires building layouts from scratch.
- **Louvain clustering**: Neither library ships Louvain natively. Both require the same external algorithm — no difference.
- **Timeline layout**: Cytoscape.js supports custom positional layouts (used in spec 010 for type-based clustering). D3 has better built-in timeline/scrollable layouts but this is not a current requirement.
- **Animation quality**: Comparable. D3 has finer-grained transition control; Cytoscape.js is sufficient for current hover/focus animations.
- **Bundle size**: Cytoscape.js ~900KB minified. D3 (full) ~500KB but requires many sub-packages for graph visualization, netting ~700–800KB in practice.
- **Next.js SSR**: Both require `typeof window !== 'undefined'` guards for SSR. Cytoscape.js is already integrated and working with the existing guard pattern.
- **Migration effort**: Migrating to D3 would require rewriting `GraphVisualization.tsx` (~600 lines), all layout logic in `graphFocus.ts`, and all stylesheet logic in `cytoscapeStyle.ts`. Estimated 3–5 days engineering plus re-testing all graph features from specs 008–010.

**Conclusion**: Cytoscape.js meets all current and foreseeable requirements. Migration to D3 provides no meaningful benefit and carries 3–5 days of migration risk. Stay with Cytoscape.js.
