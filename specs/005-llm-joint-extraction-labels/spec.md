# Feature Specification: LLM Provider Abstraction + Joint Extraction + Configurable Labels

**Feature Branch**: `005-llm-joint-extraction-labels`  
**Created**: 2026-03-16  
**Status**: Draft  
**Input**: User description: "US-05: LLM Provider Abstraction + Joint Extraction + Configurable Label System"

## Clarifications

### Session 2026-03-16

- Q: Who can access `/admin` and modify entity labels/relationship types? → A: Only authenticated admin users can access `/admin` and modify labels/types.
- Q: What is deletion behavior for labels/types used in historical extractions? → A: Hard delete is blocked when referenced in historical data; deactivation is allowed.
- Q: How should non-directional relationship types be persisted? → A: Store one canonical relation (sorted entity pair) and treat A-B and B-A as the same relation.
- Q: What should happen when selected provider credentials are missing/invalid at runtime? → A: Fail the run with explicit configuration error and actionable guidance to either provide correct credentials or select another provider; no automatic fallback.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Joint Entity+Relationship Extraction in One Call (Priority: P1)

As an analyst, I can run extraction on a document chunk using one provider call that returns entities and relationships together, so results are faster, cheaper, and contextually consistent.

**Why this priority**: This is the core scope of US-05 and directly replaces the two-pass behavior from prior specs.

**Independent Test**: Can be tested by running extraction on a multi-chunk document and confirming one provider request per chunk returns both entity and relationship output in one structured response.

**Acceptance Scenarios**:

1. **Given** a document chunk and active label/type configuration, **When** extraction is triggered, **Then** the system sends one request for that chunk containing chunk text, concept note (nullable), active entity labels, and active relationship types.
2. **Given** a provider response for one chunk, **When** the response is processed, **Then** entities and relationships are read from the same structured response and persisted in one run context.
3. **Given** an extraction run with multiple chunks, **When** request logs are reviewed, **Then** each chunk produces exactly one provider call rather than two separate calls.
4. **Given** returned entities with and without relationships, **When** persistence occurs, **Then** only entities that participate in at least one saved relationship are stored.

---

### User Story 2 - Use Unified Provider Abstraction Across Supported LLMs (Priority: P1)

As an operator, I can use a single provider abstraction for Groq, OpenAI, Azure OpenAI, and Gemini so provider switching remains consistent without changing feature behavior.

**Why this priority**: The provider abstraction is required to extend spec 003 behavior while preserving reliability and cost governance.

**Independent Test**: Can be tested by running the same extraction request against each configured provider and confirming equivalent structured outputs, shared retry/rate-limit behavior, and cost tracking.

**Acceptance Scenarios**:

1. **Given** a selected provider, **When** extraction is invoked, **Then** the system calls a shared interface method with the same input structure for all providers.
2. **Given** transient provider failures, **When** retries occur, **Then** backoff/retry behavior matches existing expectations and final rate-limit failures are surfaced consistently.
3. **Given** successful responses from Groq, OpenAI, and Gemini, **When** output is returned, **Then** all responses are normalized to the same entity+relationship JSON contract.
4. **Given** Azure OpenAI endpoint and deployment are configured but API key is not yet available, **When** provider configuration is loaded, **Then** Azure remains selectable/configurable without breaking startup.
5. **Given** any successful extraction call, **When** usage is recorded, **Then** token and cost data are tracked using the shared accounting path.

---

### User Story 3 - Manage Label and Relationship Type Catalog in Admin UI (Priority: P1)

As an admin user, I can manage entity labels and relationship types from an admin page so extraction behavior can be updated without code changes.

**Why this priority**: Configurable labels/types are central to US-05 and required by project requirements and sprint scope.

**Independent Test**: Can be tested by adding, editing, toggling, and deleting labels/types in admin UI and confirming that only active values are used in the next extraction run.

**Acceptance Scenarios**:

1. **Given** the admin page at `/admin`, **When** it is opened, **Then** entity labels and relationship types are listed with name, description, color, active state, and display order.
2. **Given** an admin edits a label or type, **When** changes are saved, **Then** the updated values appear immediately in admin listings.
3. **Given** an item is marked inactive, **When** a new extraction run starts, **Then** that inactive item is not included in the provider input.
4. **Given** seed defaults are loaded, **When** the system is initialized, **Then** entity labels and relationship types are present with the required default set.

---

### User Story 4 - Persist Only Connected Graph Data (Priority: P2)

As an analyst, I see extraction outputs that avoid disconnected graph noise, so the resulting graph contains only meaningful connected stakeholders.

**Why this priority**: Eliminating orphaned nodes is a key quality objective but depends on the core extraction and configuration flows.

**Independent Test**: Can be tested by running extraction on text that yields some standalone entities and confirming only relationship-connected entities are saved.

**Acceptance Scenarios**:

1. **Given** extraction output includes entities with no relationships, **When** persistence runs, **Then** those standalone entities are excluded from saved results.
2. **Given** all extracted entities are connected through at least one relationship, **When** persistence completes, **Then** all connected entities are retained.

### Edge Cases

- Concept note is null or empty: extraction still runs and returns valid structured output using chunk text and active taxonomy.
- Provider returns entities but no relationships for a chunk: no entities from that chunk are persisted.
- Admin deactivates all relationship types: extraction request is rejected with clear validation feedback before provider call.
- Duplicate or differently cased labels/types in admin input: uniqueness rules prevent ambiguous active taxonomy.
- A relationship references an entity that is not present in the same structured response: that relationship is discarded.
- Non-admin authenticated user attempts to access `/admin`: access is denied with an authorization error and no taxonomy changes are applied.
- Admin attempts to delete an entity label or relationship type that is referenced by historical extraction data: delete is blocked and admin is prompted to deactivate instead.
- A non-directional relationship is extracted as both A-B and B-A across chunks: only one canonical stored relation remains.
- Selected provider credentials are missing or invalid at runtime: run fails fast with a clear message that offers remediation by updating credentials or selecting a different provider.

