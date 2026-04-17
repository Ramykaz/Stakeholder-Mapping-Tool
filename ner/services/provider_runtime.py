"""Shared provider runtime behaviors: retries, rate-limit handling, and config errors."""

from __future__ import annotations

import logging
import time
from urllib.parse import urlparse
from dataclasses import dataclass
from decimal import Decimal

import pybreaker
from django.conf import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Per-provider circuit breakers
# Opens after 3 consecutive failures; resets after 60 seconds.
# ─────────────────────────────────────────────────────────────────────────────

def _on_circuit_open(cb: pybreaker.CircuitBreaker) -> None:
    logger.error(
        "circuit_breaker: circuit OPEN for provider=%s — too many recent failures",
        cb.name,
    )
    try:
        import sentry_sdk
        sentry_sdk.capture_message(
            f"Provider circuit breaker opened: {cb.name}",
            level='error',
        )
    except Exception:  # noqa: BLE001
        pass


_CIRCUIT_BREAKERS: dict[str, pybreaker.CircuitBreaker] = {}


def _get_circuit_breaker(provider: str) -> pybreaker.CircuitBreaker:
    """Return (or create) a per-provider CircuitBreaker instance."""
    if provider not in _CIRCUIT_BREAKERS:
        _CIRCUIT_BREAKERS[provider] = pybreaker.CircuitBreaker(
            fail_max=3,
            reset_timeout=60,
            name=provider,
            listeners=[pybreaker.CircuitBreakerListener()],
        )
        _CIRCUIT_BREAKERS[provider].add_listeners(
            type('_OpenListener', (pybreaker.CircuitBreakerListener,), {
                'state_change': lambda self, cb, old, new: (
                    _on_circuit_open(cb) if new.name == 'open' else None
                ),
            })()
        )
    return _CIRCUIT_BREAKERS[provider]


@dataclass
class ProviderConfigError(RuntimeError):
    """Raised when provider credentials/configuration are missing or invalid."""

    provider: str
    detail: str

    def __str__(self) -> str:
        return f"{self.provider}: {self.detail}"


def get_missing_provider_settings(provider: str) -> list[str]:
    """Return missing required setting keys for a given provider."""
    normalized_provider = (provider or '').strip().lower()
    required: list[str] = []

    if normalized_provider == 'groq':
        required = ['GROQ_API_KEY']
    elif normalized_provider == 'openai':
        required = ['OPENAI_API_KEY']
    elif normalized_provider == 'gemini':
        required = ['GEMINI_API_KEY']
    elif normalized_provider == 'azure_openai':
        required = [
            'AZURE_OPENAI_API_KEY',
            'AZURE_OPENAI_ENDPOINT',
            'AZURE_OPENAI_DEPLOYMENT',
        ]
    else:
        return []

    return [key for key in required if not str(getattr(settings, key, '') or '').strip()]


def normalize_azure_endpoint(value: str) -> str:
    """Normalize common Azure endpoint typo variants into a canonical URL."""
    endpoint = str(value or '').strip()
    if endpoint.startswith('https:https://'):
        endpoint = f"https://{endpoint[len('https:https://'):] }"
    elif endpoint.startswith('http:http://'):
        endpoint = f"http://{endpoint[len('http:http://'):] }"
    return endpoint


def validate_provider_runtime_config(provider: str) -> None:
    """Raise ProviderConfigError when selected provider config is incomplete."""
    normalized_provider = (provider or '').strip().lower()
    missing = get_missing_provider_settings(normalized_provider)
    if missing:
        raise ProviderConfigError(
            provider=normalized_provider,
            detail=f"Missing required configuration: {', '.join(missing)}",
        )

    if normalized_provider == 'azure_openai':
        endpoint = normalize_azure_endpoint(getattr(settings, 'AZURE_OPENAI_ENDPOINT', ''))
        parsed = urlparse(endpoint)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc:
            raise ProviderConfigError(
                provider=normalized_provider,
                detail='Invalid AZURE_OPENAI_ENDPOINT format. Expected https://<resource>.openai.azure.com',
            )


def normalize_usage(data: dict | None) -> dict:
    """Ensure provider usage payload always has expected numeric keys."""
    data = data or {}
    return {
        'tokens_input': int(data.get('tokens_input', 0) or 0),
        'tokens_output': int(data.get('tokens_output', 0) or 0),
        'tokens_cached': int(data.get('tokens_cached', 0) or 0),
        'cost_usd': Decimal(str(data.get('cost_usd', 0.0) or 0.0)),
    }


def is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return '429' in msg or 'rate limit' in msg or 'rate_limit' in msg


def is_auth_config_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    markers = [
        'invalid_api_key',
        'authentication',
        'unauthorized',
        'api key',
        'credential',
        'forbidden',
    ]
    return any(marker in msg for marker in markers)


def normalize_provider_error_kind(exc: Exception) -> str:
    """Normalize provider errors into stable categories for UX handling."""
    if is_rate_limit_error(exc):
        return 'rate_limit'
    msg = str(exc).lower()
    connection_markers = (
        'connection error',
        'connection refused',
        'temporary failure in name resolution',
        'name or service not known',
        'failed to resolve',
        'getaddrinfo',
        'ssl',
        'certificate',
    )
    if any(marker in msg for marker in connection_markers):
        return 'configuration'
    if 'timeout' in msg or 'timed out' in msg:
        return 'timeout'
    return 'generic'


def classify_provider_error(exc: Exception) -> str:
    """Backward-compatible classifier used by older call sites."""
    if is_auth_config_error(exc):
        return 'configuration'
    return normalize_provider_error_kind(exc)


def run_with_retry(provider: str, func, *, retries: int = 3, base_delay_seconds: float = 1.0):
    """Run provider call with circuit breaker + bounded retries for transient failures.

    The circuit breaker opens after 3 consecutive failures and rejects calls for
    60 seconds, preventing thundering-herd retries against a degraded provider.
    """
    cb = _get_circuit_breaker(provider)
    last_error: Exception | None = None

    def _call_once():
        for attempt in range(1, retries + 1):
            try:
                return func()
            except ProviderConfigError:
                raise
            except Exception as exc:  # noqa: BLE001
                nonlocal last_error
                last_error = exc
                if is_auth_config_error(exc):
                    raise ProviderConfigError(provider=provider, detail=str(exc)) from exc
                if attempt >= retries or not is_rate_limit_error(exc):
                    raise
                time.sleep(base_delay_seconds * (2 ** (attempt - 1)))
        if last_error is not None:
            raise last_error
        raise RuntimeError(f"Unexpected retry failure for provider {provider}")

    try:
        return cb.call(_call_once)
    except pybreaker.CircuitBreakerError as exc:
        raise ProviderConfigError(
            provider=provider,
            detail='Provider temporarily unavailable — circuit breaker open. Try again in 60 seconds.',
        ) from exc
