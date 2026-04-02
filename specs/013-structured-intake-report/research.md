# Research: Structured Initiative Intake + SMQ + RAG Report Generation

**Branch**: `013-structured-intake-report`
**Date**: 2026-04-02

---

## Decision 1: Async Strategy for Report Generation

**Decision**: ThreadPoolExecutor + DB status tracking + polling endpoint (no Celery, no Redis)

**Rationale**:
The constitution mandates KISS and warns against premature infrastructure additions. The existing codebase is entirely synchronous — no Celery, no Redis, no async Django. Adding Celery + Redis + a Celery worker container doubles the infrastructure footprint with no other benefit than this one feature.

The actual requirement ("sections generate without blocking, progress shown per section") can be satisfied with:
1. A `ReportSection` model with a `status` field (pending → generating → done → error)
2. A `generate/` POST endpoint that spawns a `ThreadPoolExecutor` task per section (up to 4 parallel, limited by Groq rate limits)
3. A `status/` GET endpoint that the frontend polls every 2 seconds
4. Sections write their result to the DB as they complete

This approach:
- Requires zero new infrastructure packages
- Uses Python stdlib `concurrent.futures.ThreadPoolExecutor`
- Is deterministically testable (mock the thread executor in tests)
- Can be migrated to Celery later without changing API contracts

**Alternatives considered**:
- Celery + Redis: Adds 2 new services to Docker Compose, a new package, and significant operational complexity. Rejected — KISS.
- Django Q: Uses DB as queue. Better than Celery for DB-only setups but still adds a package and a separate worker. Rejected — ThreadPoolExecutor is sufficient for ≤8 concurrent tasks.
- Server-Sent Events (SSE): Django 4.2 supports SSE via streaming responses. Complex to test, requires long-lived HTTP connections. Rejected — polling is simpler and reliable.
- Synchronous one-section-at-a-time: Simplest but blocks the user for 5–8 seconds per section. Acceptable for single-section "Generate" buttons, but "Generate All" would block for 40+ seconds. Rejected for batch generation.

**Implementation notes**:
- `ThreadPoolExecutor(max_workers=4)` is safe: max 4 concurrent LLM calls per request, respecting Groq free tier rate limits
- Thread pool is created per-request (not a global pool) to avoid Django ORM connection sharing issues across threads
- Each thread uses `django.db.close_old_connections()` at entry to avoid stale DB connections
- Django ORM writes inside threads are safe as each thread gets its own DB connection from the pool

---

## Decision 2: InitiativeProfile vs ConceptNote Integration

**Decision**: Add `InitiativeProfile` as a new `OneToOne` to `Project`. Keep `ConceptNote` model intact. Write `get_project_context()` as a module-level helper in `ingestion/services/context.py`.

**Rationale**:
The `ConceptNote` model (in `ingestion/models.py`) is a OneToOne with `Project`, storing `content` (TextField) and an optional `attachment` (FileField). It is used in NER extraction, entity summary, and NL query. Changing this model risks breaking 15+ existing migration and view references.

Instead:
- `InitiativeProfile` is a new Django model in the `ingestion` app (OneToOne to Project)
- Fields: `initiative_name`, `geography`, `thematic_area`, `core_objectives`, `expected_outcomes`, `stakeholder_focus`
- Has a `to_context_string()` method that formats all fields into a rich text block
- `get_project_context(project)` helper: returns `project.initiative_profile.to_context_string()` if exists, else `project.concept_note.content` if exists, else `project.description`
- All existing code that previously read `project.concept_note.content` is updated to call `get_project_context(project)`

**Migration path**:
- New migration adds `InitiativeProfile` table (empty, not required)
- Existing projects: `InitiativeProfile` is created on-demand when user opens the intake form for the first time, pre-filling `core_objectives` from `concept_note.content`
- No data is lost; `ConceptNote` model is not touched

**Alternatives considered**:
- Add fields directly to `ConceptNote`: Would require `ConceptNote` to become a structured model, but its `content` field is referenced in many places. Risky. Rejected.
- Add fields directly to `Project`: Project model already has 8+ fields and a pending `provider/model` migration. Adding 6 more fields increases coupling. Rejected.
- Replace `ConceptNote` entirely: Data loss risk, migration complexity. Rejected.

---

## Decision 3: SMQ Template Data Storage

**Decision**: `SMQTemplate` (global singleton with 8 sections) and `SMQSection` as separate DB models, seeded via Django data migration reading `docs/smq.txt`. Per-project answers stored in `ProjectSMQAnswer` (one row per project per section).

**Rationale**:
The SMQ has 8 sections with stable titles (from `docs/smq.txt`). These are configurable by admin per constitution requirement (FR-008). Storing them in the DB (rather than hardcoding in code or fixtures) allows admin management via Django admin without code changes.

