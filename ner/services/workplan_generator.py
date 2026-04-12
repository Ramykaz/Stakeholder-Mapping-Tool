"""Service for generating a structured stakeholder engagement workplan from SMQ Section 6."""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import TYPE_CHECKING

from ner.services.gemini_compat import generate_gemini_text
from ner.services.provider_factory import resolve_provider_model_for_project
from ner.services.provider_runtime import normalize_azure_endpoint

if TYPE_CHECKING:
    from ingestion.models import Project

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path('prompts/workplan_generate.txt')
_REASONING_MODELS = frozenset({'gpt-5-mini', 'gpt-5-nano', 'o1', 'o3-mini'})


class WorkplanGenerationError(Exception):
    """Raised when workplan cannot be generated due to missing prerequisites."""
    pass


def _load_prompt_template() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        logger.warning("Workplan generation prompt not found at %s", _PROMPT_PATH)
        return (
            "Generate a stakeholder engagement workplan as JSON with 4-7 components each having 2-4 tasks. "
            "PROJECT: {project_context}\nSECTION 6: {section_6_content}\nSTAKEHOLDERS: {stakeholder_names}\n"
            "Return: {{components: [{{title, tasks: [{{task_description, suggested_owner, timeline, "
            "dependencies, kpis, related_stakeholder}}]}}]}}"
        )


def _normalize_message_content(content) -> str:
    if content is None:
        return ''
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
        return '\n'.join(parts)

    for attr in ('text', 'output_text', 'content', 'value'):
        value = getattr(content, attr, None)
        if value:
            return _normalize_message_content(value)
    return str(content)


def _call_provider(prompt: str, provider: str, model: str, max_tokens: int = 2048) -> str:
    """Call the configured LLM provider and return the text response."""
    provider = provider.strip().lower()

    if provider == 'groq':
        from groq import Groq
        client = Groq(api_key=os.environ.get('GROQ_API_KEY', ''))
        resp = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()

    if provider == 'openai':
        from openai import OpenAI
        client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY', ''), timeout=180.0, max_retries=1)
        request_kwargs: dict = {
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_completion_tokens': max_tokens,
            'response_format': {'type': 'json_object'},
        }
        if model in _REASONING_MODELS:
            request_kwargs['reasoning_effort'] = 'low'
        try:
            resp = client.chat.completions.create(**request_kwargs)
        except Exception:
            fallback_kwargs = dict(request_kwargs)
            fallback_kwargs.pop('response_format', None)
            resp = client.chat.completions.create(**fallback_kwargs)
        return _normalize_message_content(resp.choices[0].message.content).strip()

    if provider == 'azure_openai':
        from openai import AzureOpenAI
        from django.conf import settings as django_settings
        client = AzureOpenAI(
            api_key=os.environ.get('AZURE_OPENAI_API_KEY', ''),
            azure_endpoint=normalize_azure_endpoint(getattr(django_settings, 'AZURE_OPENAI_ENDPOINT', '')),
            api_version=os.environ.get('AZURE_OPENAI_API_VERSION', '2024-12-01-preview'),
            timeout=180.0,
            max_retries=1,
        )
        deployment = getattr(django_settings, 'AZURE_OPENAI_DEPLOYMENT', model)
        request_kwargs: dict = {
            'model': deployment,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_completion_tokens': max_tokens,
            'response_format': {'type': 'json_object'},
        }
        if model in _REASONING_MODELS:
            request_kwargs['reasoning_effort'] = 'low'
        try:
            resp = client.chat.completions.create(**request_kwargs)
        except Exception:
            fallback_kwargs = dict(request_kwargs)
            fallback_kwargs.pop('response_format', None)
            resp = client.chat.completions.create(**fallback_kwargs)
        return _normalize_message_content(resp.choices[0].message.content).strip()

    if provider == 'gemini':
        return generate_gemini_text(prompt, model)

    raise ValueError(f"Unsupported provider: {provider}")


def _parse_json_response(text: str) -> dict | None:
    """Extract and parse JSON from LLM response text."""
    text = (text or '').strip()
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1]) if len(lines) > 2 else text

    # Remove accidental leading prose before JSON block
    if not text.startswith('{') and '{' in text:
        text = text[text.find('{'):]

    # Remove trailing non-JSON content after closing brace
    if text.endswith('```'):
        text = re.sub(r'```\s*$', '', text).strip()

    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except (json.JSONDecodeError, ValueError):
                pass
    return None


