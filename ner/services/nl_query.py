"""Natural language query detection and LLM-backed answer generation."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ingestion.models import Project

logger = logging.getLogger(__name__)

_QUESTION_WORDS = frozenset({
    'who', 'what', 'when', 'where', 'why', 'how', 'which', 'whose', 'whom',
    'is', 'are', 'was', 'were', 'does', 'do', 'did', 'can', 'could',
    'should', 'would', 'will', 'has', 'have', 'had',
})

_PROMPT_PATH = Path('prompts/nl_query_rag.txt')


def is_nl_question(query: str) -> bool:
    """Return True if the query looks like a natural language question.

    Detection rules (either is sufficient):
    - First token (lowercased) is a known question word
    - Token count exceeds 3 (phrase-length threshold)
    """
    tokens = query.split()
    if len(tokens) > 3:
        return True
    if tokens and tokens[0].lower().rstrip('?') in _QUESTION_WORDS:
        return True
    return False


def _load_prompt_template() -> str:
    try:
        return _PROMPT_PATH.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        logger.warning("NL query prompt not found at %s", _PROMPT_PATH)
        return (
            "Answer the following question based ONLY on the document excerpts provided.\n\n"
            "PROJECT: {project_name}\nQUESTION: {question}\n\nEXCERPTS:\n{chunks}\n\nAnswer:"
        )


def _call_provider(prompt: str, provider: str, model: str, max_tokens: int = 512) -> str:
    """Make a plain-text LLM completion using the resolved provider."""
    provider = provider.strip().lower()

    if provider == 'groq':
        from groq import Groq
        client = Groq(api_key=os.environ.get('GROQ_API_KEY', ''))
        resp = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=max_tokens,
            temperature=0.2,
        )
        return resp.choices[0].message.content.strip()

    if provider == 'openai':
        from openai import OpenAI
        client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY', ''))
        resp = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=max_tokens,
            temperature=0.2,
        )
        return resp.choices[0].message.content.strip()

    if provider == 'azure_openai':
        from openai import AzureOpenAI
        from django.conf import settings as django_settings
        client = AzureOpenAI(
            api_key=os.environ.get('AZURE_OPENAI_API_KEY', ''),
            azure_endpoint=getattr(django_settings, 'AZURE_OPENAI_ENDPOINT', ''),
            api_version='2024-02-01',
        )
        deployment = getattr(django_settings, 'AZURE_OPENAI_DEPLOYMENT', model)
        resp = client.chat.completions.create(
            model=deployment,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=max_tokens,
            temperature=0.2,
        )
        return resp.choices[0].message.content.strip()

    if provider == 'gemini':
        import google.generativeai as genai
        genai.configure(api_key=os.environ.get('GEMINI_API_KEY', ''))
        gemini_model = genai.GenerativeModel(model)
        resp = gemini_model.generate_content(prompt)
        return resp.text.strip()

    raise ValueError(f"Unsupported provider: {provider}")


def answer_nl_query(
    project: 'Project',
    question: str,
    chunk_texts: list[str],
    provider: str,
    model: str,
) -> str:
    """Generate an LLM answer grounded in retrieved document chunks.

    Returns the answer text or a graceful fallback message.
    """
    template = _load_prompt_template()
    chunks_block = '\n\n---\n\n'.join(chunk_texts) if chunk_texts else '(No relevant document excerpts found.)'
    prompt = template.format(
        project_name=project.name,
        question=question,
        chunks=chunks_block,
    )

    try:
        return _call_provider(prompt, provider, model, max_tokens=1024)
    except Exception:
        logger.exception("NL query LLM call failed", extra={'project_id': str(project.id)})
        return 'Unable to generate an answer right now. Please try again.'
