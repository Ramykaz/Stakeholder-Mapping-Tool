# NLP Approach: Literature Review & Technical Decision
## Entity Extraction, Relation Extraction, and Deduplication

---

## 1. The Core Question: Pipeline vs Joint Extraction

The fundamental question is whether to extract entities first and then extract relationships from those entities (pipeline), or to extract both entities and relationships in a single model pass (joint).

### Pipeline Approach

In a pipeline approach, entity recognition (NER) and relation extraction (RE) are treated as two independent sequential tasks. The NER model identifies entities first. Those entities are then passed as input to a separate relation extraction model which classifies what relationships exist between them.

**Advantages:**
- Simpler to implement and debug — each step is isolated
- Errors in one step are easy to trace
- Each model can be optimized independently
- Works well when entity types are well-defined and stable

**Disadvantages:**
- Error propagation — mistakes in entity extraction amplify in relation extraction
- The two tasks are treated as independent when they are fundamentally interdependent: you cannot correctly extract a relationship without understanding the entities, and you cannot correctly identify entities without understanding their relational context
- Generates large numbers of irrelevant entity pairs in the pairing phase
- Double LLM cost if both steps use an LLM
- Produces orphaned nodes — entities identified in step 1 that have no relation found in step 2

The orphaned node problem is directly observable in the current implementation and was raised in the team meeting. This is a known consequence of the pipeline approach.

### Joint Extraction Approach

Joint extraction treats entity recognition and relation extraction as a unified task. Both entities and the relationships between them are extracted in a single model pass, producing structured triples of the form (subject, relation, object).

**Advantages:**
- Eliminates error propagation — entities and relations inform each other
- No orphaned nodes — only entities with relationships are returned
- Single LLM call — half the API cost and latency
- Contextual consistency — the same chunk of text is reasoned over once
- Better handling of entity overlap and nested entities
- State-of-the-art performance across benchmarks (ACE04, ACE05, NYT, SciERC)

**Disadvantages:**
- Slightly more complex prompt engineering
- Output parsing is more structured (JSON triplets vs simple entity list)
- Harder to debug when output is malformed

### Research Consensus

The research literature from 2020 onwards consistently shows joint extraction outperforming pipeline approaches. Studies published at ACL, NAACL, and EACL conferences from 2020 to 2023 confirm that joint methods reduce cascading errors and improve information utilization (Springer AI Review, 2024). Amazon's REXEL system demonstrated joint extraction being 11x faster than competitive pipeline approaches at document level (Amazon Science, 2024). The ACM Computing Surveys comprehensive review (2024) confirms that joint approaches are now the dominant paradigm in relation extraction research.

**Verdict: Joint extraction is the correct approach for this project.**

---

## 2. SpaCy vs LLM for NER

### SpaCy (Traditional NLP)

SpaCy uses a transformer-based pipeline trained on labeled corpora (OntoNotes 5, CoNLL-03). It performs NER by classifying tokens into predefined categories using a BILOU tagging scheme.

**Advantages:**
- Fast — runs locally, no API calls, no latency
- Free — no token cost
- Deterministic — same input always produces same output
- Well-tested on standard entity types (PERSON, ORG, GPE, LOC, DATE)
- High F1 on standard benchmarks (85-92% depending on model size)
- Works offline — no network dependency

**Disadvantages:**
- Fixed entity types — cannot extract domain-specific types like "SDG Program", "Hackathon Organizer", "Impact Investor" without fine-tuning
- Requires labeled training data to add new entity types
- Weak on domain-specific language — UNDP policy documents use specialized terminology SpaCy was not trained on
- Cannot use context from a concept note to guide extraction
- Cannot extract relationships — NER only, relation extraction requires a separate model
- Cannot understand that "the Programme" refers to UNDP without coreference resolution (separate component)

**SpaCy F1 on standard benchmarks:**
- en_core_web_lg: ~85% F1 on CoNLL-03
- en_core_web_trf (RoBERTa): ~91.6% F1 on CoNLL-03
- Performance drops significantly on domain-specific text

### LLM-based NER and Relation Extraction

