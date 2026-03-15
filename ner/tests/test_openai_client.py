"""Tests for OpenAI NER client."""

import json
from unittest.mock import MagicMock, patch

import pytest

from ner.services.openai_client import extract_entities_from_chunk


@patch('ner.services.openai_client.OpenAI')
def test_extract_entities_openai_success(mock_openai_class):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = json.dumps(
        {'entities': [{'entity_type': 'PERSON', 'text': 'Alice', 'confidence': 0.91}]}
    )
    mock_response.usage.prompt_tokens = 100
    mock_response.usage.completion_tokens = 20
    mock_response.usage.prompt_tokens_details = {'cached_tokens': 10}

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai_class.return_value = mock_client

    result = extract_entities_from_chunk('Alice works at UNDP', 'key', 'gpt-5-mini')
    assert len(result['entities']) == 1
    assert result['tokens_input'] == 100
    assert result['tokens_output'] == 20
    assert result['tokens_cached'] == 10
    kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert kwargs.get('response_format') == {'type': 'json_object'}
    assert kwargs.get('max_completion_tokens') == 4096
    assert 'max_tokens' not in kwargs
    assert 'temperature' not in kwargs


@patch('ner.services.openai_client.OpenAI')
def test_extract_entities_openai_rate_limit(mock_openai_class):
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception('429 rate limit')
    mock_openai_class.return_value = mock_client

    with pytest.raises(ValueError, match='rate limit'):
        extract_entities_from_chunk('abc', 'key', 'gpt-5-mini')


@patch('ner.services.openai_client.OpenAI')
def test_extract_entities_openai_empty_content_returns_empty(mock_openai_class):
    """If completion returns empty content, the client returns empty entities without a retry."""
    empty_response = MagicMock()
    empty_response.choices[0].message.content = ""
    empty_response.usage.prompt_tokens = 80
    empty_response.usage.completion_tokens = 0
    empty_response.usage.prompt_tokens_details = {'cached_tokens': 0}

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = empty_response
    mock_openai_class.return_value = mock_client

    result = extract_entities_from_chunk('UNDP hosted an event.', 'key', 'gpt-5-mini')

    assert result['entities'] == []
    assert mock_client.chat.completions.create.call_count == 1  # no retry
    kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert kwargs.get('max_completion_tokens') == 4096
