"""Per-section report generation and batch orchestration."""

from __future__ import annotations

import logging
import os
import re
from difflib import SequenceMatcher
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from django.core.cache import cache
from django.db.models import Count
from django.db import close_old_connections
from django.utils import timezone

from ingestion.models import Project
from ingestion.services.context import get_project_context
from ner.models import Entity, Relation, SMQSection, ProjectSMQResponse, ReportSection
from ner.services.nl_query import _call_provider
from ner.services.provider_factory import resolve_provider_model_for_project
from ner.services.semantic_search import embed_query, search_chunks
from ner.services.text_quality import normalize_llm_text

_PROMPT_PATH = Path('prompts/report_section.txt')
_MAX_SECTION_WORKERS = max(1, int(os.getenv('REPORT_SECTION_MAX_WORKERS', '2')))

logger = logging.getLogger(__name__)


def _sanitize_generated_report_text(text: str) -> str:
    """Normalize generated report text to clean plain structure (no markdown symbols)."""
    return normalize_llm_text(text)


def _replace_initiative_placeholders(text: str, initiative_name: str) -> str:
    name = (initiative_name or '').strip()
    if not name:
        return text or ''
    return re.sub(r'\[\s*(?:the\s+)?initiative\s*\]', name, text or '', flags=re.IGNORECASE)


def _strip_non_document_reference_tokens(text: str) -> str:
    normalized = text or ''
    normalized = re.sub(r'\[\s*Doc\s*:[^\]]+\]', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\[\s*SMQ[^\]]*\]', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\[\s*Project\s+Context[^\]]*\]', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bSMQ_?Answer\.md\b', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bProject_?Context\.md\b', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bSMQ Answer\b', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bProject Context\b', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\s{2,}', ' ', normalized)
    normalized = re.sub(r'\n{3,}', '\n\n', normalized)
    return normalized.strip()


def _truncate_context(text: str, max_chars: int = 1100) -> str:
    value = (text or '').strip()
    if len(value) <= max_chars:
        return value
    return value[:max_chars].rsplit(' ', 1)[0].strip() + ' ...'


def _build_graph_evidence_summary(project: Project) -> str:
    top_entities = list(
        Entity.objects
        .filter(project=project, is_flagged=False)
        .order_by('-mention_count_dedup', '-confidence')
        .values_list('canonical_name', 'entity_type', 'mention_count_dedup')[:15]
    )
    relation_rows = list(
        Relation.objects
        .filter(project=project)
        .values('label', 'source_entity__canonical_name', 'target_entity__canonical_name')
        .annotate(link_count=Count('id'))
        .order_by('-link_count')[:18]
    )

    lines: list[str] = []
    if top_entities:
        lines.append('Top stakeholders by mention volume:')
        for name, entity_type, mentions in top_entities:
            if not str(name).strip():
                continue
            lines.append(f"- {name} ({entity_type}) mentions={int(mentions or 0)}")

    if relation_rows:
        lines.append('Observed relationship patterns in extracted graph:')
        for rel in relation_rows:
            source_name = str(rel.get('source_entity__canonical_name') or '').strip()
            target_name = str(rel.get('target_entity__canonical_name') or '').strip()
            label = str(rel.get('label') or '').strip()
            link_count = int(rel.get('link_count') or 0)
            if not source_name or not target_name:
                continue
            lines.append(f"- {source_name} -> {target_name} ({label}) occurrences={link_count}")

    return '\n'.join(lines).strip() or '(No graph relationship evidence available.)'


def _report_cancel_cache_key(project_id: str) -> str:
    return f"report_generation_cancel:{project_id}"


def _is_report_cancelled(project_id: str) -> bool:
    return bool(cache.get(_report_cancel_cache_key(str(project_id))))


def _is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return '429' in msg or 'rate_limit_exceeded' in msg or 'rate limit' in msg


def _is_quota_exhausted(exc: Exception) -> bool:
    from ner.services.gemini_compat import _is_quota_exhausted as _gemini_quota
    return _gemini_quota(str(exc).lower())


def _is_db_capacity_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        'maxclientsinsessionmode' in msg
        or 'max clients reached' in msg
        or 'too many clients' in msg
        or 'remaining connection slots are reserved' in msg
    )