Modern LLMs (GPT-4, Llama 3, Gemini) perform NER and RE through zero-shot or few-shot prompting without any fine-tuning.

**Advantages:**
- Zero-shot capability — no training data needed for new entity types
- Domain-adaptive — understands UNDP-specific terminology, SDG language, development sector jargon
- Concept-note guided — can be instructed to extract only entities relevant to the project context
- Joint extraction — entities and relationships in a single prompt response
- Handles implicit references — "the Programme", "the Lab", "the initiative" resolved in context
- Custom entity types — "SDG Program", "Hackathon Participant", "Impact Investor" work without fine-tuning
- Structured output — returns JSON triplets directly

**Disadvantages:**
- API cost — tokens consumed per call
- Latency — network call, typically 1-5 seconds per chunk
- Rate limits — Groq free tier: ~30 requests/minute
- Non-deterministic — same input may produce slightly different output
- Hallucination risk — LLM may fabricate entities not in the text
- Requires prompt engineering and validation

**LLM NER performance on domain-specific text:**
Research from the NER4all study (arXiv, 2025) showed that with proper contextual prompting and domain-informed prompt engineering, LLMs significantly outperform SpaCy and Flair on specialized domain text in both precision and recall using zero-shot prompts. The key finding: contextual information in the prompt is the critical factor — generic prompts perform poorly, domain-informed prompts perform well.

### SpaCy + LLM Hybrid (spacy-llm)

SpaCy now supports an official LLM integration (`spacy-llm`) that combines SpaCy's pipeline infrastructure with LLM-based components. This allows using an LLM as the NER backend within a SpaCy pipeline, giving access to SpaCy's tokenization, span detection, and document structure while delegating the classification to an LLM.

**Advantages:**
- Best of both worlds — SpaCy's structure + LLM's flexibility
- Supports OpenAI, Azure OpenAI, Groq (via custom model), Gemini
- Serializable pipelines — reusable across documents
- Few-shot examples supported natively
- Easy to replace LLM backend as better models become available

**Disadvantage:**
- Still requires an LLM API call — same cost/latency as pure LLM approach
- Adds SpaCy as an additional dependency
- Marginal benefit over direct LLM prompting for this use case

---

## 3. Recommended Approach for This Project

### Decision: LLM-based Joint Extraction with SpaCy as Structural Pre-processor

**Primary extraction: LLM joint extraction (single pass)**

One LLM call per chunk that returns a structured JSON response containing both entities and relationships as triples:

```json
{
  "entities": [
    {"text": "UNDP", "type": "Organization", "canonical": "United Nations Development Programme"},
    {"text": "AI for Good Hackathon", "type": "Event"},
    {"text": "Uzbekistan", "type": "Location"}
  ],
  "relationships": [
    {"subject": "UNDP", "relation": "organized", "object": "AI for Good Hackathon", "confidence": 0.92},
    {"subject": "AI for Good Hackathon", "relation": "located_in", "object": "Uzbekistan", "confidence": 0.95}
  ]
}
```

The concept note is passed as context in the system prompt, guiding the LLM to extract only relevant entities. Predefined entity labels are passed as a structured list so the LLM only assigns from the approved set.

**SpaCy role: Structural pre-processing only (no NER)**

SpaCy is used before the LLM call for:
- Sentence boundary detection (improving chunking quality)
- Token-level span detection (improving chunk overlap handling)
- Coreference resolution pre-processing (future sprint)

SpaCy does NOT perform NER — it feeds cleaner text to the LLM.

**Reasoning:**

| Factor | Pipeline (2 LLM calls) | Joint (1 LLM call) | SpaCy NER only |
|--------|----------------------|-------------------|----------------|
| Orphaned nodes | Common | Eliminated | No relations possible |
| API cost | 2x | 1x | Free but incomplete |
| Accuracy | Error propagation | Higher | Low on domain text |
| Domain adaptability | Limited | High | Very low |
| Concept note guidance | Partial | Full | None |
| Custom entity types | Requires fine-tuning | Zero-shot | Requires fine-tuning |
| Deduplication quality | Lower (two passes) | Higher (single context) | N/A |

