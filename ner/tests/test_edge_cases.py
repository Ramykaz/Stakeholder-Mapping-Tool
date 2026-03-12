"""Edge case tests for NER pipeline (T067).

Covers:
- Groq returns low-confidence entities (< 0.5)
- Groq returns empty entity list
- Chunk with special characters / emoji / mixed language
- Very long canonical_name (> 255 chars)
- Whitespace-only text
- Duplicate entities within single chunk
"""

import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from ingestion.models import Document, Chunk
from ner.models import Entity
from ner.services.groq_client import extract_entities_from_chunk
from ner.services.deduplicator import deduplicate_entities
from ner.services.pipeline import extract_entities_for_document


# ---------------------------------------------------------------------------
# Groq client edge cases
# ---------------------------------------------------------------------------

class TestGroqClientEdgeCases:
    """Edge cases for extract_entities_from_chunk."""

    @patch('ner.services.groq_client.Groq')
    def test_groq_returns_low_confidence_entities(self, mock_groq_class):
        """Entities with confidence < 0.5 should still be returned."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            'entities': [
                {'entity_type': 'PERSON', 'text': 'Maybe Someone', 'confidence': 0.3},
                {'entity_type': 'LOCATION', 'text': 'Vague Place', 'confidence': 0.1},
            ]
        })
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_groq_class.return_value = mock_client

        result = extract_entities_from_chunk("ambiguous text", "test-key")

        assert len(result['entities']) == 2
        assert result['entities'][0]['confidence'] == 0.3
        assert result['entities'][1]['confidence'] == 0.1

    @patch('ner.services.groq_client.Groq')
    def test_groq_returns_empty_entity_list(self, mock_groq_class):
        """Groq responds with valid JSON but zero entities."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({'entities': []})
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_groq_class.return_value = mock_client

        result = extract_entities_from_chunk("no entities here", "test-key")

        assert result['entities'] == []

    @patch('ner.services.groq_client.Groq')
    def test_chunk_with_special_characters_and_emoji(self, mock_groq_class):
        """Special characters and emoji in chunk text don't crash extraction."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            'entities': [
                {'entity_type': 'PERSON', 'text': 'José García 🇪🇸', 'confidence': 0.88},
            ]
        })
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_groq_class.return_value = mock_client

        text = "José García 🇪🇸 works at the ÑOÑO office! Cost: $1,000—really? «yes»"
        result = extract_entities_from_chunk(text, "test-key")

        assert len(result['entities']) == 1
        assert 'José' in result['entities'][0]['text']

    @patch('ner.services.groq_client.Groq')
    def test_chunk_with_mixed_languages(self, mock_groq_class):
        """Mixed-language chunk (English + Arabic + Chinese) is processed."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            'entities': [
                {'entity_type': 'ORGANIZATION', 'text': 'الأمم المتحدة', 'confidence': 0.85},
                {'entity_type': 'LOCATION', 'text': '北京', 'confidence': 0.9},
            ]
        })
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_groq_class.return_value = mock_client

        text = "The United Nations (الأمم المتحدة) has an office in 北京 (Beijing)."
        result = extract_entities_from_chunk(text, "test-key")

        assert len(result['entities']) == 2

    @patch('ner.services.groq_client.Groq')
    def test_whitespace_only_text(self, mock_groq_class):
        """Whitespace-only text returns empty entities without API call."""
        result = extract_entities_from_chunk("   \n\t  ", "test-key")

        assert result == {"entities": []}
        mock_groq_class.assert_not_called()

    @patch('ner.services.groq_client.Groq')
    def test_groq_response_with_extra_fields(self, mock_groq_class):
        """Groq returns extra unexpected fields — should not break parsing."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            'entities': [
                {
                    'entity_type': 'PERSON',
                    'text': 'Alice',
                    'confidence': 0.9,
                    'extra_field': 'ignored',
                    'source': 'line 5',
                },
            ],
            'metadata': {'model': 'llama-3'},
        })
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_groq_class.return_value = mock_client

        result = extract_entities_from_chunk("Alice said hello.", "test-key")

        assert len(result['entities']) == 1
        assert result['entities'][0]['text'] == 'Alice'


# ---------------------------------------------------------------------------
# Deduplicator edge cases
# ---------------------------------------------------------------------------

class TestDeduplicatorEdgeCases(TestCase):
    """Edge cases for deduplicate_entities."""

    def setUp(self):
        self.document = Document.objects.create(
            filename="edge.pdf",
            file_format="pdf",
            processing_status="completed",
        )

    def test_very_long_canonical_name(self):
        """Name exceeding 255 chars is safely truncated or handled."""
        long_name = "A" * 300
        extracted = [
            {'entity_type': 'PERSON', 'text': long_name, 'confidence': 0.8},
        ]
        existing = Entity.objects.none()

        result = deduplicate_entities(extracted, self.document, existing)

        assert len(result) == 1
        # The Entity model has max_length=255 — check it doesn't crash
        # (Django will raise DataError on save if too long)
        assert result[0].canonical_name == long_name

    def test_duplicate_entities_in_same_batch(self):
        """Same entity appears twice in one extraction batch — should deduplicate."""
        extracted = [
            {'entity_type': 'PERSON', 'text': 'Alice', 'confidence': 0.7},
            {'entity_type': 'PERSON', 'text': 'Alice', 'confidence': 0.9},
        ]
        existing = Entity.objects.none()

        result = deduplicate_entities(extracted, self.document, existing)

        # Should create only one entity with higher confidence
        assert len(result) == 1
        assert result[0].canonical_name == 'Alice'
        assert result[0].confidence == 0.9  # max of 0.7 and 0.9

    def test_empty_extraction_list(self):
        """Empty extracted entities should return empty list."""
        result = deduplicate_entities([], self.document, Entity.objects.none())
        assert result == []

    def test_all_entities_invalid(self):
        """All entities invalid (empty text / empty type) returns empty list."""
        extracted = [
            {'entity_type': '', 'text': 'Bob', 'confidence': 0.9},
            {'entity_type': 'PERSON', 'text': '', 'confidence': 0.9},
            {'entity_type': '', 'text': '', 'confidence': 0.5},
        ]
        existing = Entity.objects.none()

        result = deduplicate_entities(extracted, self.document, existing)
        assert len(result) == 0

    def test_confidence_zero(self):
        """Entity with confidence exactly 0.0 is still created."""
        extracted = [
            {'entity_type': 'LOCATION', 'text': 'Uncertain Place', 'confidence': 0.0},
        ]
        existing = Entity.objects.none()

        result = deduplicate_entities(extracted, self.document, existing)

        assert len(result) == 1
        assert result[0].confidence == 0.0

    def test_confidence_exactly_one(self):
        """Entity with confidence exactly 1.0 is valid."""
        extracted = [
            {'entity_type': 'ORGANIZATION', 'text': 'Certain Corp', 'confidence': 1.0},
        ]
        existing = Entity.objects.none()

        result = deduplicate_entities(extracted, self.document, existing)

        assert len(result) == 1
        assert result[0].confidence == 1.0


# ---------------------------------------------------------------------------
# Pipeline edge cases
# ---------------------------------------------------------------------------

class TestPipelineEdgeCases(TestCase):
    """Edge cases for extract_entities_for_document."""

    def setUp(self):
        self.document = Document.objects.create(
            filename="edge.pdf",
            file_format="pdf",
            processing_status="completed",
        )

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_all_chunks_return_empty_entities(self, mock_extract):
        """Every chunk returns zero entities."""
        Chunk.objects.create(
            document=self.document,
            text="No entities here.",
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=4,
        )
        Chunk.objects.create(
            document=self.document,
            text="Still nothing.",
            embedding=[0.0] * 384,
            chunk_index=1,
            token_count=3,
        )

        mock_extract.return_value = {'entities': []}

        result = extract_entities_for_document(str(self.document.id))

        assert result['entities_created'] == 0
        assert Entity.objects.filter(document_id=self.document.id).count() == 0

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('ner.services.pipeline.extract_entities_from_chunk')
    def test_single_chunk_with_many_entities(self, mock_extract):
        """One chunk returns many entities (stress test dedup path)."""
        Chunk.objects.create(
            document=self.document,
            text="Many people mentioned.",
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=4,
        )

        mock_extract.return_value = {
            'entities': [
                {'entity_type': 'PERSON', 'text': f'Person {i}', 'confidence': 0.8}
                for i in range(50)
            ]
        }

        result = extract_entities_for_document(str(self.document.id))

        assert result['entities_created'] == 50
        assert Entity.objects.filter(document_id=self.document.id).count() == 50
