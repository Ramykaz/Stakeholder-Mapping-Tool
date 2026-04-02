from __future__ import annotations

from ingestion.models import Project, InitiativeProfile, ConceptNote


def get_project_context(project: Project) -> str:
    try:
        initiative_profile = project.initiative_profile
    except InitiativeProfile.DoesNotExist:
        initiative_profile = None

    if initiative_profile:
        to_context_string = getattr(initiative_profile, 'to_context_string', None)
        if callable(to_context_string):
            text = (to_context_string() or '').strip()
            if text:
                return text

    try:
        concept_note = project.concept_note
    except ConceptNote.DoesNotExist:
        concept_note = None

    if concept_note:
        text = (concept_note.content or '').strip()
        if text:
            return text

    description = (project.description or '').strip()
    return description
