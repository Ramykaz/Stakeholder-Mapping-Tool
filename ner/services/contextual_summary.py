"""Contextual summary generation and cache utilities."""

from __future__ import annotations

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import timedelta

from django.db import models
from django.utils import timezone

from ingestion.models import Project
from ingestion.services.context import get_project_context
from ner.models import ContextualEntitySummary, Entity, EntityMention, Relation
from ner.services.text_quality import enforce_minimum_specificity

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24
DEFAULT_TIMEOUT_SECONDS = 75

_PROVIDER_TIMEOUT_MIN_SECONDS: dict[str, int] = {
    'azure_openai': 90,
    'openai': 90,
    'gemini': 60,
    'groq': 45,
}


def _resolve_timeout_seconds(provider: str, requested_timeout: int) -> int:
    normalized_provider = (provider or '').strip().lower()
    requested = max(1, int(requested_timeout or DEFAULT_TIMEOUT_SECONDS))
    provider_floor = _PROVIDER_TIMEOUT_MIN_SECONDS.get(normalized_provider, DEFAULT_TIMEOUT_SECONDS)
    return max(requested, provider_floor)


def _build_evidence_hash(entity: Entity, project: Project) -> str:
    relation_ids = list(
        Relation.objects.filter(project=project)
        .filter(models.Q(source_entity=entity) | models.Q(target_entity=entity))
        .values_list('id', flat=True)
    )
    mention_count = int(getattr(entity, 'mentions', None).count() if hasattr(entity, 'mentions') else 0)
    payload = f"{entity.id}:{project.id}:{mention_count}:{','.join(str(item) for item in relation_ids)}"
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def _generate_summary_text(entity: Entity, project: Project, provider: str = '', model: str = '') -> str:
    """Generate a grounded narrative summary using LLM + retrieved document chunks."""
    from pathlib import Path
    from django.conf import settings as django_settings
    from .semantic_search import search_chunks_for_entity
    from .nl_query import _call_provider

    concept_text = (get_project_context(project) or '').strip()

    chunks = list(search_chunks_for_entity(project, entity.canonical_name, top_k=8))
    chunk_texts = [c.text for c in chunks if (c.text or '').strip()]

    mention_rows = list(
        EntityMention.objects.filter(entity=entity, document__project=project)
        .select_related('document', 'chunk')[:12]
    )
    mention_texts: list[str] = []
    mention_refs: list[dict] = []
    for mention in mention_rows:
        snippet = (mention.excerpt or '').strip()
        if not snippet and mention.chunk and (mention.chunk.text or '').strip():
            snippet = mention.chunk.text.strip()[:300]
        if not snippet:
            continue
        mention_texts.append(snippet)
        mention_refs.append(
            {
                'document_name': mention.document.filename,
                'snippet': snippet[:200],
            }
        )

    if mention_texts:
        existing = set(text.strip() for text in chunk_texts if text.strip())
        for text in mention_texts:
            normalized = text.strip()
            if normalized and normalized not in existing:
                chunk_texts.append(normalized)
                existing.add(normalized)
            if len(chunk_texts) >= 12:
                break
    relation_statements = [
        f"{rel.source_entity.canonical_name} --[{rel.label}]--> {rel.target_entity.canonical_name}"
        for rel in Relation.objects.filter(project=project)
        .filter(models.Q(source_entity=entity) | models.Q(target_entity=entity))
        .select_related('source_entity', 'target_entity')[:30]
    ]
    relation_block = '\n'.join(relation_statements) if relation_statements else '(No project relationships found.)'
    chunks_block = '\n\n---\n\n'.join(chunk_texts) if chunk_texts else '(No document excerpts found for this entity.)'

    source_refs = [
        {'document_name': c.document.filename, 'snippet': (c.text or '')[:200]}
        for c in chunks if c.text
    ]
    if mention_refs:
        seen_pairs = {(item.get('document_name'), item.get('snippet')) for item in source_refs}
        for ref in mention_refs:
            pair = (ref.get('document_name'), ref.get('snippet'))
            if pair not in seen_pairs:
                source_refs.append(ref)
                seen_pairs.add(pair)

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
        relations=relation_block,
    )
    prompt = (
        f"{prompt}\n\n"
        "RELATIONSHIP EVIDENCE:\n"
        f"{relation_block}\n\n"
        "QUALITY RULES:\n"
        "- Write plain text only (no markdown, bullets, asterisks, or headings).\n"
        "- Be project-specific: use concrete actors/activities from evidence excerpts.\n"
        "- If evidence is weak, explicitly state the limitation in one sentence."
    )

    resolved_provider = (provider or '').strip() or django_settings.NER_DEFAULT_PROVIDER
    resolved_model = (model or '').strip() or django_settings.NER_DEFAULT_MODEL

    try:
        text = _call_provider(prompt, resolved_provider, resolved_model)
        text = enforce_minimum_specificity(text, entity_name=entity.canonical_name)
        return text, source_refs
    except Exception as exc:
        logger.warning("LLM summary call failed: %s", type(exc).__name__, extra={'entity_id': str(entity.id)})
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
    from .semantic_search import search_chunks_for_entity

    now = timezone.now()

    if not refresh:
        cached = ContextualEntitySummary.objects.filter(
            entity=entity,
            project=project,
            expires_at__gt=now,
        ).first()
        if cached and (cached.summary_text or '').strip():
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
    effective_timeout_seconds = _resolve_timeout_seconds(resolved_provider, timeout_seconds)

    relation_count = Relation.objects.filter(project=project).filter(
        models.Q(source_entity=entity) | models.Q(target_entity=entity)
    ).count()
    mention_count = EntityMention.objects.filter(entity=entity, document__project=project).count()
    evidence_chunks = search_chunks_for_entity(project, entity.canonical_name, top_k=2)
    evidence_count = len([chunk for chunk in evidence_chunks if (chunk.text or '').strip()])
    if (not refresh) and relation_count == 0 and evidence_count == 0 and mention_count == 0:
        return {
            'entity_id': str(entity.id),
            'project_id': str(project.id),
            'summary': None,
            'fallback_message': 'Insufficient evidence to generate a project-specific summary yet.',
            'retryable': True,
            'reason': 'insufficient_evidence',
        }

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_generate_summary_text, entity, project, resolved_provider, resolved_model)
            summary_text, source_refs = future.result(timeout=effective_timeout_seconds)
        summary_text = enforce_minimum_specificity(summary_text, entity_name=entity.canonical_name)
    except FutureTimeoutError:
        logger.warning(
            "Contextual summary timed out after %ss",
            effective_timeout_seconds,
            extra={'entity_id': str(entity.id), 'project_id': str(project.id), 'provider': resolved_provider or 'default'},
        )
        return {
            'entity_id': str(entity.id),
            'project_id': str(project.id),
            'summary': None,
            'fallback_message': 'Summary timed out — please try again.',
            'retryable': True,
            'reason': 'timeout',
        }
    except Exception as exc:
        from ner.services.gemini_compat import _is_quota_exhausted
        msg = str(exc).lower()
        if _is_quota_exhausted(msg):
            fallback = 'API quota exhausted — switch provider in Project Settings or try again tomorrow.'
            reason = 'quota_exhausted'
        else:
            fallback = 'Summary unavailable right now. Please try again.'
            reason = 'provider_error'
        logger.warning("Contextual summary generation failed (%s): %s", reason, type(exc).__name__,
                       extra={'entity_id': str(entity.id), 'project_id': str(project.id)})
        return {
            'entity_id': str(entity.id),
            'project_id': str(project.id),
            'summary': None,
            'fallback_message': fallback,
            'retryable': reason != 'quota_exhausted',
            'reason': reason,
        }

    provider_label = resolved_provider or 'internal'
    if not (summary_text or '').strip():
        return {
            'entity_id': str(entity.id),
            'project_id': str(project.id),
            'summary': None,
            'fallback_message': 'Summary unavailable right now. Please retry.',
            'retryable': True,
            'reason': 'empty_output',
        }

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
