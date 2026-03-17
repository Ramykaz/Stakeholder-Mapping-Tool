"""Normalized provider DTOs for joint extraction requests and responses."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderRelationshipType:
    name: str
    directional: bool


@dataclass(frozen=True)
class ProviderExtractionRequest:
    chunk_text: str
    concept_note: str | None
    entity_labels: list[str]
    relationship_types: list[ProviderRelationshipType]
    provider: str
    model: str


@dataclass(frozen=True)
class ProviderEntityResult:
    text: str
    label: str
    confidence: float | None = None


@dataclass(frozen=True)
class ProviderRelationshipResult:
    source_text: str
    type: str
    target_text: str
    confidence: float | None = None


@dataclass(frozen=True)
class ProviderUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    cost_usd: float = 0.0


@dataclass(frozen=True)
class ProviderExtractionResponse:
    entities: list[ProviderEntityResult]
    relationships: list[ProviderRelationshipResult]
    usage: ProviderUsage
