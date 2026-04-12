# System Logic — End-to-End Functional Walkthrough

Date: 2026-04-10

This document explains how the full Stakeholder Analysis Tool works, from authentication and project setup to ingestion, extraction, review, graphing, reporting, stakeholder prioritization, and export.

## 1) Runtime architecture and service boundaries

The system runs as a Docker Compose stack with four primary services:

1. `app` (Django + DRF API):
   - Owns domain logic, persistence orchestration, and API contracts.
   - Executes synchronous and asynchronous-safe flows for ingestion, extraction, review edits, graph projection, reports, SMQ, personas, and exports.

2. `worker` (Celery worker):
   - Executes background jobs for long-running generation tasks (report sections, workplan, stakeholder notes, and related asynchronous operations).

3. `redis`:
   - Message broker/result backend for Celery and lightweight state/cancel signaling.

4. `frontend` (Next.js):
   - Presents workflow UI across project setup, document operations, analyze, map, entities, report, stakeholders, and export tabs.

The database is PostgreSQL (Supabase in deployed environments), with pgvector used for semantic search vectors.

## 2) Core data model and ownership boundaries

### Primary ownership hierarchy

1. User owns Project.
2. Project owns Documents, WebSources, profile/context, guidance, and downstream derived analysis artifacts.
3. Document owns chunks and extraction lineage.

### Analysis lineage entities

- `Document`: ingestion status, extracted timestamps, cleaned/raw text.
- `Chunk`: tokenized/segmented portions used for embedding and extraction.
- `NERRun`: extraction run metadata (provider/model/tokens/cost/status).
- `Entity`: canonical extracted node in project graph.
- `EntityMention`: document-level evidence binding entity to source text.
- `Relation`: directional link between entities with confidence and provenance excerpt.

### Governance and outputs

- `InitiativeProfile`, `ConceptNote`, and `ExtractionGuidance` shape prompt context.
- `SMQ*`, `ReportSection`, `StakeholderPersona`, and workplan tables store generation outputs.

### Security boundary

All project/document/entity endpoints are user-scoped. Access checks consistently enforce owner isolation before reads/writes.

## 3) Authentication and request lifecycle

1. Frontend stores token after login.
2. API requests include `Authorization: Token <key>`.
3. DRF auth resolves user; endpoint helpers enforce owner checks.
4. Endpoint executes domain logic.
5. Response returns normalized JSON payload; frontend state updates via API client layer.

## 4) Document ingestion logic (files, URLs, crawl, paste)

### File upload flow

1. User uploads file (`pdf`, `docx`, `txt`, `md`).
2. API validates size/format.
3. Pipeline extracts raw text.
4. Text cleaning produces `cleaned_text` (raw preserved for audit).
5. Chunker splits cleaned text.
6. Embedder computes vectors for each chunk.
7. Transaction writes chunks and marks document processing status.
8. Errors are surfaced with structured, user-safe messages.

### Web source flow

1. User submits URL/crawl/pasted source.
2. Web source record is queued.
3. Worker fetches and normalizes content (stricter cleaner for web-noise suppression).
4. Content is ingested through the same chunk/embed path.
5. Web source status transitions through queued/processing/processed/error.

## 5) Incremental extraction logic

### Project-level extraction (`Analyze` page)

1. Endpoint selects only project documents where `extracted_at is null`.
2. For each selected doc:
   - Runs joint extraction (entities + relationships).
   - If relations are zero but entity signal is high, relation-only fallback executes.
   - Marks document `extracted_at=now` on completion.
3. Returns per-document and aggregate metrics.
4. If no new docs, returns a successful no-op payload (not an error).

### Single-document re-extract (`Documents` page)

1. Endpoint clears `extracted_at` for selected document.
2. Runs extraction for that document only.
3. Executes same fallback relation logic when needed.
4. Sets `extracted_at` again on completion.

### Why this design

- Prevents repeated unnecessary extraction costs.
- Enables surgical reprocessing for one document.
- Keeps project-wide extraction deterministic and auditable.

## 6) Extraction context composition and guidance precedence

Prompt context is assembled from:

1. Initiative profile / concept context (project-level baseline context).
2. Extraction guidance entries (explicit, high-priority extraction rules).
3. Runtime taxonomy constraints (entity labels / relationship types).

Guidance is additive and designed so extraction-specific instructions override generic context intent where needed.

