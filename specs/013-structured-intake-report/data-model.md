# Data Model: Structured Initiative Intake + SMQ + Extraction Guidance + RAG Report

**Branch**: `013-structured-intake-report`
**Date**: 2026-04-02

---

## Existing Models (unchanged, reference only)

### `ingestion.Project`
```
Project
├── id (UUID, PK)
├── name (CharField)
├── description (TextField)
├── status (CharField)
├── owner (FK → User)
├── provider (CharField, default from env)
├── model (CharField, default from env)
└── created_at, updated_at
```

### `ingestion.ConceptNote`
```
ConceptNote
├── id (UUID, PK)
├── project (OneToOneField → Project)
├── content (TextField)
└── attachment (FileField, optional)
```

### `ingestion.Chunk`
```
Chunk
├── id (UUID, PK)
├── document (FK → Document)
├── text (TextField)
├── embedding (VectorField, 384 dims)
├── chunk_index (IntegerField)
└── token_count (IntegerField)
```

---

## New Models

### `ingestion.InitiativeProfile`

Structured replacement/extension for the free-text concept note. OneToOne with Project. Optional — existing projects continue to use ConceptNote until the intake form is filled.

```
InitiativeProfile
├── id (UUID, PK)
├── project (OneToOneField → Project, related_name='initiative_profile')
├── initiative_name (CharField, max_length=255, blank=True)
├── geography (CharField, max_length=255, blank=True)
│   # Country/region context, e.g. "Uzbekistan, Central Asia"
├── thematic_area (CharField, max_length=255, blank=True)
│   # e.g. "Youth Employment", "AI for Good", "Climate Finance"
├── core_objectives (TextField, blank=True)
│   # Pre-filled from ConceptNote.content on first open
├── expected_outcomes (TextField, blank=True)
├── stakeholder_focus (TextField, blank=True)
│   # Who the analyst wants to map, e.g. "Focus on government bodies and NGOs"
├── created_at (DateTimeField, auto_now_add)
└── updated_at (DateTimeField, auto_now)

Methods:
  to_context_string() → str
    # Returns formatted multi-line string for use in LLM prompts:
    # "Initiative: {initiative_name}\nGeography: {geography}\n..."
    # Falls back gracefully for empty fields
```

**Validation**:
- No field is mandatory (all blank=True) — partial profiles are valid
- `project` is unique (OneToOneField enforces this at DB level)

---

### `ingestion.ExtractionGuidance`

Ordered list of per-project instructions injected into extraction prompts.

```
ExtractionGuidance
├── id (UUID, PK)
├── project (FK → Project, related_name='extraction_guidance_items')
├── text (TextField)
│   # e.g. "Focus on funding and partnership relationships"
│   # e.g. "Exclude 'the general public' as a stakeholder entity"
│   # e.g. "Treat 'the Lab' as 'UNDP SDG AI Lab'"
├── order (PositiveIntegerField, default=0)
│   # Controls injection order in prompt
└── created_at (DateTimeField, auto_now_add)

Meta:
  ordering = ['order', 'created_at']
```

**Validation**:
- `text` must not be blank
- No limit on number of items per project (practical limit enforced by prompt length)

---

### `ner.SMQTemplate`

Global singleton template defining the 8 SMQ sections. One active template at a time.

```
SMQTemplate
├── id (UUID, PK)
├── title (CharField, max_length=255)
│   # e.g. "Stakeholder Mapping Questionnaire"
├── description (TextField, blank=True)
├── is_active (BooleanField, default=True)
│   # Only one active template at a time
└── created_at (DateTimeField, auto_now_add)
```

**Seeding**: Created via data migration `ner/migrations/0018_smq_template.py` reading `docs/smq.txt`.

---

### `ner.SMQSection`

Individual section within an SMQ template. 8 sections per template.

```
SMQSection
├── id (UUID, PK)
├── template (FK → SMQTemplate, related_name='sections')
├── section_number (PositiveIntegerField)
│   # 1–8, unique within template
├── title (CharField, max_length=255)
│   # e.g. "Define the Objectives"
├── question_prompts (TextField)
│   # Full text of the questions for this section (from smq.txt)
├── order (PositiveIntegerField, default=0)
└── is_active (BooleanField, default=True)

Meta:
  ordering = ['order', 'section_number']
  unique_together = [('template', 'section_number')]
```

