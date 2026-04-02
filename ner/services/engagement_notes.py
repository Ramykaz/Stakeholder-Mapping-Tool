from pathlib import Path

from django.conf import settings as django_settings
from django.db import close_old_connections, models

from ingestion.models import Project
from ner.models import EngagementNote, Entity, ProjectSMQResponse, Relation
from ner.services.nl_query import _call_provider
from ner.services.priority_table import compute_priority_scores
from ner.services.semantic_search import search_chunks_for_entity


def generate_notes_for_project(project_id: str) -> int:
    close_old_connections()

    project = Project.objects.filter(id=project_id).first()
    if not project:
        return 0

    top_rows = compute_priority_scores(project)[:50]

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

    provider = (project.provider or django_settings.NER_DEFAULT_PROVIDER).strip().lower()
    model = (project.model or '').strip()
    if not model:
        model = django_settings.NER_PROVIDER_MODEL_ALLOWLIST.get(provider, [django_settings.NER_DEFAULT_MODEL])[0]

    generated = 0
    for row in top_rows:
        entity = Entity.objects.filter(id=row['entity_id'], project=project).first()
        if not entity:
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
        except Exception:
            note_text = ''

        if not note_text:
            continue

        EngagementNote.objects.update_or_create(
            project=project,
            entity=entity,
            defaults={'note_text': note_text},
        )
        generated += 1

    close_old_connections()
    return generated