Seeding approach:
- Add `docs/smq.txt` to the repository (commit with this branch)
- Write a Django data migration `0018_smq_template.py` that reads `docs/smq.txt` at migration time, parses the 8 sections, and creates `SMQTemplate` + `SMQSection` records
- The migration is idempotent (`get_or_create` based on `section_number`)

**Alternatives considered**:
- Django fixture (JSON/YAML loaddata): Requires a separate command to seed. Rejected — data migration runs automatically on deploy.
- Hardcode sections in Python constants: Not admin-configurable. Rejected per FR-008.

---

## Decision 4: ExtractionGuidance Injection Strategy

**Decision**: Add a `guidance_items` field (rendered as a bulleted list) to the existing extraction prompt template in `prompts/`. The `get_extraction_prompt()` function (or equivalent in `ner/services/`) gains a `guidance_items: list[str]` parameter. If empty, the guidance block is omitted from the prompt.

**Rationale**:
The extraction prompt is already templated (from the `prompts/` directory). Injecting guidance as a structured block (not appended free-text) ensures the LLM sees it as explicit instructions, not as part of the document text. The block is placed after the concept note context and before the document chunk.

Format in prompt:
```
EXTRACTION GUIDANCE (follow these instructions strictly):
- [guidance item 1]
- [guidance item 2]
```

**Alternatives considered**:
- Append guidance to concept_note string: Mixes analytical context with operational instructions. Rejected.
- System-level prompt injection: Some providers (OpenAI) support separate system + user messages. Consistent injection point in the user message is simpler and works across all providers. Rejected.

---

## Decision 5: Priority Score Formula and Stakeholder Table

**Decision**: `priority_score = graph_degree × avg_confidence`. Computed at query time from existing `Relation` and `Entity` tables, not pre-stored per default. Cache via `StakeholderPriorityEntry` table with project-level cache invalidation on new extraction.

**Rationale**:
Graph degree is derivable from `Relation.objects.filter(project=project).values('subject').annotate(count=Count('id'))`. Average confidence is derivable from `Entity.objects.filter(project=project)`. Both are fast queries. Pre-computing and caching avoids recomputation on every page load, but only saves ~50ms. Given the table is shown per-project (one user at a time), caching is optional for MVP.

**For MVP**: compute at query time, no `StakeholderPriorityEntry` table needed. If performance becomes an issue (>200 entities), add the cache table in a follow-up.

**Revised spec assumption**: `StakeholderPriorityEntry` is removed from the data model for MVP. Priority scores are computed on-demand from existing data.

---

## Decision 6: PDF Export for SMQ Report

**Decision**: Reuse the existing `ReportLab` PDF generation infrastructure in `ner/views.py`. The SMQ report PDF follows the same pattern as `ProjectExportReportPDFView` but with 8 SMQ sections instead of 5 narrative sections. Shared utility functions (`_pdf_safe()`, `_build_header()`) are extracted to `ner/services/pdf_utils.py`.

**Rationale**:
`ReportLab` is already in `requirements.txt`. The existing `ProjectExportReportPDFView` builds a multi-section PDF with tables, headings, and citations. Reusing this avoids adding WeasyPrint or any new dependency.

---

## Decision 7: New Django App vs Existing Apps

**Decision**: New models go in `ingestion/` app (`InitiativeProfile`, `ExtractionGuidance`) and `ner/` app (`SMQTemplate`, `SMQSection`, `ProjectSMQAnswer`, `ReportSection`). No new Django app is created.

**Rationale**:
- `InitiativeProfile` and `ExtractionGuidance` are project configuration → `ingestion/` (which owns Project and ConceptNote)
- SMQ and Report models are intelligence-layer features → `ner/` (which owns all analysis models)
- Creating a new app for 4 models violates KISS — it adds app boilerplate (apps.py, urls.py, migrations/) for marginal organizational benefit

**Alternatives considered**:
- New `intake/` app: Clean separation but adds infrastructure overhead. Rejected for KISS.
- New `reports/` app: Same reasoning. Rejected.

---

## Summary of Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Async strategy | ThreadPoolExecutor + DB polling | No new infrastructure, stdlib only, KISS |
| IntakeProfile integration | New OneToOne model + `get_project_context()` helper | No data loss, backwards-compatible |
| SMQ storage | DB models seeded via data migration | Admin-configurable per FR-008 |
| Guidance injection | Structured prompt block | Clear LLM instruction separation |
| Priority score | Computed at query time from existing tables | No new table for MVP |
| PDF export | Reuse existing ReportLab infrastructure | No new dependency |
| App placement | `ingestion/` + `ner/` | KISS, no new app |
| Celery/Redis | Rejected — ThreadPoolExecutor | KISS, no new infrastructure |
