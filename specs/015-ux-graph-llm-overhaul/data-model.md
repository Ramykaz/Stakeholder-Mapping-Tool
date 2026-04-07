# Phase 1 Data Model — US-015

## 1) WebSource (new)
Represents non-file ingestion inputs and processing lifecycle.

- id: UUID (PK)
- project_id: UUID (FK -> Project, required, indexed)
- source_type: enum(`url`, `crawl`, `paste`) (required)
- url: text (nullable; required for `url` and `crawl`)
- crawl_depth: integer (default 1, valid range 1..2)
- raw_text: text (nullable; required for `paste`, populated for processed web content)
- status: enum(`queued`, `processing`, `processed`, `error`) (default `queued`, indexed)
- page_count: integer (default 0)
- character_count: integer (default 0)
- title: varchar(255) (nullable; used for paste-text source naming)
- error_message: text (nullable)
- document_id: UUID (FK -> Document, nullable, set after content materialization)
- created_at: datetime (auto)
- updated_at: datetime (auto)

Validation rules:
- `source_type=url|crawl` requires valid absolute URL.
- `source_type=paste` requires non-empty `raw_text` and user-visible title.
- `crawl_depth` clamped/validated to <=2.

State transitions:
- queued -> processing -> processed
- queued|processing -> error
- error -> processing (retry path, optional)

## 2) ProjectWorkflowStatus (derived/read model)
Derived, non-persistent view of step completion and next-step action.

Fields (response shape concept):
- current_step: integer (1..7)
- steps: array of
  - number: integer
  - label: string
  - complete: boolean
  - url: string
- next_step: object | null
  - number, label, description, url, action_type

Rules:
- Step 4 URL resolves to existing map/graph route.
- Documents-page next action is conditional on extraction/entity presence.

## 3) ProviderConnectionTestResult (ephemeral response entity)
Returned by provider test endpoint.

- provider: string
- model: string
- status: enum(`ok`, `error`)
- error_message: string | null
- latency_ms: integer

Rules:
- Validate required provider-specific fields before provider call.
- No provider instance caching across requests.

## 4) StakeholderGenerationProgress (operational state)
Represents sequential note-generation progress and resume point.

Persisted approach:
- Existing engagement-note storage remains source of generated entries.
- Progress/resume pointer tracked via request/response contract and/or lightweight project-scoped state.

Core fields exposed to frontend:
- total_target: integer (<=20)
- completed_count: integer
- current_index: integer
- status: enum(`idle`, `running`, `paused_rate_limited`, `completed`, `error`)
- resumable: boolean

Rules:
- Generation processes one entity at a time.
- On 429, transition to `paused_rate_limited` and expose resume action.
- Resume continues from next unfinished entity (no duplicate completions).

## 5) ExportReadinessSummary (extended existing)
Existing export status read model, extended with workplan availability.

- can_export: boolean
- complete_sections: integer
- total_sections: integer (8)
- has_stakeholder_table: boolean
- has_personas: boolean
- has_workplan: boolean (new)
- section_statuses: array

Rules:
- Appendix B/C inclusion strictly follows `has_personas` / `has_workplan`.
- TOC entries must match included appendices only.

## 6) Existing entity impacts

### ReportSection / Export payload
- No destructive schema changes.
- Export composition behavior changed to conditional personas/workplan inclusion.

### ProjectSMQAnswer (SMQ notes context)
- Per-section notes are modeled as separate user-authored context from generated text.
- Generation pipeline includes notes as additional context input.

### Entity (orphan flag visibility)
- Isolated-node flagging action persists orphan/flagged state for entities in current filtered graph context.
