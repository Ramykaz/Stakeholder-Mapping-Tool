# Stakeholder Analysis Tool — User Guide

## 1. Welcome

This guide explains how to use the Stakeholder Analysis Tool end-to-end for practical analyst work.

You will learn how to:
- Create and manage projects
- Upload and process source material
- Run AI extraction and review results
- Explore stakeholder graphs
- Generate reports, personas, and workplans
- Export outputs for sharing

---

## 2. Who This Guide Is For

- Programme officers
- Policy analysts
- Research and M&E teams
- Project managers
- Admin users configuring taxonomy and platform governance

---

## 3. Before You Start

You need:
- A valid account (or registration access)
- A running deployment URL
- At least one configured AI provider in the backend environment
- Project source documents (PDF, DOCX, TXT, Markdown) and/or web links/text snippets

Recommended:
- Stable internet connection for provider requests
- Clear, well-structured source documents for better extraction quality

---

## 4. Sign In and Account Basics

## 4.1 Register
1. Open the login/register page
2. Create your account with username, email, and password
3. Sign in after successful registration

## 4.2 Login
1. Enter username/email and password
2. If successful, you are redirected to your project workspace/dashboard

## 4.3 Password management
- Change password from account/profile flows
- If needed, use forgot-password and reset-password flow

---

## 5. Project Lifecycle (Quick Start)

Typical workflow:
1. Create a project
2. Complete the initiative profile (project intake)
3. Fill SMQ sections (baseline pass)
4. Upload documents and/or add web sources
5. Run extraction
6. Review entities and relationships
7. Explore graph and entity details
8. Generate report/personas/workplan
9. Export deliverables

---

## 6. Create and Manage Projects

## 6.1 Create project
- Go to Projects dashboard
- Select create/new project
- Enter project name and optional description

## 6.2 Edit project metadata
- Use edit actions from project card or settings page
- Update title/description as needed

## 6.3 Delete project
- Use delete action with confirmation prompt
- Deletion is permanent; export needed outputs first

---

## 7. Initiative Profile + SMQ Best Practices

The initiative profile (project intake) and SMQ completion are the primary context inputs for extraction and generation quality.

In the initiative profile, include:
- Problem statement and scope
- Geography and stakeholders
- Governance and institutional context
- Key objectives, constraints, and assumptions
- Expected outputs and implementation context

In SMQ sections, make sure to:
- Complete all applicable sections before final generation/export
- Add analyst notes where project context is nuanced
- Re-run only sections that are weak rather than regenerating everything

Tips:
- Use concise, structured sections
- Keep names and acronyms consistent
- Update initiative profile as project understanding evolves

Note: concept note fields may still appear in some environments for compatibility, but current workflow should prioritize initiative profile + SMQ.

---

## 8. Add Source Material

## 8.1 Supported formats
- PDF
- DOCX
- TXT
- Markdown (.md)

## 8.2 Upload documents
1. Go to project Documents page
2. Upload one or more files
3. Monitor status badges (pending/processing/completed/failed)

## 8.3 Add web sources
You can add:
- URL ingestion
- Crawl sources (bounded depth)
- Pasted text sources

Use web sources when key context is external to your uploaded files.

---

## 9. Run Entity Extraction

## 9.1 Trigger extraction
- Navigate to Analyze page
- Start extraction for the project

## 9.2 Incremental behavior
- By default, extraction targets new/unprocessed documents
- Use per-document re-extract when source or taxonomy has changed

## 9.3 If extraction fails
Check:
- Source document quality and format
- Provider credentials and model selection
- Backend connectivity and runtime status

---

## 10. Review and Correct Extracted Data

## 10.1 Document review panel
Per document, review:
- Extracted entities
- Extracted relationships
- Confidence indicators
- Evidence excerpts

## 10.2 Edit and cleanup actions
You can:
- Relabel entities/relations
- Delete incorrect relationships
- Remove low-quality mentions

## 10.3 Deduplication review
Use review queue to resolve borderline duplicate candidates:
- Merge when same real-world stakeholder
- Keep separate when distinct actors

Analyst decisions here directly improve graph quality and reporting accuracy.

---

## 11. Explore the Graph

