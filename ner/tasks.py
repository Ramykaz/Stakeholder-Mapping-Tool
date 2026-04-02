from celery import shared_task

from ingestion.models import Project
from ner.services.engagement_notes import generate_notes_for_project
from ner.services.report_generator import generate_all_sections, generate_report_section


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
