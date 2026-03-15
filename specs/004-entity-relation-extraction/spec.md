# Feature Specification: Entity + Relation Extraction with Graph Integration

**Feature Branch**: `004-entity-relation-extraction`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: User description: "After uploading a document there should be an alternative to Extract Entities: a new option called Extract Entities + Relations. This option shows the same provider choices (Groq and OpenAI with model selector). Instead of only extracting named entities, it extracts relation triplets (entity1, relation, entity2). Relations must be meaningful and directional. Each relation inherits entity-level properties such as confidence and type. The extracted relations integrate into the existing graph view so that edges are rendered alongside nodes, and node shapes reflect entity types."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract Entity Relations from an Uploaded Document (Priority: P1)

A researcher has uploaded a document and wants to understand the connections between the people, organisations, and locations in it — not just the entities in isolation. They choose "Extract Entities + Relations" instead of "Extract Entities", select their preferred provider (Groq or OpenAI), and trigger the operation. The system extracts named entities and also identifies directional, labelled relationships between pairs of entities (e.g., "Sarah Chen → *reports to* → Apex Corp"). Each relation has a confidence score. The results are stored and queryable.

**Why this priority**: This is the core value of the feature. Relations are what transform a list of entities into a knowledge graph. Without this, the feature does not exist.

**Independent Test**: Can be fully tested by calling POST /api/v1/documents/{id}/extract-entities-relations/ on a document with chunks and verifying that both Entity records and Relation records are created in the database, each with correct attributes — delivers a queryable relationship store as standalone value.

**Acceptance Scenarios**:

1. **Given** a document with extracted chunks, **When** "Extract Entities + Relations" is triggered with a valid provider and model, **Then** the system first extracts entities (using existing NER logic) and then extracts relation triplets between those entities.
2. **Given** the extraction completes, **When** relation records are inspected, **Then** each relation has: a source entity (linked to an Entity record in the document), a target entity (linked to a different Entity record), a meaningful directional label (e.g., "employs", "reports to", "located in", "chairs"), and a confidence score between 0.0 and 1.0.
3. **Given** two chunks each reference the same relationship in different words, **When** the system deduplicates, **Then** a single Relation record is stored representing that pairing, with the higher confidence score retained.
4. **Given** a provider/model selection is made, **When** the extraction runs, **Then** both entities and relations are extracted in the same run, sharing a single NERRun record that records provider, model, duration, and token usage.
5. **Given** the Groq or OpenAI API returns an error mid-extraction, **When** the failure is encountered, **Then** no partial Relation records are persisted for that run, and the run is marked as failed.
6. **Given** a document has fewer than two distinct entities, **When** relation extraction runs, **Then** zero relations are created and the system reports success with entities_created and relations_created counts.

---

### User Story 2 - View Entities and Relations as a Graph with Typed Node Shapes (Priority: P1)

A user opens the graph view for a document that has had "Extract Entities + Relations" run on it. They see a network graph where nodes represent entities, edges represent relations between them, edge labels show the relationship type, and node shapes visually differentiate entity types (e.g., people look different from organisations). The graph is interactive and meaningful at a glance.

**Why this priority**: The primary output of this feature is the graph. Without visual rendering of relations as edges and typed node shapes, there is no user-facing value beyond the data being stored.

**Independent Test**: Can be fully tested by loading the graph page for a document with extracted relations and verifying that: edges appear with labels, node shapes vary by entity type, and the graph is interactive — delivers the full visual experience as standalone value.

**Acceptance Scenarios**:

1. **Given** a document with extracted entities and relations, **When** the graph view is loaded, **Then** entity nodes are rendered with shapes corresponding to their type: PERSON as ellipse, ORGANIZATION as rectangle, LOCATION as diamond, ROLE as hexagon.
2. **Given** the graph is rendered, **When** edges are inspected, **Then** each edge has a visible label showing the relation's directional label (e.g., an arrow from "Sarah Chen" to "Apex Corp" labelled "reports to").
3. **Given** a document with only entity extraction (no relations run), **When** the graph is loaded, **Then** only nodes are shown (no edges), maintaining backward compatibility.
4. **Given** the graph has many edges, **When** a user hovers over or clicks an edge, **Then** the edge details (label, confidence, source and target entity names) are accessible.
5. **Given** the confidence filter is applied, **When** a minimum confidence threshold is set, **Then** both nodes (low-confidence entities) and edges (low-confidence relations) below the threshold are hidden.

---

### User Story 3 - Trigger Extraction from the Upload Flow with Provider Selection (Priority: P1)

