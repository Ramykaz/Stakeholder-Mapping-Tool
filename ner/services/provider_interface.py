"""Shared provider protocol for single-call joint extraction."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class RelationshipTypeInput:
    """Runtime relationship type passed to provider extraction calls."""

    name: str
    directional: bool


class ConfigurationError(RuntimeError):
    """Raised when provider-specific runtime configuration is invalid."""


def normalize_provider_test_response(
    *,
    provider: str,
    model: str,
    status: str,
    error_message: str | None = None,
    latency_ms: int = 0,
) -> dict:
    """Normalize provider test endpoint payload shape for frontend consumption."""
    normalized_status = (status or '').strip().lower()
    if normalized_status not in {'ok', 'error'}:
        normalized_status = 'error'

    return {
        'provider': (provider or '').strip(),
        'model': (model or '').strip(),
        'status': normalized_status,
        'error_message': (error_message or None),
        'latency_ms': max(0, int(latency_ms or 0)),
    }


@dataclass(frozen=True)
class JointExtractionRequest:
    """Normalized provider input payload for one chunk."""

    chunk_text: str
    concept_note: str | None
    entity_labels: list[str]
    relationship_types: list[RelationshipTypeInput]
    model: str


class JointExtractionProvider(Protocol):
    """Provider contract for one-call entity+relationship extraction."""

    def extract_joint(self, payload: JointExtractionRequest) -> dict:
        """Return a normalized response with entities and relationships."""
