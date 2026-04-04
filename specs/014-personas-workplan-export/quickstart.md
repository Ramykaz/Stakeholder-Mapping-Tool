# Quickstart: US-014 Integration Scenarios

**Branch**: `014-personas-workplan-export`
**Date**: 2026-04-03

These scenarios describe complete end-to-end flows for testing each user story independently after implementation.

---

## Scenario 1: Stakeholder Personas

**Prerequisites**: Project with 10+ extracted entities across at least 3 entity types (e.g. Person ×5, Organization ×4, Government ×2).

1. Navigate to `/projects/{id}/report`
2. Scroll to the "Stakeholder Personas" section at the bottom of the page (below all 8 report section cards)
3. Click "Generate personas"
4. Observe: skeleton shimmer cards appear immediately in a 3-column grid
5. Within 30 seconds: real persona cards appear for Person and Organization (≥3 each)
6. Observe: Government shows "Not enough data to generate a persona for this stakeholder type." (only 2 entities)
7. Confirm each card has: entity type badge (coloured), persona name (large), archetype label (italic), demographics paragraph, 3 motivations with teal accent, 3 frustrations with red accent, "Based on:" footer with clickable entity names
8. Click one of the entity names in the "Based on:" list — confirm the entity detail side panel opens

**Pass criteria**: Persona cards generated for types with ≥3 entities. Correct insufficient-data message for types below threshold. Entity links open detail panels.

---

## Scenario 2: Workplan Generation

**Prerequisites**: Project with SMQ Section 6 ("Develop Stakeholder Engagement Strategies") in "complete" status.

**Section 6 not complete flow:**
1. Navigate to `/projects/{id}/report?tab=workplan`
2. Observe: "Generate workplan" button is greyed out/disabled
3. Hover over the button — tooltip shows "Complete Section 6 (Stakeholder Engagement Strategies) first." with a link to Section 6
4. Click the link — confirms navigation to the SMQ page at Section 6

**Generation flow:**
1. With Section 6 complete, return to the Workplan tab
2. Click "Generate workplan"
3. Observe: skeleton accordion panels appear with shimmer rows
4. Within 30 seconds: 4–7 accordion panels appear, each expanded by default
5. Each panel shows: component title as header, a table with Task / Owner / Timeline / KPI columns
6. Click a table row — it expands inline showing full task_description and dependencies on grey background
7. If a task has a related entity: a coloured entity badge appears in the expanded row; click it to open the entity detail panel

**Pass criteria**: Workplan blocked when Section 6 incomplete. Generation produces 4–7 components. Task row expansion shows full details. Entity badges link to panels.

---

## Scenario 3: Stepwise Workflow UI

**Prerequisites**: Any project (with varying completion states to test different step states).

1. Open a newly created project with no documents
2. Observe: stepper banner shows below the project header — Step 1 has a pulsing teal circle (active), Steps 2–7 show muted grey circles
3. Click Step 2 circle — confirms navigation to `/projects/{id}/documents`
4. Scroll to the bottom of the page — "Next step" card shows "Step 2: Upload documents" with a "Go to Upload documents" button
5. Upload and process a document — return to any project page
6. Observe: Step 1 and 2 now show filled teal checkmarks; Step 3 is now active (pulsing)
7. On a mobile emulator (viewport < 768px): stepper collapses to "Step 3 of 7 — Run extraction" with ← → arrows
8. Navigate to the Export tab — confirm the "Next step" card is NOT shown at the bottom

**Pass criteria**: Stepper reflects actual completion state. Active step pulses. Mobile collapse works. Next step card absent on Export tab.

---

## Scenario 4: Enriched Entity Card

**Prerequisites**: Project with a generated stakeholder priority table, at least one persona, and at least one complete report section that mentions a specific entity.

