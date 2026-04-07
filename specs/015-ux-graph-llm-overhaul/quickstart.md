# Quickstart Validation — US-015

## Preconditions
- Project exists with at least one processed document and extracted entities.
- Frontend/backend/worker running via Docker Compose.
- At least one configured LLM provider key in environment.

## 1) Typography and contrast audit
1. Open sidebar, graph page, entities/relations tables, report, stakeholders, intake, SMQ, workflow stepper.
2. Confirm listed text targets are visible in light/dark themes.
3. Confirm body/label text minimum 12px; edge labels minimum 11px with readable background fill.

Expected:
- No invisible/low-contrast text in audited scope.
- No layout or component structure changes.

### US1 visual audit tracking

- [ ] Sidebar project names/count labels readable in light/dark
- [ ] Graph legend labels meet contrast + minimum size
- [ ] Graph edge labels readable with background token treatment
- [ ] Entities/relations table body text meets contrast + minimum size
- [ ] Report/stakeholder tab inactive labels readable
- [ ] Status badges readable across project pages
- [ ] Intake labels/placeholders readable and not undersized
- [ ] SMQ/report/stakeholder/persona/stepper text visible in both themes

## 2) D3 graph parity and quality
1. Open map/graph page and verify zoom/pan, fit, node click panel, hover neighborhood dimming, filter wiring, focus mode, NL-query highlighting, minimap.
2. Confirm node sizing, labels, edge labeling readability, and no obvious first-load settle animation.
3. Toggle "Show isolated nodes" and verify hide/show behavior.
4. Trigger "Flag all isolated entities" and verify persistence indicator in entity table.

Expected:
- Behavioral parity with prior graph interactions + improved readability.

## 3) Workflow stepper and next-step logic
1. Verify each page shows correct next step by state:
   - Intake -> Upload Documents
   - Documents -> Run Extraction or Review Graph based on entity state
   - Graph -> Generate Report
   - Report -> Stakeholder Table
   - Stakeholders -> Export
   - Export -> no next card
2. Click step 4 and verify it routes to map page (no 404).

## 4) LLM error handling and sequential stakeholder generation
1. Trigger provider 429 and timeout scenarios (or mock).
2. Confirm contextual amber or neutral messages (no raw network errors).
3. Start stakeholder generation and verify sequential row appearance up to max 20.
4. On rate-limit pause, click resume and confirm continuation from prior point.

## 5) Provider wiring + connection test
1. In Settings, change provider/model and save.
2. Click Test connection and verify status/latency feedback.
3. Run extraction, report generation, stakeholder notes, personas, workplan, NL query.

Expected:
- All LLM calls use current provider without restart.

## 6) Initiative profile + SMQ UX
1. Edit initiative profile; verify no autosave-on-blur.
2. Confirm Save profile button enablement requires title and unsaved-change warning appears on navigate-away.
3. Open SMQ and verify single-section focus view with previous/next navigation, section progress, and per-section notes area.

## 7) Web ingestion paths
1. Add URL source; verify processing status and resulting document entry.
2. Add crawl source with depth 1 or 2; verify limits enforced and status updates.
3. Add pasted text with title; verify it appears in list and enters existing extraction pipeline.

## 8) Export appendices
1. Generate personas and workplan.
2. Open export status and verify readiness checklist includes workplan line.
3. Download PDF and DOCX.
4. Verify TOC and appendices reflect actual presence:
   - Appendix B: Stakeholder Personas (if present)
   - Appendix C: Engagement Workplan (if present)

Expected:
- Missing appendices omitted cleanly; present appendices rendered with required structure.

## Validation Outcomes (2026-04-06)

- ✅ Backend regression suite passed in Docker using:
   - `docker compose run --rm -e GROQ_API_KEY= --entrypoint pytest app ingestion/tests ner/tests -q`
   - Result: `210 passed`
- ✅ Frontend production build passed:
   - `cd frontend && npm run build`
- ⚠️ Frontend build reported an existing warning unrelated to US-015 changes:
   - Invalid href in `/projects/[id]/workspace` with `'/projects//settings'`
- ℹ️ Manual visual validation remains recommended for typography and interaction-specific checks in sections 1–8 above.
