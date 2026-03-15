# Prompt Contract: Relation Extraction

**Feature**: Entity + Relation Extraction with Graph Integration  
**Version**: 1.0  
**Date**: 2026-03-15  
**Stored**: `/prompts/relation-extraction-v1.md`

---

## Prompt Structure

The relation extraction prompt is sent to the LLM **after entity extraction completes** for each chunk. The prompt receives:
1. The chunk text
2. A list of canonical entity names extracted from that chunk (by the prior entity extraction pass)

The LLM must return relation triplets in JSON format.

---

## Prompt Template

```text
You are an expert knowledge graph builder specializing in extracting meaningful relationships between entities.

You will be provided with a TEXT CHUNK and a LIST OF ENTITIES already identified in that chunk. Your task is to extract directional, labeled relationships between pairs of entities.

# Input

TEXT CHUNK:
{chunk_text}

ENTITIES IDENTIFIED IN THIS CHUNK:
{entity_list}

# Task

Extract relationship triplets in the form:
(source_entity, relation_label, target_entity)

# Rules

1. ONLY use entities from the provided ENTITIES list — do not introduce new entity names.
2. Each relation must be DIRECTIONAL: (A, relation, B) means A has the relation TO B.
3. Relation labels must be:
   - UPPERCASE (e.g., "REPORTS_TO", not "reports to")
   - Short and specific (1-3 words, e.g., "EMPLOYS", "LOCATED_IN", "CHAIRS")
   - Meaningful (avoid vague labels like "RELATED_TO" or "CONNECTED_TO")
4. Do NOT create self-referential relations (source and target must be different entities).
5. Assign a confidence score (0.0 to 1.0) based on textual evidence strength.
6. If no valid relations exist in the chunk, return an empty list.

# Examples

Good examples:
- ("Sarah Chen", "REPORTS_TO", "Apex Corp") — confidence: 0.85
- ("Apex Corp", "PARTNERS_WITH", "Ministry of Agriculture") — confidence: 0.90
- ("Dr. Raj Patel", "CHAIRS", "Technical Advisory Board") — confidence: 0.92

Bad examples:
- ("Sarah Chen", "knows", "Apex Corp") — label not uppercase
- ("Apex Corp", "related", "Ministry") — "Ministry" not in entity list; label too vague
- ("Sarah Chen", "WORKS_FOR", "Sarah Chen") — self-loop

# Output Format

Return JSON only. No additional text.

{
  "relations": [
    {
      "source_entity": "<canonical name from entity list>",
      "target_entity": "<canonical name from entity list>",
      "label": "<UPPERCASE_RELATION_LABEL>",
      "confidence": <float 0.0-1.0>
    }
  ]
}

# Now extract relations from the provided text.
```

---

## Input Formatting

### {chunk_text}
The raw text of the chunk (same text that was used for entity extraction).

### {entity_list}
A comma-separated list of canonical entity names extracted from the chunk.

**Example**:
```
Sarah Chen, Apex Corp, Ministry of Agriculture, Technical Advisory Board
```

**If no entities were found in the chunk**, the list is empty and the LLM should return `{"relations": []}`.

---

## Output Validation

After receiving the LLM response, the backend validates each relation:

| Validation Rule | Action on Violation |
|-----------------|---------------------|
| `source_entity` in entity list | Discard relation; log warning |
| `target_entity` in entity list | Discard relation; log warning |
| `source_entity ≠ target_entity` | Discard relation; log warning |
| `label` is non-empty and ≤100 chars | Discard relation; log error |
| `confidence` is in [0.0, 1.0] | Clamp to [0.0, 1.0]; log warning |

Valid relations are deduplicated and persisted.

---

## Promptversioning

- **Version 1** (this document): Initial release — guided free-form labels, examples-based instruction, confidence scoring
- **Future versions**: May add controlled vocabulary, few-shot examples from domain data, or chain-of-thought reasoning prompts

All prompt changes are tracked in the `prompts/` directory with version suffixes (e.g., `relation-extraction-v2.md`). The active version is referenced in the codebase via a constant:

```python
RELATION_EXTRACTION_PROMPT_VERSION = "v1"
RELATION_EXTRACTION_PROMPT_PATH = f"prompts/relation-extraction-{RELATION_EXTRACTION_PROMPT_VERSION}.md"
```

---

## Confidence Scoring Guidance

The LLM assigns confidence based on:
- **Explicit statements** (0.9-1.0): "Sarah Chen reports to the CEO of Apex Corp"
- **Clear implicit relations** (0.7-0.9): "As Apex Corp's liaison to the Ministry..."
- **Weak/ambiguous phrasing** (0.5-0.7): "Sarah Chen works with Apex Corp on several projects"
- **Speculative** (<0.5): "Sarah Chen may be affiliated with Apex Corp"

Relations with confidence < 0.5 are persisted but can be filtered out in the UI.

---

## Provider-Specific Handling

### Groq (Llama 3.1)
- Uses the same prompt format
- Typically returns well-formatted JSON with good adherence to uppercase label rules
- May occasionally return lowercase labels → normalized during validation

### OpenAI (GPT-4o-mini, GPT-5-mini, GPT-5-nano)
- Uses the same prompt format
- `response_format={"type": "json_object"}` enforces valid JSON structure
- GPT-5 models (reasoning models) may use `reasoning_effort="low"` to reduce internal thinking tokens

No provider-specific prompt variations at MVP; a single prompt works for all.

---

## Error Handling

| Error Scenario | Backend Behavior |
|----------------|------------------|
| LLM returns invalid JSON | Log error; treat as zero relations for this chunk; continue with next chunk |
| LLM returns relations with entities not in the provided list | Discard invalid relations; keep valid ones; log warning |
| LLM returns empty `"relations": []` | Valid response; no relations extracted for this chunk |
| LLM timeout or API error | Fail the entire extraction run; return HTTP 422 to client |

---

## Contract Guarantees

1. **Single source of truth**: The prompt stored in `/prompts/relation-extraction-v1.md` is the authoritative version; no inline prompts in code.
2. **Version tracking**: Prompt version is recorded in NERRun metadata (future enhancement) so extraction results are traceable to the prompt used.
3. **Deterministic structure**: Prompt structure (rules, output format) remains stable; only examples and refinements change across versions.
4. **No hallucinated entities**: Validated relations only reference entities from the provided list (enforced post-LLM, not reliant on LLM compliance).
