"""Test suite for entity deduplication."""

import pytest
from unittest.mock import MagicMock
from uuid import uuid4
from ner.services.deduplicator import deduplicate_entities
from ner.models import Entity


class TestDeduplicateEntities:
    """Test deduplication of extracted entities."""

    def test_deduplicate_new_entities(self):
        """Test all entities are new (no existing)."""
        document_id = uuid4()
        extracted = [
            {'entity_type': 'PERSON', 'text': 'John', 'confidence': 0.95},
            {'entity_type': 'LOCATION', 'text': 'New York', 'confidence': 0.92},
        ]

        # No existing entities
        existing = Entity.objects.none()

        result = deduplicate_entities(extracted, str(document_id), existing)

        assert len(result) == 2
        assert all(isinstance(e, Entity) for e in result)
        assert result[0].canonical_name == 'John'
        assert result[0].entity_type == 'PERSON'

    def test_deduplicate_merge_duplicates(self):
        """Test merging of duplicate entities by canonical name."""
        document_id = uuid4()

        # Create existing entity
        existing_entity = Entity(
            id=uuid4(),
            entity_type='PERSON',
            canonical_name='John Doe',
            raw_mentions=['John Doe', 'John'],
            confidence=0.85,
            document_id=document_id,
        )

        extracted = [
            {'entity_type': 'PERSON', 'text': 'John Doe', 'confidence': 0.95},
        ]

        # Mock existing queryset
        existing = MagicMock()
        existing.__iter__ = lambda self: iter([existing_entity])

        result = deduplicate_entities(extracted, str(document_id), existing)

        # Should update existing entity, not create new
        assert len(result) == 0  # No new entities to create
        assert existing_entity.confidence == 0.95  # Updated to max

    def test_deduplicate_different_entity_types(self):
        """Test entities with same text but different types are kept separate."""
        document_id = uuid4()
        extracted = [
            {'entity_type': 'PERSON', 'text': 'Washington', 'confidence': 0.8},
            {'entity_type': 'LOCATION', 'text': 'Washington', 'confidence': 0.95},
        ]

        existing = Entity.objects.none()
        result = deduplicate_entities(extracted, str(document_id), existing)

        # Should create both (different entity_type)
        assert len(result) == 2
        types = {e.entity_type for e in result}
        assert 'PERSON' in types and 'LOCATION' in types

    def test_deduplicate_invalid_confidence(self):
        """Test handling of invalid confidence values."""
        document_id = uuid4()
        extracted = [
            {'entity_type': 'PERSON', 'text': 'John', 'confidence': 1.5},  # > 1.0
            {'entity_type': 'LOCATION', 'text': 'Boston', 'confidence': -0.5},  # < 0.0
        ]

        existing = Entity.objects.none()
        result = deduplicate_entities(extracted, str(document_id), existing)

        # Should clamp to [0.0, 1.0]
        assert result[0].confidence <= 1.0
        assert result[1].confidence >= 0.0

    def test_deduplicate_skip_invalid_entities(self):
        """Test skipping of invalid entities (missing fields)."""
        document_id = uuid4()
        extracted = [
            {'entity_type': 'PERSON', 'text': 'John', 'confidence': 0.95},
            {'entity_type': '', 'text': 'Invalid', 'confidence': 0.5},  # Missing type
            {'entity_type': 'LOCATION', 'text': '', 'confidence': 0.8},  # Missing text
        ]

        existing = Entity.objects.none()

        with pytest.mock.patch('ner.services.deduplicator.logger'):
            result = deduplicate_entities(extracted, str(document_id), existing)

        # Should only create valid entity
        assert len(result) == 1
        assert result[0].canonical_name == 'John'
