"""Shared provider protocol for single-call joint extraction."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class RelationshipTypeInput:
    """Runtime relationship type passed to provider extraction calls."""

    name: str
    directional: bool


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
