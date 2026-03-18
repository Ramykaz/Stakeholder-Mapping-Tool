"""Contextual summary generation and cache utilities."""

from __future__ import annotations

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import timedelta

from django.utils import timezone

from ingestion.models import Project
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


def _generate_summary_text(entity: Entity, project: Project) -> str:
    concept_note = getattr(project, 'concept_note', None)
    concept_text = (concept_note.content or '').strip() if concept_note else ''

    outgoing = list(
        Relation.objects.filter(project=project, source_entity=entity)
        .select_related('target_entity')
        .order_by('-confidence', 'label')[:5]
    )
    incoming = list(
        Relation.objects.filter(project=project, target_entity=entity)
        .select_related('source_entity')
        .order_by('-confidence', 'label')[:5]
    )

    relation_parts = []
    for rel in outgoing:
        relation_parts.append(f"{entity.canonical_name} {rel.label.lower().replace('_', ' ')} {rel.target_entity.canonical_name}")
    for rel in incoming:
        relation_parts.append(f"{rel.source_entity.canonical_name} {rel.label.lower().replace('_', ' ')} {entity.canonical_name}")

    relation_sentence = '; '.join(relation_parts[:3]) if relation_parts else f"{entity.canonical_name} appears in project evidence with limited explicit relationships"
    context_sentence = (
        f" In this project context, {concept_text[:280].strip()}"
        if concept_text
        else ""
    )

    return (
        f"{entity.canonical_name} is modeled as a {entity.entity_type.lower()} stakeholder in {project.name}. "
        f"Key evidence indicates: {relation_sentence}.{context_sentence}"
    ).strip()


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

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_generate_summary_text, entity, project)
            summary_text = future.result(timeout=max(1, timeout_seconds))
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

    cache = _upsert_cache(entity, project, summary_text, provider='internal')
    return {
        'entity_id': str(entity.id),
        'project_id': str(project.id),
        'summary': cache.summary_text,
        'source': 'provider',
        'generated_at': cache.generated_at,
        'expires_at': cache.expires_at,
    }