---

### `ner.ProjectSMQResponse`

Container for all SMQ answers for a given project. OneToOne with Project.

```
ProjectSMQResponse
├── id (UUID, PK)
├── project (OneToOneField → Project, related_name='smq_response')
└── created_at (DateTimeField, auto_now_add)
    updated_at (DateTimeField, auto_now)
```

---

### `ner.ProjectSMQAnswer`

One answer per section per project. Created on first "Generate" or first manual edit.

```
ProjectSMQAnswer
├── id (UUID, PK)
├── response (FK → ProjectSMQResponse, related_name='answers')
├── section (FK → SMQSection)
├── answer_text (TextField, blank=True)
│   # User-edited or AI-generated answer
├── ai_generated (BooleanField, default=False)
│   # True if last write was from AI generation
├── is_stale (BooleanField, default=False)
│   # Set True when new documents are extracted after this answer was generated
├── last_generated_at (DateTimeField, null=True, blank=True)
├── chunk_ids_used (JSONField, default=list)
│   # List of Chunk UUIDs used in generation, for citation tracing
└── created_at, updated_at

Meta:
  unique_together = [('response', 'section')]
```

---

### `ner.ReportSection`

Cached AI-generated narrative for one SMQ section within a project. Separate from `ProjectSMQAnswer` — the report is the formatted output, the answer is the structured input.

```
ReportSection
├── id (UUID, PK)
├── project (FK → Project, related_name='report_sections')
├── section (FK → SMQSection)
├── status (CharField)
│   # Choices: 'pending' | 'generating' | 'done' | 'error'
│   # Default: 'pending'
├── generated_text (TextField, blank=True)
│   # The narrative paragraph(s) for this section
├── citations (JSONField, default=list)
│   # [{"doc_name": "...", "chunk_id": "...", "snippet": "..."}, ...]
├── error_message (TextField, blank=True)
│   # Set if status='error'
├── cache_key (CharField, max_length=64, blank=True)
│   # SHA256 of (project_id + section_id + extraction_run_ids)
│   # Used for cache invalidation
├── generated_at (DateTimeField, null=True, blank=True)
└── created_at, updated_at

Meta:
  unique_together = [('project', 'section')]
```

**State transitions**:
```
(none) → pending → generating → done
                             → error
done → pending (on re-generate request)
done → stale (when new extraction invalidates cache)
```

---

## Entity Relationships

```
Project ─── (1:1) ─── InitiativeProfile
         ├── (1:1) ─── ConceptNote        (existing, unchanged)
         ├── (1:*) ─── ExtractionGuidance
         ├── (1:1) ─── ProjectSMQResponse ─── (1:*) ─── ProjectSMQAnswer ─── (N:1) ─── SMQSection
         └── (1:*) ─── ReportSection      ─── (N:1) ─── SMQSection

SMQTemplate ─── (1:*) ─── SMQSection
```

---

## `get_project_context()` Helper

Location: `ingestion/services/context.py`

```python
def get_project_context(project) -> str:
    """
    Returns the best available context string for LLM calls scoped to this project.
    Priority: InitiativeProfile > ConceptNote > project.description
    """
    if hasattr(project, 'initiative_profile') and project.initiative_profile:
        return project.initiative_profile.to_context_string()
    try:
        return project.concept_note.content
    except ConceptNote.DoesNotExist:
        return project.description or ""
```

All existing callers of `project.concept_note.content` in `ner/views.py` and `ner/services/` are updated to call `get_project_context(project)`.

---

## Migration Plan

| Migration | App | Description |
|-----------|-----|-------------|
| `ingestion/0009_initiative_profile.py` | ingestion | Add `InitiativeProfile` model |
| `ingestion/0010_extraction_guidance.py` | ingestion | Add `ExtractionGuidance` model |
| `ner/0018_smq_template.py` | ner | Add `SMQTemplate`, `SMQSection` models |
| `ner/0019_smq_template_seed.py` | ner | Data migration: seed 8 sections from `docs/smq.txt` |
| `ner/0020_project_smq_response.py` | ner | Add `ProjectSMQResponse`, `ProjectSMQAnswer` |
| `ner/0021_report_section.py` | ner | Add `ReportSection` model |

All migrations are backwards-compatible (new tables, no changes to existing columns).
