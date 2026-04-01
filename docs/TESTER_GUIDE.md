# Tester Guide — UNDP Stakeholder Analysis Platform
## Step-by-Step Testing Instructions

**Branch**: `010-graph-visualization-fixes` (latest hardening + all graph/report/taxonomy fixes)
**Last Updated**: 2026-03-26
**Audience**: QA testers, analysts, and feature reviewers

---

## Before You Begin

### Prerequisites
- The application is running locally via Docker (`docker compose up -d`)
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- You have access to at least one test document (PDF, DOCX, or TXT)
- A sample concept note text is prepared (a short paragraph describing a project focus area)

### Test Accounts to Create
Create these accounts during testing:
| Role | Email | Password |
|------|-------|----------|
| Admin user | `admin@test.com` | your choice |
| Regular user | `user@test.com` | your choice |

---

## Module 1 — User Registration and Login

### 1.1 Register a New Account
1. Navigate to `http://localhost:3000`
2. Click **Sign Up** / Register link
3. Fill in: name, email (`admin@test.com`), password
4. Submit the form
5. **Expected**: Account created, redirected to dashboard or login page
6. **Verify**: No error messages; form clears after submission

### 1.2 Login
1. Navigate to the login page
2. Enter `admin@test.com` and your password
3. Click **Log In**
4. **Expected**: Redirected to the main dashboard showing your projects list
5. **Verify**: Your name or email appears in the navigation bar

### 1.3 Register a Second Account (Regular User)
1. Log out (click your avatar or the logout button)
2. Register a second account: `user@test.com`
3. Log back in as `admin@test.com` for the rest of setup

### 1.4 Promote Admin Account
1. Open `http://localhost:8000/admin` (Django Admin)
2. Log in with a superuser account (created via `docker compose exec app python manage.py createsuperuser` if needed)
3. Navigate to **Users**, find `admin@test.com`, check **Staff status** and **Superuser status**
4. Save
5. **Expected**: `admin@test.com` now has admin privileges in the application

---

## Module 2 — Project Creation

### 2.1 Create a New Project
1. On the dashboard, click **New Project** or **+**
2. Enter:
   - **Name**: `Uzbekistan AI Ecosystem`
   - **Description**: `Mapping AI stakeholders for the 2024 AI for Good Hackathon in Uzbekistan`
3. Click **Create**
4. **Expected**: Project card appears on the dashboard with name, description, and creation date

### 2.2 Project Card Options Menu
1. On the project card, locate the **⋮** (three-dot) menu icon
2. Click it
3. **Expected**: A dropdown appears with at least **Open** and **Delete** options

### 2.3 Delete Project (Confirmation Modal)
1. Click **Delete** from the ⋮ menu
2. **Expected**: A confirmation modal appears
3. The modal should ask you to **type the project name** (`Uzbekistan AI Ecosystem`) to confirm
4. Type an incorrect name → **Expected**: Delete button stays disabled
5. Type the correct project name → **Expected**: Delete button becomes active
6. Click **Cancel** — do not actually delete the project
7. **Expected**: Modal closes, project still exists

---

## Module 3 — Concept Note

### 3.1 Add a Concept Note
1. Click **Open** on the `Uzbekistan AI Ecosystem` project card
2. In the project workspace sidebar, locate the **Concept Note** section
3. Enter the following text:
   ```
   This project maps the ecosystem of organizations, individuals, and institutions
   involved in artificial intelligence development and deployment in Uzbekistan.
   Focus areas include government ministries, international development organizations
   such as UNDP, private sector AI companies, academic institutions, and civil society
   groups working on AI policy, education, and applied projects.
   ```
4. Click **Save** (or the equivalent save button)
5. **Expected**: Concept note saved; no error message

### 3.2 Edit the Concept Note
1. While in the same workspace, click on the concept note text
2. Add one sentence to the end: `Special attention to cross-border partnerships.`
3. Save again
4. **Expected**: Updated text saved; sidebar reflects the change

---

## Module 4 — Document Upload and Extraction

