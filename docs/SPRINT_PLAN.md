# Sprint 2 Plan 
## UNDP SDG AI Lab — Stakeholder Analysis Platform

**Goal:** Project-based stakeholder mapping platform

**Existing specs:** 001-doc-ingestion-pipeline, 002-ner-pipeline, 003-openai-llm-toggle, 004-entity-relation-extraction

---

## 1 — LLM Foundation + Project Model

- Replace the current two-pass extraction pipeline with a single LLM call that returns both entities and relationships together — eliminates orphaned nodes and halves API cost
- Build a pluggable LLM provider system so the platform can switch between Groq, OpenAI, Azure OpenAI, and Gemini via a single environment variable — Azure slot ready even before the key is provided
- Move all retry logic, rate limit handling, and error responses into one shared place that applies to every provider automatically
- Enforce explicit provider credential/configuration errors (with remediation guidance) and no silent fallback
- Create the Project model — users can create named projects, each project is an isolated workspace
- Create the Concept Note model — each project has one concept note that seeds the LLM with context during all extractions
- Build admin UI at `/admin` for managing entity labels and relationship types
- Persist only graph-connected entities and canonicalize non-directional relation pairs (A-B == B-A)

---

## 2 — Project API + Entity Deduplication

- Build all project management features: create, list, open, update, delete a project
- Build concept note management: write or upload a concept note per project, update it at any time
- Scope document upload to projects — every uploaded document belongs to a project
- Scope entity extraction, entity list, and graph to projects — every query is filtered by project context
- Implement 3-level entity deduplication:
  - Exact name match — "UNDP" + "UNDP" merges into one
  - Acronym expansion — "UNDP" + "United Nations Development Programme" merges into one, both stored as aliases
  - Fuzzy matching — near-duplicate names above similarity threshold are merged automatically
- Handle project phase disambiguation — "AI for Good Phase 1" and "Phase 2" stay separate but are linked as related
- Fix mention counts to reflect unique mentions only — chunk overlap duplicates no longer inflate counts
- Show aliases beneath each entity name in the UI and a review banner for flagged near-duplicates

---

## 3 — Admin System + Frontend Restructure

- Build configurable entity label system — admin can add, remove, and reorder entity types (Person, Organization, Location, Role, Event, Project) from the UI without code changes
- Build configurable relationship type system — admin can manage relationship types (funded, partnered, participated, organized, etc.) from the UI without code changes
- Rebuild the frontend around the project model:
  - Landing page becomes a project dashboard — grid of project cards with name, document count, entity count, last updated
  - New project flow: name → concept note → document upload → extract → map
  - Project workspace: document list panel on the left, interactive map on the right
  - Project settings page for editing name, concept note, and managing documents
  - Admin page for managing entity labels and relationship types
- Redesign the graph visualization completely inspired by Kumu:
  - Node shapes driven by entity label configuration from the database
  - Node size proportional to number of connections
  - Curved edges with relationship type labels
  - Edge thickness reflects relationship strength and confidence
  - Color coding per entity type

---

## 4 — Entity Profile Panel + Query + Polish

- Build the Wikipedia-style entity side panel: clicking any node opens a panel showing the entity name, type, LLM-generated summary, all relationships grouped by type with clickable connected entities, which projects it appears in, known aliases, and source document excerpts
- Allow navigating between entities in the panel — click a connected entity to open its profile
- Build global entity view — any entity can be viewed across all projects it appears in
- Build natural language query: user types a question, the system answers using the project knowledge graph and highlights relevant nodes on the map simultaneously
- Add filter controls — filter visible nodes and edges by entity type, relationship type, or geography
- Add focus mode — click a node and everything beyond two hops fades out
- Add search bar — type an entity name to find and center it on the map
- Loading states, error messages, empty states, and step-by-step guidance for new projects
- Remove all developer-facing UI elements

---

## 5 — Tests, E2E Verification, Staging Deploy

- Write tests for all new features — project management, concept note, scoped graph, query, deduplication, joint extraction, and all LLM providers
- Run full end-to-end flow in Docker: create project → add concept note → upload document → extract → explore map → run query → verify no orphaned nodes → verify deduplication working
- Record latency for each step against spec targets
- Clean Docker build and deploy to staging
- Confirm Azure OpenAI environment variable slot is present and documented even if key not yet provided
- Tag release v0.2.0

---

## Sprint Specs (5 total, in strict order)

| Spec | Feature | Depends On |
|------|---------|------------|
| US-05 | LLM abstraction + joint extraction + label system + admin UI | 002, 003, 004 |
| US-06 | Entity deduplication + aliases + review UI | 002, 004, US-05 |
| US-07 | Projects + concept note + project dashboard + workspace | all previous ✅ Implemented + regressions passing |
| US-08 | Graph redesign + side panel + filters + focus | US-05, US-06, US-07 |
| US-09 | Natural language query | US-05, US-07, US-08 |

---

## Definition of Done

- A user can create a project, add a concept note, upload documents, and see a scoped stakeholder map in one flow
- No orphaned nodes anywhere on the map
- Entity deduplication handling UNDP / United Nations Development Programme type cases correctly
- Graph redesigned with shaped nodes, curved labeled edges, filter and focus working
- Entity side panel and natural language query working
- All LLM providers plugged in — Groq, OpenAI, Azure (slot ready), Gemini
- All tests passing
- Staging URL live and shareable

---

## Technical Rules for This Sprint

- Read docs/PROJECT_REQUIREMENTS.md and docs/NLP_APPROACH.md before writing any spec
- Read all existing specs (001, 002, 003, 004) before planning — extend, do not rebuild
- Run tests only in Docker: `docker compose run --rm --entrypoint="" app pytest --tb=short`
- Never run `docker compose build --no-cache` unless Dockerfile or requirements.txt changed
- No LLM API calls in CI — all Groq, OpenAI, Azure, Gemini calls mocked in tests
- Commit after each completed spec, push to branch, open PR before moving to next spec
- All prompts versioned in prompts/ directory