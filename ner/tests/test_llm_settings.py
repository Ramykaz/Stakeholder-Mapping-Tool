from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase


User = get_user_model()


class TestLLMSettingsEndpoint(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('llm_user', 'llm@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

    def test_llm_connection_test_requires_supported_provider(self):
        response = self.client.get(
            reverse('settings-llm-test'),
            {'provider': 'invalid_provider', 'model': 'some-model'},
        )

        assert response.status_code == 400
        data = response.json()
        assert data['status'] == 'error'
        assert data['error_message']

    @patch('ner.services.nl_query._call_provider')
    @patch('ner.views.validate_provider_runtime_config')
    def test_llm_connection_test_returns_ok_payload(self, mock_validate, mock_call):
        mock_call.return_value = 'OK'

        response = self.client.get(
            reverse('settings-llm-test'),
            {'provider': 'groq', 'model': 'llama-3.1-8b-instant'},
        )

        assert response.status_code == 200
        data = response.json()
        assert data['provider'] == 'groq'
        assert data['model'] == 'llama-3.1-8b-instant'
        assert data['status'] == 'ok'
        assert data['latency_ms'] >= 0

        mock_validate.assert_called_once_with('groq')
        mock_call.assert_called_once()

    @patch('ner.services.nl_query._call_provider')
    @patch('ner.views.validate_provider_runtime_config')
    def test_llm_connection_test_returns_error_status_for_provider_failures(self, mock_validate, mock_call):
        mock_call.side_effect = RuntimeError('rate limit exceeded')

        response = self.client.get(
            reverse('settings-llm-test'),
            {'provider': 'groq', 'model': 'llama-3.1-8b-instant'},
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'error'
        assert 'rate_limit' in data['error_message']
        assert data['latency_ms'] >= 0

    @override_settings(
        AZURE_OPENAI_API_KEY='test-key',
        AZURE_OPENAI_DEPLOYMENT='gpt-5-mini',
        AZURE_OPENAI_ENDPOINT='not-a-url',
    )
    def test_llm_connection_test_rejects_malformed_azure_endpoint(self):
        response = self.client.get(
            reverse('settings-llm-test'),
            {'provider': 'azure_openai', 'model': 'gpt-5-mini'},
        )

        assert response.status_code == 400
        data = response.json()
        assert data['status'] == 'error'
        assert 'invalid azure_openai_endpoint format'.lower() in data['error_message'].lower()
