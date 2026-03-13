"""Groq API client for entity extraction."""

import json
import logging
from groq import Groq

logger = logging.getLogger(__name__)


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


def extract_entities_from_chunk(chunk_text: str, groq_api_key: str) -> dict:
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
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Extract entities from:\n\n{chunk_text}"},
            ],
            temperature=0.0,  # Deterministic output
            max_tokens=1024,
        )

        # Parse JSON response
        response_text = response.choices[0].message.content.strip()
        
        # Try to extract JSON from response
        try:
            result = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to find JSON within the response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                logger.warning(f"Invalid JSON from Groq: {response_text}")
                return {"entities": []}

        # Validate response structure
        if not isinstance(result, dict) or "entities" not in result:
            logger.warning(f"Invalid response structure: {result}")
            return {"entities": []}

        return result

    except Exception as e:
        # Check for rate limit error
        if "429" in str(e) or "rate_limit" in str(e).lower():
            raise ValueError("API rate limit exceeded") from e
        logger.error(f"Groq API error: {e}")
        raise RuntimeError(f"Failed to extract entities: {e}") from e
