"""Groq API client for entity extraction."""

import json
import logging
import re
from groq import Groq

logger = logging.getLogger(__name__)


def _extract_first_json_object(text: str) -> str | None:
    """Extract the first complete {...} JSON object from text (handles nested braces)."""
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _repair_common_json_issues(s: str) -> str:
    """Fix common LLM JSON mistakes (trailing commas before ] or })."""
    # Trailing comma before ] or }
    s = re.sub(r',\s*([}\]])', r'\1', s)
    return s


def _parse_entities_response(response_text: str) -> dict:
    """Parse Groq response into {entities: [...]}. Returns dict or raises JSONDecodeError."""
    raw = response_text.strip()
    # Try direct parse first
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Extract first JSON object (avoids "Extra data" when model returns JSON + explanation)
    obj_str = _extract_first_json_object(raw)
    if not obj_str:
        raise json.JSONDecodeError("No JSON object found", raw, 0)
    # Repair trailing commas etc. then parse
    repaired = _repair_common_json_issues(obj_str)
    return json.loads(repaired)


def load_ner_prompt() -> str:
    """Load NER extraction prompt from file."""
    try:
        with open('prompts/ner-extraction-v1.md', 'r') as f:
            content = f.read().strip()
            if not content:
                # Return default prompt if file is empty
                return _default_ner_prompt()
            return content
    except FileNotFoundError:
        logger.warning("NER prompt file not found. Using default prompt.")
        return _default_ner_prompt()


def _default_ner_prompt() -> str:
    """Default NER extraction system prompt."""
    return """You are a named entity recognition (NER) system. Extract the following entity types from the provided text:

- PERSON: Names of individuals
- ORGANIZATION: Company names, institutions, agencies
- LOCATION: Geographic locations, places, regions
- ROLE: Job titles, positions, professional roles

For each entity found, provide:
1. entity_type: One of [PERSON, ORGANIZATION, LOCATION, ROLE]
2. text: The exact text from the input
3. confidence: A float between 0.0-1.0 indicating extraction confidence

Confidence guidelines:
- 0.9+: High confidence (clear, unambiguous)
- 0.7-0.9: Clear (good contextual evidence)
- 0.5-0.7: Borderline (some ambiguity)
- <0.5: Weak (highly uncertain)

Return ONLY a valid JSON object with this structure:
{"entities": [{"entity_type": "...", "text": "...", "confidence": 0.0}]}
"""


def extract_entities_from_chunk(
    chunk_text: str,
    groq_api_key: str,
    model: str = "llama-3.1-8b-instant",
) -> dict:
    """Extract entities from a text chunk using Groq Llama 3.

    Args:
        chunk_text: Text to extract entities from (256-512 tokens).
        groq_api_key: Groq API key for authentication.

    Returns:
        Dictionary with structure: {entities: [{entity_type, text, confidence}]}

    Raises:
        ValueError: If API response is invalid or rate limited.
        RuntimeError: If API call fails.
    """
    if not chunk_text or not chunk_text.strip():
        return {"entities": []}

    try:
        client = Groq(api_key=groq_api_key)
        prompt = load_ner_prompt()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Extract entities from:\n\n{chunk_text}"},
            ],
            temperature=0.0,  # Deterministic output
            max_tokens=1024,
        )

        # Parse JSON response (LLM often returns extra text or malformed JSON)
        response_text = response.choices[0].message.content.strip()
        try:
            result = _parse_entities_response(response_text)
        except json.JSONDecodeError as e:
            logger.warning("Groq returned invalid JSON for chunk: %s. Response snippet: %.200s", e, response_text)
            return {"entities": []}

        # Validate response structure
        if not isinstance(result, dict) or "entities" not in result:
            logger.warning("Invalid response structure from Groq: %s", result)
            return {"entities": []}

        return {
            "entities": result.get("entities", []),
            "tokens_input": getattr(getattr(response, "usage", None), "prompt_tokens", 0) or 0,
            "tokens_output": getattr(getattr(response, "usage", None), "completion_tokens", 0) or 0,
            "tokens_cached": 0,
            "cost_usd": 0.0,
        }

    except Exception as e:
        # Check for rate limit error
        if "429" in str(e) or "rate_limit" in str(e).lower():
            raise ValueError("API rate limit exceeded") from e
        logger.error(f"Groq API error: {e}")
        raise RuntimeError(f"Failed to extract entities: {e}") from e