### 4.1 Upload a Document
1. Inside the project workspace, navigate to the **Documents** tab or section
2. Click **Upload Document**
3. Select a PDF file (≤50MB, English text preferred)
4. **Expected**: Document appears in the list with status `Processing` or `Pending`
5. Wait for processing to complete
6. **Expected**: Status changes to `Completed` or `Ready`

### 4.2 Upload Multiple Documents
1. Upload a second document (DOCX or TXT)
2. **Expected**: Both documents appear in the list
3. Each document shows: filename, file type, upload date, and status

### 4.3 Run Entity Extraction
1. Navigate to the **Analyze** tab or click **Extract Entities** / **Run Analysis**
2. Select the LLM provider (e.g., Groq) and model if shown
3. Click **Analyze** / **Extract**
4. **Expected**: Extraction runs (may take 10–60 seconds depending on document size)
5. **Expected**: A success message or progress indicator appears
6. **Expected**: No error toast or HTTP error

### 4.4 Per-Document Extraction Stats
1. After extraction, return to the **Documents** tab
2. **Expected**: Each document now shows inline stats:
   - Entity count extracted
   - Relation count extracted
   - Confidence distribution (e.g., High: 12, Medium: 5, Low: 2)
3. Click the expand arrow on a document row
4. **Expected**: An expandable section shows the **top 5 extracted entities** for that document (names and types)

---

## Module 5 — Interactive Stakeholder Map (Graph)

### 5.1 Open the Map
1. Navigate to the **Map** or **Graph** tab of the project
2. **Expected**: Nodes (circles) and edges (curved lines with labels) appear on a dark canvas (`#0d1220`)
3. **Expected**: Graph loads within 5 seconds for small datasets

### 5.2 Node Appearance
- **Verify**: Nodes are circles (not squares or diamonds)
- **Verify**: Nodes have different colors per entity type (see legend)
- **Verify**: Nodes vary in size based on the number of connections — highly connected entities are larger

### 5.3 Legend
1. Locate the **legend** on the graph canvas (usually bottom-left or sidebar)
2. **Verify**: Two sections exist:
   - **Entity Types** — colored circles matching node colors (Person, Organization, Location, etc.)
   - **Size Scale** — shows small/medium/large circles indicating connection-based sizing
3. Colors in the legend should match the actual node colors on the graph

### 5.4 Zoom and Pan
1. Use the **mouse scroll wheel** to zoom in and out
2. **Expected**: Smooth zoom within bounds (does not over-zoom or get stuck)
3. Click and drag the canvas background to **pan**
4. **Expected**: Graph pans correctly
5. Click the **Fit to View** button (if present)
6. **Expected**: All nodes become visible and centered

### 5.5 Hover — Neighbourhood Dimming
1. Hover your mouse over any node (do not click)
2. **Expected**:
   - Non-connected nodes and edges fade out (dimmed)
   - Connected nodes and their edges remain vivid (highlighted)
   - A floating tooltip appears showing the entity name and type
3. Move the mouse away from the node
4. **Expected**: All nodes return to full opacity; tooltip disappears

### 5.6 Click — Persistent Focus Mode
1. Click any node on the graph
2. **Expected**:
   - The entity's side panel opens on the right
   - Non-neighbourhood nodes remain dimmed (focus mode is locked)
3. Press **Escape** OR click a dedicated **Exit Focus** button
4. **Expected**: Focus clears; all nodes return to full opacity

### 5.7 1-Hop vs 2-Hop Neighbourhood Toggle
1. Click a node to enter focus mode
2. Look for a **1-hop / 2-hop** toggle or radius selector in the controls
3. Switch to 2-hop
4. **Expected**: Second-degree connections (friends of friends) also become highlighted

### 5.8 Search Bar — Entity Name Search
1. Locate the **search bar** at the top or top-left of the graph
2. Type part of an entity name (e.g., `UNDP`)
3. **Expected**:
   - Matched nodes are highlighted with a yellow/gold border and glow (`.search-hit` style)
   - Non-matching nodes are dimmed

