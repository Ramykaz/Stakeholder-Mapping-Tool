# Research: Document Ingestion Pipeline

**Branch**: `001-doc-ingestion-pipeline` | **Date**: 2026-03-10
**Phase**: 0 — Unknowns resolved before design

---

## Topic 1: Semantic Chunking Strategy for all-MiniLM-L6-v2

### Decision 1.1 — Chunk Size
**Decision**: 200–256 tokens per chunk (~800–1,024 characters)

**Rationale**: all-MiniLM-L6-v2 has a hard maximum of 256 word-piece tokens. Staying at 200–240 tokens leaves a safety margin against truncation. For dense UNDP policy documents, this corresponds to roughly 6–10 sentences — enough to capture a coherent policy statement without losing context.

**Alternatives considered**:
- Smaller chunks (<150 tokens): lose surrounding context; retrieval suffers on multi-sentence policy claims
- Larger chunks (>256 tokens): model truncates silently; last sentences of chunk are not embedded

### Decision 1.2 — Overlap
**Decision**: 32–48 token overlap between adjacent chunks (~20% of chunk size)

**Rationale**: 20% overlap prevents semantic loss at chunk boundaries — critical when a key policy statement spans the end of one chunk and the start of the next. Storage overhead is acceptable at MVP scale (a few thousand chunks).

**Alternatives considered**:
- No overlap: simpler, but boundary loss measurably reduces retrieval recall on long documents
- >30% overlap: diminishing returns; increases chunk count and storage without proportional recall gains

### Decision 1.3 — Chunking Strategy
**Decision**: Sentence-based segmentation (primary); merge short sentences to reach target token count

**Rationale**: Policy documents use sentences as the atomic semantic unit. Splitting mid-sentence destroys meaning. Sentence-based chunking respects these boundaries. Sentences under 50 tokens are merged with their neighbour; sentences over 256 tokens are split at clause boundaries.

**Alternatives considered**:
- Token-based (fixed length): fast but semantically blind; breaks mid-clause frequently
- Paragraph-based: useful as grouping heuristic but paragraphs in policy PDFs are inconsistent length

### Decision 1.4 — Python Library
**Decision**: spaCy (`en_core_web_sm`) for sentence segmentation + `transformers.AutoTokenizer` for token-count verification

**Rationale**: spaCy is production-grade, handles abbreviations and policy-specific punctuation reliably, and is faster than NLTK. The all-MiniLM-L6-v2 tokenizer is used post-segmentation to verify that no chunk exceeds 256 tokens before embedding.

**Alternatives considered**:
- LangChain text splitters: functional but adds an abstraction layer and a heavy dependency for a single use case
- NLTK sentence tokenizer: less accurate than spaCy on formal/policy text; slower

---

## Topic 2: pgvector Index Type for 384-Dimensional Embeddings

### Decision 2.1 — Index Type
**Decision**: IVFFlat for MVP; plan HNSW migration at 50k+ vectors

**Rationale**: IVFFlat has lower memory overhead and simpler configuration than HNSW, making it the right choice for a dataset that will start in the hundreds-to-thousands range. HNSW provides better recall and query latency at scale but is more expensive to build and maintain.

**Alternatives considered**:
- HNSW from the start: better long-term but over-engineered for MVP; Supabase managed tier has memory constraints
- No index (sequential scan): catastrophically slow as vector count grows; not acceptable even for MVP

### Decision 2.2 — Index Parameters
**Decision**: IVFFlat with `lists=100` initially; scale by sqrt(N) rule as data grows

**Rationale**: `lists=100` is appropriate for up to ~10,000 vectors. As dataset grows, rebuild with `lists=sqrt(N)` (e.g., lists=223 at 50k vectors). If migrating to HNSW: `m=16`, `ef_construction=256`.

### Decision 2.3 — Index Creation Timing
**Decision**: Create the index at migration time (empty table)

**Rationale**: Creating the index in the migration keeps schema management fully declarative and predictable. Queries without an index are catastrophically slow even at small scale. The index builds instantly on an empty table.

### Decision 2.4 — Distance Metric
**Decision**: Cosine similarity (`<=>` operator in pgvector)

**Rationale**: all-MiniLM-L6-v2 is trained and evaluated using cosine similarity; embeddings are normalized to unit length. Using cosine distance gives the most semantically accurate similarity scores.

**Alternatives considered**:
- L2 (Euclidean): suboptimal for normalized embeddings; effectively equivalent to cosine but with added noise
- Inner product: only optimal when magnitude carries meaning, which it does not here

---

## Topic 3: sentence-transformers Model Loading in Django

### Decision 3.1 — Loading Pattern
**Decision**: `AppConfig.ready()` + module-level singleton

**Rationale**: `AppConfig.ready()` is Django's canonical application startup hook, executed once. A module-level singleton ensures all workers share the same loaded model object rather than reloading per-request. Per-request loading (~90MB per call) would make every ingestion request unacceptably slow.

**Alternatives considered**:
- Per-request loading: ~90MB overhead per request; non-starter
- Module-level import (outside AppConfig): can execute during test collection; AppConfig guard is cleaner

### Decision 3.2 — Memory Budget
**Decision**: Plan for 300–400 MB per container; set Docker memory limit to 1.5–2 GB

**Rationale**: Model weights ~90 MB + PyTorch overhead ~100 MB + inference buffers ~100–150 MB = ~300–400 MB per worker. Single-worker MVP stays well within a 1.5 GB limit.

### Decision 3.3 — Thread Safety
**Decision**: No special handling needed; sentence-transformers is safe for concurrent inference in eval mode

**Rationale**: PyTorch inference operations are thread-safe when the model is in eval mode. The CPython GIL prevents concurrent tensor mutations. Model weights are never modified after loading.

### Decision 3.4 — Model Storage
**Decision**: Pre-download model to a Docker volume; load from local path at startup

**Rationale**: Eliminates HuggingFace Hub network dependency at container startup (avoids 30–120s download on every cold start). Supports offline/air-gapped deployment. The model is downloaded once and mounted as a Docker volume.

**Implementation**: Set `HF_HOME=/app/models` in the Docker environment so sentence-transformers caches to the volume automatically. Volume is declared in `docker-compose.yml`.

**Alternatives considered**:
- Download at startup: fragile; depends on network availability; slow cold starts
- Bake into Docker image: inflates image size by ~90 MB; model updates require full image rebuild

---

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|-----------|
| Chunk token size | 200–256 tokens (~1,000 chars) with 32–48 token overlap |
| Chunking library | spaCy sentence segmentation + AutoTokenizer verification |
| pgvector index | IVFFlat (lists=100), cosine metric, created at migration time |
| Embedding model loading | AppConfig.ready() singleton, local volume mount |
| Container memory budget | 1.5–2 GB limit; ~300–400 MB per worker |
