"""Gemini client for joint entity + relationship extraction."""

from __future__ import annotations

import json

import httpx

from ner.services.openai_client import _parse_entities_response


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

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
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

    resp = httpx.post(url, params={'key': api_key}, json=body, timeout=60)
    resp.raise_for_status()
    payload = resp.json()

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
