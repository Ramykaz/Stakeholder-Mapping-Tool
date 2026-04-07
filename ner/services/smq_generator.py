"""SMQ section generation using semantic chunk retrieval + provider abstraction."""

from __future__ import annotations

from pathlib import Path

from ingestion.services.context import get_project_context
from ner.services.nl_query import _call_provider
from ner.services.provider_factory import resolve_provider_model_for_project
from ner.services.semantic_search import embed_query, search_chunks


_PROMPT_PATH = Path('prompts/smq_section_generate.txt')


def _load_prompt_template() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        return (
            "You are generating one section answer for a Stakeholder Mapping Questionnaire.\n"
            "Section: {section_title}\n"
            "Questions: {question_prompts}\n"
            "Project context: {project_context}\n"
            "Analyst notes: {section_notes}\n"
            "Evidence:\n{chunk_excerpts}\n\n"
            "Write a concise evidence-backed answer with inline citations [Doc: filename]."
        )


def generate_smq_section(project, section, notes_text: str = '') -> dict:
    query_vector = embed_query(section.question_prompts or section.title)
    chunks = list(search_chunks(project, query_vector, top_k=8))

    excerpts = []
    chunk_ids_used = []
    citations = []
    for chunk in chunks:
        chunk_ids_used.append(str(chunk.id))
        doc_name = chunk.document.filename if chunk.document_id else 'Unknown document'
        snippet = (chunk.text or '')[:500]
        excerpts.append(f"[Doc: {doc_name}]\n{snippet}")
        citations.append({
            'doc_name': doc_name,
            'chunk_id': str(chunk.id),
            'snippet': (chunk.text or '')[:200],
        })

    prompt = _load_prompt_template().format(
        section_title=section.title,
        question_prompts=section.question_prompts,
        project_context=(get_project_context(project) or '').strip() or '(No project context provided.)',
        section_notes=(notes_text or '').strip() or '(No analyst notes provided.)',
        chunk_excerpts='\n\n---\n\n'.join(excerpts) if excerpts else '(No supporting excerpts found.)',
    )

    provider_config = resolve_provider_model_for_project(project)
    provider = provider_config.provider
    model = provider_config.model

    answer_text = _call_provider(prompt, provider, model, max_tokens=1024)
    return {
        'answer_text': (answer_text or '').strip(),
        'chunk_ids_used': chunk_ids_used,
        'citations': citations,
        'provider': provider,
        'model': model,
    }
