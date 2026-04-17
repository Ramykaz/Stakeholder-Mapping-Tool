"""Utilities for normalizing LLM-generated narrative text quality."""

from __future__ import annotations

import re

from ner.services.content_safety import filter_llm_text


def normalize_llm_text(text: str, *, strip_list_markers: bool = True, _context: str = 'text_quality') -> str:
    """Return clean plain text without markdown/control artifacts.

    Also applies the content safety filter before returning.
    """
    # Apply safety filter first — catches injection / PII before any other processing.
    safe_text = filter_llm_text(text or '', context=_context).text
    cleaned = safe_text.replace('\r\n', '\n').replace('\r', '\n')
    cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'__(.*?)__', r'\1', cleaned)
    cleaned = re.sub(r'`([^`]*)`', r'\1', cleaned)
    cleaned = re.sub(r'^\s{0,3}#{1,6}\s*', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'\1', cleaned)

    normalized_lines: list[str] = []
    for raw_line in cleaned.split('\n'):
        line = raw_line.strip()
        if not line:
            normalized_lines.append('')
            continue

        if strip_list_markers:
            line = re.sub(r'^\s*[-*•●▪◦‣]+\s+', '', line)
            line = re.sub(r'^\s*\d+[\.)]\s+', '', line)

        line = line.replace('*', '')
        line = re.sub(r'\s+', ' ', line).strip()
        if line:
            normalized_lines.append(line)

    compact = '\n'.join(normalized_lines)
    compact = re.sub(r'\n{3,}', '\n\n', compact).strip()
    return compact


def enforce_minimum_specificity(text: str, *, entity_name: str = '') -> str:
    """Light quality guard against ultra-generic responses."""
    candidate = normalize_llm_text(text)
    if not candidate:
        return ''

    lowered = candidate.lower()
    generic_markers = (
        'plays a key role',
        'important role',
        'significant role',
        'in this project',
    )
    word_count = len([token for token in candidate.split() if token.strip()])
    has_entity = bool(entity_name and entity_name.lower() in lowered)
    if word_count < 12 and (not has_entity) and any(marker in lowered for marker in generic_markers) and entity_name:
        return f"{entity_name} appears in project evidence, but available excerpts are limited for a fuller analysis."
    return candidate