### 5.9 Filter Controls
1. Locate the **filter panel** (usually a sidebar or collapsible panel)
2. **Entity type filter**: Uncheck one entity type (e.g., `Location`)
3. **Expected**: Location nodes disappear from the graph immediately
4. Re-check `Location` → nodes reappear
5. **Confidence slider**: Drag the minimum confidence slider upward
6. **Expected**: Low-confidence entities are removed from view
7. **Minimum degree slider**: Increase the minimum degree
8. **Expected**: Nodes with fewer connections are filtered out

### 5.10 Light Mode — All Elements Visible
1. Click the **sun/moon toggle** in the top navigation bar to switch to **light mode**
2. **Expected**: Canvas background changes from dark to light (cream/white `#f0ece2`)
3. **Verify**: Node labels are dark and legible (not white-on-white)
4. **Verify**: Edge lines are visible (dark lines, not invisible)
5. **Verify**: Edge labels are visible (dark text on light background)
6. **Verify**: Legend text is readable
7. Switch back to dark mode
8. **Expected**: Everything returns to the dark palette

### 5.11 PNG Export
1. Click the **Export PNG** button (camera or download icon)
2. **Expected**: A `.png` file downloads immediately
3. **Verify**: The downloaded file is NOT 0 bytes
4. Open the file
5. **Expected**: The full graph is captured, including all nodes and edges, with the correct background color

---

## Module 6 — Entity Profile Side Panel

### 6.1 Open the Panel
1. Click any node on the graph
2. **Expected**: A side panel slides in from the right
3. **Verify** the panel shows:
   - Entity **name** and **type** (e.g., `UNDP — Organization`)
   - Entity **description** (if extracted)
   - **Confidence score**
   - **Mention count** (deduplicated)

### 6.2 Relationships Section
1. In the side panel, scroll to **Relationships**
2. **Verify**: Each relationship shows:
   - The related entity name
   - Relationship type (e.g., `funded`, `partnered`)
   - Direction (→ or ←)
   - Source document name

### 6.3 LLM-Generated Summary
1. Click the **Generate Summary** button in the entity panel
2. **Expected**: A loading indicator appears briefly
3. **Expected**: A narrative paragraph appears (NOT a template string or asterisks like `**bold**`)
4. **Verify**: The summary is grounded — it mentions information from the uploaded documents
5. **Verify**: No markdown symbols (`**`, `*`, `##`) appear in the rendered text

### 6.4 Timeline of Document Mentions
1. In the entity side panel, scroll to the **Timeline** section
2. **Expected**: A list of timeline entries, ordered by document upload date
3. Each entry should show:
   - Document name (clickable link to the source document)
   - Upload date
   - A context snippet from the chunk where the entity was mentioned

### 6.5 Flag / Reject an Entity
1. In the entity side panel, locate the **Flag** or **Reject** button
2. Click **Flag**
3. **Expected**:
   - A confirmation or immediate action occurs
   - The entity disappears from the graph (hidden from view)
   - A flagged entity count badge appears or updates in the **project header**
4. Navigate to the project header/overview
5. **Verify**: The badge shows the correct flagged entity count

### 6.6 Unflag an Entity
1. Navigate to the **Entities** table (if available) or the entity detail page
2. Find the flagged entity (it should be shown in a separate flagged list or with a flag icon)
3. Click **Unflag**
4. **Expected**: Entity reappears on the graph; flagged count decreases

---

## Module 7 — Entities Table

### 7.1 View the Entities Table
1. Navigate to the **Entities** tab or list within the project
2. **Expected**: A table showing all extracted entities with columns:
   - Name, Type, Confidence, Mention count, Relationships count
3. **Verify**: Entities match what is visible on the graph

### 7.2 Flag from the Entities Table
1. Find an entity row in the table
2. Click the **Flag** icon or button on that row
3. **Expected**: Entity is flagged and either hidden or marked with a visual indicator

---

## Module 8 — Natural Language Query

