"""Test suite for entity extraction pipeline."""

import pytest
from unittest.mock import patch
from uuid import uuid4
from django.test import TestCase
from ingestion.models import Document, Chunk
from ner.models import Entity, NERRun
from ner.services.pipeline import extract_entities_for_document


class TestExtractEntitiesForDocument(TestCase):
    """Test entity extraction pipeline orchestration."""

    def setUp(self):
        """Create test document and chunks."""
        self.document = Document.objects.create(
            filename="test.pdf",
            file_format="pdf",
            processing_status="completed",
        )
        self.chunk1 = Chunk.objects.create(
            document=self.document,
            text="John Doe works at UNDP.",
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=6,
        )
        self.chunk2 = Chunk.objects.create(
            document=self.document,
            text="They are located in New York.",
            embedding=[0.0] * 384,
            chunk_index=1,
            token_count=6,
        )

    def test_document_not_found(self):
        """Test 404 when document doesn't exist."""
        non_existent_id = uuid4()

        with pytest.raises(Document.DoesNotExist):
            extract_entities_for_document(str(non_existent_id))

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline._extract_chunk_entities')
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
    @patch('ner.services.pipeline._extract_chunk_entities')
    def test_clean_slate_replacement(self, mock_extract):
        """Test that extraction replaces all existing entities."""
        # Create existing entities
        Entity.objects.create(
            entity_type='PERSON',
            canonical_name='Old Person',
            document_id=self.document,
            confidence=0.8,
        )
        Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Old Org',
            document_id=self.document,
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
    @patch('ner.services.pipeline._extract_chunk_entities')
    def test_rate_limit_error(self, mock_extract):
        """Test handling of rate limit errors."""
        mock_extract.side_effect = ValueError("API rate limit exceeded")

        with pytest.raises(ValueError, match="rate limit"):
            extract_entities_for_document(str(self.document.id))

        # Ensure no entities were persisted
        assert Entity.objects.filter(document_id=self.document.id).count() == 0

    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-openai-key'})
    @patch('ner.services.pipeline.get_provider')
    def test_openai_provider_dispatch(self, mock_get_provider):
        """OpenAI provider should route through OpenAI client path."""
        mock_provider = mock_get_provider.return_value
        mock_provider.extract_entities.side_effect = [
            {'entities': [{'entity_type': 'PERSON', 'text': 'Jane', 'confidence': 0.9}], 'tokens_input': 10, 'tokens_output': 3, 'tokens_cached': 0},
            {'entities': [], 'tokens_input': 2, 'tokens_output': 1, 'tokens_cached': 0},
        ]

        result = extract_entities_for_document(
            str(self.document.id),
            provider='openai',
            model='gpt-5-mini',
        )

        assert result['entities_created'] == 1
        assert result['provider'] == 'openai'
        assert result['model'] == 'gpt-5-mini'

    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-openai-key'})
    @patch('ner.services.pipeline.get_provider')
    def test_openai_output_uses_existing_entity_schema(self, mock_get_provider):
        """OpenAI extraction output should map into the existing Entity schema."""
        mock_provider = mock_get_provider.return_value
        mock_provider.extract_entities.side_effect = [
            {'entities': [{'entity_type': 'ORGANIZATION', 'text': 'UNDP', 'confidence': 0.88}]},
            {'entities': []},
        ]

        result = extract_entities_for_document(
            str(self.document.id),
            provider='openai',
            model='gpt-5-mini',
        )

        created = Entity.objects.filter(document_id=self.document.id).first()
        assert result['entities_created'] == 1
        assert created is not None
        assert created.entity_type == 'ORGANIZATION'
        assert created.canonical_name == 'UNDP'
        assert 0.0 <= created.confidence <= 1.0

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline._extract_chunk_entities')
    def test_no_chunks(self, mock_extract):
        """Test document with no chunks."""
        doc_no_chunks = Document.objects.create(
            filename="empty.pdf",
            file_format="pdf",
            processing_status="completed",
        )

        result = extract_entities_for_document(str(doc_no_chunks.id))

        assert result['entities_created'] == 0

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline._extract_chunk_entities')
    def test_multiple_runs_are_preserved_in_history(self, mock_extract):
        """Each extraction should create a distinct NERRun record for the same document."""
        mock_extract.side_effect = [
            {'entities': [{'entity_type': 'PERSON', 'text': 'Alice', 'confidence': 0.9}]},
            {'entities': []},
            {'entities': [{'entity_type': 'ORGANIZATION', 'text': 'UNDP', 'confidence': 0.95}]},
            {'entities': []},
        ]

        first = extract_entities_for_document(str(self.document.id), provider='groq', model='llama-3.1-8b-instant')
        second = extract_entities_for_document(str(self.document.id), provider='groq', model='llama-3.1-8b-instant')

        runs = NERRun.objects.filter(document_id=self.document.id).order_by('created_at')
        assert runs.count() == 2
        assert first['run_id'] != second['run_id']
        assert runs[0].status == NERRun.STATUS_COMPLETED
        assert runs[1].status == NERRun.STATUS_COMPLETED