---

## 4. Entity Deduplication Approach

Entity deduplication must handle the following at save time:

### Level 1 — Exact Match
Check `(canonical_name.lower().strip(), entity_type)` uniqueness in the database. Django `get_or_create` handles this.

### Level 2 — Acronym Resolution
Maintain a lookup table of known acronyms and their expansions:
```python
ACRONYM_MAP = {
    "UNDP": "United Nations Development Programme",
    "WHO": "World Health Organization",
    "SDG": "Sustainable Development Goals",
    # populated dynamically as project grows
}
```
Before saving, expand any acronym found in the extraction output. Store the acronym as an alias.

### Level 3 — Fuzzy Matching
For entities that are not exact matches and not in the acronym map, run fuzzy string similarity:
- Use `rapidfuzz` library (token_sort_ratio + partial_ratio)
- Similarity threshold: 0.85 for merge, 0.70-0.85 for flag-and-review
- Only compare within the same entity type — "Amazon" (Org) never merges with "Amazon" (Location)
- Store both variants as aliases pointing to the canonical record

### Level 4 — Embedding-based Similarity (Future Sprint)
For cases where names are semantically similar but textually different, use cosine similarity between entity name embeddings (all-MiniLM-L6-v2, already in the stack):
- "youth innovation program" ≈ "young innovators programme" → flag for review
- Threshold: cosine similarity > 0.92 → suggest merge

### EntityAlias Table
```
EntityAlias:
  - id
  - entity (FK to canonical Entity)
  - alias_text
  - source (extraction | manual | acronym_map)
  - created_at
```

All alias lookups resolve to the canonical entity. The map is cumulative — as the system processes more documents it learns more aliases automatically.

### Project Phase Disambiguation
Entities with phase indicators ("Phase 1", "Phase 2", "2023", "2024") are kept as separate entities but linked via a `parent_entity` FK:
```
Entity "AI for Good Phase 1" → parent_entity: "AI for Good"
Entity "AI for Good Phase 2" → parent_entity: "AI for Good"
```
This allows both granular and aggregate views on the map.

---

## 5. LLM Provider Architecture

All LLM calls go through a provider abstraction layer. Adding a new provider requires implementing one interface:

```python
class LLMProvider(ABC):
    def extract_entities_and_relations(
        self, 
        chunk: str, 
        concept_note: str,
        entity_labels: list[str],
        relation_types: list[str]
    ) -> ExtractionResult:
        pass
```

Supported providers:

| Provider | Model | Use Case |
|----------|-------|----------|
| Groq | llama-3.3-70b-versatile | Development / free tier |
| OpenAI | gpt-4o, gpt-4.1-mini | Production |
| Azure OpenAI | gpt-5-mini (UNDP endpoint) | UNDP internal production |
| Google Gemini | gemini-1.5-pro / flash | Alternative / backup |

Provider is selected via `LLM_PROVIDER` environment variable. All retry logic, cost tracking, and error handling are implemented once in the abstraction layer and apply to all providers.

Structured output (JSON mode) is used where supported:
- OpenAI: `response_format={"type": "json_object"}`
- Azure OpenAI: same as OpenAI
- Groq: prompt-enforced JSON (structured output not yet available on free tier)
- Gemini: `response_mime_type="application/json"`

---

## 6. Summary of Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Extraction approach | Joint (single LLM pass) | Eliminates orphaned nodes, halves API cost, higher accuracy |
| NER model | LLM (not SpaCy) | Domain adaptability, zero-shot custom types, concept note guidance |
| SpaCy role | Pre-processing only | Sentence boundaries, chunking quality |
| Deduplication | 3-level: exact + acronym + fuzzy | Handles all known duplicate patterns |
| LLM provider | Pluggable abstraction | Supports Groq, OpenAI, Azure, Gemini via env var |
| Structured output | JSON triplets per chunk | Parseable, consistent, provider-agnostic |
| Retry strategy | Exponential backoff, max 3 retries | Handles Groq rate limits and transient failures |