### 8.1 Ask a Question
1. In the graph search bar, type a natural language question:
   - `Who are the main funders in this project?`
   - Or: `Which organizations partnered with UNDP?`
2. Press Enter
3. **Expected**:
   - The system detects this is a question (not a simple name lookup)
   - A result panel appears **above** or alongside the graph
   - The panel shows an LLM-generated answer in clean prose (no asterisks or markdown symbols)
   - Relevant entity nodes are highlighted on the graph simultaneously

### 8.2 Simple Entity Search (Not a Question)
1. Type a short entity name in the search bar: `UNDP`
2. Press Enter
3. **Expected**:
   - No LLM panel appears
   - Matched entity nodes are highlighted on the graph (`.search-hit` glow)

---

## Module 9 — Deduplication Review Queue

### 9.1 Access the Review Page
1. In the project workspace sidebar, look for a **Review** badge or button showing a number (e.g., `3 pending`)
2. Click it, or navigate to `/projects/{id}/review`
3. **Expected**: A "Review Duplicates" page loads

### 9.2 Review a Candidate Pair
1. **Expected**: Each row shows:
   - Entity A name
   - Entity B name
   - Similarity score (e.g., `0.78`)
   - Sample mention context from a source document
2. Click **Merge** on one pair
3. **Expected**: The pair is merged; count decreases; the row disappears
4. Click **Keep Separate** on another pair
5. **Expected**: The pair is dismissed; count decreases

### 9.3 Sidebar Badge Updates
1. After reviewing pairs, return to the main project view
2. **Verify**: The sidebar badge count has decreased accordingly

---

## Module 10 — Global Entity View

### 10.1 Navigate to /entities
1. In the **main sidebar** (not the project sidebar), look for **Entities** or a globe icon
2. Click it, or navigate to `/entities`
3. **Expected**: A global entities page loads

### 10.2 Verify the Table
1. **Expected**: A table with columns:
   - Entity name
   - Type
   - Project count (number of projects it appears in)
   - Document count
   - Confidence range (e.g., `0.72 – 0.95`)
2. **Verify**: Entities are sorted by cross-project frequency (most common first)

### 10.3 Open a Global Entity Profile
1. Click any entity name in the table
2. **Expected**: A global profile page opens showing:
   - All projects this entity appears in
   - All relationships across all projects
   - Timeline of mentions (same format as entity side panel)

---

## Module 11 — Reports (PDF and DOCX)

### 11.1 Generate a PDF Report
1. In the project workspace, navigate to **Reports** or click **Export Report**
2. Select **PDF** format
3. Click **Download** or **Generate**
4. **Expected**: A PDF file downloads

### 11.2 Verify PDF Quality
Open the downloaded PDF and check:
- [ ] Cover section with project name and date
- [ ] Executive summary narrative (no `**text**`, `*text*`, or `##` headings appearing literally)
- [ ] Statistics table (entity count, relation count, document count)
- [ ] **Table column headers are legible** — white text on colored background (NOT blue-on-blue or invisible)
- [ ] Key stakeholders section with a table
- [ ] Relationship section
- [ ] Per-document breakdown
- [ ] Conclusions rendered as bullet points (using `•`, not `*`)
- [ ] **Non-English characters** (if any in source docs): displayed correctly, not as empty boxes
- [ ] No missing or empty pages

### 11.3 Generate a DOCX Report
1. Select **DOCX** format and download
2. Open in Microsoft Word or LibreOffice

### 11.4 Verify DOCX Quality
- [ ] Same section structure as the PDF (cover, summary, tables, breakdown, conclusions)
- [ ] No asterisks or markdown symbols in the text
- [ ] Tables are properly formatted with visible headers
- [ ] Conclusion bullets formatted as proper list items
- [ ] Overall layout is consistent with the PDF version

---

## Module 12 — Account Settings (Taxonomy)

### 12.1 Access Account Settings as Admin
1. Logged in as `admin@test.com`, click your avatar or navigate to **Account** / `/account`
2. Navigate to the **Taxonomy** tab
3. **Expected**: Two panels:
   - **Entity Labels** — list of entity types (Person, Organization, etc.)
   - **Relationship Types** — list of relationship types (funded, partnered, etc.)