def _generate_workplan_json(prompt: str, provider: str, model: str) -> dict | None:
    prompt_variants = [
        prompt,
        (
            prompt
            + '\n\nReturn ONLY a valid JSON object with the top-level key "components".'
            + ' Do not include markdown, code fences, comments, or explanatory text.'
        ),
    ]
    token_budgets = [1800, 2600, 3400]

    for variant in prompt_variants:
        for budget in token_budgets:
            raw = _call_provider(variant, provider=provider, model=model, max_tokens=budget)
            parsed = _parse_json_response(raw)
            if parsed and isinstance(parsed.get('components'), list):
                return parsed
    return None


def generate_workplan_for_project(project_id: str) -> int:
    """Generate a structured engagement workplan from SMQ Section 6 report content.

    Uses Section 6 content when available; otherwise falls back to other completed
    report sections and project context.
    Deletes existing workplan and creates new components + tasks.
    Returns count of components created.
    """
    from ingestion.models import Project
    from ner.models import ReportSection, Entity, WorkplanComponent, WorkplanTask
    from ingestion.services.context import get_project_context
    from ner.services.priority_table import compute_priority_scores

    project = Project.objects.select_related('initiative_profile').get(id=project_id)
    provider_config = resolve_provider_model_for_project(project)
    provider = provider_config.provider
    model = provider_config.model
    project_context = get_project_context(project)

    section_6 = (
        ReportSection.objects.select_related('section')
        .filter(
            project=project,
            section__section_number=6,
            status=ReportSection.STATUS_DONE,
        )
        .first()
    )

    section_6_content = (section_6.generated_text or '').strip() if section_6 else ''
    if not section_6_content:
        fallback_sections = list(
            ReportSection.objects.select_related('section')
            .filter(project=project, status=ReportSection.STATUS_DONE)
            .order_by('section__section_number')
        )
        if fallback_sections:
            section_6_content = '\n\n'.join(
                f"Section {item.section.section_number}: {(item.generated_text or '').strip()}"
                for item in fallback_sections
                if (item.generated_text or '').strip()
            ).strip()

    # Get top-10 stakeholder names from priority scores
    try:
        top_rows = compute_priority_scores(project)[:10]
        stakeholder_names = '\n'.join(
            f"- {row['name']} ({row.get('entity_type', '')})"
            for row in top_rows
        )
    except Exception as e:
        logger.warning("Could not compute priority scores for workplan: %s", e)
        stakeholder_names = '(No ranked stakeholders yet)'

    # Build prompt
    template = _load_prompt_template()
    prompt = template
    prompt = prompt.replace('{project_context}', project_context or '(No project context available)')
    prompt = prompt.replace(
        '{section_6_content}',
        section_6_content or '(No generated section content available; infer from project context.)',
    )
    prompt = prompt.replace('{stakeholder_names}', stakeholder_names)

    data = _generate_workplan_json(prompt, provider=provider, model=model)

    if not data or 'components' not in data:
        raise WorkplanGenerationError("LLM returned invalid JSON for workplan generation.")

    components_data = data['components']
    if not isinstance(components_data, list) or not components_data:
        raise WorkplanGenerationError("LLM returned no workplan components.")

    # Build entity lookup for related_stakeholder name matching
    entity_lookup: dict[str, Entity] = {}
    for entity in Entity.objects.filter(project=project):
        entity_lookup[entity.canonical_name.lower()] = entity

    # Delete existing workplan and create new
    from django.db import transaction
    with transaction.atomic():
        WorkplanComponent.objects.filter(project=project).delete()

        created_components = 0
        for comp_order, comp_data in enumerate(components_data):
            if not isinstance(comp_data, dict):
                continue
            component = WorkplanComponent.objects.create(
                project=project,
                order=comp_order,
                title=comp_data.get('title', f'Component {comp_order + 1}'),
            )
            tasks_data = comp_data.get('tasks', [])
            if not isinstance(tasks_data, list):
                tasks_data = []

            for task_order, task_data in enumerate(tasks_data):
                if not isinstance(task_data, dict):
                    continue

                # Attempt to link related entity by case-insensitive name match
                related_entity = None
                related_name = (task_data.get('related_stakeholder') or '').strip().lower()
                if related_name:
                    related_entity = entity_lookup.get(related_name)

                WorkplanTask.objects.create(
                    component=component,
                    order=task_order,
                    task_description=task_data.get('task_description', ''),
                    suggested_owner=task_data.get('suggested_owner', ''),
                    timeline=task_data.get('timeline', ''),
                    dependencies=task_data.get('dependencies', ''),
                    kpis=task_data.get('kpis', ''),
                    related_entity=related_entity,
                )
            created_components += 1

    logger.info(
        "generate_workplan_for_project: created %d components for project %s",
        created_components,
        project_id,
    )
    return created_components
