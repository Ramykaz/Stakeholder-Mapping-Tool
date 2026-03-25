# Feature Specification: Intelligence Layer

**Feature Branch**: `011-intelligence-layer`
**Created**: 2026-03-24
**Status**: Draft
**Input**: Issues 10, 11, 17, 18, 19, 20, 21, 23, 24, 25 — semantic search, RAG summaries, per-document stats, entity flagging, dedup review queue, entity timeline, NL query, global entity view, D3 vs Cytoscape spike, LLM provider selection UI

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Semantic Search and NL Query (Priority: P1)

As an analyst exploring a project map, I can type a natural language question into the search bar and receive a grounded answer drawn from my uploaded documents, with the relevant entity nodes highlighted on the graph simultaneously. When I type a simple entity name, the matched node is highlighted as before.

**Why this priority**: Semantic search is the foundation that Issues 11 and 21 depend on. Without it, the existing search bar is a plain substring match that ignores all the stored document embeddings. This is the single highest-value fix in this spec and unlocks the intelligence capabilities of the entire platform.

**Independent Test**: Open a project map, type a question such as "Who are the funders in this ecosystem?" — confirm an LLM-generated answer appears in a result panel above the graph and the relevant entity nodes are highlighted. Type a plain entity name — confirm node highlight only (no answer panel).

**Acceptance Scenarios**:

1. **Given** a project with processed documents, **When** a user types a natural language question into the search bar, **Then** the system detects it as a question, retrieves the most relevant document chunks via semantic similarity, sends them to the LLM, displays the answer in a panel above the graph, and highlights matched entity nodes.
2. **Given** a project with processed documents, **When** a user types an entity name (not a question), **Then** matched nodes are highlighted on the graph with no LLM answer panel shown.
3. **Given** a query is submitted, **When** the semantic search finds no relevant chunks above threshold, **Then** the system shows a clear "no relevant content found" message rather than an empty panel.
4. **Given** a question is submitted, **When** the LLM provider is unavailable, **Then** the system shows a graceful error message and still highlights any matched entity nodes it found.

---

### User Story 2 - LLM RAG Entity Summary (Priority: P1)

As an analyst viewing an entity's detail profile, I can click "Generate summary" and receive a narrative description of that entity's role in the project, grounded in actual document text rather than a template string.

**Why this priority**: The current Generate summary button produces a hardcoded placeholder — it calls no LLM and reads no documents. This is a broken feature that erodes trust in the platform.

**Independent Test**: Open any entity detail page, click Generate summary — confirm the result reads as a coherent narrative referencing actual content from the uploaded documents, not a template string.

**Acceptance Scenarios**:

1. **Given** an entity with associated document chunks, **When** a user clicks Generate summary, **Then** the system retrieves the top-K chunks where that entity is mentioned via semantic search, sends them with the entity metadata and project concept note to the LLM, and displays a grounded narrative summary.
2. **Given** a summary has been generated, **When** no new extractions have run for that entity within 24 hours, **Then** the cached summary is returned instantly without a new LLM call.
3. **Given** new extractions have run since the last summary, **When** a user requests a summary, **Then** the cache is invalidated and a fresh summary is generated from the updated document evidence.
4. **Given** an entity exists but no document chunks mention it, **When** a user requests a summary, **Then** the system returns a message indicating insufficient document evidence rather than hallucinating content.

---

### User Story 3 - Per-Document Extraction Stats (Priority: P1)

As an analyst reviewing uploaded documents, I can see at a glance how many entities and relations were extracted from each document, along with the confidence distribution, and I can expand any document row to see its top 5 extracted entities.

**Why this priority**: After running extraction, the documents page currently shows only upload status badges. Users have no way to assess extraction quality per document without navigating away.

**Independent Test**: Upload two documents with different content density, run extraction, open the documents page — confirm each document row shows entity count, relation count, and confidence distribution. Expand one row and confirm the top 5 entities are listed.

**Acceptance Scenarios**:

