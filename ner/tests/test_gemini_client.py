"""Unit tests for ner.services.gemini_client."""

import json
import pytest
from unittest.mock import MagicMock, patch


class TestExtractJointFromChunk:
    def test_empty_chunk_returns_empty_result(self):
        from ner.services.gemini_client import extract_joint_from_chunk
        result = extract_joint_from_chunk('', api_key='key', model='gemini-2.0-flash')
        assert result['entities'] == []
        assert result['relationships'] == []
        assert result['tokens_input'] == 0
        assert result['cost_usd'] == 0.0

    def test_whitespace_only_chunk_returns_empty(self):
        from ner.services.gemini_client import extract_joint_from_chunk
        result = extract_joint_from_chunk('   ', api_key='key', model='gemini-2.0-flash')
        assert result['entities'] == []

    @patch('ner.services.gemini_client.httpx.post')
    def test_successful_extraction(self, mock_post):
        from ner.services.gemini_client import extract_joint_from_chunk

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'candidates': [{'content': {'parts': [{'text': json.dumps({
                'entities': [{'text': 'UNDP', 'label': 'ORG'}],
                'relationships': [],
            })}]}}],
            'usageMetadata': {'promptTokenCount': 100, 'candidatesTokenCount': 20},
        }
        mock_post.return_value = mock_response

        result = extract_joint_from_chunk('UNDP leads the project.', api_key='key', model='gemini-2.0-flash')

        assert len(result['entities']) == 1
        assert result['tokens_input'] == 100
        assert result['tokens_output'] == 20

    @patch('ner.services.gemini_client.httpx.post')
    def test_404_model_not_found_tries_fallback(self, mock_post):
        """404 response for all versions of the first model falls through to default model."""
        from ner.services.gemini_client import extract_joint_from_chunk

        not_found_response = MagicMock()
        not_found_response.status_code = 404
        not_found_response.text = 'model not found'

        success_response = MagicMock()
        success_response.status_code = 200
        success_response.json.return_value = {
            'candidates': [{'content': {'parts': [{'text': '{"entities":[],"relationships":[]}'}]}}],
            'usageMetadata': {},
        }

        # custom-nonexistent-model → 2 api versions × 404, then DEFAULT model v1beta → 200
        mock_post.side_effect = [not_found_response, not_found_response, success_response]

        result = extract_joint_from_chunk(
            'Some text', api_key='key', model='custom-nonexistent-model'
        )
        assert result['entities'] == []

    @patch('ner.services.gemini_client.httpx.post')
    def test_http_error_raises(self, mock_post):
        from ner.services.gemini_client import extract_joint_from_chunk
        import httpx as real_httpx

        error_response = MagicMock()
        error_response.status_code = 500
        error_response.text = 'Internal server error'
        error_response.raise_for_status.side_effect = real_httpx.HTTPStatusError(
            '500', request=MagicMock(), response=error_response
        )
        mock_post.return_value = error_response

        with pytest.raises(real_httpx.HTTPStatusError):
            extract_joint_from_chunk('Some text', api_key='key', model='gemini-2.0-flash')

    @patch('ner.services.gemini_client.httpx.post')
    def test_malformed_response_returns_empty_entities(self, mock_post):
        """LLM returns valid JSON but without expected keys — should return empty lists."""
        from ner.services.gemini_client import extract_joint_from_chunk

        mock_response = MagicMock()
        mock_response.status_code = 200
        # Valid JSON but no 'entities' or 'relationships' keys
        mock_response.json.return_value = {
            'candidates': [{'content': {'parts': [{'text': '{"status": "ok"}'}]}}],
            'usageMetadata': {},
        }
        mock_post.return_value = mock_response

        result = extract_joint_from_chunk('Some text', api_key='key', model='gemini-2.0-flash')
        assert result['entities'] == []
        assert result['relationships'] == []

    @patch('ner.services.gemini_client.httpx.post')
    def test_concept_note_included_in_prompt(self, mock_post):
        from ner.services.gemini_client import extract_joint_from_chunk

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'candidates': [{'content': {'parts': [{'text': '{"entities":[],"relationships":[]}'}]}}],
            'usageMetadata': {},
        }
        mock_post.return_value = mock_response

        extract_joint_from_chunk(
            'Text chunk',
            api_key='key',
            model='gemini-2.0-flash',
            concept_note='Education reform project',
        )

        call_kwargs = mock_post.call_args
        body = call_kwargs.kwargs.get('json') or call_kwargs[1].get('json', {})
        prompt_text = str(body)
        assert 'Education reform project' in prompt_text
