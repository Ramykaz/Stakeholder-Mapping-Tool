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

### US-08 Delivery Update (Current Sprint)

- The graph view now supports payload-driven visual encoding (style, degree, confidence-aware edge rendering), plus explicit zoom controls.
- Entity side-panel interaction is available in both graph and workspace map contexts, including linked-entity drill-down and back navigation.
- Client-side entity/relation filters, filtered-visible two-hop focus mode, and real-time search/centering are implemented for fast exploration without graph refetch.
- Contextual summary generation remains explicit and on-demand, with workspace integration for generate/refresh actions and fallback-friendly handling.

### 1. User Accounts and Projects

- User registration and login (authentication required)
- Each user can create multiple named projects
- Each project has: name, description, status, created date
- Projects are isolated by default — each project has its own scoped view
- Projects can be shared with team members (future enhancement)

### 2. Concept Note as Project Seed

- Before document upload, user writes or uploads a concept note
- The concept note defines project objectives and the stakeholder focus area
- The LLM uses the concept note as context during all entity and relationship extraction
- Relationships are only extracted if they are relevant to the concept note scope
- This is the key differentiator — extraction is guided, not exhaustive
- Concept note is stored in the database and re-sent with every extraction call for the project

### 3. Document Management

- Upload multiple documents per project (PDF, DOCX, TXT, up to 50MB)
- Documents are chunked and processed within the project context
- A document folder sits alongside the concept note per project
- Document list visible within the project view

### 4. Entity Extraction — Guided, Typed, and Deduplicated

- Predefined entity label set passed to LLM as structured input
- Default labels: **Person, Organization, Location, Role, Event, Project**
- Entity labels are configurable by admin from the UI — no code changes required
- LLM extracts entities AND relationships in a **single pass** — not two separate calls
- Entity uniqueness enforced globally: same entity exists once in the database, tagged per project
- Deduplication handles name variations and acronyms:
  - Exact match: "UNDP" = "UNDP"
  - Acronym expansion: "UNDP" = "United Nations Development Programme"
  - Minor variation: "UN Development Programme" = "United Nations Development Programme"
  - Project phases: "AI for Good Phase 1" and "AI for Good Phase 2" are separate but linked
  - Fuzzy matching via string similarity for near-duplicates
- Mention count reflects unique mentions only — chunk overlap artifacts are deduplicated before counting
- No orphaned nodes — entities with no relationships in context are not shown on the map

### 5. Relationship Extraction — Context-Aware and Typed

- Relationships extracted in context of the concept note — not all co-mentions
- Relationships are typed with a predefined extensible set:
  - funded, partnered, participated, implemented, mentored, supported, advised, organized, attended, employed
- Relationship types are configurable by admin
- Relationships have weights — strength based on frequency and confidence score
- Relationships can be directional (A funds B) or bidirectional
- Relationship type labels visible on graph edges

### 6. LLM Provider Support

The system is built with a pluggable LLM provider architecture. The following providers must be supported with the ability to switch without code changes:

- **Groq** (Llama 3 — current default, free tier)
- **OpenAI** (GPT-4o, GPT-4.1 mini)
- **Azure OpenAI** (GPT-5 mini — endpoint to be provided by UNDP SDG AI Lab)
- **Google Gemini** (Gemini 1.5 Pro / Flash)

Provider selection is configured via environment variables:
```
LLM_PROVIDER=groq|openai|azure|gemini
LLM_MODEL=llama-3.3-70b-versatile
GROQ_API_KEY=...
OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=...
GEMINI_API_KEY=...
```

All LLM calls go through a shared provider abstraction layer — prompts and parsing logic are provider-agnostic. Switching providers requires only an environment variable change.

All LLM calls include:
- Retry with exponential backoff (max 3 retries)
- HTTP 429 returned to client on final failure
- Request/response logging for debugging
- Cost tracking per call (token count × provider rate)

### 7. Interactive Stakeholder Map

Inspired by Kumu and network visualization best practices:

- **Force-directed layout** — nodes settle into natural clusters
- **Node size** proportional to number of connections (or budget value if available)
- **Node shape** by entity type:
  - Circle — Organization
  - Square — Government institution
  - Triangle — Private sector entity
  - Diamond — Event or Project
  - Hexagon — Person
  - (All shapes configurable by admin)
- **Node color** by entity category — one color per type
- **Curved labeled edges** showing relationship type
- **Edge thickness** proportional to relationship weight/strength
- **Click node** → side panel opens with full entity profile
- **Focus mode** — click a node, everything beyond N hops fades out
- **Filter controls** — filter by entity type, relationship type, geography
- **Cluster view** — group entities by type or category
- **Search bar** — find a specific entity on the map
- **Zoom and pan** — full graph navigation

### 8. Entity Profile Panel (Wikipedia-style)

When a node is clicked, a side panel opens showing:

- Entity name, type, description
- All relationships listed with type, direction, and source document
- Which projects this entity appears in
- LLM-generated summary of this entity's role in the current project context
- Mention count (deduplicated)
- Links to source documents where entity was mentioned
- Confidence score

### 9. Natural Language Query

- User can ask questions against the extracted knowledge graph
- Examples:
  - "Who are the top 20 stakeholders I should meet?"
  - "Who are the funders in this ecosystem?"
  - "Which organizations participated in hackathons in Uzbekistan?"
  - "What is the relationship between UNDP and this accelerator?"
- LLM answers using the project knowledge graph as RAG context
- Query interface sits alongside the map (not a separate chatbot page)

### 10. Global Entity Database

- Entities exist globally across all projects
- Each entity accumulates relationships from every project it appears in
- Global entity view shows full history of an entity across all engagements
- When inside a project, only that project's relationships are shown
- Global entity profile accessible from any project view

### 11. Admin Panel

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
| Minor variation | "UN Development Programme" + "United Nations Development Programme" | Fuzzy match — merge if similarity > threshold |
| Project phases | "AI for Good Phase 1" + "AI for Good Phase 2" | Keep separate — but link as related entities |
| Same name different type | "Amazon" (company) + "Amazon" (river) | Keep separate — differentiated by entity type |
| Abbreviation in context | "the Programme" referring to UNDP | Coreference resolution — link to canonical entity |

Implementation approach:
1. On entity save: check exact match on (canonical_name, entity_type)
2. If no exact match: run fuzzy similarity check (Levenshtein + token sort ratio) against existing entities of same type
3. If similarity > 0.85: flag for merge, store both names as aliases, use most complete name as canonical
4. Aliases stored in a separate EntityAlias table linked to the canonical Entity record
5. All mentions of any alias resolve to the same entity node on the map

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
- Django 4.2 backend, Next.js frontend
- English language documents only (initial version)
- All LLM calls mocked in CI — no real API calls in tests
- Prompts versioned in prompts/ directory
- Entity and relationship label sets stored in database — configurable without code changes