1. **Given** extraction has completed for a document, **When** the user views the documents page, **Then** that document's row shows entity count, relation count, and a confidence distribution indicator.
2. **Given** extraction has completed, **When** a user expands a document row, **Then** the top 5 entities extracted from that document are listed with their types and confidence scores.
3. **Given** extraction has not yet run for a document, **When** the user views the documents page, **Then** the document row shows a neutral "not extracted" state with no misleading zeros.

---

### User Story 4 - Entity Flagging and Rejection (Priority: P1)

As an analyst, I can flag any extracted entity I consider incorrect or irrelevant. Flagged entities disappear from the graph and are excluded from future extractions for that document. I can see the total flagged count in the project header and reverse a flag from the entity detail page.

**Why this priority**: Without a feedback mechanism, analysts must accept all extraction results — including errors and irrelevant entities — with no way to improve quality over time.

**Independent Test**: Flag an entity from the entity side panel — confirm it disappears from the graph immediately. Check the project header for a flagged count. Open the entity detail page — confirm an unflag option is visible. Unflag the entity — confirm it reappears on the graph.

**Acceptance Scenarios**:

1. **Given** an entity visible on the graph, **When** a user clicks the flag/reject button in the entity side panel or entities table, **Then** the entity is marked as flagged, disappears from the graph immediately, and the flagged count in the project header increments.
2. **Given** a flagged entity, **When** future extraction runs on the same document, **Then** that entity is excluded from extraction output for that document.
3. **Given** a flagged entity, **When** a user navigates to its detail page, **Then** an unflag option is visible and unflagging restores the entity to the graph.
4. **Given** the project header, **When** any entities are flagged, **Then** the header shows the count of flagged entities for the current project.

---

### User Story 5 - Dedup Review Queue for Project Owners (Priority: P2)

As a project owner, I can review near-duplicate entity pairs that the system flagged as uncertain matches, and decide to merge them or keep them separate — without needing access to Django admin.

**Why this priority**: The dedup review workflow already exists but is invisible to project owners. Borderline duplicates accumulate silently, causing graph pollution and unreliable counts.

**Independent Test**: Trigger a dedup event that produces a borderline match. Open `/projects/{id}/review` — confirm the candidate pair is listed with both names, similarity score, and mention context. Merge them — confirm the graph reflects one node. Keep separate — confirm both nodes persist.

**Acceptance Scenarios**:

1. **Given** near-duplicate entities exist for a project, **When** a project owner opens `/projects/{id}/review`, **Then** they see a list of candidate pairs with both entity names, similarity score, and a sample mention from the source document.
2. **Given** a candidate pair is displayed, **When** the user selects Merge, **Then** the two entities are merged into one canonical record, their aliases are preserved, and the graph reflects a single node.
3. **Given** a candidate pair is displayed, **When** the user selects Keep separate, **Then** the pair is dismissed from the review queue and both entities remain as distinct nodes.
4. **Given** there are pending review items for a project, **When** the user views the project sidebar, **Then** a badge shows the count of pending review items.
5. **Given** all review items are resolved, **When** the user opens the review page, **Then** they see an empty state confirming no pending duplicates.

---

### User Story 6 - Entity Mention Timeline (Priority: P2)

As an analyst viewing an entity's detail page, I can see a chronological timeline of every document mention for that entity — showing which document it appeared in, when it was uploaded, and the surrounding context snippet — so I can understand when and where this entity entered the stakeholder ecosystem.

**Why this priority**: The entity detail page currently shows relationships and a summary but no temporal context. Understanding when an entity first appeared and in which documents is important for UNDP programme analysis.

**Independent Test**: Open an entity detail page for an entity that appears in multiple documents — confirm a timeline section shows entries in chronological order by upload date, each with document name, date, and a context snippet. Click a document link — confirm it navigates to the source document.

**Acceptance Scenarios**:

1. **Given** an entity that appears in multiple documents, **When** a user opens its detail page, **Then** a timeline section lists all document mentions ordered chronologically by document upload date.
2. **Given** a timeline entry, **When** the user reads it, **Then** it shows the document name, upload date, and a short context snippet from the relevant chunk.
3. **Given** a timeline entry, **When** the user clicks the document link, **Then** they are navigated to the source document within the project.
4. **Given** an entity with a single document mention, **When** the timeline is displayed, **Then** it shows one entry.

