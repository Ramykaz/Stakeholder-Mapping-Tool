"""LLM output content safety filter.

Provides a lightweight, regex-based filter that runs on every LLM response
before it reaches the user. No external API required — deterministic and
zero-latency overhead.

Catches:
- Prompt injection preambles (attempt to hijack the response)
- Credential/secret leakage patterns in generated text
- Common self-harm / crisis trigger phrases
- PII patterns (SSN, credit cards) appearing verbatim in generated text

All flagged events are logged as warnings and, when Sentry is active,
attached as breadcrumbs for traceability.
"""

from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Pattern definitions
# ─────────────────────────────────────────────────────────────────────────────

# Prompt injection preambles — model being instructed to ignore its prior context.
_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r'ignore\s+(all\s+)?previous\s+instructions?', re.IGNORECASE),
    re.compile(r'disregard\s+(all\s+)?previous\s+(instructions?|context)', re.IGNORECASE),
    re.compile(r'forget\s+(all\s+)?previous\s+instructions?', re.IGNORECASE),
    re.compile(r'you\s+are\s+now\s+(a\s+)?(?:DAN|jailbreak)', re.IGNORECASE),
    re.compile(r'\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>', re.IGNORECASE),
    re.compile(r'act\s+as\s+if\s+you\s+(have\s+no|don\'t\s+have)', re.IGNORECASE),
]

# Credential / secret leak patterns — these should never appear in generated text.
_CREDENTIAL_PATTERNS: list[re.Pattern] = [
    re.compile(r'(?:password|passwd|secret|api[_-]?key)\s*[=:]\s*\S{4,}', re.IGNORECASE),
    re.compile(r'Bearer\s+[A-Za-z0-9\-._~+/]{20,}'),
    re.compile(r'(?:sk|pk|rk)-[A-Za-z0-9]{20,}'),  # OpenAI / Stripe key patterns
    re.compile(r'gsk_[A-Za-z0-9]{20,}'),             # Groq key pattern
]

# PII patterns — remove if they appear verbatim in generated text.
_PII_PATTERNS: list[tuple[re.Pattern, str]] = [
    # US SSN: 123-45-6789
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '[SSN REDACTED]'),
    # Credit card: 16-digit groups (Visa/MC/Amex formats)
    (re.compile(r'\b(?:\d[ -]?){13,16}\b'), '[CARD NUMBER REDACTED]'),
]

# Self-harm / crisis triggers — replace with support signpost.
_CRISIS_PATTERNS: list[re.Pattern] = [
    re.compile(r'\b(?:kill\s+(?:your)?self|commit\s+suicide|self[- ]harm(?:ing)?)\b', re.IGNORECASE),
]

_CRISIS_REPLACEMENT = (
    '[Sensitive content filtered. If you or someone you know needs support, '
    'please contact a crisis helpline in your country.]'
)

# Maximum safe output length before truncation (characters).
_MAX_OUTPUT_LENGTH = 16_000


# ─────────────────────────────────────────────────────────────────────────────
# Result type
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FilterResult:
    """Result of applying the content safety filter."""
    safe: bool
    text: str
    reasons: list[str] = field(default_factory=list)

    @property
    def was_modified(self) -> bool:
        return bool(self.reasons)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def filter_llm_text(text: str, *, context: str = '') -> FilterResult:
    """Apply safety filters to LLM-generated text.

    Args:
        text:    The raw LLM output string.
        context: Caller label for logging (e.g. 'nl_query', 'report_section').

    Returns:
        FilterResult with the (possibly cleaned) text and any flagged reasons.
    """
    if not text:
        return FilterResult(safe=True, text='')

    cleaned = text
    reasons: list[str] = []

    # 1. Truncate runaway outputs.
    if len(cleaned) > _MAX_OUTPUT_LENGTH:
        cleaned = cleaned[:_MAX_OUTPUT_LENGTH]
        reasons.append('output_truncated')

    # 2. Prompt injection — strip the injected preamble if found at the start,
    #    or replace inline occurrences.
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(cleaned):
            cleaned = pattern.sub('[FILTERED]', cleaned)
            reasons.append(f'injection_pattern:{pattern.pattern[:40]}')

    # 3. Credential / secret leakage — replace with placeholder.
    for pattern in _CREDENTIAL_PATTERNS:
        if pattern.search(cleaned):
            cleaned = pattern.sub('[CREDENTIAL REDACTED]', cleaned)
            reasons.append('credential_leak')

    # 4. PII redaction.
    for pattern, replacement in _PII_PATTERNS:
        if pattern.search(cleaned):
            cleaned = pattern.sub(replacement, cleaned)
            reasons.append('pii_redacted')

    # 5. Crisis / self-harm triggers.
    for pattern in _CRISIS_PATTERNS:
        if pattern.search(cleaned):
            cleaned = pattern.sub(_CRISIS_REPLACEMENT, cleaned)
            reasons.append('crisis_trigger')

    safe = not bool(reasons)

    if reasons:
        logger.warning(
            "content_safety: filtered LLM output [context=%s reasons=%s]",
            context or 'unknown',
            reasons,
        )
        try:
            import sentry_sdk as _sentry
            _sentry.add_breadcrumb(
                category='content_safety',
                message=f'LLM output filtered [{context}]',
                data={'reasons': reasons},
                level='warning',
            )
        except Exception:  # noqa: BLE001
            pass

    return FilterResult(safe=safe, text=cleaned, reasons=reasons)


def sanitize_entity_text(text: str) -> str:
    """Sanitize entity or relationship label text before storing in the DB.

    - Strips HTML tags
    - Truncates to 500 characters
    - Removes null bytes
    """
    if not text:
        return ''
    cleaned = html.unescape(text)
    cleaned = re.sub(r'<[^>]+>', '', cleaned)  # strip HTML tags
    cleaned = cleaned.replace('\x00', '')       # remove null bytes
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned[:500]
