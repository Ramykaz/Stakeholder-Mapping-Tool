# Phase 0 Research — Incremental Extraction, Review, and Evidence Integrity

## Decision 1: Incremental extraction selector
- Decision: Use a document extraction marker (`extracted_at`) as the default selector; standard extraction runs target only documents with no extraction timestamp.
- Rationale: This is deterministic, auditable, and low-complexity compared with comparing entity counts or run histories.
- Alternatives considered:
  - Infer “new” by missing entities/relationships: rejected (can be stale/inconsistent after manual edits).
  - Always full-project re-extraction with dedup: rejected (wasteful and not aligned with user intent).

## Decision 2: Re-extract single document flow
- Decision: Add per-document explicit re-extract action that clears extraction marker for that document and re-runs extraction only for it.
- Rationale: Preserves incremental default behavior while enabling targeted correction/reprocessing.
- Alternatives considered:
  - Global “force re-extract all”: rejected (high cost/risk and poor precision).
  - Hidden admin-only reset scripts: rejected (not usable by analysts in normal workflow).

## Decision 3: Document-level evidence provenance model
- Decision: Keep entity `document` linkage and add/strengthen explicit mention-level provenance via `EntityMention` model for per-document evidence tables; relationships include direct source document provenance.
- Rationale: Review APIs require document-scoped confidence/excerpt/mention counts and delete-by-document semantics.
- Alternatives considered:
  - Derive mentions only from canonical entity rows: rejected (insufficient granularity for per-document edits).
  - Store excerpts only in frontend state: rejected (not durable or queryable).

## Decision 4: Orphan-entity integrity enforcement
- Decision: Enforce no-orphan rule at three layers: extraction save-time validation, graph query filtering, and one-time cleanup command for legacy records.
- Rationale: Multi-layer enforcement prevents both new and historical integrity drift.
- Alternatives considered:
  - Query-only filter: rejected (orphan rows remain in DB and leak into other views).
  - Save-only rule: rejected (legacy data remains unclean and query inconsistencies persist).

## Decision 5: Entity hallucination guard in extraction
- Decision: Add post-extraction mention validation using case-insensitive substring match against chunk text (including aliases where available) before persisting candidate entities.
- Rationale: Simple, transparent guardrail with low runtime overhead that catches common hallucinated entities.
- Alternatives considered:
  - Fuzzy match threshold validation: rejected for initial scope (higher false positives and complexity).
  - LLM self-check roundtrip: rejected (extra cost/latency).

## Decision 6: Document cleaning boundary and storage
- Decision: Preserve `raw_text` for audit and persist `cleaned_text` used for chunking/embedding/extraction/excerpts.
- Rationale: Ensures reproducibility while improving extraction quality and UI evidence cleanliness.
- Alternatives considered:
  - Overwrite raw text in place: rejected (loss of auditability).
  - Clean at display-time only: rejected (retrieval/extraction remains polluted).

## Decision 7: Web-source stricter cleaning
- Decision: Apply baseline cleaner to all documents and stricter line-drop heuristics for web-sourced text patterns that resemble code/CSS/JSON fragments.
- Rationale: Web pages contain significantly more non-linguistic artifacts than uploaded files.
- Alternatives considered:
  - Uniform cleaner for all sources: rejected (insufficient noise suppression for web content).

## Decision 8: Document review UX placement
- Decision: Keep review on documents page via expandable inline panel with lazy-loaded Entities/Relationships tabs.
- Rationale: Matches user requirement and minimizes context-switch overhead.
- Alternatives considered:
  - Separate review page per document: rejected (explicitly out of scope).

## Decision 9: Contextual summary evidence package
- Decision: Generate summary only when evidence threshold is met, using project context + top cleaned excerpts + full relationship statements + mention/doc counts.
- Rationale: Prevents generic summaries and forces project-grounded narratives.
- Alternatives considered:
  - Always generate with fallback generic copy: rejected (fails specificity requirement).

## Decision 10: Entity mini-graph rendering approach
- Decision: Use static radial layout (no force animation, no pan/zoom) based on existing entity-detail relationship payload.
- Rationale: Satisfies UX requirement with minimal new API surface and predictable readability.
- Alternatives considered:
  - Reuse full graph component with controls: rejected (unnecessary complexity for 1-hop snapshot).