---

### User Story 7 - Global Entity View (Priority: P2)

As an analyst, I can access a global `/entities` page from the main sidebar that lists all entities across all projects I have access to, sorted by how many projects they appear in — so I can identify the most cross-cutting stakeholders in the ecosystem.

**Why this priority**: Entities are already globally deduplicated but there is no UI surface to see the cross-project entity landscape. This is a key analytical capability for UNDP teams managing multiple projects.

**Independent Test**: Create two projects each mentioning the same organisation. Open `/entities` — confirm that organisation appears once with a project count of 2. Click its name — confirm the global entity profile shows both projects and all relationships across them.

**Acceptance Scenarios**:

1. **Given** the user is authenticated, **When** they open `/entities`, **Then** they see a table of all entities across their accessible projects, sorted by cross-project frequency (descending), with columns: name, type, project count, document count, confidence range.
2. **Given** the global entities list, **When** a user clicks an entity name, **Then** they are taken to that entity's global profile showing all projects it appears in and all relationships across those projects.
3. **Given** the main sidebar, **When** the user is on any page, **Then** an "Entities" link is visible that navigates to `/entities`.
4. **Given** an entity appears in only one project, **When** shown in the global list, **Then** its project count shows 1 and its global profile shows only that project's relationships.

---

### User Story 8 - LLM Provider Selection Per Project (Priority: P2)

As a project owner, I can select which LLM provider and model to use for my project from the project settings page. Only providers with valid API keys configured in the environment are available for selection — others are shown greyed out. The active provider is visible in the project workspace sidebar.

**Why this priority**: The provider abstraction already exists but is locked to a global environment variable. Different projects may have different cost, quality, or compliance requirements.

**Independent Test**: Open project settings — confirm a provider dropdown shows available providers (active) and unconfigured providers (greyed out, labelled "not configured"). Select a different provider and save. Return to the project workspace sidebar — confirm the active provider name is displayed. Run an extraction — confirm it uses the newly selected provider.

**Acceptance Scenarios**:

1. **Given** a project settings page, **When** a user opens the provider dropdown, **Then** providers with configured API keys are selectable and providers without keys are shown greyed out with a "not configured" label.
2. **Given** a user selects a provider and saves, **When** they view the project workspace sidebar, **Then** the currently active provider name and model are displayed.
3. **Given** a project-level provider is saved, **When** extraction, summary generation, or NL query runs for that project, **Then** the project-level provider is used instead of the global environment variable default.
4. **Given** no project-level provider has been set, **When** any LLM call runs for that project, **Then** the system falls back to the global `LLM_PROVIDER` environment variable.

---

### User Story 9 - D3.js vs Cytoscape.js Architecture Decision Record (Priority: P3)

As a technical lead, I can read a concise Architecture Decision Record at `docs/ADR-graph-library.md` that compares D3.js and Cytoscape.js across performance, layout support, animation quality, bundle size, and migration effort — and clearly recommends whether to stay with Cytoscape.js or migrate.

**Why this priority**: This is a research spike. Its output informs future graph feature decisions but does not block current delivery.

**Independent Test**: Open `docs/ADR-graph-library.md` — confirm it covers all five evaluation dimensions and ends with an unambiguous recommendation with rationale.

**Acceptance Scenarios**:

1. **Given** this spec is implemented, **When** a reviewer opens `docs/ADR-graph-library.md`, **Then** the document covers: edge bundling performance at 500+ nodes, custom layout support, animation quality, bundle size and Next.js SSR compatibility, and estimated migration effort.
2. **Given** the ADR document, **When** a technical decision-maker reads it, **Then** the recommendation section clearly states "Stay with Cytoscape.js" or "Migrate to D3.js" with full rationale — not an open-ended "it depends" conclusion.

---

### Edge Cases

