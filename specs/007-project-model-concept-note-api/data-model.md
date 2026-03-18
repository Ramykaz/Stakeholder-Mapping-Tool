# Data Model — US-07

## 1) Project (new)

### Fields
- `id` (UUID, PK)
- `name` (string, required)
- `description` (text, optional)
- `status` (enum: `active|archived`, default `active`)
- `created_at` (datetime)
- `updated_at` (datetime)

### Rules
- Name is required and non-empty.
- Status governs UI behavior for write operations.
- Dashboard metrics are computed from linked documents/entities.

---

## 2) ConceptNote (new, 1:1 with Project)

### Fields
- `id` (UUID, PK)
- `project` (OneToOne FK to `Project`)
- `content` (text, required; may be empty string by policy)
- `attachment` (file, optional)
- `created_at` (datetime)
- `updated_at` (datetime)

### Rules
- Exactly one concept note per project.
- Content and attachment are independently optional at update time.
- Latest note state is used as extraction context for project-scoped extraction.

---

## 3) Document (extended existing)

### Added Field
- `project` (nullable FK to `Project` during transition)

### Migration Rule
- On migration, all pre-existing documents are assigned to deterministic default project.

---

## 4) Entity (extended existing)

### Added Field
- `project` (nullable FK to `Project` during transition)

### Migration Rule
- Backfill project from related document where available.

---

## 5) Relation (extended existing)

### Added Field
- `project` (nullable FK to `Project` during transition)

### Migration Rule
- Backfill project from related document/run where available.

---

## 6) Derived/API Read Models

### ProjectSummary
- `id`, `name`, `description`, `status`, `document_count`, `entity_count`, `updated_at`

### ProjectWorkspaceState
- Project metadata + document list + scoped graph/entity endpoints

### GlobalEntityProfile
- Entity core fields + list of projects where entity appears