## 7) Evidence integrity and anti-hallucination enforcement

1. Candidate entity text is checked against chunk evidence.
2. Candidates lacking evidence are dropped.
3. Persisted entities receive mention evidence rows (`EntityMention`).
4. Relations store provenance excerpt and source document when available.
5. Graph APIs filter out orphaned entities (no mention evidence).
6. Cleanup command removes historical orphan entities.

Result: graph nodes are evidence-backed, not free-floating hallucinations.

## 8) Document review and correction workflow

Per-document review APIs provide:

- Entity list (name/type/confidence/mention count/excerpt).
- Relationship list (source/label/target/confidence/provenance snippets).
- Actions: relabel relationship, delete relationship, correct entity canonical fields, delete entity mention.

On destructive edits:

1. Related caches are invalidated (including contextual summaries when evidence changes).
2. Graph and downstream views reflect updated state on next fetch.

## 9) Frontend status state machine and polling behavior

### Documents page

1. Polls while file processing or extraction state is pending/extracting.
2. Per-document action transitions show visible status (`analyzing` -> `completed`/`updated`).
3. State is sourced from backend (`extraction_state`) so refresh/navigation does not lose progress visibility.

### Analyze page

1. Shows count of new documents eligible for incremental extraction.
2. If extraction continues in background, page detects extracting docs and shows active analyzing state.
3. Polls until extracting docs resolve, then refreshes entities/graph and shows completion state.
4. Navigation away and back keeps status continuity via server state, not only local flags.

## 10) Graph logic and projection

1. Graph endpoint resolves mention-backed entities only.
2. Builds nodes with style metadata and confidence/degree attributes.
3. Builds edges from relation records with confidence and direction.
4. Frontend supports focus/filter and neighborhood views.
5. Entity detail page includes mini-graph (1-hop) for local traversal.

## 11) Contextual summaries, SMQ, and report generation

### Contextual summary

1. Checks evidence threshold.
2. If insufficient evidence, returns explicit insufficiency status.
3. If sufficient, composes grounded prompt using project context + excerpts + relations.
4. Caches output with evidence hash; invalidates on edits affecting evidence.

Detailed generation logic:
- Evidence package includes cleaned excerpts, relationship statements, and mention-level context.
- Prompt context is project-scoped and anchored to persisted graph/evidence records.
- Output is normalized before response to reduce markdown artifacts and noisy formatting.
- Cache invalidation is triggered by mention/relationship edits so stale summaries are not reused.

### SMQ

1. Loads section templates and existing answers.
2. AI generation uses retrieved evidence and project context.
3. Placeholder normalization uses initiative name where applicable.

Detailed generation logic:
- Provider/model are resolved from project-level LLM settings.
- Prompt construction combines section question intent, initiative context, and retrieved evidence snippets.
- Normalization pipeline cleans markdown artifacts and placeholder residue before persistence.
- Retry/error mapping path returns user-safe messages for quota/rate/provider failures.

### Report sections

1. Section generation can run async.
2. Status lifecycle: pending/generating/done/error/stale.
3. Handles transient error recovery states and stale detection after new extraction evidence.
4. Supports regeneration with custom instruction.

Detailed generation logic:
1. `generate_all_sections` initializes each section as `pending` and clears prior transient errors.
2. Section workers run in parallel (provider-aware cap; Groq uses single-worker path, others use bounded concurrency).
3. Each section run loads project + section + SMQ answer + top semantic chunks.
4. Graph-evidence summary is computed from entity mention volumes and observed relationship patterns.
5. Prompt is assembled from:
   - section title,
   - SMQ answer (truncated guardrail),
   - project context (truncated guardrail),
   - chunk evidence excerpts,
   - graph context,
   - optional user custom instruction.
6. Generation attempts use progressive context/token settings to improve completion robustness.
7. Post-processing applies:
   - markdown normalization,
   - initiative placeholder replacement,
   - stripping of forbidden non-document references/tokens.
8. Quality gate rejects low-value outputs based on minimum length/paragraph count and anti-paraphrase similarity checks.
9. If accepted, section is persisted as `done` with citations and `generated_at` timestamp.
10. If generation fails, section is persisted as `error` with user-facing remediation-safe message.
11. Worker-level exceptions are isolated so one section failure does not crash the entire section batch.

## 12) Stakeholder prioritization, personas, and workplan