def _friendly_error(exc: Exception) -> str:
    """Return a clean, user-readable error message (no raw API payloads)."""
    if _is_db_capacity_error(exc):
        return (
            "Database is temporarily busy. Please wait a moment and click Regenerate "
            "(or reduce concurrent report jobs in settings)."
        )
    if _is_quota_exhausted(exc):
        return "API quota exhausted — your free-tier limit has been reached. Switch to a different provider in Project Settings, or enable billing on your API account."
    if _is_rate_limit_error(exc):
        raw = str(exc)
        match = re.search(r'try again in\s*([0-9]+(?:\.[0-9]+)?)s', raw.lower())
        if match:
            wait = int(float(match.group(1))) + 1
            return f"Rate limit reached — please wait {wait} seconds and click Regenerate."
        return "Rate limit reached — please wait a moment and click Regenerate."
    details = str(exc).strip()
    return f"Generation failed: {details}" if details else "Generation failed. Please try again."


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


def _build_report_prompt(
    *,
    template: str,
    section_title: str,
    smq_answer: str,
    project_context: str,
    graph_context: str,
    custom_instruction: str,
    excerpts: list[str],
) -> str:
    base_prompt = template.format(
        section_title=section_title,
        smq_answer=smq_answer,
        project_context=project_context,
        chunk_excerpts='\n\n---\n\n'.join(excerpts) if excerpts else '(No supporting excerpts found.)',
        entity_context=graph_context or '(No graph context available.)',
        custom_instruction=(custom_instruction or '').strip() or '(No additional instruction.)',
    )
    return (
        f"{base_prompt}\n\n"
        "Additional requirements:\n"
        "- Produce a substantive analysis, not a paraphrase of the SMQ answer or project context.\n"
        "- Use evidence IDs in square brackets (for example: [1], [2]) for factual claims.\n"
        "- Integrate stakeholder actors, relationship patterns, and document-level differences.\n"
        "- Explicitly connect initiative goals to extracted graph evidence (who influences whom, where leverage exists, where gaps exist).\n"
        "- Do NOT include citations to SMQ or project context (forbidden: [Doc: SMQ Answer], [Doc: Project Context], SMQ_Answer.md, Project_Context.md).\n"
        "- Avoid repeating the prompt labels \"SMQ\" and \"Project Context\" in the final narrative.\n"
        "- Write at least 7 analytical paragraphs with concrete findings, tensions, risks, and implementation implications."
    )


def _is_low_quality_report(generated_text: str, smq_answer: str, project_context: str) -> bool:
    words = [token for token in re.split(r'\s+', generated_text or '') if token.strip()]
    if len(words) < 420:
        return True

    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', generated_text or '') if p.strip()]
    if len(paragraphs) < 7:
        return True

    normalized_generated = (generated_text or '').strip().lower()
    normalized_smq = (smq_answer or '').strip().lower()
    normalized_context = (project_context or '').strip().lower()
    if not normalized_generated or not normalized_smq:
        return '[doc:' in normalized_generated

    if '[doc:' in normalized_generated:
        return True
    if 'smq_answer.md' in normalized_generated or 'project_context.md' in normalized_generated:
        return True
    if 'smq answer' in normalized_generated or 'project context' in normalized_generated:
        return True

    smq_similarity = SequenceMatcher(None, normalized_generated, normalized_smq).ratio()
    context_similarity = SequenceMatcher(None, normalized_generated, normalized_context).ratio() if normalized_context else 0.0
    return smq_similarity >= 0.78 or context_similarity >= 0.68


