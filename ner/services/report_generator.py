"""Per-section report generation and batch orchestration."""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from django.db import close_old_connections
from django.utils import timezone

from ingestion.models import Project
from ingestion.services.context import get_project_context
from ner.models import Entity, SMQSection, ProjectSMQResponse, ReportSection
from ner.services.nl_query import _call_provider
from ner.services.semantic_search import embed_query, search_chunks

_PROMPT_PATH = Path('prompts/report_section.txt')


def _is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return '429' in msg or 'rate_limit_exceeded' in msg or 'rate limit' in msg


def _is_quota_exhausted(exc: Exception) -> bool:
    from ner.services.gemini_compat import _is_quota_exhausted as _gemini_quota
    return _gemini_quota(str(exc).lower())


def _friendly_error(exc: Exception) -> str:
    """Return a clean, user-readable error message (no raw API payloads)."""
    if _is_quota_exhausted(exc):
        return "API quota exhausted — your free-tier limit has been reached. Switch to a different provider in Project Settings, or enable billing on your API account."
    if _is_rate_limit_error(exc):
        raw = str(exc)
        match = re.search(r'try again in\s*([0-9]+(?:\.[0-9]+)?)s', raw.lower())
        if match:
            wait = int(float(match.group(1))) + 1
            return f"Rate limit reached — please wait {wait} seconds and click Regenerate."
        return "Rate limit reached — please wait a moment and click Regenerate."
    return "Generation failed. Please try again."


def _load_prompt_template() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        return (
            "Write a concise stakeholder report section.\n"
            "Section: {section_title}\n"
            "SMQ Answer: {smq_answer}\n"
            "Project Context: {project_context}\n"
            "Evidence:\n{chunk_excerpts}\n"
            "Include inline citations [Doc: filename, p.chunk_index]."
        )


def generate_report_section(project_id: str, section_id: str, custom_instruction: str = '') -> None:
    close_old_connections()

    project = Project.objects.get(id=project_id)
    section = SMQSection.objects.get(id=section_id)

    report_section, _ = ReportSection.objects.get_or_create(project=project, section=section)
    report_section.status = ReportSection.STATUS_GENERATING
    report_section.error_message = ''
    report_section.save(update_fields=['status', 'error_message', 'updated_at'])

    try:
        response = ProjectSMQResponse.objects.filter(project=project).first()
        answer = None
        if response:
            answer = response.answers.filter(section=section).first()

        query_vector = embed_query(section.title)
        chunks = list(search_chunks(project, query_vector, top_k=10))

        excerpts = []
        citations = []
        for chunk in chunks:
            doc_name = chunk.document.filename if chunk.document_id else 'Unknown document'
            chunk_index = getattr(chunk, 'chunk_index', 0)
            text = (chunk.text or '')
            excerpts.append(f"[Doc: {doc_name}, p.{chunk_index}]\n{text[:700]}")
            citations.append(
                {
                    'doc_name': doc_name,
                    'chunk_id': str(chunk.id),
                    'snippet': text[:200],
                }
            )

        entity_context_rows = list(
            Entity.objects
            .filter(project=project, is_flagged=False)
            .order_by('-mention_count_dedup', '-confidence')
            .values_list('canonical_name', 'entity_type', 'mention_count_dedup')[:12]
        )
        entity_context = '\n'.join(
            f"- {name} ({entity_type}) mentions={mentions}"
            for name, entity_type, mentions in entity_context_rows
            if str(name).strip()
        )

        prompt = _load_prompt_template().format(
            section_title=section.title,
            smq_answer=(answer.answer_text.strip() if answer and answer.answer_text else '(No SMQ answer provided.)'),
            project_context=(get_project_context(project) or '').strip() or '(No project context provided.)',
            chunk_excerpts='\n\n---\n\n'.join(excerpts) if excerpts else '(No supporting excerpts found.)',
            entity_context=entity_context or '(No entity context available.)',
            custom_instruction=(custom_instruction or '').strip() or '(No additional instruction.)',
        )

        provider = (project.provider or '').strip().lower() or 'groq'
        model = (project.model or '').strip()
        if not model:
            from django.conf import settings
            model = settings.NER_PROVIDER_MODEL_ALLOWLIST.get(provider, [settings.NER_DEFAULT_MODEL])[0]

        generated_text = (_call_provider(prompt, provider, model, max_tokens=1400) or '').strip()

        report_section.status = ReportSection.STATUS_DONE
        report_section.generated_text = generated_text
        report_section.citations = citations
        report_section.error_message = ''
        report_section.generated_at = timezone.now()
        report_section.save(
            update_fields=['status', 'generated_text', 'citations', 'error_message', 'generated_at', 'updated_at']
        )
    except Exception as exc:
        report_section.status = ReportSection.STATUS_ERROR
        report_section.error_message = _friendly_error(exc)
        report_section.save(update_fields=['status', 'error_message', 'updated_at'])


def generate_all_sections(project: Project, section_ids: list[str], custom_instruction: str = '') -> None:
    section_ids = [str(section_id) for section_id in section_ids]

    for section_id in section_ids:
        section = SMQSection.objects.get(id=section_id)
        report_section, _ = ReportSection.objects.get_or_create(project=project, section=section)
        report_section.status = ReportSection.STATUS_PENDING
        report_section.error_message = ''
        report_section.generated_text = ''
        report_section.citations = []
        report_section.save(update_fields=['status', 'error_message', 'generated_text', 'citations', 'updated_at'])

    provider = (project.provider or '').strip().lower() or 'groq'
    max_workers = 1 if provider == 'groq' else 4

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        if custom_instruction:
            futures = [
                executor.submit(generate_report_section, str(project.id), section_id, custom_instruction)
                for section_id in section_ids
            ]
        else:
            futures = [
                executor.submit(generate_report_section, str(project.id), section_id)
                for section_id in section_ids
            ]
        for future in futures:
            future.result()
