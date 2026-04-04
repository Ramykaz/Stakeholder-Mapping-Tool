# Research: US-014 — Stakeholder Personas + Workplan + Workflow + Export

**Branch**: `014-personas-workplan-export`
**Date**: 2026-04-03

---

## Decision 1: host_organization field for PDF cover page

**Decision**: Use `InitiativeProfile.host_organization` (already exists) for the PDF cover page. The spec assumption was incorrect — the field was added in spec 013's expansion migration (`0011_intake_profile_expansion_and_guidance_flags.py`).

**Rationale**: `host_organization` is already a CharField on `InitiativeProfile` (line 62, ingestion/models.py). No new field needed. The cover page will use: `initiative_name`, `host_organization`, `geography` (as country), and generation date.

**Alternatives considered**: Adding a separate `country` field — rejected, `geography` already captures this.

---

## Decision 2: StakeholderPersona placement — ner/ app

**Decision**: `StakeholderPersona` belongs in `ner/models.py`, not `ingestion/`. It is an analytical output derived from extracted entities, parallel to `ReportSection` and `EngagementNote`.

**Rationale**: `ner/` holds all AI-generated analytical artefacts. `ingestion/` holds raw input models. Entity type lookup needed for persona grouping is already available in `ner/`.

**Alternatives considered**: A new `personas/` app — rejected (KISS; no new app needed for two models).

---

## Decision 3: WorkplanComponent and WorkplanTask placement — ner/ app

**Decision**: Both `WorkplanComponent` and `WorkplanTask` go in `ner/models.py` with Celery tasks in `ner/tasks.py` and service logic in `ner/services/workplan_generator.py`.

**Rationale**: Consistent with all other AI-generated project artefacts. The workplan reads `ProjectSMQAnswer` (SMQ Section 6) and entity data, both already in `ner/`.

**Alternatives considered**: Separate `workplan/` app — rejected (only 2 models, no justification for a new app).

---

## Decision 4: Report staleness — adding STATUS_STALE to ReportSection

**Decision**: Add `STATUS_STALE = 'stale'` to `ReportSection.STATUS_CHOICES`. Requires a Django migration to extend the varchar choices. The field is `max_length=16`, and 'stale' fits. No destructive schema change — adding a new choice value is backward-compatible.

**Rationale**: `ReportSection.status` currently has pending/generating/done/error. 'stale' is a distinct state needed to surface staleness in the UI without conflating it with 'done'. The `is_stale` field already exists on `ProjectSMQAnswer` but `ReportSection` has no equivalent — the status field is the right place.

**Alternatives considered**: A boolean `is_stale` field on `ReportSection` — rejected (would require checking two fields in all queries; the status string is cleaner and already used for filtering).

---

## Decision 5: Staleness trigger — post-extraction hook in ner/views.py

**Decision**: Call `flag_stale_report_sections(project_id)` synchronously at the end of successful extraction in `ner/views.py` (at both the single-document endpoint around line 431 and the batch endpoint around line 988). No Celery task needed for this — it is a fast DB update (UPDATE WHERE project=X AND status='done').

**Rationale**: Staleness flagging is a trivial bulk UPDATE — not an LLM call. Making it synchronous avoids race conditions where the response returns before staleness is flagged. Two extraction endpoints exist (single doc and batch); both must be updated.

**Alternatives considered**: Celery signal after extraction — rejected (over-engineering for a simple DB write; adds latency with no benefit).

---

## Decision 6: Workplan Celery task — json_mode via prompt instruction

**Decision**: Use the existing `_call_provider()` abstraction from `ner/services/nl_query.py` for workplan generation. Since the Groq/Llama abstraction does not natively expose a `json_mode` parameter, instruct the LLM in the prompt to return only valid JSON and validate/parse with `json.loads()` in the service layer. On parse failure, retry once with an error correction prompt.

**Rationale**: The existing abstraction is `_call_provider(prompt, provider, model, max_tokens)`. Adding `json_mode` would require changes to all provider branches. Prompt-instruction JSON mode is already proven in the SMQ generator.

**Alternatives considered**: Adding `json_mode=True` to `_call_provider()` — deferred to a future refactor spec; not needed here.

---

## Decision 7: Persona Celery task — shared_task in ner/tasks.py

**Decision**: Add `generate_personas_task(project_id)` as a `@shared_task` in `ner/tasks.py`. Service logic goes in `ner/services/persona_generator.py`. The task groups entities by type via Django ORM, calls the LLM once per type (≥3 entities), and uses `bulk_create` to replace personas atomically (delete + create in a transaction).