## 11.1 Graph page capabilities
- Interactive network visualization
- Entity type filtering
- Confidence and degree threshold controls
- Focus mode on selected node
- Neighbourhood exploration

## 11.2 Reading node and edge signals
- Node size reflects connection degree/influence
- Border/color reflects entity type
- Directed edges represent relationship direction

## 11.3 Focus mode
- Click a node to isolate relevant neighbourhood
- Use one-hop/two-hop context controls (if enabled)
- Exit focus mode via toolbar action or Escape

---

## 12. Entity Detail Analysis

Each entity page typically provides:
- Canonical name and type
- Confidence and alias information
- Relationship summary
- Contextual AI summary (where configured)
- Mini-graph neighbourhood

Use this page to validate key stakeholder representation before reporting.

---

## 13. Generate Outputs

## 13.1 Report generation
- Generate section-wise report content
- Edit/regenerate sections based on quality
- Track stale sections and regenerate when data changed

## 13.2 Personas
- Generate persona outputs grouped by relevant stakeholder types
- Validate personas against extracted evidence before publication

## 13.3 Workplan
- Generate implementation workplan from report context
- Prefer complete report sections for stronger workplan quality

## 13.4 SMQ sections
- Use section-focused generation
- Add analyst notes where required
- Re-run sections selectively rather than full regeneration

---

## 14. Export and Share

Export options include:
- Report PDF
- Report DOCX
- Workplan PDF
- Workplan DOCX

Before exporting:
- Resolve major dedup/review issues
- Validate critical entities and relations
- Ensure generated sections are up to date

---

## 15. Admin Guide (Role-Based)

Admins can typically:
- Access admin pages
- Manage user access and status
- Configure entity labels and relationship taxonomies
- Review platform-level usage patterns

Governance recommendations:
- Standardize taxonomy before large extraction runs
- Limit frequent taxonomy churn during active analysis cycles
- Document taxonomy change history for auditability

---

## 16. Quality Tips for Better Results

For better extraction and generation quality:
- Use clean, text-selectable PDFs when possible
- Avoid mixed-language fragments in the same section
- Expand acronyms at first occurrence in initiative profile and SMQ inputs
- Keep project-specific terms consistent
- Run review pass before generating final exports

---

## 17. Troubleshooting (User-Focused)

## 17.1 I cannot log in
- Verify credentials
- Try password reset
- Ask admin to confirm account is active

## 17.2 Upload succeeded but extraction not appearing
- Wait for processing completion
- Confirm extraction was triggered
- Refresh document/project status view

## 17.3 Graph looks incomplete
- Lower confidence/degree filters
- Confirm extraction completed for all key documents
- Review dedup queue for hidden duplicates

## 17.4 Generated report quality is weak
- Improve initiative profile detail
- Complete missing SMQ sections and refine section notes
- Add higher-quality source documents
- Correct extraction errors before regeneration

## 17.5 Export failed
- Retry after report/workplan generation completes
- Verify backend service health
- Contact support/admin with project ID and timestamp

---

## 18. Suggested Operating Procedure for Teams

Team workflow recommendation:
1. Intake lead completes initiative profile and baseline SMQ sections
2. Data lead uploads source docs and validates processing
3. Analysis lead triggers extraction and runs review
4. QA analyst validates graph/entity correctness
5. Reporting lead generates and edits outputs
6. Admin/compliance reviewer validates final export package

This role separation improves consistency and reduces final-stage rework.

---

## 19. FAQ

Q: Can I use only one provider?
A: Yes. You can run with a single configured provider; others are optional.

Q: Do I need to re-extract everything each time?
A: Not usually. Use incremental extraction and per-document re-extract when needed.

Q: Is the graph automatically updated after edits?
A: Yes, graph payloads reflect current database state; refresh the map view if needed.

Q: Is this tool a replacement for analyst judgment?
A: No. It accelerates analysis, but human review remains essential for quality assurance.

---

## 20. Support Checklist (When Reporting Issues)

Include the following to speed up support:
- Project ID
- Action you were performing
- Timestamp and timezone
- Screenshot of error message
- Whether issue is repeatable
- Whether document processing had completed

---

## 21. Related Documentation

For deeper technical details, see:
- `docs/TECHNICAL_DOCUMENTATION.md`
- `docs/SETUP.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTER_GUIDE.md`