After uploading a document, a user is presented with two extraction options side by side: "Extract Entities" (existing) and "Extract Entities + Relations" (new). Both options expose identical provider and model selectors. Choosing the new option and confirming triggers the combined pipeline. On completion, the summary screen shows both entity and relation counts. The document list shows which mode was last used.

**Why this priority**: The upload flow is the only entry point for triggering extraction. Without this UI, the backend feature is unreachable for end users.

**Independent Test**: Can be fully tested through the upload UI by selecting "Extract Entities + Relations", completing the flow, and verifying that (a) the extraction runs successfully, (b) the completion screen shows entity + relation counts, and (c) the document row in Recent Documents reflects the run mode.

**Acceptance Scenarios**:

1. **Given** a document has been uploaded, **When** the extraction step is shown, **Then** two options are presented: "Extract Entities" and "Extract Entities + Relations", both with the same provider/model selector.
2. **Given** the user selects "Extract Entities + Relations" and clicks confirm, **When** extraction completes, **Then** the completion screen shows the count of entities found and the count of relations found.
3. **Given** extraction is in progress, **When** the progress display is shown, **Then** it indicates that both entities and relations are being extracted (e.g., "Extracting entities and relations…").
4. **Given** extraction completes, **When** the document row in Recent Documents is viewed, **Then** it shows the model used, duration, and that the run produced both entities and relations.

---

### User Story 4 - Retrieve Relations via REST API (Priority: P2)

A developer or downstream service needs to query the extracted relations for a document programmatically. A dedicated REST endpoint returns all relations for a document with full triplet data (source entity, label, target entity, confidence), enabling external tools to consume the knowledge graph.

**Why this priority**: Programmatic access enables integration with other tools and downstream pipelines. Lower priority than the extraction and graph rendering stories because the data already flows through the graph endpoint.

**Independent Test**: Can be fully tested by calling GET /api/v1/documents/{id}/relations/ and verifying the response structure, data completeness, and correct entity linkage — delivers a queryable relation API as standalone value.

**Acceptance Scenarios**:

1. **Given** a document with extracted relations, **When** GET /api/v1/documents/{id}/relations/ is called, **Then** HTTP 200 is returned with a JSON array of relation objects.
2. **Given** the response is returned, **When** each relation object is inspected, **Then** it contains: id, source_entity_id, source_entity_name, target_entity_id, target_entity_name, label, confidence, run_id, document_id, created_at.
3. **Given** no relations exist for a document, **When** the endpoint is called, **Then** HTTP 200 is returned with an empty array.
4. **Given** the graph endpoint is called, **When** relations exist for the document, **Then** GET /api/v1/graph/?document_id={id} returns both a `nodes` array and an `edges` array in Cytoscape-compatible format.

---

### Edge Cases

- What happens when entity extraction finds zero entities? → Relation extraction is skipped and relations_created = 0 is reported.
- What happens when the LLM returns a relation referencing an entity name not in the extracted entity set? → The relation is discarded; only relations between known, stored entities are persisted.
- What happens when source and target entity in a triplet are the same entity? → The relation is discarded (self-loops are not meaningful for stakeholder analysis).
- What if the provider returns the same relation multiple times across chunks? → Deduplication by (source_entity_id, normalised_label, target_entity_id) retains the highest-confidence instance.
- What if the user re-runs "Extract Entities + Relations" on a document that already has relations? → Existing relations for that document are deleted before the new run begins (same clean-slate pattern as entity extraction).
- What if the graph view is opened for a document with only entity-extraction runs (no relations)? → The graph renders nodes only with no edges; node shapes are still applied.

---

## Requirements *(mandatory)*

### Functional Requirements

**Extraction Pipeline**

- **FR-001**: System MUST provide a new "Extract Entities + Relations" extraction mode that runs entity extraction followed by relation extraction in a single operation.
- **FR-002**: The "Extract Entities + Relations" mode MUST support the same provider and model selection as the existing "Extract Entities" mode (Groq with its default model; OpenAI with model selector showing gpt-4o-mini, gpt-5-mini, gpt-5-nano).
- **FR-003**: System MUST extract relation triplets in the form (source_entity, relation_label, target_entity) from each document chunk using the selected LLM provider.
- **FR-004**: Relation labels MUST be meaningful and directional natural-language phrases (e.g., "reports to", "chairs", "founded", "located in", "advises") — not generic labels such as "related" or "connected".
- **FR-005**: Each relation MUST carry a confidence score between 0.0 and 1.0 mirroring the confidence model used for entities.
- **FR-006**: Relations MUST reference Entity records that already exist for the document; relations pointing to entity names not found in the entity store MUST be discarded.
- **FR-007**: Self-referential relations (source entity = target entity) MUST be discarded.
- **FR-008**: Relations MUST be deduplicated by (source_entity_id, normalised_label, target_entity_id); duplicate triplets retain the highest-confidence instance.
- **FR-009**: Re-running "Extract Entities + Relations" on a document MUST first delete all existing relations for that document before persisting new results.
- **FR-010**: Both entities and relations extracted in a single run MUST share one NERRun record that records provider, model, token usage, cost, and wall-clock duration.

