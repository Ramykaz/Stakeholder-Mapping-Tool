# Data Model — Complete UI Polishing and Rewiring

## Overview

This feature does not replace core persistence models; it formalizes the domain/view models and state contracts required to keep UI rewiring backward-compatible with existing ingestion, NER, graph, and reasoning behavior.

## Entities

### 1) UserSessionContext
- **Purpose**: Represents authenticated user scope and active workspace context across pages.
- **Fields**:
  - `user_id` (string, required)
  - `is_authenticated` (boolean, required)
  - `active_project_id` (string | null)
  - `active_document_id` (string | null)
  - `context_source` (enum: `url`, `persisted`, `default`)
  - `updated_at` (datetime)
- **Validation Rules**:
  - `active_document_id` may be set only when linked to accessible project/document scope.
  - URL-derived context overrides persisted context.

### 2) WorkspaceProject
- **Purpose**: Logical container for analyst uploads, processing runs, and analysis outputs.
- **Fields**:
  - `project_id` (string, required)
  - `name` (string, required)
  - `owner_id` (string, required)
  - `document_count` (integer, derived)
  - `last_activity_at` (datetime)
  - `status_summary` (enum: `empty`, `active`, `processing`, `error`)
- **Validation Rules**:
  - Must be owned by or shared with current user.
  - `status_summary` is derived from latest document/run states.

### 3) SourceDocument
- **Purpose**: Upload input to ingestion and downstream extraction.
- **Fields**:
  - `document_id` (string, required)
  - `project_id` (string, required)
  - `filename` (string, required)
  - `content_type` (string)
  - `uploaded_at` (datetime)
  - `processing_status` (enum: `queued`, `processing`, `completed`, `failed`)
  - `error_message` (string | null)
- **Validation Rules**:
  - `project_id` must reference an accessible project.
  - Status transitions follow allowed state machine below.

### 4) ProcessingRun
- **Purpose**: Represents an extraction/relation/reasoning attempt scope and outcome.
- **Fields**:
  - `run_id` (string, required)
  - `project_id` (string, required)
  - `document_id` (string | null)
  - `provider` (string)
  - `started_at` (datetime)
  - `completed_at` (datetime | null)
  - `duration_seconds` (number | null)
  - `status` (enum: `queued`, `running`, `completed`, `failed`)
  - `relations_created` (integer | null)
- **Validation Rules**:
  - `completed_at` is required when `status` is terminal.
  - `duration_seconds` cannot be negative.

### 5) ExtractedEntity
- **Purpose**: Stakeholder concept displayed in entities and graph views.
- **Fields**:
  - `entity_id` (string, required)
  - `run_id` (string, required)
  - `project_id` (string, required)
  - `document_id` (string | null)
  - `text` (string, required)
  - `entity_type` (string, required)
  - `canonical_name` (string | null)
  - `confidence` (number | null)
- **Validation Rules**:
  - `entity_type` must map to known display category or safe fallback category.
  - Duplicate entities are deduplicated by existing pipeline logic (not changed in this feature).

### 6) EntityRelation
- **Purpose**: Semantic relation between entities for relations and graph exploration.
- **Fields**:
  - `relation_id` (string, required)
  - `run_id` (string, required)
  - `project_id` (string, required)
  - `source_entity_id` (string, required)
  - `target_entity_id` (string, required)
  - `relation_type` (string, required)
  - `confidence` (number | null)
  - `evidence_text` (string | null)
- **Validation Rules**:
  - `source_entity_id` and `target_entity_id` must exist in scope.
  - Relation deduplication remains governed by existing backend constraints.

### 7) ReasoningInsight
- **Purpose**: Workspace-scoped reasoning output tied to extracted data context.
- **Fields**:
  - `insight_id` (string, required)
  - `project_id` (string, required)
  - `document_id` (string | null)
  - `summary` (string, required)
  - `generated_at` (datetime)
  - `source_run_id` (string | null)
  - `status` (enum: `ready`, `partial`, `failed`)
- **Validation Rules**:
  - Must be generated against current accessible project scope.
  - `summary` may be empty only when status is `failed`.

## Relationships

- `WorkspaceProject` 1—N `SourceDocument`
- `WorkspaceProject` 1—N `ProcessingRun`
- `ProcessingRun` 1—N `ExtractedEntity`
- `ProcessingRun` 1—N `EntityRelation`
- `ExtractedEntity` N—N `EntityRelation` (via source/target references)
- `WorkspaceProject` 1—N `ReasoningInsight`
- `UserSessionContext` 1—0..1 active `WorkspaceProject`

## State Transitions

### Document Processing
- `queued` → `processing`
- `processing` → `completed`
- `processing` → `failed`
- `failed` → `queued` (retry path)

### Processing Run
- `queued` → `running`
- `running` → `completed`
- `running` → `failed`

### UI Async State (view contract)
- `idle` → `loading`
- `loading` → `ready`
- `loading` → `empty`
- `loading` → `error`
- `error` → `loading` (retry)

## Derived Views Used by Rewiring

- **WorkspaceSummaryView**: project metadata + status summary + latest run indicators.
- **AnalysisAvailabilityView**: booleans for whether entities/relations/graph/reasoning can be opened.
- **CrossPageContextView**: normalized context tuple (`project_id`, `document_id`, optional filters) used by navigation links and route transitions.
