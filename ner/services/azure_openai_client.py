"""Azure OpenAI client for joint entity + relationship extraction."""

from __future__ import annotations

import os

from ner.services.openai_client import _parse_entities_response


def extract_joint_from_chunk(
    chunk_text: str,
    api_key: str,
    endpoint: str,
    deployment: str,
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

    if not endpoint or not deployment:
        raise RuntimeError('Azure OpenAI endpoint/deployment configuration is missing')

    prompt_parts = [
        'Extract entities and relationships from the provided text.',
        'Return only JSON with keys: entities, relationships.',
    ]
    if concept_note:
        prompt_parts.append(f'Concept note context:\n{concept_note}')
    if entity_labels:
        prompt_parts.append(f"Allowed entity labels: {', '.join(entity_labels)}")
    if relationship_types:
        names = [str(item.get('name', '')).strip() for item in relationship_types if item.get('name')]
        if names:
            prompt_parts.append(f"Allowed relationship types: {', '.join(names)}")

    AzureOpenAI = __import__('openai', fromlist=['AzureOpenAI']).AzureOpenAI
    client = AzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=os.environ.get('AZURE_OPENAI_API_VERSION', '2024-12-01-preview'),
    )

    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {'role': 'system', 'content': '\n\n'.join(prompt_parts)},
            {'role': 'user', 'content': chunk_text},
        ],
        response_format={'type': 'json_object'},
        max_completion_tokens=4096,
    )

    content = response.choices[0].message.content or '{}'
    parsed = _parse_entities_response(content)
    usage = getattr(response, 'usage', None)
    prompt_tokens = int(getattr(usage, 'prompt_tokens', 0) or 0)
    output_tokens = int(getattr(usage, 'completion_tokens', 0) or 0)
    prompt_details = getattr(usage, 'prompt_tokens_details', None)
    cached_tokens = int(getattr(prompt_details, 'cached_tokens', 0) or 0)

    return {
        'entities': parsed.get('entities', []),
        'relationships': parsed.get('relationships', []),
        'tokens_input': prompt_tokens,
        'tokens_output': output_tokens,
        'tokens_cached': cached_tokens,
        'cost_usd': 0.0,
    }
