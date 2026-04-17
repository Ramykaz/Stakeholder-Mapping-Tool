"""Relation extraction logic for entity pairs."""

import json
import logging
import re
from typing import List
from ner.models import Entity

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
    s = re.sub(r',\s*([}\]])', r'\1', s)
    return s


def _parse_relations_response(response_text: str) -> dict:
    """Parse LLM response into {relations: [...]}. Returns dict or raises JSONDecodeError."""
    raw = response_text.strip()
    # Try direct parse first
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Extract first JSON object
    obj_str = _extract_first_json_object(raw)
    if not obj_str:
        raise json.JSONDecodeError("No JSON object found", raw, 0)
    # Repair trailing commas then parse
    repaired = _repair_common_json_issues(obj_str)
    return json.loads(repaired)


def load_relation_prompt() -> str:
    """Load relation extraction prompt from file."""
    try:
        with open('prompts/relation-extraction-v1.md', 'r') as f:
            content = f.read().strip()
            if not content:
                return _default_relation_prompt()
            return content
    except FileNotFoundError:
        logger.warning("Relation prompt file not found. Using default prompt.")
        return _default_relation_prompt()


def _default_relation_prompt() -> str:
    """Default relation extraction system prompt."""
    return """You are an expert knowledge graph builder. Extract directional relationships between entities.

Rules:
1. ONLY use entities from the provided list
2. Relations must be DIRECTIONAL: (A, relation, B) means A relates TO B
3. Labels must be UPPERCASE, 1-3 words (e.g., "REPORTS_TO", "EMPLOYS")
4. Assign confidence 0.0-1.0 based on textual evidence
5. No self-loops (source != target)

Return JSON only:
{"relations": [{"source_entity": "...", "target_entity": "...", "label": "...", "confidence": 0.0}]}
"""


def extract_relations_from_chunk(
    chunk_text: str,
    entities_in_chunk: List[Entity],
    provider_client,
    model: str,
) -> dict:
    """Extract relations from a text chunk given entities already extracted.
    
    Args:
        chunk_text: Text chunk to analyze
        entities_in_chunk: List of Entity objects already extracted from this chunk
        provider_client: Groq or OpenAI client instance
        model: Model name to use
        
    Returns:
        Dictionary with structure: {
            relations: [{source_entity, target_entity, label, confidence}],
            tokens_input: int,
            tokens_output: int,
            tokens_cached: int,
            cost_usd: float
        }
    
    Raises:
        ValueError: If API response is invalid
        RuntimeError: If API call fails
    """
    if not chunk_text or not chunk_text.strip():
        return {"relations": [], "tokens_input": 0, "tokens_output": 0, "tokens_cached": 0, "cost_usd": 0.0}
    
    if len(entities_in_chunk) < 2:
        # Need at least 2 entities to form a relation
        logger.debug("Skipping relation extraction: fewer than 2 entities in chunk")
        return {"relations": [], "tokens_input": 0, "tokens_output": 0, "tokens_cached": 0, "cost_usd": 0.0}
    
    # Build entity list for prompt
    entity_names = [entity.canonical_name for entity in entities_in_chunk]
    entity_list_str = "\n".join([f"- {name}" for name in entity_names])
    
    try:
        prompt = load_relation_prompt()
        
        # Format prompt with chunk text and entity list
        user_message = f"""**TEXT CHUNK**:
{chunk_text}

**ENTITIES IDENTIFIED IN THIS CHUNK**:
{entity_list_str}

Return your response as JSON only, with no additional text."""
        
        # Call provider (Groq or OpenAI)
        try:
            response = provider_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_message},
                ],
                max_completion_tokens=4096,
            )
        except TypeError as token_err:
            if "max_completion_tokens" not in str(token_err):
                raise
            response = provider_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=4096,
            )
        
        response_text = response.choices[0].message.content.strip()
        
        try:
            result = _parse_relations_response(response_text)
        except json.JSONDecodeError as e:
            logger.warning("LLM returned invalid JSON for relation extraction: %s. Response snippet: %.200s", e, response_text)
            return {"relations": [], "tokens_input": 0, "tokens_output": 0, "tokens_cached": 0, "cost_usd": 0.0}
        
        # Validate response structure
        if not isinstance(result, dict) or "relations" not in result:
            logger.warning("Invalid relation response structure: %s", result)
            return {"relations": [], "tokens_input": 0, "tokens_output": 0, "tokens_cached": 0, "cost_usd": 0.0}
        
        # Validate and filter relations
        raw_relations = result.get("relations", [])
        valid_relations = validate_relations(raw_relations, entities_in_chunk)
        
        usage = getattr(response, "usage", None)
        tokens_input = getattr(usage, "prompt_tokens", 0) or 0
        tokens_output = getattr(usage, "completion_tokens", 0) or 0
        # Access cached_tokens from prompt_tokens_details object
        prompt_details = getattr(usage, "prompt_tokens_details", None)
        tokens_cached = getattr(prompt_details, "cached_tokens", 0) if prompt_details else 0
        
        return {
            "relations": valid_relations,
            "tokens_input": tokens_input,
            "tokens_output": tokens_output,
            "tokens_cached": tokens_cached,
            "cost_usd": 0.0,  # Calculated separately by costing module
        }
        
    except Exception as e:
        if "429" in str(e) or "rate_limit" in str(e).lower():
            raise ValueError("API rate limit exceeded") from e
        logger.error(f"Relation extraction API error: {e}")
        raise RuntimeError(f"Relation extraction failed: {e}") from e


