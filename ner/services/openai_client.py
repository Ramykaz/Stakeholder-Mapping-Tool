"""OpenAI API client for entity extraction."""

from __future__ import annotations

import json
import logging
import re

from openai import OpenAI

from ner.services.groq_client import load_ner_prompt

logger = logging.getLogger(__name__)

OPENAI_MAX_COMPLETION_TOKENS = 4096  # Must accommodate reasoning tokens + JSON output; reasoning models use most of this internally


def _extract_first_json_object(text: str) -> str | None:
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
    return re.sub(r',\s*([}\]])', r'\1', s)


def _parse_entities_response(response_text: str) -> dict:
    raw = response_text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    obj_str = _extract_first_json_object(raw)
    if not obj_str:
        raise json.JSONDecodeError("No JSON object found", raw, 0)
    repaired = _repair_common_json_issues(obj_str)
    return json.loads(repaired)


def _extract_cached_tokens(usage) -> int:
    if usage is None:
        return 0
    details = getattr(usage, 'prompt_tokens_details', None)
    if details is None:
        return 0
    cached = getattr(details, 'cached_tokens', None)
    if cached is None and isinstance(details, dict):
        cached = details.get('cached_tokens')
    return int(cached or 0)


def _normalize_message_content(content) -> str:
    """Normalize OpenAI message content into a plain string for JSON parsing."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        for key in ('text', 'output_text', 'content', 'value'):
            value = content.get(key)
            if value:
                return _normalize_message_content(value)
        return str(content)
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            normalized = _normalize_message_content(item)
            if normalized:
                parts.append(normalized)
        return "\n".join(parts)

    for attr in ('text', 'output_text', 'content', 'value'):
        value = getattr(content, attr, None)
        if value:
            return _normalize_message_content(value)
    return str(content)


# Models that use internal reasoning tokens and accept the reasoning_effort parameter.
_REASONING_MODELS = {'gpt-5-mini', 'gpt-5-nano', 'o1', 'o3-mini'}


def _create_openai_completion(client: OpenAI, model: str, prompt: str, chunk_text: str, max_completion_tokens: int):
    """Create one OpenAI chat completion call with consistent request options."""
    kwargs: dict = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': f'Extract entities from:\n\n{chunk_text}'},
        ],
        'response_format': {'type': 'json_object'},
        'max_completion_tokens': max_completion_tokens,
    }
    if model in _REASONING_MODELS:
        kwargs['reasoning_effort'] = 'low'
    return client.chat.completions.create(**kwargs)


def extract_entities_from_chunk(chunk_text: str, openai_api_key: str, model: str) -> dict:
    """Extract entities from text using OpenAI and return Groq-compatible output shape."""
    if not chunk_text or not chunk_text.strip():
        return {"entities": [], "tokens_input": 0, "tokens_output": 0, "tokens_cached": 0}

    from time import perf_counter
    _t_total = perf_counter()

    try:
        # ── 1. Client + prompt load ──────────────────────────────────────────
        _t = perf_counter()
        client = OpenAI(api_key=openai_api_key)
        prompt = load_ner_prompt()
        logger.info("[OPENAI] step=1_client_and_prompt  duration=%.3fs", perf_counter() - _t)

        # ── 2. HTTP request to OpenAI ────────────────────────────────────────
        logger.info(
            "[OPENAI] step=2_sending_request  model=%s  chunk_chars=%d  max_tokens=%d",
            model, len(chunk_text), OPENAI_MAX_COMPLETION_TOKENS,
        )
        _t = perf_counter()
        response = _create_openai_completion(client, model, prompt, chunk_text, OPENAI_MAX_COMPLETION_TOKENS)
        _api_dur = perf_counter() - _t
        usage = getattr(response, 'usage', None)
        tok_in = getattr(usage, 'prompt_tokens', 0) if usage else 0
        tok_out = getattr(usage, 'completion_tokens', 0) if usage else 0
        finish = getattr(response.choices[0], 'finish_reason', 'unknown')
        logger.info(
            "[OPENAI] step=3_response_received  duration=%.2fs  tok_in=%d  tok_out=%d  finish=%s",
            _api_dur, tok_in, tok_out, finish,
        )

        # ── 3. Normalise content ─────────────────────────────────────────────
        _t = perf_counter()
        content = _normalize_message_content(response.choices[0].message.content)
        logger.info("[OPENAI] step=4_normalize_content  content_chars=%d  duration=%.4fs", len(content), perf_counter() - _t)

        if not content.strip():
            logger.warning("[OPENAI] step=4_normalize_content  EMPTY — returning no entities")
            content = '{}'

        # ── 4. JSON parse ────────────────────────────────────────────────────
        _t = perf_counter()
        try:
            parsed = _parse_entities_response(content)
        except json.JSONDecodeError:
            logger.warning("[OPENAI] step=5_json_parse  FAILED  snippet=%.200s", content)
            parsed = {"entities": []}
        logger.info(
            "[OPENAI] step=5_json_parse  entities=%d  duration=%.4fs",
            len(parsed.get("entities", [])), perf_counter() - _t,
        )

        tokens_cached = _extract_cached_tokens(usage)

        logger.info(
            "[OPENAI] step=DONE  total=%.2fs  entities=%d  tok_in=%d  tok_out=%d  tok_cached=%d",
            perf_counter() - _t_total,
            len(parsed.get("entities", [])), int(tok_in or 0), int(tok_out or 0), int(tokens_cached or 0),
        )

        return {
            "entities": parsed.get("entities", []),
            "tokens_input": int(tok_in or 0),
            "tokens_output": int(tok_out or 0),
            "tokens_cached": int(tokens_cached or 0),
        }
    except Exception as e:
        if '401' in str(e) or 'invalid_api_key' in str(e).lower():
            raise ValueError('OpenAI authentication failed') from e
        if '429' in str(e) or 'rate limit' in str(e).lower():
            raise ValueError('API rate limit exceeded') from e
        logger.error("[OPENAI] step=ERROR  after=%.2fs  error=%s", perf_counter() - _t_total, e)
        raise RuntimeError(f"Failed to extract entities: {e}") from e
