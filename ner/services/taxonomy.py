"""Helpers for retrieving active taxonomy values for extraction payloads."""

from __future__ import annotations

from ner.models import EntityLabel, RelationshipType


def get_active_entity_labels() -> list[str]:
    """Return active entity label names ordered for deterministic prompts."""
    return list(
        EntityLabel.objects.filter(active=True)
        .order_by('display_order', 'name')
        .values_list('name', flat=True)
    )


def get_active_relationship_types() -> list[dict]:
    """Return active relationship types with direction metadata for prompts."""
    rows = (
        RelationshipType.objects.filter(active=True)
        .order_by('display_order', 'name')
        .values('name', 'directional')
    )
    return [{'name': row['name'], 'directional': row['directional']} for row in rows]