def validate_relations(
    raw_relations: List[dict],
    entities_in_chunk: List[Entity],
) -> List[dict]:
    """Validate relation triplets and filter out invalid ones.
    
    Validation rules:
    1. source_entity and target_entity must match entity names from entities_in_chunk
    2. source_entity != target_entity (no self-loops)
    3. confidence must be in [0.0, 1.0]
    4. label must be non-empty and <= 100 chars
    5. confidence >= 0.5 (filter low-confidence relations)
    
    Args:
        raw_relations: List of raw relation dicts from LLM
        entities_in_chunk: List of Entity objects for validation
        
    Returns:
        List of validated relation dicts with entity IDs attached
    """
    entity_name_to_obj = {entity.canonical_name: entity for entity in entities_in_chunk}
    valid_relations = []
    
    for rel in raw_relations:
        source_name = rel.get("source_entity", "").strip().replace("\x00", "")
        target_name = rel.get("target_entity", "").strip().replace("\x00", "")
        label = rel.get("label", "").strip().replace("\x00", "")
        confidence = rel.get("confidence", 0.0)
        
        # Validation gate 1: Entity names must exist
        if source_name not in entity_name_to_obj or target_name not in entity_name_to_obj:
            logger.debug(
                "Discarding relation with dangling entity reference: %s → %s",
                source_name, target_name,
            )
            continue
        
        source_entity = entity_name_to_obj[source_name]
        target_entity = entity_name_to_obj[target_name]
        
        # Validation gate 2: No self-loops
        if source_entity.id == target_entity.id:
            logger.debug("Discarding self-loop relation: %s → %s", source_name, source_name)
            continue
        
        # Validation gate 3: Confidence in range
        try:
            confidence = float(confidence)
            if confidence < 0.0 or confidence > 1.0:
                logger.warning("Invalid confidence %s for relation, clamping", confidence)
                confidence = max(0.0, min(1.0, confidence))
        except (ValueError, TypeError):
            logger.warning("Invalid confidence value: %s, using 0.5", confidence)
            confidence = 0.5
        
        # Validation gate 4: Label non-empty and reasonable length
        if not label or len(label) > 100:
            logger.debug("Discarding relation with invalid label: '%s'", label)
            continue
        
        # Validation gate 5: Confidence threshold
        if confidence < 0.5:
            logger.debug("Discarding low-confidence relation (%.2f): %s → %s", confidence, source_name, target_name)
            continue
        
        # Attach entity IDs and validated data
        valid_relations.append({
            "source_entity_id": source_entity.id,
            "target_entity_id": target_entity.id,
            "label": label.upper(),  # Normalize to uppercase
            "confidence": confidence,
        })
    
    return valid_relations
