# Quickstart: US-013 Integration Scenarios

**Branch**: `013-structured-intake-report`
**Date**: 2026-04-02

These scenarios describe complete end-to-end flows for testing each user story independently after implementation.

---

## Scenario 1: Structured Initiative Intake Form

**Prerequisites**: Project exists with at least one extracted document.

1. Open project settings → "Initiative Profile" tab (or `/projects/{id}/intake`)
2. Observe: form pre-populated with `core_objectives` from existing ConceptNote content
3. Fill in: `geography = "Uzbekistan"`, `thematic_area = "Youth Employment"`, `stakeholder_focus = "Focus on government bodies and NGOs"`
4. Save → observe success confirmation
5. Trigger a new extraction on any document
6. Inspect the extraction LLM prompt (via logs or debug endpoint) → confirm it contains all filled fields
7. Verify the project workspace sidebar shows the initiative summary (name, theme, geography)

**Pass criteria**: Extraction prompt contains structured fields; no existing entity/relation data was affected; ConceptNote is still readable.

---

## Scenario 2: SMQ Template System

**Prerequisites**: SMQ template seeded (8 sections visible). Project with ≥1 extracted document.

**Manual answer flow**:
1. Open project → "SMQ" tab
2. See all 8 section panels with question prompts
3. Click section 1 text area → type a manual answer → click Save
4. Refresh page → observe answer persists

**AI generation flow**:
1. On section 2 ("Identify Stakeholders") → click "Generate with AI"
2. Observe: loading indicator appears
3. Within 10 seconds → answer text appears with citation markers
4. Edit the AI answer → click Save → confirm edited version is saved (not re-overwritten)
5. For a project with no documents: click "Generate with AI" → observe informative message "No documents extracted yet"

**Pass criteria**: Manual and AI answers persist independently. AI answer references document content. No error on projects without documents.

---

## Scenario 3: Extraction Guidance Panel

**Prerequisites**: Project with at least one document (not yet extracted, or re-extractable).

1. Open project settings → "Extraction Guidance" section
2. Click "Add guidance" → type: `Focus on funding and investment relationships` → Save
3. Add a second item: `Treat "the Lab" as "UNDP SDG AI Lab"` → Save
4. Observe both items in the list with drag handles
5. Reorder items (drag item 2 to position 1) → Save → confirm new order persists
6. Run extraction on a document → inspect LLM prompt in backend logs
7. Confirm prompt contains both guidance items in a labelled block

**Pass criteria**: Both guidance items appear in the extraction prompt. Order is respected. Deleting an item removes it from subsequent extraction prompts.

---

## Scenario 4: Per-Section RAG Report Generation

**Prerequisites**: Project with ≥2 extracted documents. Initiative profile filled (Scenario 1). SMQ answers for at least 2 sections (optional but recommended).

**Single section generation**:
1. Open project → "Report" tab
2. All 8 sections show "Not generated" status
3. Click "Generate" on section 1 ("Define the Objectives")
4. Observe: section status → "Generating..." → within 15 seconds → "Done"
5. Read the generated narrative → confirm it references content from uploaded documents
6. Observe citations listed below the narrative (document name + snippet)

**Batch generation**:
1. Click "Generate All Sections"
2. Observe all 8 sections enter "Generating..." state simultaneously
3. Within 60 seconds all sections reach "Done" state (or "Error" on rate limit)
4. Observe any errored sections have a "Retry" button

**Cache invalidation**:
1. Extract a new document for the project
2. Return to Report tab → observe all previously-generated sections show "Stale" badge with "Regenerate" prompt

**PDF export**:
1. Once all sections are "Done" → click "Export PDF"
2. File downloads with project name and date in filename
3. Open PDF → verify all 8 sections are present with citations

**Pass criteria**: Report sections reference source documents. PDF exports cleanly. Cache invalidation works after new extraction.

---

## Scenario 5: Stakeholder Priority Table

**Prerequisites**: Project with ≥10 extracted entities of varied types (Person, Organization, Government).

1. Open project → "Stakeholders" tab (or priority table view)
2. Observe: entities listed ranked by priority score (degree × avg_confidence), highest first
3. Confirm columns: rank, name, entity type, mention count, confidence, connections (degree), priority score
4. Apply filter: "Organizations only" → table updates to show only Organization-type entities, re-ranked
5. Click any entity row → entity side panel opens with full profile (existing panel component)
6. Click "Generate Engagement Notes" → loading indicator per row
7. Within 30 seconds → engagement notes populate as one-line text per entity
8. Notes reference either SMQ section 2/6 answers or document content
9. Click "Export CSV" → file downloads with all columns including engagement notes

**Pass criteria**: Priority scores are correctly computed. Filtering is instant. Engagement notes reference grounded sources. CSV exports all rows.

---

## Regression Scenarios

After implementing all 5 stories, verify existing features still work:

1. **Existing extraction**: Create project → upload doc → extract → verify graph shows entities (no regression from guidance injection)
2. **Entity summary**: Click entity on graph → click "Generate summary" → LLM summary appears (now uses `get_project_context()` internally)
3. **NL query**: Type a question in search bar → answer panel appears → entities highlighted
4. **Existing PDF/DOCX report**: Download report → verify same format as before (no regression from PDF utility extraction)
5. **Light/dark mode**: Toggle theme → Report tab and SMQ tab render correctly in both modes
6. **Dedup review**: `/projects/{id}/review` still loads with candidate pairs
