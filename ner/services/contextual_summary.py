"""Contextual summary generation and cache utilities."""

from __future__ import annotations

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import timedelta

from django.utils import timezone

from ingestion.models import Project
from ingestion.services.context import get_project_context
from ner.models import ContextualEntitySummary, Entity, Relation

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24
DEFAULT_TIMEOUT_SECONDS = 8


def _build_evidence_hash(entity: Entity, project: Project) -> str:
    relation_ids = list(
        Relation.objects.filter(project=project)
        .filter(source_entity=entity)
        .values_list('id', flat=True)
    )
    payload = f"{entity.id}:{project.id}:{','.join(str(item) for item in relation_ids)}"
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def _generate_summary_text(entity: Entity, project: Project, provider: str = '', model: str = '') -> str:
    """Generate a grounded narrative summary using LLM + retrieved document chunks."""
    from pathlib import Path
    from django.conf import settings as django_settings
    from .semantic_search import search_chunks_for_entity
    from .nl_query import _call_provider

    concept_text = (get_project_context(project) or '').strip()

    chunks = list(search_chunks_for_entity(project, entity.canonical_name, top_k=8))
    chunk_texts = [c.text for c in chunks if c.text]
    chunks_block = '\n\n---\n\n'.join(chunk_texts) if chunk_texts else '(No document excerpts found for this entity.)'

    source_refs = [
        {'document_name': c.document.filename, 'snippet': (c.text or '')[:200]}
        for c in chunks if c.text
    ]

    prompt_path = Path('prompts/entity_summary_rag.txt')
    try:
        template = prompt_path.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        template = (
            "Summarize the role of {entity_name} ({entity_type}) in {project_name} "
            "based only on these excerpts:\n{chunks}\nProject context: {concept_note}\nSummary:"
        )

    prompt = template.format(
        entity_name=entity.canonical_name,
        entity_type=entity.entity_type,
        project_name=project.name,
        concept_note=concept_text[:500] if concept_text else '(No concept note available.)',
        chunks=chunks_block,
    )

    resolved_provider = (provider or '').strip() or django_settings.NER_DEFAULT_PROVIDER
    resolved_model = (model or '').strip() or django_settings.NER_DEFAULT_MODEL

    try:
        text = _call_provider(prompt, resolved_provider, resolved_model)
        return text, source_refs
    except Exception:
        logger.exception("LLM summary call failed", extra={'entity_id': str(entity.id)})
        raise


def _upsert_cache(entity: Entity, project: Project, summary_text: str, provider: str = 'internal') -> ContextualEntitySummary:
    now = timezone.now()
    cache, _ = ContextualEntitySummary.objects.update_or_create(
        entity=entity,
        project=project,
        defaults={
            'summary_text': summary_text,
            'generated_by_provider': provider,
            'generated_at': now,
            'expires_at': now + timedelta(hours=CACHE_TTL_HOURS),
            'evidence_hash': _build_evidence_hash(entity, project),
        },
    )
    return cache


def get_or_generate_summary(
    *,
    entity: Entity,
    project: Project,
    refresh: bool = False,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    provider: str = '',
    model: str = '',
) -> dict:
    now = timezone.now()

    if not refresh:
        cached = ContextualEntitySummary.objects.filter(
            entity=entity,
            project=project,
            expires_at__gt=now,
        ).first()
        if cached:
            return {
                'entity_id': str(entity.id),
                'project_id': str(project.id),
                'summary': cached.summary_text,
                'source': 'cache',
                'generated_at': cached.generated_at,
                'expires_at': cached.expires_at,
            }

    resolved_provider = (provider or '').strip()
    resolved_model = (model or '').strip()

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_generate_summary_text, entity, project, resolved_provider, resolved_model)
            summary_text, source_refs = future.result(timeout=max(1, timeout_seconds))
    except FutureTimeoutError:
        logger.warning("Contextual summary timed out", extra={'entity_id': str(entity.id), 'project_id': str(project.id)})
        return {
            'entity_id': str(entity.id),
            'project_id': str(project.id),
            'summary': None,
            'fallback_message': 'Summary unavailable right now. Try again.',
            'retryable': True,
            'reason': 'timeout_or_provider_unavailable',
            'status_code': 503,
        }
    except Exception:
        logger.exception("Contextual summary generation failed", extra={'entity_id': str(entity.id), 'project_id': str(project.id)})
        return {
            'entity_id': str(entity.id),
            'project_id': str(project.id),
            'summary': None,
            'fallback_message': 'Summary unavailable right now. Try again.',
            'retryable': True,
            'reason': 'timeout_or_provider_unavailable',
            'status_code': 503,
        }

    provider_label = resolved_provider or 'internal'
    cache = _upsert_cache(entity, project, summary_text, provider=provider_label)
    return {
        'entity_id': str(entity.id),
        'project_id': str(project.id),
        'summary': cache.summary_text,
        'source': 'provider',
        'generated_at': cache.generated_at,
        'expires_at': cache.expires_at,
        'source_chunks': source_refs,
    }
