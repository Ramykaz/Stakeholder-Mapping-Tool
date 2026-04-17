"""Unit tests for ner.services.provider_runtime utility functions."""

import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch
from django.test import override_settings

from ner.services.provider_runtime import (
    ProviderConfigError,
    get_missing_provider_settings,
    normalize_azure_endpoint,
    normalize_usage,
    is_rate_limit_error,
    is_auth_config_error,
    normalize_provider_error_kind,
    run_with_retry,
)


class TestGetMissingProviderSettings:
    @override_settings(GROQ_API_KEY='test-key')
    def test_groq_all_present_returns_empty(self):
        assert get_missing_provider_settings('groq') == []

    @override_settings(GROQ_API_KEY='')
    def test_groq_missing_key_returns_key_name(self):
        missing = get_missing_provider_settings('groq')
        assert 'GROQ_API_KEY' in missing

    @override_settings(OPENAI_API_KEY='')
    def test_openai_missing_key_returned(self):
        assert 'OPENAI_API_KEY' in get_missing_provider_settings('openai')

    @override_settings(GEMINI_API_KEY='')
    def test_gemini_missing_key_returned(self):
        assert 'GEMINI_API_KEY' in get_missing_provider_settings('gemini')

    @override_settings(AZURE_OPENAI_API_KEY='', AZURE_OPENAI_ENDPOINT='', AZURE_OPENAI_DEPLOYMENT='')
    def test_azure_all_missing_returns_three_keys(self):
        missing = get_missing_provider_settings('azure_openai')
        assert len(missing) == 3

    @override_settings(AZURE_OPENAI_API_KEY='key', AZURE_OPENAI_ENDPOINT='https://x.com', AZURE_OPENAI_DEPLOYMENT='dep')
    def test_azure_all_present_returns_empty(self):
        assert get_missing_provider_settings('azure_openai') == []

    def test_unknown_provider_returns_empty(self):
        assert get_missing_provider_settings('unknown_provider') == []

    def test_case_insensitive_provider(self):
        with override_settings(GROQ_API_KEY='key'):
            assert get_missing_provider_settings('GROQ') == []


class TestNormalizeAzureEndpoint:
    def test_strips_double_https_prefix(self):
        result = normalize_azure_endpoint('https:https://myresource.openai.azure.com')
        assert result == 'https://myresource.openai.azure.com'

    def test_strips_double_http_prefix(self):
        result = normalize_azure_endpoint('http:http://myresource.openai.azure.com')
        assert result == 'http://myresource.openai.azure.com'

    def test_normal_endpoint_unchanged(self):
        url = 'https://myresource.openai.azure.com'
        assert normalize_azure_endpoint(url) == url

    def test_empty_string_returned_as_is(self):
        assert normalize_azure_endpoint('') == ''


class TestNormalizeUsage:
    def test_all_fields_populated(self):
        result = normalize_usage({'tokens_input': 10, 'tokens_output': 5, 'tokens_cached': 2, 'cost_usd': 0.001})
        assert result['tokens_input'] == 10
        assert result['tokens_output'] == 5
        assert result['tokens_cached'] == 2
        assert result['cost_usd'] == Decimal('0.001')

    def test_missing_fields_default_to_zero(self):
        result = normalize_usage({})
        assert result['tokens_input'] == 0
        assert result['tokens_output'] == 0
        assert result['tokens_cached'] == 0
        assert result['cost_usd'] == Decimal('0.0')

    def test_none_input_defaults_all_zeros(self):
        result = normalize_usage(None)
        assert result['tokens_input'] == 0

    def test_string_cost_coerced_to_decimal(self):
        result = normalize_usage({'cost_usd': '0.05'})
        assert result['cost_usd'] == Decimal('0.05')


class TestIsRateLimitError:
    def test_429_in_message(self):
        assert is_rate_limit_error(Exception('429 too many requests'))

    def test_rate_limit_phrase(self):
        assert is_rate_limit_error(Exception('rate limit exceeded'))

    def test_rate_limit_underscore(self):
        assert is_rate_limit_error(Exception('rate_limit_error'))

    def test_unrelated_error(self):
        assert not is_rate_limit_error(Exception('connection refused'))


class TestIsAuthConfigError:
    def test_invalid_api_key(self):
        assert is_auth_config_error(Exception('invalid_api_key provided'))

    def test_authentication_failure(self):
        assert is_auth_config_error(Exception('authentication failed'))

    def test_unauthorized(self):
        assert is_auth_config_error(Exception('unauthorized access'))

    def test_credential_error(self):
        assert is_auth_config_error(Exception('bad credential'))

    def test_unrelated_error(self):
        assert not is_auth_config_error(Exception('timeout'))


class TestNormalizeProviderErrorKind:
    def test_rate_limit_429(self):
        assert normalize_provider_error_kind(Exception('429 rate limit')) == 'rate_limit'

    def test_connection_error(self):
        assert normalize_provider_error_kind(Exception('connection error occurred')) == 'configuration'

    def test_ssl_error(self):
        assert normalize_provider_error_kind(Exception('ssl certificate verify failed')) == 'configuration'

    def test_timeout(self):
        assert normalize_provider_error_kind(Exception('request timed out')) == 'timeout'

    def test_generic_error(self):
        assert normalize_provider_error_kind(Exception('model returned error')) == 'generic'


class TestRunWithRetry:
    def setup_method(self):
        # Reset all circuit breakers between tests so tripped breakers in
        # earlier tests don't block later tests from calling the func at all.
        from ner.services.provider_runtime import _CIRCUIT_BREAKERS
        _CIRCUIT_BREAKERS.clear()

    def test_success_on_first_attempt(self):
        func = MagicMock(return_value='result')
        assert run_with_retry('groq', func, retries=3) == 'result'
        func.assert_called_once()

    def test_retries_on_rate_limit_then_succeeds(self):
        func = MagicMock(side_effect=[Exception('429 rate limit'), 'result'])
        with patch('ner.services.provider_runtime.time.sleep'):
            result = run_with_retry('groq', func, retries=3, base_delay_seconds=0.01)
        assert result == 'result'
        assert func.call_count == 2

    def test_raises_after_exhausted_retries(self):
        func = MagicMock(side_effect=Exception('429 rate limit'))
        with patch('ner.services.provider_runtime.time.sleep'):
            with pytest.raises(Exception, match='rate limit'):
                run_with_retry('groq', func, retries=3, base_delay_seconds=0.01)

    def test_provider_config_error_not_retried(self):
        exc = ProviderConfigError(provider='groq', detail='missing key')
        func = MagicMock(side_effect=exc)
        with pytest.raises(ProviderConfigError):
            run_with_retry('groq', func, retries=3)
        func.assert_called_once()

    def test_auth_error_wrapped_as_provider_config_error(self):
        func = MagicMock(side_effect=Exception('invalid_api_key'))
        with pytest.raises(ProviderConfigError, match='groq'):
            run_with_retry('groq', func, retries=3)

    def test_non_rate_limit_error_not_retried(self):
        func = MagicMock(side_effect=RuntimeError('model not found'))
        with pytest.raises(RuntimeError):
            run_with_retry('groq', func, retries=3)
        func.assert_called_once()
