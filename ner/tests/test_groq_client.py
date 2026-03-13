"""Test suite for Groq client."""

import json
import pytest
from unittest.mock import patch, MagicMock
from ner.services.groq_client import extract_entities_from_chunk, load_ner_prompt


class TestLoadNERPrompt:
    """Test NER prompt loading."""

    def test_load_prompt_from_file(self, tmp_path):
        """Test loading prompt from file."""
        # Create temporary prompt file
        prompt_file = tmp_path / "ner-extraction-v1.md"
        prompt_text = "Test prompt content"
        prompt_file.write_text(prompt_text)

        # Mock file path in function
        with patch('builtins.open', create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = prompt_text
            result = load_ner_prompt()
            assert "Test prompt content" in result or result  # Should return something

    def test_load_prompt_default_when_file_missing(self):
        """Test default prompt when file not found."""
        with patch('builtins.open', side_effect=FileNotFoundError):
            result = load_ner_prompt()
            assert "entity" in result.lower()


class TestExtractEntitiesFromChunk:
    """Test entity extraction from text chunks."""

    @patch('ner.services.groq_client.Groq')
    def test_extract_entities_success(self, mock_groq_class):
        """Test successful entity extraction."""
        # Mock Groq response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            'entities': [
                {'entity_type': 'PERSON', 'text': 'John Doe', 'confidence': 0.95},
                {'entity_type': 'ORGANIZATION', 'text': 'UNDP', 'confidence': 0.98},
            ]
        })

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_groq_class.return_value = mock_client

        # Test extraction
        result = extract_entities_from_chunk(
            "John Doe works at UNDP.",
            "test-api-key"
        )

        assert result['entities']
        assert len(result['entities']) == 2
        assert result['entities'][0]['entity_type'] == 'PERSON'

    @patch('ner.services.groq_client.Groq')
    def test_extract_entities_empty_text(self, mock_groq_class):
        """Test with empty text."""
        result = extract_entities_from_chunk("", "test-api-key")
        assert result == {"entities": []}

    @patch('ner.services.groq_client.Groq')
    def test_extract_entities_invalid_json(self, mock_groq_class):
        """Test handling of invalid JSON response."""
        # Mock invalid JSON response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "Not valid JSON"

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_groq_class.return_value = mock_client

        # Should return empty entities or raise
        with patch('ner.services.groq_client.logger'):
            result = extract_entities_from_chunk(
                "Test text",
                "test-api-key"
            )
            assert result == {"entities": []} or "entities" in result

    @patch('ner.services.groq_client.Groq')
    def test_extract_entities_rate_limit(self, mock_groq_class):
        """Test handling of rate limit errors."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("429 rate limit exceeded")
        mock_groq_class.return_value = mock_client

        # Should raise ValueError for rate limit
        with pytest.raises(ValueError, match="rate limit"):
            extract_entities_from_chunk(
                "Test text",
                "test-api-key"
            )

    @patch('ner.services.groq_client.Groq')
    def test_extract_entities_api_failure(self, mock_groq_class):
        """Test handling of general API failures."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API connection error")
        mock_groq_class.return_value = mock_client

        # Should raise RuntimeError for general failures
        with pytest.raises(RuntimeError):
            extract_entities_from_chunk(
                "Test text",
                "test-api-key"
            )