### 12.2 Edit an Entity Label Color (Admin)
1. In Entity Labels, find any label row (e.g., `Person`)
2. Click the **color picker** on that row
3. Select a new color
4. **Expected**: A **Save** button appears on that row (it was not there before)
5. Click **Save**
6. **Expected**: Success — no "Action failed" toast; Save button disappears
7. **Verify**: The color change is reflected if you re-open Account Settings

### 12.3 Edit an Entity Label Name (Admin)
1. Click on the name field of an entity label
2. Change the text (e.g., add a space or character)
3. **Expected**: Save button appears
4. Restore the original name, then verify Save button disappears again (no longer dirty)

### 12.4 Add a New Entity Label (Admin)
1. In the **add form** at the top of Entity Labels panel:
   - Name: `Donor`
   - Description: `Funding organizations and grant-makers`
   - Color: pick any color
   - Display order: `11`
2. Click **+ Add**
3. **Expected**: New `Donor` label appears in the list below

### 12.5 Delete an Entity Label (Admin)
1. Find the `Donor` label you just created
2. Click **Delete**
3. **Expected**: Row disappears from the list; no error

### 12.6 Same Tests for Relationship Types
Repeat steps 12.2–12.5 for the **Relationship Types** panel:
- Edit a color → Save button appears → Save works without error
- Edit a name → Save works
- Add a new relationship type: `evaluated`
- Delete `evaluated`

### 12.7 View Taxonomy as Non-Admin (Read-Only)
1. Log out and log in as `user@test.com`
2. Navigate to **Account** → **Taxonomy** tab
3. **Expected**:
   - Entity Labels and Relationship Types are displayed
   - **No** add form at the top
   - **No** edit inputs or Save/Delete buttons on rows
   - A note visible: "Viewing in read-only mode. Contact an admin to modify taxonomy settings."

---

## Module 13 — Admin Panel (Django Admin)

### 13.1 Access Django Admin
1. Navigate to `http://localhost:8000/admin`
2. Log in as the Django superuser
3. **Expected**: Admin dashboard loads

### 13.2 Verify Entity Label Management
1. Navigate to **Entity Label Configs**
2. **Verify**: All labels are present (Person, Organization, Location, etc.)
3. Add or edit a label from admin → changes should be reflected in the frontend taxonomy

### 13.3 Verify Relationship Type Management
1. Navigate to **Relationship Type Configs**
2. **Verify**: All relationship types are present

### 13.4 System Counts
1. Check **Entities**, **Relationships**, **NER Runs** counts in the admin
2. **Verify**: Counts reflect the extraction work done in Module 4

---

## Module 14 — Theme Persistence

### 14.1 Dark Mode (Default)
1. Open the app in a fresh session
2. **Expected**: Dark mode is active by default (dark background, light text)

### 14.2 Switch to Light Mode
1. Click the **sun icon** in the top nav
2. **Expected**:
   - UI panels switch to light background
   - Graph canvas switches to light/cream background (`#f0ece2`)
   - All text remains legible

### 14.3 Persistence Across Sessions
1. With light mode active, close the browser tab
2. Reopen `http://localhost:3000`
3. **Expected**: Light mode is still active (stored in `localStorage`)
4. Switch back to dark mode and confirm it persists after reload as well

---

## Module 15 — Entity Deduplication (Verification)

### 15.1 Verify Duplicate Handling
1. If your uploaded documents contain the same entity with slight name variations (e.g., `UNDP` and `United Nations Development Programme`), after extraction:
2. Check the **Entities** table
3. **Expected**: Only **one** entity entry for UNDP (not two separate entries)
4. Click on the entity
5. **Expected**: Aliases section (if visible) shows both `UNDP` and `United Nations Development Programme`

### 15.2 Verify No Orphaned Nodes
1. On the graph, verify there are no isolated nodes with no edges
2. **Expected**: Every visible node has at least one connecting edge