**Rationale**: Follows the established pattern of `generate_report_sections_task` in `ner/tasks.py`. Celery is already configured and running.

**Alternatives considered**: ThreadPoolExecutor (as in spec 013 report generator) — persona generation is per-type (typically 3–8 calls), so Celery is preferred now that it's available; no need for the threading workaround.

---

## Decision 8: Workflow step computation — method on Project model, GET endpoint

**Decision**: Add `get_workflow_status()` as a method on the `Project` model (ingestion/models.py). Add `workflow_step` (IntegerField, default=1) and `stakeholder_table_stale` (BooleanField, default=False) to `Project`. Add a GET endpoint at `/api/v1/projects/{id}/workflow/` in `ingestion/views.py`.

**Rationale**: Step completion depends on related model counts (documents, entities, report sections, priority table entries). Placing the logic on `Project` avoids duplicating these queries in views. The `workflow_step` field stores the analyst's manual override (if any); `get_workflow_status()` computes the actual current step dynamically.

**Alternatives considered**: Computed entirely in the view — rejected (makes the view too fat and untestable).

---

## Decision 9: Export service — ner/services/report_export.py

**Decision**: Create `ner/services/report_export.py` with `generate_pdf(project)` and `generate_docx(project)` functions. Both use the already-imported `reportlab` and `python-docx` (both confirmed in requirements.txt at versions 4.2.5 and 1.1.2 respectively). The existing `ner/services/pdf_utils.py` (from spec 013) provides `pdf_safe()` and `resolve_pdf_fonts()` helpers which are reused.

**Rationale**: Reuses existing PDF infrastructure from spec 013. `python-docx` is already installed. No new dependencies.

**Alternatives considered**: Generating DOCX via HTML-to-DOCX conversion — rejected (adds a new dependency; python-docx provides direct paragraph/table APIs that are cleaner for structured documents).

---

## Decision 10: Entity enrichment — extending existing entity detail endpoint

**Decision**: Extend the existing `GET /api/v1/projects/{id}/entities/{entity_id}/` endpoint (in `ner/views.py`) to include `stakeholder_priority`, `persona`, and `appears_in_report_sections` fields. These are computed at query time from existing tables — no new DB fields needed on Entity.

**Rationale**: The endpoint already exists. Adding computed fields to the serializer output is the least invasive approach and avoids a breaking change to the response schema (new fields are additive).

**Alternatives considered**: A separate endpoint `/api/v1/projects/{id}/entities/{entity_id}/enrichment/` — rejected (forces two API calls from the frontend for what is logically one resource).

---

## Decision 11: Frontend WorkflowStepper — shared component, integrated via layout

**Decision**: Create `frontend/src/components/WorkflowStepper.tsx` as a standalone component. Integrate it into the project layout wrapper (likely `frontend/src/components/layout/ProjectLayout.tsx` or the project detail page layout) so it appears on all project sub-pages automatically. The "Next step" card is a separate `frontend/src/components/NextStepCard.tsx` component rendered at the bottom of each page that is not the Export tab.

**Rationale**: Centralising stepper logic in one component ensures consistent step rendering across all project pages without per-page integration.

**Alternatives considered**: Per-page stepper inclusion — rejected (violates DRY; any step label change would require updating all pages).

---

## Decision 12: New migrations summary

| Migration | App | Description |
|-----------|-----|-------------|
| `0012_project_workflow_fields.py` | ingestion | Add `workflow_step`, `stakeholder_table_stale` to Project |
| `0023_stakeholder_persona.py` | ner | Add `StakeholderPersona` model |
| `0024_workplan.py` | ner | Add `WorkplanComponent`, `WorkplanTask` models |
| `0025_report_section_stale.py` | ner | Add `STATUS_STALE` to `ReportSection.STATUS_CHOICES`, extend max_length to 16 (already 16 — fits 'stale') |

All migrations are backward-compatible (new tables or new choices — no column drops or type changes).

---

## Decision 13: Prompt templates

Two new prompt files:

- `prompts/persona_generate.txt` — given entity type name, list of entity names, and project context, return JSON `{ persona_name, archetype_label, demographics, motivations: [3 items], frustrations: [3 items] }`.
- `prompts/workplan_generate.txt` — given SMQ section 6 content, top-10 stakeholder names, and project context, return JSON `{ components: [{ title, tasks: [{ task_description, suggested_owner, timeline, dependencies, kpis, related_stakeholder }] }] }`.
