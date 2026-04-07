"""Service for generating AI stakeholder persona cards grouped by entity type."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING

from ner.services.gemini_compat import generate_gemini_text
from ner.services.provider_factory import resolve_provider_model_for_project

if TYPE_CHECKING:
    from ingestion.models import Project

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path('prompts/persona_generate.txt')


def _load_prompt_template() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        logger.warning("Persona generation prompt not found at %s", _PROMPT_PATH)
        return (
            "Generate a stakeholder persona for entity type '{entity_type}' "
            "with entities: {entity_names}. Project: {project_context}. "
            "Return JSON: {{persona_name, archetype_label, demographics, motivations: [3], frustrations: [3]}}"
        )


def _call_provider(prompt: str, provider: str, model: str, max_tokens: int = 1024) -> str:
    """Call the configured LLM provider and return the text response."""
    provider = provider.strip().lower()

    if provider == 'groq':
        from groq import Groq
        client = Groq(api_key=os.environ.get('GROQ_API_KEY', ''))
        resp = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()

    if provider == 'openai':
        from openai import OpenAI
        client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY', ''))
        resp = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()

    if provider == 'azure_openai':
        from openai import AzureOpenAI
        from django.conf import settings as django_settings
        client = AzureOpenAI(
            api_key=os.environ.get('AZURE_OPENAI_API_KEY', ''),
            azure_endpoint=getattr(django_settings, 'AZURE_OPENAI_ENDPOINT', ''),
            api_version='2024-02-01',
        )
        deployment = getattr(django_settings, 'AZURE_OPENAI_DEPLOYMENT', model)
        resp = client.chat.completions.create(
            model=deployment,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()

    if provider == 'gemini':
        return generate_gemini_text(prompt, model)

    raise ValueError(f"Unsupported provider: {provider}")


def _parse_json_response(text: str) -> dict | None:
    """Extract and parse JSON from LLM response text."""
    text = text.strip()
    # Strip markdown code blocks if present
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1]) if len(lines) > 2 else text
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        # Try to find JSON object in the text
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except (json.JSONDecodeError, ValueError):
                pass
    return None


def _generate_single_persona(
    entity_type_name: str,
    entity_names: list[str],
    descriptions: list[str],
    project_context: str,
    provider: str,
    model: str,
) -> dict | None:
    """Call LLM to generate a single persona for an entity type.

    Returns parsed JSON dict or None on failure.
    """
    template = _load_prompt_template()
    prompt = template
    prompt = prompt.replace('{entity_type}', entity_type_name)
    prompt = prompt.replace('{entity_names}', '\n'.join(f'- {name}' for name in entity_names))
    prompt = prompt.replace(
        '{descriptions}',
        '\n'.join(f'- {d}' for d in descriptions if d.strip()) or '(No additional descriptions)',
    )
    prompt = prompt.replace('{project_context}', project_context or '(No project context available)')

    try:
        raw = _call_provider(prompt, provider=provider, model=model)
        data = _parse_json_response(raw)
        if not data:
            logger.warning("Persona generation: failed to parse JSON for type '%s'", entity_type_name)
            return None

        # Validate required fields
        required = ['persona_name', 'archetype_label', 'demographics', 'motivations', 'frustrations']
        if not all(k in data for k in required):
            logger.warning("Persona generation: missing required fields for type '%s'", entity_type_name)
            return None

        # Ensure lists have exactly 3 items
        motivations = data.get('motivations', [])[:3]
        frustrations = data.get('frustrations', [])[:3]
        if len(motivations) < 3 or len(frustrations) < 3:
            logger.warning("Persona generation: insufficient motivation/frustration items for type '%s'", entity_type_name)

        data['motivations'] = motivations
        data['frustrations'] = frustrations
        return data

    except Exception as e:
        logger.error("Persona generation error for type '%s': %s", entity_type_name, e)
        return None


def generate_personas_for_project(project_id: str) -> int:
    """Generate persona cards for all entity types with >= 3 entities in the project.

    Groups entities by type, generates one persona per type with sufficient data.
    Deletes existing personas for the project and creates new ones.

    Returns count of personas created.
    """
    from ingestion.models import Project
    from ner.models import Entity, EntityLabel, StakeholderPersona
    from ingestion.services.context import get_project_context

    project = Project.objects.select_related('initiative_profile').get(id=project_id)
    provider_config = resolve_provider_model_for_project(project)
    provider = provider_config.provider
    model = provider_config.model
    project_context = get_project_context(project)

    # Group entities by entity_type (CharField value like 'PERSON')
    entities_qs = Entity.objects.filter(project=project).values(
        'entity_type', 'canonical_name', 'id'
    )

    # Build mapping: entity_type_str -> list of entity data
    type_to_entities: dict[str, list[dict]] = {}
    for e in entities_qs:
        et = e['entity_type']
        if et not in type_to_entities:
            type_to_entities[et] = []
        type_to_entities[et].append(e)

    created_count = 0
    new_personas = []

    for entity_type_str, entity_list in type_to_entities.items():
        if len(entity_list) < 3:
            logger.info(
                "Skipping persona for type '%s' — only %d entities (need >= 3)",
                entity_type_str,
                len(entity_list),
            )
            continue

        # Look up corresponding EntityLabel
        try:
            entity_label = EntityLabel.objects.get(name__iexact=entity_type_str)
        except EntityLabel.DoesNotExist:
            # Try with exact match fallback
            entity_label = None
            logger.info("No EntityLabel found for entity_type='%s'", entity_type_str)

        # Take up to 10 entity names for the prompt
        sample = entity_list[:10]
        entity_names = [e['canonical_name'] for e in sample]
        representative_entities = [
            {'id': str(e['id']), 'name': e['canonical_name']}
            for e in sample
        ]

        # Get up to 5 descriptions (empty string list — Entity has no description field)
        descriptions = []

        persona_data = _generate_single_persona(
            entity_type_name=entity_type_str.title(),
            entity_names=entity_names,
            descriptions=descriptions,
            project_context=project_context,
            provider=provider,
            model=model,
        )

        if persona_data is None:
            continue

        new_personas.append(StakeholderPersona(
            project=project,
            entity_type=entity_label,
            persona_name=persona_data['persona_name'],
            archetype_label=persona_data['archetype_label'],
            demographics=persona_data['demographics'],
            motivations=persona_data['motivations'],
            frustrations=persona_data['frustrations'],
            representative_entities=representative_entities,
        ))
        created_count += 1

    # Delete existing and bulk create new in a transaction
    from django.db import transaction
    with transaction.atomic():
        StakeholderPersona.objects.filter(project=project).delete()
        StakeholderPersona.objects.bulk_create(new_personas, ignore_conflicts=True)

    logger.info(
        "generate_personas_for_project: created %d personas for project %s",
        created_count,
        project_id,
    )
    return created_count
