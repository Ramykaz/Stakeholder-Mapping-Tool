"""Gemini client for joint entity + relationship extraction."""

from __future__ import annotations

import json

import httpx

from ner.services.openai_client import _parse_entities_response
from ner.services.gemini_compat import DEFAULT_GEMINI_MODEL, normalize_gemini_model


def extract_joint_from_chunk(
    chunk_text: str,
    api_key: str,
    model: str,
    concept_note: str | None = None,
    entity_labels: list[str] | None = None,
    relationship_types: list[dict] | None = None,
) -> dict:
    if not chunk_text or not chunk_text.strip():
        return {
            'entities': [],
            'relationships': [],
            'tokens_input': 0,
            'tokens_output': 0,
            'tokens_cached': 0,
            'cost_usd': 0.0,
        }

    prompt_parts = [
        'Extract entities and relationships from the provided text.',
        'Return only strict JSON with keys: entities, relationships.',
    ]
    if concept_note:
        prompt_parts.append(f'Concept note context:\n{concept_note}')
    if entity_labels:
        prompt_parts.append(f"Allowed entity labels: {', '.join(entity_labels)}")
    if relationship_types:
        names = [str(item.get('name', '')).strip() for item in relationship_types if item.get('name')]
        if names:
            prompt_parts.append(f"Allowed relationship types: {', '.join(names)}")

    resolved_model = normalize_gemini_model(model)
    model_candidates = [resolved_model]
    if resolved_model != DEFAULT_GEMINI_MODEL:
        model_candidates.append(DEFAULT_GEMINI_MODEL)

    body = {
        'contents': [
            {
                'parts': [
                    {'text': '\n\n'.join(prompt_parts)},
                    {'text': chunk_text},
                ]
            }
        ],
        'generationConfig': {
            'temperature': 0.0,
            'responseMimeType': 'application/json',
        },
    }

    payload = None
    last_error_text = ''
    for candidate_model in model_candidates:
        for api_version in ('v1beta', 'v1'):
            url = f"https://generativelanguage.googleapis.com/{api_version}/models/{candidate_model}:generateContent"
            resp = httpx.post(url, params={'key': api_key}, json=body, timeout=60)
            if resp.status_code >= 400:
                body_text = (resp.text or '').lower()
                last_error_text = body_text
                if resp.status_code == 404 and ('not found' in body_text or 'not supported' in body_text):
                    continue
                resp.raise_for_status()
            payload = resp.json()
            break
        if payload is not None:
            break

    if payload is None:
        raise RuntimeError(
            f"Gemini generateContent failed for models {model_candidates}. Last error: {last_error_text[:400]}"
        )

    text = '{}'
    try:
        text = payload['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError, TypeError):
        text = '{}'

    parsed = _parse_entities_response(text)
    usage = payload.get('usageMetadata', {})

    return {
        'entities': parsed.get('entities', []),
        'relationships': parsed.get('relationships', []),
        'tokens_input': int(usage.get('promptTokenCount', 0) or 0),
        'tokens_output': int(usage.get('candidatesTokenCount', 0) or 0),
        'tokens_cached': 0,
        'cost_usd': 0.0,
    }