1. Click any entity on the graph (or in the priority table) that is in the top-ranked stakeholders
2. Entity detail side panel opens — scroll to "Stakeholder analysis" section (below the stats row)
3. Confirm: priority badge (High/Medium/Low) with category label and rank "#N of M"
4. Confirm: "Why this priority:" label with priority_reason text beneath
5. Confirm: "Recommended ask:" label with ask_request text
6. Confirm: "Appears in report:" with section title chips
7. Click one chip — report page opens (or navigation occurs) scrolled to that section
8. Confirm: "Representative archetype:" with archetype_label and persona_name as a link to the personas section
9. Open an entity that is NOT in the priority table but the table has been generated — confirm grey note "Not ranked in the top stakeholders."
10. Open an entity on a project where no priority table has been generated — confirm grey note with link "Generate stakeholder table to see priority analysis →"

**Pass criteria**: All enrichment fields visible for ranked entities. Chips navigate correctly. Appropriate fallback messages for unranked entities.

---

## Scenario 5: Incremental Report Staleness

**Prerequisites**: Project with at least 2 report sections in "done" status.

1. From the Documents page, upload and process a new document
2. Observe: dismissible amber toast appears at bottom right: "Your report was generated before this document was added. View report →"
3. Click "View report →" in the toast — navigates to the report page
4. Observe: amber page-level notice bar at top: "Some sections were generated before new documents were added. [Regenerate all stale sections →]"
5. At least one section card shows an amber banner above its content: "New data available — regenerate to include the latest findings."
6. On that section, click "Keep current version" — confirm the amber banner disappears and the section content is unchanged (status resets to done)
7. On another stale section, click "Regenerate this section" — confirm the section enters "Generating…" state and eventually returns to "done" with new content
8. Navigate to the Stakeholder table page — confirm amber banner with "Regenerate table" and "Keep current version" buttons appears at the top

**Pass criteria**: Toast on documents page. Page-level bar on report page. Per-section stale banners. Both actions work correctly. Stakeholder table page shows staleness banner.

---

## Scenario 6: Full Report Export

**Prerequisites**: Project with at least 4 report sections in "done" status, a generated stakeholder priority table, and generated personas.

1. Navigate to `/projects/{id}/report?tab=export` (or click the Export tab — last tab)
2. Observe: readiness checklist shows 4 of 8 sections with teal checkmarks, 4 with grey ×
3. Stakeholder table row shows a teal checkmark; personas row shows a teal checkmark
4. Summary line shows "Report includes: cover page, table of contents, 4 of 8 analysis sections, stakeholder priority table, stakeholder personas."
5. Click "Download PDF report" — button shows "Generating…" spinner
6. Within 15 seconds a PDF file downloads named "{initiative_title}_stakeholder_analysis.pdf"
7. Open PDF — verify: cover page with initiative title, host organisation, geography, and generation date; table of contents; 4 prose sections; Appendix A (priority table); Appendix B (persona entries)
8. Section headings in navy, subheadings in teal, table header rows in teal with alternating row shading
9. Click "Download Word document" — DOCX file downloads with equivalent structure
10. On a project with 0 complete sections: navigate to Export tab — both buttons show disabled state with tooltip "Complete at least one report section to export"

**Pass criteria**: Checklist accurate. PDF and DOCX download within 15 seconds. PDF uses correct colour scheme. Appendices A and B present. Export blocked when no sections complete.

---

## Regression Scenarios

After implementing all 6 user stories, verify existing features still work:

1. **Existing report generation** (US-013): Click "Generate All Sections" — all 8 sections generate and display as before
2. **Existing PDF from US-013**: Navigate to the existing report export view (if separate from new export tab) — verify it still works
3. **Entity detail panel** (US-011): Click an entity — the existing stats, relationships, summary, and timeline still appear correctly alongside the new "Stakeholder analysis" section
4. **SMQ flow** (US-013): Fill and save an SMQ answer — persists correctly
5. **Stakeholder priority table** (US-013): Priority table loads and CSV exports correctly
6. **Extraction** (US-011): Extract a new document — entities and relations appear on the graph; staleness flag fires after extraction
7. **Light/dark mode**: Toggle theme — all new components (persona cards, workplan accordion, stepper, export tab) render correctly in both modes
