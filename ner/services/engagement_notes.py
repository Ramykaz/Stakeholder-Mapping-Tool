import time
from pathlib import Path

from django.core.cache import cache
from django.db import close_old_connections, models

from ingestion.models import Project
from ner.models import EngagementNote, Entity, ProjectSMQResponse, Relation
from ner.services.nl_query import _call_provider
from ner.services.provider_factory import resolve_provider_model_for_project
from ner.services.provider_runtime import normalize_provider_error_kind
from ner.services.priority_table import compute_priority_scores
from ner.services.semantic_search import search_chunks_for_entity

# Only generate notes for the top N entities — US4 caps at 20 for resumable processing
_MAX_ENTITIES = 20
# Seconds to wait between calls on Groq to avoid hitting the TPM rate limit
_INTER_CALL_DELAY = 2.0
_BATCH_SIZE = 5
_STATE_TTL_SECONDS = 60 * 30
_MAX_RUN_SECONDS = 90


def _state_key(project_id: str) -> str:
    return f"stakeholder_notes_state:{project_id}"


def _cancel_key(project_id: str) -> str:
    return f"stakeholder_notes_cancel:{project_id}"


def generate_notes_for_project(
    project_id: str,
    action: str = 'start',
    max_items: int = _MAX_ENTITIES,
) -> dict:
    close_old_connections()

    project = Project.objects.filter(id=project_id).first()
    if not project:
        return {
            'status': 'error',
            'total_target': 0,
            'completed_count': 0,
            'current_index': 0,
            'message': 'Project not found.',
        }

    capped_max_items = min(max(int(max_items or _MAX_ENTITIES), 1), _MAX_ENTITIES)
    top_rows = compute_priority_scores(project)[:capped_max_items]
    total_target = len(top_rows)

    state_cache_key = _state_key(str(project_id))
    cancel_cache_key = _cancel_key(str(project_id))
    cached_state = cache.get(state_cache_key) or {}
    action = str(action or 'start').strip().lower()

    if action == 'stop':
        cache.set(cancel_cache_key, True, timeout=_STATE_TTL_SECONDS)
        payload = {
            'status': 'cancelled',
            'total_target': total_target,
            'completed_count': int(cached_state.get('completed_count', 0) or 0),
            'current_index': int(cached_state.get('current_index', 0) or 0),
            'message': 'Generation stopped. Existing notes are preserved.',
        }
        cache.set(state_cache_key, payload, timeout=_STATE_TTL_SECONDS)
        close_old_connections()
        return payload

    if action == 'start':
        cache.delete(cancel_cache_key)
    if action == 'resume' and cached_state:
        current_index = int(cached_state.get('current_index', 0) or 0)
        completed_count = int(cached_state.get('completed_count', 0) or 0)
    else:
        current_index = 0
        completed_count = 0

    section_2 = ''
    section_6 = ''
    smq_response = ProjectSMQResponse.objects.filter(project=project).first()
    if smq_response:
        for answer in smq_response.answers.select_related('section').all():
            if answer.section.section_number == 2:
                section_2 = answer.answer_text or ''
            elif answer.section.section_number == 6:
                section_6 = answer.answer_text or ''

    prompt_path = Path('prompts/engagement_note.txt')
    try:
        template = prompt_path.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        template = (
            "Write one sentence recommending engagement for {entity_name} ({entity_type}).\n"
            "Relationships: {relationships}\nSMQ2: {smq_section_2}\nSMQ6: {smq_section_6}\n"
            "Evidence: {chunk_excerpts}\n"
        )

    provider_config = resolve_provider_model_for_project(project)
    provider = provider_config.provider
    model = provider_config.model
    started_at = time.monotonic()

    processed_in_batch = 0
    for row in top_rows[current_index:]:
        if cache.get(cancel_cache_key):
            payload = {
                'status': 'cancelled',
                'total_target': total_target,
                'completed_count': completed_count,
                'current_index': max(0, current_index - 1),
                'message': 'Generation stopped. Existing notes are preserved.',
            }
            cache.set(state_cache_key, payload, timeout=_STATE_TTL_SECONDS)
            close_old_connections()
            return payload

        if (time.monotonic() - started_at) >= _MAX_RUN_SECONDS:
            payload = {
                'status': 'running',
                'total_target': total_target,
                'completed_count': completed_count,
                'current_index': max(0, current_index - 1),
                'message': 'Partial progress saved. Continue generation to process remaining stakeholders.',
            }
            cache.set(state_cache_key, payload, timeout=_STATE_TTL_SECONDS)
            close_old_connections()
            return payload

        if processed_in_batch >= _BATCH_SIZE:
            break

        entity = Entity.objects.filter(id=row['entity_id'], project=project).first()
        current_index += 1
        processed_in_batch += 1
        if not entity:
            completed_count += 1
            continue

        relations = Relation.objects.filter(project=project).filter(
            models.Q(source_entity=entity) | models.Q(target_entity=entity)
        ).select_related('source_entity', 'target_entity')[:10]
        rel_lines = [
            f"{rel.source_entity.canonical_name} -[{rel.label}]-> {rel.target_entity.canonical_name}"
            for rel in relations
        ]

        chunks = list(search_chunks_for_entity(project, entity.canonical_name, top_k=3))
        chunk_excerpts = '\n'.join(
            f"[{chunk.document.filename}] {(chunk.text or '')[:220]}"
            for chunk in chunks
        )

        prompt = template.format(
            entity_name=entity.canonical_name,
            entity_type=entity.entity_type,
            relationships='\n'.join(rel_lines) if rel_lines else '(No known relations.)',
            smq_section_2=section_2 or '(No section 2 answer yet.)',
            smq_section_6=section_6 or '(No section 6 answer yet.)',
            chunk_excerpts=chunk_excerpts or '(No supporting excerpts found.)',
        )

        try:
            note_text = (_call_provider(prompt, provider, model, max_tokens=256) or '').strip()
        except Exception as exc:
            kind = normalize_provider_error_kind(exc)
            if kind == 'rate_limit':
                payload = {
                    'status': 'paused_rate_limited',
                    'total_target': total_target,
                    'completed_count': completed_count,
                    'current_index': max(0, current_index - 1),
                    'message': 'Provider rate-limited. Resume generation in a moment.',
                }
                cache.set(state_cache_key, payload, timeout=_STATE_TTL_SECONDS)
                close_old_connections()
                return payload

            payload = {
                'status': 'error',
                'total_target': total_target,
                'completed_count': completed_count,
                'current_index': max(0, current_index - 1),
                'message': 'Stakeholder note generation failed. Please retry.',
            }
            cache.set(state_cache_key, payload, timeout=_STATE_TTL_SECONDS)
            close_old_connections()
            return payload

        if provider == 'groq' and completed_count > 0:
            time.sleep(_INTER_CALL_DELAY)

        if not note_text:
            payload = {
                'status': 'error',
                'total_target': total_target,
                'completed_count': completed_count,
                'current_index': max(0, current_index - 1),
                'message': 'Provider returned an empty response. Existing notes are preserved; retry to continue.',
            }
            cache.set(state_cache_key, payload, timeout=_STATE_TTL_SECONDS)
            close_old_connections()
            return payload

        EngagementNote.objects.update_or_create(
            project=project,
            entity=entity,
            defaults={'note_text': note_text},
        )
        completed_count += 1

    if current_index >= total_target:
        payload = {
            'status': 'completed',
            'total_target': total_target,
            'completed_count': completed_count,
            'current_index': total_target,
            'message': 'Stakeholder notes generated.',
        }
        cache.set(state_cache_key, payload, timeout=_STATE_TTL_SECONDS)
        close_old_connections()
        return payload

    payload = {
        'status': 'running',
        'total_target': total_target,
        'completed_count': completed_count,
        'current_index': current_index,
        'message': 'Stakeholder note generation is in progress.',
    }
    cache.set(state_cache_key, payload, timeout=_STATE_TTL_SECONDS)

    close_old_connections()
    return payload
