import logging

from celery import shared_task
from django.core.cache import cache

from ingestion.models import Project
from ner.services.engagement_notes import generate_notes_for_project
from ner.services.report_generator import generate_all_sections, generate_report_section


logger = logging.getLogger(__name__)
_GENERATION_STATUS_TTL_SECONDS = 60 * 60


def _persona_generation_cache_key(project_id: str) -> str:
    return f"persona_generation_status:{project_id}"


def _workplan_generation_cache_key(project_id: str) -> str:
    return f"workplan_generation_status:{project_id}"


def _set_generation_status(cache_key: str, status: str, message: str = '') -> None:
    cache.set(cache_key, {'status': status, 'message': message}, timeout=_GENERATION_STATUS_TTL_SECONDS)


@shared_task(bind=True)
def generate_report_sections_task(self, project_id: str, section_ids: list[str], custom_instruction: str = '') -> dict:
    project = Project.objects.get(id=project_id)
    generate_all_sections(project, section_ids, custom_instruction=custom_instruction)
    return {'project_id': project_id, 'sections_queued': len(section_ids)}


@shared_task(bind=True)
def regenerate_report_section_task(self, project_id: str, section_id: str, custom_instruction: str = '') -> dict:
    generate_report_section(project_id, section_id, custom_instruction=custom_instruction)
    return {'project_id': project_id, 'section_id': section_id}


@shared_task(bind=True)
def generate_priority_notes_task(self, project_id: str) -> dict:
    generated = generate_notes_for_project(project_id)
    return {'project_id': project_id, 'generated': generated}


@shared_task(bind=True)
def generate_personas_task(self, project_id: str) -> dict:
    from ner.services.persona_generator import generate_personas_for_project
    cache_key = _persona_generation_cache_key(project_id)
    _set_generation_status(cache_key, 'running', 'Persona generation is in progress.')
    try:
        count = generate_personas_for_project(project_id)
        _set_generation_status(cache_key, 'completed', f'Generated {count} persona(s).')
        return {'project_id': project_id, 'personas_created': count}
    except Exception as exc:
        logger.warning("Persona generation failed for %s: %s", project_id, exc)
        _set_generation_status(cache_key, 'error', str(exc))
        return {'project_id': project_id, 'error': str(exc)}


@shared_task(bind=True)
def generate_workplan_task(self, project_id: str) -> dict:
    from ner.services.workplan_generator import generate_workplan_for_project, WorkplanGenerationError
    cache_key = _workplan_generation_cache_key(project_id)
    _set_generation_status(cache_key, 'running', 'Workplan generation is in progress.')
    try:
        count = generate_workplan_for_project(project_id)
        _set_generation_status(cache_key, 'completed', f'Generated {count} workplan component(s).')
        return {'project_id': project_id, 'components_created': count}
    except WorkplanGenerationError as e:
        logger.warning("Workplan generation failed for %s: %s", project_id, e)
        _set_generation_status(cache_key, 'error', str(e))
        return {'project_id': project_id, 'error': str(e)}
    except Exception as exc:
        logger.warning("Workplan generation failed for %s: %s", project_id, exc)
        _set_generation_status(cache_key, 'error', str(exc))
        return {'project_id': project_id, 'error': str(exc)}