## Requirements *(mandatory)*

### Functional Requirements

**Provider Abstraction and Joint Extraction**

- **FR-001**: The system MUST expose one shared provider interface method that accepts chunk text, concept note (nullable), active entity labels, and active relationship types.
- **FR-002**: The shared provider interface MUST return one structured JSON response containing both extracted entities and extracted relationships for the chunk.
- **FR-003**: The system MUST replace the two-pass per-chunk extraction flow with one provider call per chunk for joint extraction.
- **FR-004**: The system MUST preserve existing retry behavior, rate-limit handling, and extraction cost tracking from prior provider integrations through the shared abstraction.
- **FR-005**: The system MUST support Groq, OpenAI, Azure OpenAI, and Gemini through the same interface contract.
- **FR-006**: The system MUST support Azure OpenAI endpoint and deployment configuration readiness even when the Azure API key is not yet supplied.
- **FR-026**: If the selected provider has missing or invalid runtime credentials, the system MUST fail the extraction run with an explicit provider configuration error and MUST NOT auto-fallback to another provider.
- **FR-027**: Credential-related error responses MUST include actionable remediation guidance: provide valid credentials for the selected provider or choose another configured provider.

**Extraction Input and Persistence Rules**

- **FR-007**: For every extraction request, the system MUST pass only active entity labels and active relationship types as structured input to the provider.
- **FR-008**: The system MUST persist entities and relationships from the same provider response within one run context.
- **FR-009**: The system MUST save only entities that participate in at least one saved relationship.
- **FR-010**: The system MUST discard relationships that reference unresolved entities or violate directional relationship constraints.
- **FR-024**: For relationship types marked `directional=false`, persistence MUST normalize the entity pair to one canonical order and store a single relation record.
- **FR-025**: For relationship types marked `directional=false`, reversed duplicates between the same entity pair MUST be treated as duplicates of the same relation.

**Configurable Label System**

- **FR-011**: The system MUST maintain a database-managed entity label catalog containing name, description, node shape, color, active flag, and display order.
- **FR-012**: The system MUST maintain a database-managed relationship type catalog containing name, description, directional flag, color, active flag, and display order.
- **FR-013**: The system MUST initialize default entity labels: Person, Organization, Location, Role, Event, Project.
- **FR-014**: The system MUST initialize default relationship types: funded, partnered, participated, implemented, mentored, organized, attended, advised.
- **FR-015**: The admin UI at `/admin` MUST allow authenticated admin users to view, add, edit, and delete entity labels and relationship types.
- **FR-016**: The admin UI MUST display each entity label with name, node shape, color, and active toggle.
- **FR-017**: Changes to labels and relationship types MUST take effect on the next extraction run without requiring deployment.
- **FR-021**: Non-admin users MUST NOT be permitted to create, update, or delete entity labels or relationship types via UI or API routes backing `/admin`.
- **FR-022**: The system MUST prevent hard deletion of any entity label or relationship type that is referenced by historical extraction records.
- **FR-023**: For referenced labels/types, the admin workflow MUST support deactivation so future extraction runs stop using them while historical records remain intact.

**Backward Compatibility and Scope**

- **FR-018**: The feature MUST extend existing capabilities from specs 002, 003, and 004 rather than introducing a parallel extraction architecture.
- **FR-019**: Existing extraction result consumers MUST continue receiving a stable structured contract after normalization from the shared provider abstraction.
- **FR-020**: The feature MUST remain compatible with existing run-level reporting for extraction counts and usage metadata.

### Key Entities *(include if feature involves data)*

- **Entity Label**: Admin-managed extraction category with display metadata and active/order controls used to constrain entity classification.
- **Relationship Type**: Admin-managed relationship taxonomy item with directionality and display metadata used to constrain relationship extraction.
- **Joint Extraction Result**: Single per-chunk structured output containing entities and relationships produced by one provider call.
- **Provider Configuration**: Runtime provider selection and credentials/settings used by the shared abstraction to execute extraction requests.

### Dependencies

- Spec `002-ner-pipeline`
- Spec `003-openai-llm-toggle`
- Spec `004-entity-relation-extraction`

### Assumptions

- Existing authentication and authorization controls already govern access to admin capabilities.
- Concept note support exists and may be null for this feature scope.
- Existing provider pricing logic remains authoritative for cost calculations and is reused by the abstraction layer.
- Default seeds are created once and can be modified by admins after initialization.

### References

- `docs/NLP_APPROACH.md`
- `docs/PROJECT_REQUIREMENTS.md`
- `docs/SPRINT_PLAN.md`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of extraction runs process each chunk with exactly one provider call that returns both entities and relationships.
- **SC-002**: 100% of saved entities in joint extraction runs have at least one associated saved relationship (zero orphaned nodes).
- **SC-003**: At least 95% of successful runs record provider usage and cost metrics through the shared abstraction path.
- **SC-004**: Admin users can complete create/edit/deactivate actions for both label catalogs in under 2 minutes without developer intervention.
- **SC-005**: Changes made in `/admin` are reflected in provider input on the very next extraction run for 100% of validation cases.
- **SC-006**: All four providers (Groq, OpenAI, Azure OpenAI, Gemini) pass contract validation for normalized joint extraction response shape before release.
