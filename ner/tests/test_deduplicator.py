"""Test suite for entity deduplication."""

import pytest
from unittest.mock import MagicMock
from uuid import uuid4
from django.test import TestCase
from ingestion.models import Document
from ner.services.deduplicator import deduplicate_entities
from ner.models import Entity


class TestDeduplicateEntities(TestCase):
    """Test deduplication of extracted entities."""

    def setUp(self):
        """Create a test document."""
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
        )

    def test_deduplicate_new_entities(self):
        """Test all entities are new (no existing)."""
        extracted = [
            {'entity_type': 'PERSON', 'text': 'John', 'confidence': 0.95},
            {'entity_type': 'LOCATION', 'text': 'New York', 'confidence': 0.92},
        ]

        # No existing entities
        existing = Entity.objects.none()

        result = deduplicate_entities(extracted, self.document, existing)

        assert len(result) == 2
        assert all(isinstance(e, Entity) for e in result)
        assert result[0].canonical_name == 'John'
        assert result[0].entity_type == 'PERSON'

    def test_deduplicate_merge_duplicates(self):
        """Test merging of duplicate entities by canonical name."""
        # Create existing entity
        existing_entity = Entity.objects.create(
            entity_type='PERSON',
            canonical_name='John Doe',
            raw_mentions=['John Doe', 'John'],
            confidence=0.85,
            document=self.document,
        )

        extracted = [
            {'entity_type': 'PERSON', 'text': 'John Doe', 'confidence': 0.95},
        ]

        existing = Entity.objects.filter(document=self.document)

        result = deduplicate_entities(extracted, self.document, existing)

        # Should update existing entity, not create new
        assert len(result) == 0  # No new entities to create
        assert existing_entity.confidence == 0.95  # Updated to max

    def test_deduplicate_different_entity_types(self):
        """Test entities with same text but different types are kept separate."""
        extracted = [
            {'entity_type': 'PERSON', 'text': 'Washington', 'confidence': 0.8},
            {'entity_type': 'LOCATION', 'text': 'Washington', 'confidence': 0.95},
        ]

        existing = Entity.objects.none()
        result = deduplicate_entities(extracted, self.document, existing)

        # Should create both (different entity_type)
        assert len(result) == 2
        types = {e.entity_type for e in result}
        assert 'PERSON' in types and 'LOCATION' in types

    def test_deduplicate_invalid_confidence(self):
        """Test handling of invalid confidence values."""
        extracted = [
            {'entity_type': 'PERSON', 'text': 'John', 'confidence': 1.5},  # > 1.0
            {'entity_type': 'LOCATION', 'text': 'Boston', 'confidence': -0.5},  # < 0.0
        ]

        existing = Entity.objects.none()
        result = deduplicate_entities(extracted, self.document, existing)

        # Should clamp to [0.0, 1.0]
        assert result[0].confidence <= 1.0
        assert result[1].confidence >= 0.0

    def test_deduplicate_skip_invalid_entities(self):
        """Test skipping of invalid entities (missing fields)."""
        extracted = [
            {'entity_type': 'PERSON', 'text': 'John', 'confidence': 0.95},
            {'entity_type': '', 'text': 'Invalid', 'confidence': 0.5},  # Missing type
            {'entity_type': 'LOCATION', 'text': '', 'confidence': 0.8},  # Missing text
        ]

        existing = Entity.objects.none()

        from unittest.mock import patch
        with patch('ner.services.deduplicator.logger'):
            result = deduplicate_entities(extracted, self.document, existing)

        # Should only create valid entity
        assert len(result) == 1
        assert result[0].canonical_name == 'John'
