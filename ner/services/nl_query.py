"""Natural language query detection and LLM-backed answer generation."""

from __future__ import annotations

import logging
import os
import re
import time
from pathlib import Path
from typing import TYPE_CHECKING

from ner.services.gemini_compat import generate_gemini_text
from ner.services.provider_factory import resolve_provider_model

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

        last_exc: Exception | None = None
        for _attempt in range(4):
            try:
                resp = client.chat.completions.create(
                    model=model,
                    messages=[{'role': 'user', 'content': prompt}],
                    max_tokens=max_tokens,
                    temperature=0.2,
                )
                return resp.choices[0].message.content.strip()
            except Exception as exc:
                msg = str(exc)
                msg_lower = msg.lower()
                if '429' not in msg_lower and 'rate limit' not in msg_lower and 'rate_limit' not in msg_lower:
                    raise

                last_exc = exc
                wait_seconds = 8.0
                match = re.search(r'try again in\s*([0-9]+(?:\.[0-9]+)?)s', msg_lower)
                if match:
                    try:
                        wait_seconds = max(wait_seconds, float(match.group(1)) + 1.0)
                    except ValueError:
                        pass
                logger.warning(
                    "Groq rate-limited for model %s; retrying in %.1fs",
                    model,
                    wait_seconds,
                )
                time.sleep(wait_seconds)

        if last_exc:
            raise last_exc
        raise RuntimeError('Groq call failed without captured exception')

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
        return generate_gemini_text(prompt, model)

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
        provider_config = resolve_provider_model(provider, model)
        return _call_provider(prompt, provider_config.provider, provider_config.model, max_tokens=1024)
    except Exception:
        logger.exception("NL query LLM call failed", extra={'project_id': str(project.id)})
        return 'Unable to generate an answer right now. Please try again.'
