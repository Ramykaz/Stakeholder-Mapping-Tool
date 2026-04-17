"""Unit tests for ner.services.azure_openai_client."""

import json
import pytest
from unittest.mock import MagicMock, patch


class TestAzureExtractJointFromChunk:
    def test_empty_chunk_returns_empty_result(self):
        from ner.services.azure_openai_client import extract_joint_from_chunk
        result = extract_joint_from_chunk(
            '', api_key='key', endpoint='https://x.openai.azure.com',
            deployment='gpt-4o', model='gpt-4o',
        )
        assert result['entities'] == []
        assert result['relationships'] == []
        assert result['tokens_input'] == 0
        assert result['cost_usd'] == 0.0

    def test_whitespace_only_chunk_returns_empty(self):
        from ner.services.azure_openai_client import extract_joint_from_chunk
        result = extract_joint_from_chunk(
            '   ', api_key='key', endpoint='https://x.openai.azure.com',
            deployment='gpt-4o', model='gpt-4o',
        )
        assert result['entities'] == []

    def test_missing_endpoint_raises_runtime_error(self):
        from ner.services.azure_openai_client import extract_joint_from_chunk
        with pytest.raises(RuntimeError, match='endpoint/deployment'):
            extract_joint_from_chunk(
                'Some text', api_key='key', endpoint='', deployment='', model='gpt-4o'
            )

    def test_missing_deployment_raises_runtime_error(self):
        from ner.services.azure_openai_client import extract_joint_from_chunk
        with pytest.raises(RuntimeError, match='endpoint/deployment'):
            extract_joint_from_chunk(
                'Some text', api_key='key', endpoint='https://x.openai.azure.com',
                deployment='', model='gpt-4o',
            )

    def test_successful_extraction(self):
        """Successful call returns entities, relationships, and token counts."""
        from ner.services.azure_openai_client import extract_joint_from_chunk

        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 80
        mock_usage.completion_tokens = 25
        mock_usage.prompt_tokens_details = MagicMock(cached_tokens=5)

        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            'entities': [{'text': 'UNDP', 'label': 'ORG'}],
            'relationships': [],
        })
        mock_response.usage = mock_usage

        mock_azure_client = MagicMock()
        mock_azure_client.chat.completions.create.return_value = mock_response

        AzureOpenAI_mock = MagicMock(return_value=mock_azure_client)
        mock_openai_module = MagicMock()
        mock_openai_module.AzureOpenAI = AzureOpenAI_mock

        with patch.dict('sys.modules', {'openai': mock_openai_module}):
            result = extract_joint_from_chunk(
                'UNDP leads the initiative.',
                api_key='test-key',
                endpoint='https://myresource.openai.azure.com',
                deployment='gpt-4o-deployment',
                model='gpt-4o',
            )

        assert len(result['entities']) == 1
        assert result['tokens_input'] == 80
        assert result['tokens_output'] == 25
        assert result['tokens_cached'] == 5

    def test_entity_labels_and_rel_types_included(self):
        from ner.services.azure_openai_client import extract_joint_from_chunk

        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"entities":[],"relationships":[]}'
        mock_response.usage = MagicMock(
            prompt_tokens=0, completion_tokens=0,
            prompt_tokens_details=MagicMock(cached_tokens=0)
        )

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        AzureOpenAI_mock = MagicMock(return_value=mock_client)
        mock_openai_module = MagicMock()
        mock_openai_module.AzureOpenAI = AzureOpenAI_mock

        with patch.dict('sys.modules', {'openai': mock_openai_module}):
            extract_joint_from_chunk(
                'Some text',
                api_key='key',
                endpoint='https://x.openai.azure.com',
                deployment='dep',
                model='gpt-4o',
                entity_labels=['PERSON', 'ORG'],
                relationship_types=[{'name': 'FUNDS', 'directional': True}],
            )

        call_args = mock_client.chat.completions.create.call_args
        messages = call_args.kwargs.get('messages') or call_args[1].get('messages') or call_args[0][0]
        system_msg = next(m['content'] for m in messages if m['role'] == 'system')
        assert 'PERSON' in system_msg
        assert 'FUNDS' in system_msg
