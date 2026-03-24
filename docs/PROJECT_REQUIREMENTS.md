# Project Requirements & Scope
## UNDP SDG AI Lab — AI-Powered Stakeholder Analysis Platform

---

## What This System Is

An AI-powered stakeholder mapping platform that allows users to create projects, upload documents, and automatically extract a relationship network of key entities — organizations, people, roles, locations — relevant to that project's context. The result is an interactive, explorable map where users can navigate, filter, query, and understand the ecosystem of stakeholders around any given topic or engagement.

This is not a generic document analysis tool. The system is designed specifically for UNDP analysts and program teams who need to understand who is doing what, with whom, and in what context — across multiple projects and documents.

---

## The Core User Journey

1. User registers and logs into the platform
2. User creates a new project (e.g. "AI for Good Uzbekistan Hackathon")
3. User writes or uploads a **concept note** — a short document describing the project objectives, the context, and the types of stakeholders they are interested in. This is the seed that tells the LLM what is relevant
4. User uploads project documents — reports, event summaries, news articles, proposals, or any other relevant files
5. The system processes all documents, extracting entities and relationships **guided by the concept note context** — only contextually relevant connections are surfaced
6. User opens the project map and sees an interactive network of nodes and edges
7. User clicks any node to open a Wikipedia-style side panel with full entity details
8. User filters, focuses, and queries the map to extract insights
9. The same entity appearing across multiple projects exists once globally but its relationships are scoped per project

---

## Features

### 1. User Accounts and Projects

- User registration and login (authentication required)
- Each user can create multiple named projects
- Each project has: name, description, status, created date
- Projects are isolated by default — each project has its own scoped view
- Project cards show a visible options menu (`⋮`) with Open and Delete actions
- Delete project requires typing the project name in a confirmation modal to prevent accidental deletion
- Projects can be shared with team members (future enhancement)

### 2. Concept Note as Project Seed

- Before document upload, user writes or uploads a concept note
- The concept note defines project objectives and the stakeholder focus area
- The LLM uses the concept note as context during all entity and relationship extraction
- Relationships are only extracted if they are relevant to the concept note scope
- This is the key differentiator — extraction is guided, not exhaustive
- Concept note is stored in the database and re-sent with every extraction call for the project
- The concept note is editable at any time from the workspace sidebar — not only during initial project setup

### 3. Document Management

- Upload multiple documents per project (PDF, DOCX, TXT, up to 50MB)
- Documents are chunked and processed within the project context
- A document folder sits alongside the concept note per project
- Document list visible within the project view
- After extraction, each document shows inline stats: entities extracted, relations extracted, confidence distribution, and top 5 extracted entities

### 4. Entity Extraction — Guided, Typed, and Deduplicated

- Predefined entity label set passed to LLM as structured input
- Default labels: **Person, Organization, Location, Role, Event, Project, Policy, Concept, Theme, Government**
- Entity labels are configurable by admin from the UI — no code changes required
- LLM extracts entities AND relationships in a **single pass** — not two separate calls
- Entity uniqueness enforced globally: same entity exists once in the database, tagged per project
- Deduplication handles name variations and acronyms:
  - Exact match: "UNDP" = "UNDP"
  - Acronym expansion: "UNDP" = "United Nations Development Programme"
  - Minor variation: "UN Development Programme" = "United Nations Development Programme"
  - Project phases: "AI for Good Phase 1" and "AI for Good Phase 2" are separate but linked
  - Fuzzy matching via string similarity for near-duplicates (RapidFuzz)
- Mention count reflects unique mentions only — chunk overlap artifacts are deduplicated before counting
- No orphaned nodes — entities with no relationships in context are not shown on the map
- Users can flag or reject extracted entities they consider incorrect or irrelevant
  - Flagged entities are hidden from the graph and excluded from future extractions for that document
  - Unflagging is possible from the entity detail page
  - A count of flagged entities is visible in the project header

### 5. Deduplication Review Queue

- The deduplication system flags near-duplicate entity pairs (similarity 0.70–0.85) for human review
- Project owners can access a "Review duplicates" page at `/projects/{id}/review`
- Each candidate pair shows: both entity names, similarity score, and sample mention context
- Actions: Merge or Keep separate
- A badge in the project sidebar shows the count of pending review items

### 6. Relationship Extraction — Context-Aware and Typed

- Relationships extracted in context of the concept note — not all co-mentions
- Relationships are typed with a predefined extensible set:
  - funded, partnered, participated, implemented, mentored, supported, advised, organized, attended, employed
- Relationship types are configurable by admin
- Relationships have weights — strength based on frequency and confidence score
- Relationships can be directional (A funds B) or bidirectional
- Relationship type labels visible on graph edges

### 7. LLM Provider Support

The system is built with a pluggable LLM provider architecture. The following providers are supported:

- **Groq** (Llama 3.1 8b Instant — current default, free tier)
- **OpenAI** (GPT-4o mini, GPT-4.1 mini)
- **Azure OpenAI** (GPT-5 mini — endpoint provided by UNDP SDG AI Lab)
- **Google Gemini** (Gemini 1.5 Pro / Flash)

Provider and model can be selected by the user per extraction run from the Analyze page — not just via environment variables. The backend validates provider/model combinations against a configurable allowlist.

All LLM calls include:
- Retry with exponential backoff (max 3 retries)
- HTTP 429 returned to client on final failure
- Request/response logging for debugging
- Cost tracking per call (token count × provider rate) stored in NERRun audit log

### 8. Interactive Stakeholder Map

Inspired by Kumu and network visualization best practices:

- **Force-directed layout** — nodes settle into natural clusters
- **Node shape** — all nodes are circles (uniform shape; type is differentiated by colour only)
- **Node size** proportional to number of connections (degree), mapped to a pixel range (min 28px → max 72px). A visible size legend is shown on the map page
- **Node colour** by entity type — one vivid colour per type with semi-transparent fill
- **Curved labeled edges** showing relationship type
- **Edge thickness** proportional to relationship weight/strength
- **Click node** → side panel opens with full entity profile
- **Hover** → neighbourhood dimming (non-connected nodes fade out) with a floating tooltip showing entity name and type
- **Persistent focus mode** — clicking a node locks focus; non-neighbourhood nodes stay dimmed until Escape or a dedicated exit button is pressed. Supports 1-hop and 2-hop neighbourhood radius toggle
- **Filter controls** — filter by entity type (checkboxes), minimum confidence score (slider), minimum degree (slider). Filters update the graph live without re-fetching data
- **Cluster view** — group entities by type or community detection (Louvain algorithm)
- **Search bar** — find a specific entity on the map; matched nodes are highlighted
- **Zoom and pan** — full graph navigation with zoom in/out and fit-to-view controls
- **Light and dark mode** — the canvas background adapts to the active UI theme

### 9. Entity Profile Panel (Wikipedia-style)

When a node is clicked, a side panel opens showing:

- Entity name, type, description
- All relationships listed with type, direction, and source document
- Which projects this entity appears in
- LLM-generated summary of this entity's role in the current project context, grounded in source document chunks (retrieved via semantic search)
- Mention count (deduplicated)
- Chronological timeline of document mentions — showing document name, upload date, and a context snippet from the source chunk. Each entry links to the source document
- Confidence score

### 10. Natural Language Query

- User can ask questions against the extracted knowledge graph
- Examples:
  - "Who are the top 20 stakeholders I should meet?"
  - "Who are the funders in this ecosystem?"
  - "Which organizations participated in hackathons in Uzbekistan?"
  - "What is the relationship between UNDP and this accelerator?"
- When the input looks like a natural language question, the system retrieves the most relevant document chunks via semantic search (pgvector cosine similarity) and sends them to the LLM as context
- LLM answer is displayed in a result panel alongside the graph
- Matched entity nodes are highlighted on the graph
- Simple entity-name lookups continue to work as keyword search

### 11. Semantic Search

- The graph search and NL query both use pgvector cosine similarity over chunk embeddings
- User queries are embedded at query time using the same `all-MiniLM-L6-v2` model used during ingestion
- Top-K most similar chunks are retrieved; their associated entities are ranked and returned
- This replaces the prior SQL `LIKE` substring match
- LLM entity summaries also use semantic chunk retrieval to ground their output in source documents

### 12. Global Entity Database

- Entities exist globally across all projects
- Each entity accumulates relationships from every project it appears in
- A global entity view (`/entities`) lists all entities the current user has access to, sorted by cross-project frequency
- Columns: entity name, type, number of projects, number of documents, confidence range
- When inside a project, only that project's relationships are shown
- Global entity profile accessible from any project view

### 13. UI Themes

- The application supports both dark mode (default) and light/day mode
- Theme is toggled via a sun/moon button in the top navigation bar
- Theme preference is persisted in `localStorage` across sessions
- The graph canvas, all panels, and all text adapt to the active theme without page reload

### 14. Admin Panel

- Manage entity label types (add, remove, reorder) without code changes
- Manage relationship types (add, remove, reorder) without code changes
- View system-wide entity and relationship counts
- LLM provider and model selection
- API key management

---

## Entity Deduplication — Critical Requirements

Entity deduplication is a critical system requirement. The following cases must all be handled:

| Case | Example | Resolution |
|------|---------|------------|
| Exact duplicate | "UNDP" + "UNDP" | Merge — same record |
| Acronym vs full name | "UNDP" + "United Nations Development Programme" | Merge — canonical name = full name, acronym stored as alias |
| Minor variation | "UN Development Programme" + "United Nations Development Programme" | Fuzzy match — merge if similarity > 0.85 |
| Project phases | "AI for Good Phase 1" + "AI for Good Phase 2" | Keep separate — but link as related entities |
| Same name different type | "Amazon" (company) + "Amazon" (river) | Keep separate — differentiated by entity type |
| Abbreviation in context | "the Programme" referring to UNDP | Coreference resolution — link to canonical entity |

Implementation approach:
1. On entity save: check exact match on (canonical_name, entity_type)
2. If no exact match: run fuzzy similarity check (RapidFuzz) against existing entities of same type
3. If similarity ≥ 0.85: auto-merge, store both names as aliases, use most complete name as canonical
4. If similarity 0.70–0.85: create EntityReviewCandidate for human review
5. If similarity < 0.70: create new entity
6. Aliases stored in a separate EntityAlias table linked to the canonical Entity record
7. All mentions of any alias resolve to the same entity node on the map

---

## Reference Benchmarks

- **Kumu** (kumu.io) — project-based ecosystem mapping, filter/focus/showcase, data-driven decorations, Wikipedia-style side panels
- **Epstein Graph** (epsteingraph.com) — document-to-network extraction, node size by mention count, click to view source documents
- **Reddit r/dataisbeautiful** network examples — creative implementations from emails and documents
- **Stakeholder.Net** (WHO/QUB) — stakeholder network analysis, typed relationships, weighted edges, health sector SNA best practices

---

## Technical Constraints

- All data stored in Supabase (PostgreSQL + pgvector)
- Docker-based deployment
- Django 4.2 backend, Next.js 14 frontend, TypeScript
- English language documents only (initial version)
- All LLM calls mocked in CI — no real API calls in tests
- Entity and relationship label sets stored in database — configurable without code changes
- Uploaded files require persistent storage (not container-local disk) before production deployment — S3 or equivalent object storage required
- Maximum upload size: 50 MB per file