- What happens when the semantic search model is not loaded at query time (model weights not present in the volume)?
- How does the system behave when the selected project-level LLM provider API key expires mid-session?
- If an entity is flagged and a subsequent extraction run re-introduces it — does it auto-unflag or stay flagged?
- If a dedup merge is applied to an entity that is already flagged — does the merged entity inherit the flag state?
- What if a project has hundreds of timeline entries — is the timeline paginated or truncated?
- If the same entity appears in two chunks of the same document — does the timeline show one entry or two?
- What if an NL query is ambiguous and the top-K chunks span multiple unrelated topics with no clear answer?

## Requirements *(mandatory)*

### Functional Requirements

**Semantic Search — Issue 10**

- **FR-001**: The system MUST replace the current SQL substring search in `ProjectQueryView` with pgvector cosine similarity search over stored chunk embeddings.
- **FR-002**: The system MUST embed the user's query at query time using the same `all-MiniLM-L6-v2` model used during document ingestion.
- **FR-003**: The system MUST return the top-K most similar chunks (default K=10), extract their associated entity IDs, and return them as ranked results.
- **FR-004**: The frontend MUST highlight matched entity nodes on the graph when search results are returned.

**LLM RAG Entity Summary — Issue 11**

- **FR-005**: The entity summary endpoint MUST retrieve the top-K chunks mentioning the entity via pgvector cosine similarity before calling the LLM.
- **FR-006**: The LLM prompt MUST include the retrieved chunks, entity metadata, and the project concept note.
- **FR-007**: The system MUST use the existing 24-hour cache with evidence-hash invalidation — a new LLM call is only made when the underlying evidence changes or the cache expires.
- **FR-008**: The summary endpoint MUST use the project-level LLM provider setting when one is configured.

**Per-Document Extraction Stats — Issue 17**

- **FR-009**: After extraction completes for a document, the documents page MUST display inline per-document stats: entity count, relation count, and confidence distribution.
- **FR-010**: Each document row MUST be expandable to reveal the top 5 entities extracted from that document, with their types and confidence scores.
- **FR-011**: Documents for which extraction has not run MUST show a neutral "not extracted" state — not zeros.

**Entity Flagging — Issue 18**

- **FR-012**: The backend MUST add an `is_flagged` boolean field to the Entity model with a database migration, defaulting to `false`.
- **FR-013**: A flag/reject action MUST be available on both the entity side panel (map page) and the entities table.
- **FR-014**: Flagged entities MUST be excluded from the project graph API response and from future extraction output for the source document.
- **FR-015**: The project header MUST display the count of flagged entities for the current project when the count is greater than zero.
- **FR-016**: An unflag action MUST be available on the entity detail page, restoring the entity to the graph.

**Dedup Review Queue — Issue 19**

- **FR-017**: A review page at `/projects/{id}/review` MUST be accessible to the project owner without admin credentials.
- **FR-018**: The review page MUST list candidate duplicate pairs with: both entity names, similarity score, and at least one mention context snippet from source documents.
- **FR-019**: Each candidate pair MUST offer Merge and Keep separate actions.
- **FR-020**: The project sidebar MUST display a badge showing the count of pending review items when greater than zero.

**Entity Mention Timeline — Issue 20**

- **FR-021**: The entity detail page MUST include a timeline section listing all document mentions ordered by document upload date (ascending).
- **FR-022**: Each timeline entry MUST show: document name, upload date, and a context snippet from the source chunk.
- **FR-023**: Each timeline entry MUST link to the source document within the project.

**Natural Language Query — Issue 21**

- **FR-024**: The system MUST detect when a search bar input is a natural language question (contains question words or is longer than 3 tokens).
- **FR-025**: For detected questions, the system MUST retrieve top-K relevant chunks via pgvector semantic search, send them to the LLM with the question, and display the answer in a panel above the graph.
- **FR-026**: Matched entity nodes MUST be highlighted on the graph simultaneously with the answer being displayed.
- **FR-027**: Simple entity-name inputs MUST continue to work as keyword node-highlight search with no LLM call.

**Global Entity View — Issue 23**

