# Contract: Provider Interface (Joint Extraction)

## Purpose
Defines the single abstraction contract implemented by all LLM providers (Groq, OpenAI, Azure OpenAI, Gemini).

## Method
`extract_joint(payload) -> JointExtractionResponse`

## Request Payload
```json
{
  "chunk_text": "string",
  "concept_note": "string|null",
  "entity_labels": ["Person", "Organization", "Location"],
  "relationship_types": [
    {"name": "funded", "directional": true},
    {"name": "partnered", "directional": false}
  ],
  "provider": "groq|openai|azure_openai|gemini",
  "model": "string"
}
```

### Request Rules
- `chunk_text` required, non-empty.
- `entity_labels` required, non-empty, active labels only.
- `relationship_types` required, non-empty, active types only.
- `concept_note` nullable.

## Response Payload
```json
{
  "entities": [
    {"text": "UNDP", "label": "Organization", "confidence": 0.96}
  ],
  "relationships": [
    {
      "source_text": "UNDP",
      "type": "funded",
      "target_text": "AI for Good Hackathon",
      "confidence": 0.91
    }
  ],
  "usage": {
    "input_tokens": 1200,
    "cached_input_tokens": 0,
    "output_tokens": 340,
    "cost_usd": 0.0021
  }
}
```

### Response Rules
- `entities` and `relationships` returned from same provider call.
- labels/types must map to active taxonomy values.
- unresolved relationships are dropped before persistence.

## Error Contract
```json
{
  "error": {
    "code": "PROVIDER_CONFIG_ERROR|RATE_LIMIT|PROVIDER_RESPONSE_INVALID|UPSTREAM_ERROR",
    "message": "string",
    "remediation": [
      "Provide valid credentials for selected provider",
      "Or choose another configured provider"
    ]
  }
}
```

### Error Rules
- Missing/invalid credentials must produce `PROVIDER_CONFIG_ERROR`.
- No automatic provider fallback.
- Retries/backoff apply to transient failures only.
