# Implementation Plan: Entity + Relation Extraction with Graph Integration

**Branch**: `004-entity-relation-extraction` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-entity-relation-extraction/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extend the existing NER extraction system by adding a combined "Extract Entities + Relations" pipeline that produces both named entities and directional labeled relationships between them in the form of triplets (source_entity, relation_label, target_entity). Relations are extracted using the selected LLM provider (Groq or OpenAI with model choice), deduplicated, and stored with confidence scores. The graph visualization is enhanced to render entity nodes with type-specific shapes (PERSON=ellipse, ORGANIZATION=rectangle, LOCATION=diamond, ROLE=hexagon) and relation edges with visible directional labels. The upload flow presents side-by-side extraction mode options, and the Recent Documents list indicates whether relations were extracted in each run.

## Technical Context

**Language/Version**: Python 3.11 (backend); Node.js 20 LTS (frontend)

**Primary Dependencies**: 
- **Backend**: Django 4.2, Django REST Framework, groq (Python SDK), openai (Python SDK) — already installed
- **Frontend**: Next.js 14, React 18, Cytoscape.js, TypeScript — already installed

**Storage**: PostgreSQL 15 + pgvector (via Supabase); new `relations` table with FKs to entities and documents; extend `ner_run` table to track relations_created count

**Testing**: pytest, pytest-django (backend); Jest, React Testing Library (frontend)

**Target Platform**: Linux (Docker); Docker Compose with two containers (backend at :8000 + frontend at :3000)

**Project Type**: Web application — REST API backend + Next.js frontend

**Performance Goals**: 
- Relation extraction within 2× entity-only extraction time for same document/provider
- Graph rendering with edges within 3 seconds for 100 entities + 200 relations
- ≥90% extracted relations reference valid entity pairs

**Constraints**: 
- Extraction is **synchronous** (blocks until complete, returns 201 Created)
- Re-extraction deletes all existing relations for the document before persisting new ones (clean slate)
- Self-referential relations (source = target) are discarded
- Relations referencing entities not in the extracted entity set are discarded
- No authentication (MVP)

**Scale/Scope**: MVP — same scale as existing NER pipeline; hundreds to low-thousands of documents; 4 entity types; no change to user scale

---

## Constitution Check

✅ **All gates pass**. No violations introduced.

| Principle | Status | Notes |
|-----------|--------|-------|
| Docker from Day-1 | ✅ Pass | Reuses existing containers; no new services |
| Supabase as single source of truth | ✅ Pass | New relations table; extends ner_run; no local state |
| Prompts versioned | ✅ Pass | Relation extraction prompt stored in `prompts/relation-extraction-v1.md` |
| Deterministic builds | ✅ Pass | No new dependencies; reuses groq + openai SDKs |
| Observability | ✅ Pass | Reuses existing logging + health check |
| KISS / YAGNI | ✅ Pass | Extends existing entity pipeline; minimal new abstractions |
| Tests before PR | ✅ Required | pytest + Jest suites must pass before merge |
| DRY | ✅ Pass | Reuses provider factory, costing, chunking, and run tracking from existing NER |

---

## Project Structure

### Documentation (this feature)

```text
specs/004-entity-relation-extraction/
├── plan.md              # This file
├── research.md          # Phase 0 output (relation extraction prompting strategies)
├── data-model.md        # Phase 1 output (Relation model, extended NERRun)
├── quickstart.md        # Phase 1 output (local dev setup)
├── contracts/
│   ├── api.md          # REST API endpoints (POST extract-entities-relations, GET relations)
│   ├── graph.md        # Extended graph response with edges + node shape mapping
│   └── prompt.md       # Relation extraction prompt contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
stakeholder-analysis-tool/
├── ner/                             # UPDATED: extend existing Django app
│   ├── models.py                    # UPDATED: add Relation model; extend NERRun with relations_created
│   ├── views.py                     # UPDATED: add ExtractEntitiesRelationsView, RelationsView
│   ├── serializers.py               # UPDATED: add RelationSerializer
│   ├── urls.py                      # UPDATED: add /extract-entities-relations/, /relations/ routes
│   ├── services/
│   │   ├── pipeline.py              # UPDATED: add extract_relations_for_document()
│   │   ├── relation_extractor.py   # NEW: relation triplet extraction logic
│   │   ├── relation_deduplicator.py # NEW: deduplicate relations by (source, label, target)
│   │   └── [groq_client.py, openai_client.py, provider_factory.py] # REUSED: no changes
│   ├── migrations/
│   │   └── 0006_add_relations.py   # NEW: create relations table + add relations_created to ner_run
│   └── tests/
│       ├── test_relation_extractor.py # NEW
│       ├── test_relation_deduplicator.py # NEW
│       └── test_views.py            # UPDATED: add relation extraction + graph edge tests
│
├── graph/                           # UPDATED: extend graph app for edges
│   ├── views.py                     # UPDATED: CytoscapeGraphView returns edges array
│   └── tests/
│       └── test_graph_edges.py      # NEW: edge rendering tests
│
├── frontend/                        # UPDATED: extend frontend
│   ├── pages/
│   │   ├── upload.tsx               # UPDATED: add "Extract Entities + Relations" button
│   │   └── graph.tsx                # UPDATED: render edges with labels + typed node shapes
│   ├── src/
│   │   ├── lib/api.ts               # UPDATED: add extractEntitiesRelations(), getRelations()
│   │   └── types/index.ts           # UPDATED: Relation type, extended DocumentSummary
│   └── tests/
│       └── graph.test.tsx           # UPDATED: edge rendering + node shape tests
│
├── prompts/
│   ├── ner-extraction-v1.md         # existing
│   └── relation-extraction-v1.md    # NEW: versioned relation extraction prompt
│
└── stakeholder_analysis/
    └── settings.py                  # no changes needed (ner app already registered)
```

**Structure Decision**: Web application (Option 2) — extends existing backend/ (Django ner + graph apps) and frontend/ (Next.js) with relation extraction and graph edges. No new apps or containers; all new logic integrated into existing `ner` and `graph` Django apps.

