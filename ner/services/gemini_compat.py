"""Compatibility helpers for Gemini model selection and fallback behavior."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'


def _is_quota_exhausted(message: str) -> bool:
    """True for unrecoverable quota exhaustion (daily/monthly cap, billing required)."""
    return any(kw in message for kw in (
        'billing',
        'free_tier',
        'quota_metric',
        'quota_id',
        'generateRequestsPerDay',
        'generateRequestsPerMinute',
        'plan and billing',
        'upgrade',
    ))

_LEGACY_ALIASES = {
    'gemini-1.5-flash': DEFAULT_GEMINI_MODEL,
    'gemini-1.5-pro': DEFAULT_GEMINI_MODEL,
}


def normalize_gemini_model(model: str | None) -> str:
    raw = (model or '').strip()
    if raw.startswith('models/'):
        raw = raw.split('/', 1)[1]
    if not raw:
        return DEFAULT_GEMINI_MODEL
    return _LEGACY_ALIASES.get(raw, raw)


_GEMINI_TIMEOUT = 90  # seconds — prevents worker from hanging indefinitely


def generate_gemini_text(prompt: str, model: str | None) -> str:
    import time
    import google.generativeai as genai

    genai.configure(api_key=os.environ.get('GEMINI_API_KEY', ''))
    requested = normalize_gemini_model(model)
    fallback = DEFAULT_GEMINI_MODEL
    request_options = {'timeout': _GEMINI_TIMEOUT}

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            response = genai.GenerativeModel(requested).generate_content(
                prompt,
                request_options=request_options,
            )
            break
        except Exception as exc:
            message = str(exc).lower()
            # Model not available — try fallback immediately (no retry)
            if requested != fallback and ('not found' in message or 'not supported' in message):
                logger.warning("Gemini model '%s' unavailable; retrying with '%s'", requested, fallback)
                response = genai.GenerativeModel(fallback).generate_content(
                    prompt,
                    request_options=request_options,
                )
                break
            # Quota exhausted — not recoverable by retrying (free tier or billing cap)
            if _is_quota_exhausted(message):
                raise
            # Temporary rate limit (per-minute TPM) — back off and retry
            if '429' in message or 'resource_exhausted' in message:
                wait = 15.0 * (attempt + 1)
                logger.warning("Gemini rate-limited (attempt %d); retrying in %.0fs", attempt + 1, wait)
                last_exc = exc
                time.sleep(wait)
                continue
            raise
    else:
        if last_exc:
            raise last_exc
        raise RuntimeError('Gemini call failed without captured exception')

    text = getattr(response, 'text', None)
    if text:
        return text.strip()

    candidates = getattr(response, 'candidates', None) or []
    for candidate in candidates:
        parts = getattr(getattr(candidate, 'content', None), 'parts', None) or []
        for part in parts:
            part_text = getattr(part, 'text', None)
            if part_text:
                return str(part_text).strip()

    return ''
