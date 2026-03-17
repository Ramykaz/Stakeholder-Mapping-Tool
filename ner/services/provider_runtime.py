"""Shared provider runtime behaviors: retries, rate-limit handling, and config errors."""

from __future__ import annotations

import time
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class ProviderConfigError(RuntimeError):
    """Raised when provider credentials/configuration are missing or invalid."""

    provider: str
    detail: str

    def __str__(self) -> str:
        return f"{self.provider}: {self.detail}"


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


def run_with_retry(provider: str, func, *, retries: int = 3, base_delay_seconds: float = 1.0):
    """Run provider call with bounded retries for transient failures."""
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return func()
        except ProviderConfigError:
            raise
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if is_auth_config_error(exc):
                raise ProviderConfigError(provider=provider, detail=str(exc)) from exc
            if attempt >= retries or not is_rate_limit_error(exc):
                raise
            time.sleep(base_delay_seconds * (2 ** (attempt - 1)))
    if last_error is not None:
        raise last_error
    raise RuntimeError(f"Unexpected retry failure for provider {provider}")