- **FR-028**: A `/entities` global page MUST be accessible from the main sidebar and list all entities the current user has access to, sorted by cross-project frequency descending.
- **FR-029**: The global entity table MUST include columns: name, type, project count, document count, confidence range.
- **FR-030**: Clicking an entity MUST open its global profile showing all projects it appears in and all relationships across those projects.

**LLM Provider Selection UI — Issue 25**

- **FR-031**: The backend MUST add `provider` and `model` fields to the Project model with a database migration, defaulting to the value of the `LLM_PROVIDER` environment variable.
- **FR-032**: The project settings page MUST include a provider selection dropdown; providers without a configured API key MUST be shown greyed out with a "not configured" label.
- **FR-033**: The selected provider MUST be stored per project and used for all extraction, summary, and query calls for that project.
- **FR-034**: The project workspace sidebar MUST display the active provider name and model for the current project.

**D3.js vs Cytoscape.js Spike — Issue 24**

- **FR-035**: A document MUST be created at `docs/ADR-graph-library.md` comparing D3.js and Cytoscape.js across: edge bundling at 500+ nodes, custom layout support, animation quality, bundle size and Next.js SSR compatibility, and estimated migration effort.
- **FR-036**: The ADR MUST conclude with an unambiguous recommendation (stay or migrate) with full rationale.

### Key Entities

- **DocumentChunk**: A passage of text extracted from a document during ingestion, with a 384-dimension vector embedding. The foundation for all semantic search and RAG retrieval in this spec.
- **Entity**: A named entity extracted from documents. Gains a new `is_flagged` boolean field. Referenced by chunk mentions, timeline entries, and dedup review candidates.
- **EntityReviewCandidate**: A near-duplicate entity pair flagged for human review (similarity 0.70–0.85). Gains a project-accessible review UI surfaced to project owners.
- **Project**: A named workspace. Gains `provider` and `model` fields for per-project LLM selection.
- **NERRun**: Audit log of an extraction run. Used to compute per-document entity/relation counts and confidence distributions shown on the documents page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Semantic search returns relevant entity results for natural language queries in under 2 seconds for projects with up to 500 documents.
- **SC-002**: The Generate summary button produces a grounded narrative referencing source document content — zero instances of the hardcoded template string appear in production after this spec ships.
- **SC-003**: 100% of LLM calls for extraction, summary, and NL query use the project-level provider setting when one is configured; calls fall back to the global default only when no project-level setting exists.
- **SC-004**: Project owners can complete a full dedup review action (Merge or Keep separate) without any admin access.
- **SC-005**: Flagging an entity removes it from the graph in under 500 milliseconds without a page reload.
- **SC-006**: All documents in a "completed extraction" state display per-document stats — zero completed documents show a missing or empty stats row.
- **SC-007**: The global entities page loads and renders for a user with up to 20 projects in under 3 seconds.
- **SC-008**: `docs/ADR-graph-library.md` exists after this spec ships, covers all five evaluation dimensions, and contains an unambiguous recommendation.

## Assumptions

- The `all-MiniLM-L6-v2` model weights are already downloaded into the Docker volume at `/app/models/all-MiniLM-L6-v2` — no additional download step is required for semantic search to function.
- The `DocumentChunk` model already stores a pgvector embedding column at 384 dimensions from spec 001; this spec only adds a new query path over existing data, not a schema change to chunks.
- The `EntityReviewCandidate` model (or equivalent dedup review structure) already exists in the backend from spec 006; this spec adds the frontend review page and any missing API endpoints needed to expose it to project owners.
- Provider availability detection (which API keys are configured) is handled by the backend; the frontend receives a structured list of available vs. unavailable providers from a dedicated endpoint rather than reading environment variables directly.
- The 24-hour evidence-hash cache for entity summaries already exists from prior specs; this spec replaces the hardcoded template string with a real LLM call wired into that cache.
- Issue 24 (the D3 vs Cytoscape spike) produces a document only — no code migration is in scope for this spec regardless of the ADR recommendation.
- Flagging an entity that is later re-introduced by a new extraction run does NOT auto-unflag it — the flag state is sticky and must be explicitly removed by the user.
