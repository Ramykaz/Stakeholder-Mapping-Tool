"""Test suite for entity extraction pipeline."""

import pytest
from unittest.mock import patch, MagicMock
from uuid import uuid4
from django.test import TestCase
from ingestion.models import Document, Chunk
from ner.models import Entity
from ner.services.pipeline import extract_entities_for_document


class TestExtractEntitiesForDocument(TestCase):
    """Test entity extraction pipeline orchestration."""

    def setUp(self):
        """Create test document and chunks."""
        self.document = Document.objects.create(
            id=uuid4(),
            filename="test.pdf",
            format="pdf",
            status="completed",
        )
        self.chunk1 = Chunk.objects.create(
            document=self.document,
            text="John Doe works at UNDP.",
        )
        self.chunk2 = Chunk.objects.create(
            document=self.document,
            text="They are located in New York.",
        )

    def test_document_not_found(self):
        """Test 404 when document doesn't exist."""
        non_existent_id = uuid4()

        with pytest.raises(Document.DoesNotExist):
            extract_entities_for_document(str(non_existent_id))

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_extract_entities_success(self, mock_extract):
        """Test successful extraction for document with chunks."""
        # Mock Groq responses
        mock_extract.side_effect = [
            {
                'entities': [
                    {'entity_type': 'PERSON', 'text': 'John Doe', 'confidence': 0.95},
                    {'entity_type': 'ORGANIZATION', 'text': 'UNDP', 'confidence': 0.98},
                ]
            },
            {
                'entities': [
                    {'entity_type': 'LOCATION', 'text': 'New York', 'confidence': 0.92},
                ]
            },
        ]

        result = extract_entities_for_document(str(self.document.id))

        assert result['entities_created'] == 3
        assert Entity.objects.filter(document_id=self.document.id).count() == 3

    @patch.dict('os.environ', {'GROQ_API_KEY': ''})
    def test_missing_groq_api_key(self):
        """Test error when GROQ_API_KEY not set."""
        with pytest.raises(RuntimeError, match="GROQ_API_KEY"):
            extract_entities_for_document(str(self.document.id))

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_clean_slate_replacement(self, mock_extract):
        """Test that extraction replaces all existing entities."""
        # Create existing entities
        Entity.objects.create(
            entity_type='PERSON',
            canonical_name='Old Person',
            document_id=self.document.id,
            confidence=0.8,
        )
        Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Old Org',
            document_id=self.document.id,
            confidence=0.8,
        )

        assert Entity.objects.filter(document_id=self.document.id).count() == 2

        # Mock new extraction
        mock_extract.side_effect = [
            {'entities': [{'entity_type': 'PERSON', 'text': 'New Person', 'confidence': 0.9}]},
            {'entities': []},
        ]

        result = extract_entities_for_document(str(self.document.id))

        # Should have only 1 new entity (old ones deleted)
        assert result['entities_created'] == 1
        assert Entity.objects.filter(document_id=self.document.id).count() == 1

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_rate_limit_error(self, mock_extract):
        """Test handling of rate limit errors."""
        mock_extract.side_effect = ValueError("API rate limit exceeded")

        with pytest.raises(ValueError, match="rate limit"):
            extract_entities_for_document(str(self.document.id))

        # Ensure no entities were persisted
        assert Entity.objects.filter(document_id=self.document.id).count() == 0

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_no_chunks(self, mock_extract):
        """Test document with no chunks."""
        doc_no_chunks = Document.objects.create(
            filename="empty.pdf",
            format="pdf",
            status="completed",
        )

        result = extract_entities_for_document(str(doc_no_chunks.id))

        assert result['entities_created'] == 0
