"""Service for detecting and flagging stale report sections after new document extraction."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def flag_stale_report_sections(project_id: str) -> int:
    """
    Set status='stale' for all ReportSection rows with status='done' for the project.
    Also sets project.stakeholder_table_stale = True.

    Only 'done' sections are flagged — pending, generating, error, and already-stale
    sections are left unchanged.

    Returns count of sections flagged.
    """
    from ner.models import ReportSection
    from ingestion.models import Project

    updated = ReportSection.objects.filter(
        project_id=project_id,
        status=ReportSection.STATUS_DONE,
    ).update(status=ReportSection.STATUS_STALE)

    if updated > 0:
        try:
            project = Project.objects.get(id=project_id)
            project.stakeholder_table_stale = True
            project.save(update_fields=['stakeholder_table_stale'])
        except Project.DoesNotExist:
            logger.warning("flag_stale_report_sections: project %s not found", project_id)

    logger.info(
        "flag_stale_report_sections: flagged %d sections as stale for project %s",
        updated,
        project_id,
    )
    return updated