def generate_report_section(project_id: str, section_id: str, custom_instruction: str = '') -> None:
    close_old_connections()
    report_section = None
    project = None
    section = None

    try:
        if _is_report_cancelled(project_id):
            return

        project = Project.objects.get(id=project_id)
        section = SMQSection.objects.get(id=section_id)
        initiative_name = (getattr(getattr(project, 'initiative_profile', None), 'initiative_name', '') or project.name or '').strip()

        report_section, _ = ReportSection.objects.get_or_create(project=project, section=section)
        report_section.status = ReportSection.STATUS_GENERATING
        report_section.error_message = ''
        report_section.save(update_fields=['status', 'error_message', 'updated_at'])

        response = ProjectSMQResponse.objects.filter(project=project).first()
        answer = None
        if response:
            answer = response.answers.filter(section=section).first()

        query_vector = embed_query(section.title)
        chunks = list(search_chunks(project, query_vector, top_k=10))

        excerpt_rows: list[tuple[str, dict]] = []
        citations = []
        for evidence_index, chunk in enumerate(chunks, start=1):
            doc_name = chunk.document.filename if chunk.document_id else 'Unknown document'
            chunk_index = getattr(chunk, 'chunk_index', 0)
            text = (chunk.text or '')
            citation = {
                'ref_id': evidence_index,
                'doc_name': doc_name,
                'chunk_id': str(chunk.id),
                'chunk_index': int(chunk_index),
                'snippet': text[:200],
            }
            citations.append(citation)
            excerpt_rows.append((f"[{evidence_index}] {doc_name} (chunk {chunk_index})\n{text}", citation))

        graph_context = _build_graph_evidence_summary(project)

        prompt_template = _load_prompt_template()
        smq_answer = _truncate_context(answer.answer_text if answer and answer.answer_text else '(No SMQ answer provided.)', 950)
        project_context = _truncate_context((get_project_context(project) or '').strip() or '(No project context provided.)', 1200)

        provider_config = resolve_provider_model_for_project(project)
        provider = provider_config.provider
        model = provider_config.model

        if _is_report_cancelled(project_id):
            report_section.status = ReportSection.STATUS_ERROR
            report_section.error_message = 'Generation stopped by user.'
            report_section.save(update_fields=['status', 'error_message', 'updated_at'])
            return

        generated_text = ''
        selected_citations: list[dict] = []
        attempt_settings = [
            (12, 760, 2000),
            (10, 620, 2600),
            (8, 520, 3200),
        ]
        for max_excerpts, max_excerpt_chars, max_completion_tokens in attempt_settings:
            selected_rows = excerpt_rows[:max_excerpts]
            prompt_excerpts = [row[0][:max_excerpt_chars] for row in selected_rows]
            prompt = _build_report_prompt(
                template=prompt_template,
                section_title=section.title,
                smq_answer=smq_answer,
                project_context=project_context,
                graph_context=graph_context,
                custom_instruction=custom_instruction,
                excerpts=prompt_excerpts,
            )
            attempt_text = (_call_provider(prompt, provider, model, max_tokens=max_completion_tokens) or '').strip()
            attempt_text = _sanitize_generated_report_text(attempt_text)
            attempt_text = _replace_initiative_placeholders(attempt_text, initiative_name)
            attempt_text = _strip_non_document_reference_tokens(attempt_text)
            if attempt_text.strip() and not _is_low_quality_report(attempt_text, smq_answer, project_context):
                generated_text = attempt_text
                selected_citations = [row[1] for row in selected_rows]
                break

            if attempt_text.strip() and not generated_text.strip():
                generated_text = attempt_text
                selected_citations = [row[1] for row in selected_rows]

        if not generated_text.strip():
            report_section.status = ReportSection.STATUS_ERROR
            report_section.error_message = (
                'Generation returned empty content. Please click Regenerate or switch provider/model in Project Settings.'
            )
            report_section.citations = selected_citations or citations
            report_section.save(update_fields=['status', 'error_message', 'citations', 'updated_at'])
            return

        if _is_report_cancelled(project_id):
            report_section.status = ReportSection.STATUS_ERROR
            report_section.error_message = 'Generation stopped by user.'
            report_section.save(update_fields=['status', 'error_message', 'updated_at'])
            return

        report_section.status = ReportSection.STATUS_DONE
        report_section.generated_text = generated_text
        report_section.citations = selected_citations or citations
        report_section.error_message = ''
        report_section.generated_at = timezone.now()
        report_section.save(
            update_fields=['status', 'generated_text', 'citations', 'error_message', 'generated_at', 'updated_at']
        )
    except Exception as exc:
        try:
            if report_section is None and project is not None and section is not None:
                report_section, _ = ReportSection.objects.get_or_create(project=project, section=section)

            if report_section is not None:
                report_section.status = ReportSection.STATUS_ERROR
                report_section.error_message = _friendly_error(exc)
                report_section.save(update_fields=['status', 'error_message', 'updated_at'])
            else:
                logger.exception(
                    "Failed to generate report section %s for project %s before status row creation",
                    section_id,
                    project_id,
                )
        except Exception:
            logger.exception(
                "Failed to persist report generation error for section %s in project %s",
                section_id,
                project_id,
            )


def generate_all_sections(project: Project, section_ids: list[str], custom_instruction: str = '') -> None:
    section_ids = [str(section_id) for section_id in section_ids]

    for section_id in section_ids:
        if _is_report_cancelled(str(project.id)):
            return
        section = SMQSection.objects.get(id=section_id)
        report_section, _ = ReportSection.objects.get_or_create(project=project, section=section)
        report_section.status = ReportSection.STATUS_PENDING
        report_section.error_message = ''
        report_section.generated_text = ''
        report_section.citations = []
        report_section.save(update_fields=['status', 'error_message', 'generated_text', 'citations', 'updated_at'])

    provider = resolve_provider_model_for_project(project).provider
    max_workers = 1 if provider == 'groq' else _MAX_SECTION_WORKERS

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        if _is_report_cancelled(str(project.id)):
            return
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
            try:
                future.result()
            except Exception:
                logger.exception(
                    "One report section worker failed for project %s; remaining sections continue",
                    project.id,
                )