---

## Module 16 — Edge and Relationship Display

### 16.1 Verify Edges Are Visible in Both Themes
**Dark mode:**
- Edges should be visible dark blue lines
- Edge labels (relationship type) should be readable

**Light mode:**
- Edges should be visible (dark blue, NOT white/invisible)
- Edge labels should be readable dark text

### 16.2 Verify Relationship Labels on Edges
1. Zoom into a section of the graph
2. **Expected**: Each edge has a small text label showing the relationship type (e.g., `funded`, `partnered`)
3. Labels should be readable in both themes

### 16.3 Edge Thickness
1. Find two entities with a strong relationship (multiple mentions)
2. **Expected**: The edge between them appears thicker than edges between rarely-mentioned entities

---

## Checklist Summary for Testers

Use this checklist to track your testing progress:

### Core Functionality
- [ ] Registration and login work for new accounts
- [ ] Project creation, card display, and deletion confirmation work
- [ ] Concept note can be created and edited from the sidebar
- [ ] Documents upload and show status updates
- [ ] Extraction runs without errors
- [ ] Per-document stats and top 5 entities shown after extraction

### Graph Map
- [ ] Nodes visible with correct colors and sizes
- [ ] Legend shows entity types and size scale
- [ ] Zoom/pan/fit-to-view work smoothly
- [ ] Hover dims non-neighbours; tooltip appears
- [ ] Click enters persistent focus mode; Escape exits
- [ ] 1-hop / 2-hop toggle works
- [ ] Search highlights matching nodes
- [ ] Filters (type, confidence, degree) update graph live
- [ ] **Light mode**: all nodes, edges, and labels are visible
- [ ] **Dark mode**: all nodes, edges, and labels are visible
- [ ] PNG export downloads a non-empty image file with full graph

### Entity Panel
- [ ] Panel opens on node click with name, type, description, confidence, mentions
- [ ] Relationships listed with type, direction, source document
- [ ] LLM summary generates without asterisks or markdown symbols
- [ ] Timeline section shows document mentions in chronological order
- [ ] Flag button hides entity from graph and updates project header count
- [ ] Unflag restores entity to graph

### NL Query
- [ ] Question input triggers LLM answer panel above graph
- [ ] Answer has no markdown symbols
- [ ] Matched entities highlighted on graph simultaneously
- [ ] Short entity-name input triggers only graph highlight (no LLM panel)

### Dedup Review
- [ ] Review page accessible from sidebar badge
- [ ] Pairs shown with names, score, and context snippet
- [ ] Merge and Keep Separate both work and decrease count

### Global Entity View
- [ ] /entities page loads with correct table columns
- [ ] Sorted by cross-project frequency
- [ ] Clicking entity opens global profile

### Reports
- [ ] PDF downloads and is non-empty
- [ ] PDF has no asterisks or markdown in body text
- [ ] PDF table headers are legible (white text on colored background)
- [ ] PDF non-English characters display correctly
- [ ] DOCX downloads with same section structure as PDF
- [ ] Conclusion bullets in both reports use `•` not `*`

### Taxonomy (Account Settings)
- [ ] Admin can change entity label colors (Save button appears on change, Save works)
- [ ] Admin can change entity label names (Save button appears on change, Save works)
- [ ] Admin can add new entity labels
- [ ] Admin can delete entity labels
- [ ] Same for relationship types
- [ ] Non-admin user sees read-only view with the informational note

### Themes
- [ ] Dark mode is default
- [ ] Light mode switch works for entire UI
- [ ] Theme persists across page reload

---

## Reporting Issues

When you find a bug, please document:
1. **Steps to reproduce** — exactly what you did
2. **Expected result** — what should have happened
3. **Actual result** — what actually happened
4. **Screenshot or recording** — if applicable
5. **Theme** — dark or light mode when issue occurred
6. **Browser and OS** — e.g., Chrome 123, Windows 11

Report issues to the development team via the project's GitHub Issues page or Slack channel.
