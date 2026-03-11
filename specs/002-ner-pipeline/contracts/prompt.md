# NER Extraction Prompt Contract

**Feature**: 002-ner-pipeline  
**Phase**: 1 — Design  
**Date**: 2026-03-12  
**Version**: v1

---

## Overview

Per the project constitution, all LLM prompts must be versioned and stored in the codebase. This document defines the contract for the NER extraction prompt that is sent to the Groq Llama 3 API.

**Prompt Location**: `prompts/ner-extraction-v1.md` (in source code)

---

## Prompt Specification

### Purpose

Extract named entities of four types (PERSON, ORGANIZATION, LOCATION, ROLE) from a text chunk, return structured JSON with entity details, and include confidence scores.

### Input

**Source**: A single text chunk (typically 256–512 tokens) from an ingested document.

**Example chunk text**:
```
John Smith, Director of Operations at UNDP, met with officials from the 
World Bank in Geneva last week. The meeting focused on development goals 
for Sub-Saharan Africa.
```

### Output Format

The Groq API response must be a structured JSON object with entity arrays:

```json
{
  "entities": [
    {
      "entity_type": "PERSON",
      "text": "John Smith",
      "confidence": 0.94
    },
    {
      "entity_type": "ORGANIZATION",
      "text": "UNDP",
      "confidence": 0.96
    },
    {
      "entity_type": "LOCATION",
      "text": "Geneva",
      "confidence": 0.91
    },
    {
      "entity_type": "ORGANIZATION",
      "text": "World Bank",
      "confidence": 0.95
    },
    {
      "entity_type": "LOCATION",
      "text": "Sub-Saharan Africa",
      "confidence": 0.88
    }
  ]
}
```

### Entity Type Definitions

| Type | Definition | Examples |
|------|-----------|----------|
| **PERSON** | Individual people, including titles and roles (when directly attached to the name) | John Smith, Dr. Jane Doe, CEO Sarah Johnson |
| **ORGANIZATION** | Companies, NGOs, government agencies, associations | UNDP, World Bank, WHO, Microsoft, Red Cross |
| **LOCATION** | Geographic places, regions, cities, countries, natural features | Geneva, Sub-Saharan Africa, Tokyo, the Nile River |
| **ROLE** | Job titles, positions, organizational roles *when mentioned as standalone roles* | Director of Operations, Ambassador, Senior Advisor |

**Note on ROLE vs. PERSON**: Extract ROLE type only for standalone role mentions not directly attached to a person's name. For example:
- "John Smith, **Director of Operations**" → Extract as PERSON; Director role is part of the context (optional: extract as ROLE if model identifies it separately)
- "The **Director of Operations** announced..." → Extract as ROLE

### Confidence Scoring

**Range**: 0.0 to 1.0 (float)

**Guidelines**:
- **0.9+**: Strong, unambiguous mentions with clear context
- **0.7–0.9**: Clear mentions; minor ambiguity possible
- **0.5–0.7**: Borderline cases; could be interpreted multiple ways
- **<0.5**: Weak or highly uncertain; often omitted unless explicitly included

The backend deduplication service uses confidence scores to rank canonical names when merging duplicates.

---

## Backend Processing Pipeline

### Expected Groq Integration

```python
# Pseudocode for backend services/groq_client.py

def extract_entities_for_chunk(chunk_text: str) -> list[dict]:
    """
    Call Groq API with NER prompt; parse and validate response.
    
    Args:
        chunk_text: The extracted text from a document chunk
        
    Returns:
        List of entity dicts with keys: entity_type, text, confidence
        
    Raises:
        GroqAPIError: If Groq API fails or rate limits
        JSONParseError: If response is malformed JSON
    """
    prompt = load_prompt('prompts/ner-extraction-v1.md')
    
    response = groq_client.chat.completions.create(
        model='llama-3-8b-instant',
        messages=[
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': chunk_text},
        ],
        temperature=0.0,  # Deterministic extraction
        max_tokens=1024,
    )
    
    response_text = response.choices[0].message.content
    entity_json = json.loads(response_text)
    
    # Validate and return
    return validate_entities(entity_json['entities'])
```

### Deduplication Service Integration

The deduplicator service:
1. Receives all extracted entities for a document
2. Groups entities by type
3. Merges textually similar entities (e.g., "UNDP" and "United Nations Development Programme")
4. Selects canonical name (highest confidence mention, or LLM-based resolution)
5. Stores all raw mentions in JSON array
6. Takes max/mean of confidence scores (TBD in implementation)

---

## Constraints & Validation Rules

### Input Constraints

- **Max tokens per chunk**: 512 (enforced by ingestion pipeline from US-01)
- **Min tokens per chunk**: 10 (empty/near-empty chunks return empty entities list)
- **Language**: English only (MVP)

### Output Constraints

- **Entities per chunk**: 0 to 50 (reasonable upper bound for typical chunks)
- **Confidence range**: Must be 0.0 to 1.0 inclusive
- **Entity text**: Must be non-empty, match text in input chunk (case-insensitive ok)
- **Entity type**: Must be one of: PERSON, ORGANIZATION, LOCATION, ROLE

### Validation on Receipt

Backend validates each entity response:
```python
def validate_entity(entity: dict) -> bool:
    """
    Validate extracted entity conforms to schema.
    Returns True if valid, raises ValueError otherwise.
    """
    assert entity['entity_type'] in ['PERSON', 'ORGANIZATION', 'LOCATION', 'ROLE']
    assert 0.0 <= entity['confidence'] <= 1.0
    assert len(entity['text'].strip()) > 0
    assert entity['text'].lower() in chunk_text.lower()
    return True
```

---

## Version History

### v1 (2026-03-12)

Initial version.

- 4 entity types: PERSON, ORGANIZATION, LOCATION, ROLE
- Confidence scores (0.0–1.0) from Groq
- JSON output format
- Groq Llama 3 API integration
- Future versions can add:
  - Entity relationships/edges
  - Cross-document entity linking
  - Saliency/importance scoring
  - Relationship extraction (e.g., "works_at", "located_in")

---

## Notes for Implementation

1. **Prompt Clarity**: The actual prompt (`prompts/ner-extraction-v1.md`) should be clear, concise, and include examples. Use few-shot prompting if needed.

2. **Temperature**: Set to 0.0 for deterministic extraction (LLMs are not fully deterministic, but low temperature improves consistency).

3. **Model Choice**: Groq Llama 3 8B instant is suitable for MVP. Larger models (70B) may improve accuracy but increase latency.

4. **Error Handling**: If Groq returns invalid JSON or malformed entities, log the error, return empty entity list, and continue (don't fail the extraction).

5. **Rate Limiting**: Per convention, fail fast (HTTP 429) and let caller handle retry. No backend queueing.

6. **Testing**: Mock Groq responses in all unit tests. Use representative test data (person + org + location per chunk).