1. Priority table computes weighted stakeholder scores from graph and evidence context.
2. Personas and workplan components are generated from validated project context/evidence.
3. Export layer packages report/personas/workplan outputs into PDF/DOCX.

## 13) Error handling and resiliency strategy

1. Endpoint-level validation returns structured API errors.
2. Provider errors are normalized for user-facing remediation guidance.
3. Retry/fallback strategies exist in extraction and provider runtime paths.
4. Health endpoint validates database connectivity.
5. Docker DNS hardening is applied for app/worker connectivity reliability.

Additional resilience details for generation/extraction:
- Database capacity saturation (for example, Supabase `max clients reached`) is detected and mapped to actionable user messages.
- Report generation uses bounded parallelism to reduce database session pressure during async section fan-out.
- Section-level failures are isolated; successful sections remain persisted even if one section fails.
- Cancellation signals are checked during generation to stop expensive runs quickly and safely.
- Extraction fallback logic (relations-only fallback) prevents silent low-output failures when entity signal exists.

## 14) Performance and consistency controls

1. Incremental extraction avoids redundant work.
2. Lazy-loaded document review reduces initial payload weight.
3. Polling is conditional and stops when no active processing remains.
4. Memoization and targeted refresh patterns reduce frontend recompute overhead.
5. Transactions preserve ingestion consistency under failure conditions.

## 15) Current verified quality state

1. Full backend suite passing (224 tests).
2. Full frontend suite passing (61 tests).
3. New integration tests added for document endpoint lifecycle and incremental extraction semantics.
4. Containers rebuilt and service health validated.

## 16) Operator runbook (practical sequence)

1. Bring stack up (`app`, `worker`, `frontend`, `redis`).
2. Confirm health endpoint and container status.
3. Upload documents/sources.
4. Run incremental analysis (project-level) or document-level re-extract.
5. Review and correct entities/relations.
6. Validate graph and entity summaries.
7. Generate report/personas/workplan.
8. Review stakeholder table.
9. Export artifacts.

This sequence reflects the intended operational workflow and the dependency order used by the system logic.

## 17) Extraction internals (deep dive)

### 17.1 Ingestion-to-extraction pipeline

1. Raw text is extracted from source content and retained for auditability.
2. Cleaner produces normalized `cleaned_text` used by all downstream NLP steps.
3. Chunking splits cleaned text into embedding/extraction-ready segments.
4. Embedding service produces vectors for semantic retrieval.
5. Extraction service runs entity and relation passes with project taxonomy/guidance context.
6. Evidence validator requires mention-backed persistence (no mention -> no entity persistence).
7. Persistence writes entities, mentions, and relations with provenance excerpts/source linkage.

### 17.2 Incremental semantics and determinism

- `extracted_at is null` = eligible for project-level extraction.
- `re-extract` endpoint explicitly resets one document for targeted rerun.
- This design preserves deterministic project-level runs and avoids redundant cost.

### 17.3 Evidence integrity guardrails

- Entity candidate text is validated against chunk evidence before persistence.
- Relation rows keep directional source/target and provenance snippet.
- Graph payload excludes orphan entities (no mentions).
- Cleanup command removes historical orphan residue from legacy states.

## 18) LLM orchestration internals (deep dive)

### 18.1 Provider/model resolution

- Provider/model selection is project-scoped and centrally resolved by provider abstraction.
- Runtime clients normalize provider-specific error payloads into unified handling.

### 18.2 Prompt assembly strategy

- Prompts are composed from structured templates plus runtime evidence payloads.
- Context windows are bounded by truncation guards to control token pressure.
- Custom user instruction is injected as an additive constraint, not a full prompt replacement.

### 18.3 Output normalization and quality controls

- Outputs pass normalization layer to remove markdown artifacts and formatting noise.
- Domain-specific sanitization removes forbidden internal-reference labels.
- Quality gates reject generic/paraphrased low-signal text before final persistence.

### 18.4 Async execution and status model

- Celery tasks own long-running generation (report/workplan/persona families).
- Status progression is explicit (`pending -> generating -> done/error/stale`).
- Frontend polling reads persisted status rather than local assumptions, preserving refresh safety.

### 18.5 Failure modes and recovery

- Rate limits and quota exhaustion surface clear remediation messages.
- DB capacity spikes surface “temporarily busy” guidance instead of raw stack traces.
- Failed sections remain retryable through regenerate endpoints without corrupting completed sections.