**API**

- **FR-011**: System MUST expose POST /api/v1/documents/{id}/extract-entities-relations/ to trigger combined extraction, accepting provider and model parameters identical to the existing extraction endpoint.
- **FR-012**: System MUST expose GET /api/v1/documents/{id}/relations/ returning all relations for a document with full triplet data.
- **FR-013**: The existing graph endpoint GET /api/v1/graph/?document_id={id} MUST be extended to include an `edges` array in Cytoscape-compatible format when relations exist for the document.

**Graph Visualisation**

- **FR-014**: Node shapes in the graph view MUST reflect entity type: PERSON as ellipse, ORGANIZATION as rectangle, LOCATION as diamond, ROLE as hexagon.
- **FR-015**: Edges in the graph view MUST display the relation label as visible text on or adjacent to the edge line.
- **FR-016**: Edges MUST be directional (arrows from source to target entity).
- **FR-017**: The confidence filter in the graph view MUST apply to both nodes and edges; entities and relations below the minimum confidence threshold MUST be hidden.
- **FR-018**: Documents with only entity-extraction runs (no relations) MUST continue to render correctly in the graph view (nodes only, no edges).

**Upload Flow**

- **FR-019**: After document upload, the extraction step MUST present two options: "Extract Entities" (existing) and "Extract Entities + Relations" (new), with identical provider/model selector UI for both.
- **FR-020**: On completion of "Extract Entities + Relations", the confirmation screen MUST display both entities_created and relations_created counts.
- **FR-021**: The Recent Documents list MUST indicate whether the last run produced relations (e.g., by showing the count of relations alongside entities).

### Key Entities

- **Relation**: Represents a directional, labelled relationship between two entities. Attributes: id (UUID), document (FK to Document), run (FK to NERRun), source_entity (FK to Entity), target_entity (FK to Entity), label (text — the relation phrase), confidence (float 0.0–1.0), created_at. Enforces source ≠ target.
- **Enhanced NERRun**: Existing run record extended to track relations_created count alongside entities_created, supporting both pure entity runs and entity+relation runs under one unified record.
- **Enhanced Graph Response**: The graph API response is extended from `{ nodes }` to `{ nodes, edges }`. An edge carries: id, source (entity UUID), target (entity UUID), label (relation phrase), confidence.

## Assumptions

- The extraction sequence within a single "Extract Entities + Relations" run is: (1) extract entities using existing NER pipeline, (2) extract relations between the identified entities using a second LLM pass per chunk.
- The relation-extraction LLM prompt is separate from the NER prompt and instructs the model to return triplets only for entities that appear in the provided entity list for that chunk.
- Token usage for the relation-extraction pass is counted separately and added to the NERRun's total token/cost fields.
- Node shape mapping (PERSON=ellipse, ORGANIZATION=rectangle, LOCATION=diamond, ROLE=hexagon) is fixed and not user-configurable in this feature.
- Relation label normalisation for deduplication means lower-casing and trimming whitespace; semantic deduplication (synonymous labels) is out of scope.
- The "Extract Entities" button remains unchanged; it continues to produce entity-only runs with no relations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete "Extract Entities + Relations" on a 4-chunk document within twice the time required for entity-only extraction on the same document and provider.
- **SC-002**: At least 90% of extracted relations reference source and target entities that both exist in the entity store for that document (no dangling references).
- **SC-003**: The graph view renders edges with visible directional labels within 3 seconds of loading for documents with up to 100 entities and 200 relations.
- **SC-004**: Node shapes consistently and correctly reflect the entity type in 100% of rendered nodes across both the entities-only and entities+relations graph modes.
- **SC-005**: Re-running extraction on the same document produces a clean result with no duplicate or orphaned relation records from prior runs.
- **SC-006**: Relation labels are meaningful — a non-technical reviewer reading a random sample of 10 extracted relation triplets can understand each relationship without additional context in at least 8 of 10 cases.

