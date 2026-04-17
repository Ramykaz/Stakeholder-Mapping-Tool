"""Unit tests for ner.services.provider_factory."""

import pytest
from unittest.mock import patch
from django.test import override_settings

from ner.services.provider_factory import (
    ProviderConfig,
    validate_provider_config,
    resolve_provider_model,
    get_provider,
    GroqProvider,
    OpenAIProvider,
    GeminiProvider,
    AzureOpenAIProvider,
)
from ner.services.provider_runtime import ProviderConfigError

_ALLOWLIST = {
    'groq': ['llama3-8b-8192', 'llama3-70b-8192'],
    'openai': ['gpt-4o', 'gpt-4o-mini'],
    'azure_openai': ['gpt-4o'],
    'gemini': ['gemini-2.0-flash'],
}


class TestValidateProviderConfig:
    def test_valid_config_passes(self):
        config = ProviderConfig(provider='groq', model='llama3-8b-8192')
        validate_provider_config(config, _ALLOWLIST)  # no exception

    def test_unsupported_provider_raises(self):
        config = ProviderConfig(provider='unknown', model='some-model')
        with pytest.raises(ValueError, match='Unsupported provider'):
            validate_provider_config(config, _ALLOWLIST)

    def test_unsupported_model_for_provider_raises(self):
        config = ProviderConfig(provider='groq', model='gpt-4o')
        with pytest.raises(ValueError, match="Unsupported model"):
            validate_provider_config(config, _ALLOWLIST)


class TestResolveProviderModel:
    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_default_provider_and_model_resolved(self):
        config = resolve_provider_model()
        assert config.provider == 'groq'
        assert config.model == 'llama3-8b-8192'

    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_explicit_provider_and_model_accepted(self):
        config = resolve_provider_model(provider='openai', model='gpt-4o')
        assert config.provider == 'openai'
        assert config.model == 'gpt-4o'

    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_unsupported_provider_raises(self):
        with pytest.raises(ValueError, match='Unsupported provider'):
            resolve_provider_model(provider='anthropic')

    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_provider_only_assigns_first_model(self):
        config = resolve_provider_model(provider='openai')
        assert config.model == 'gpt-4o'

    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_none_provider_uses_default(self):
        config = resolve_provider_model(provider=None)
        assert config.provider == 'groq'


class TestGetProvider:
    @override_settings(
        GROQ_API_KEY='test-groq-key',
        NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST,
        NER_DEFAULT_PROVIDER='groq',
    )
    def test_returns_groq_provider(self):
        with patch('ner.services.provider_factory.validate_provider_runtime_config'):
            config = ProviderConfig(provider='groq', model='llama3-8b-8192')
            provider = get_provider(config, {})
        assert isinstance(provider, GroqProvider)
        assert provider.api_key == 'test-groq-key'

    @override_settings(
        OPENAI_API_KEY='test-openai-key',
        NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST,
    )
    def test_returns_openai_provider(self):
        with patch('ner.services.provider_factory.validate_provider_runtime_config'):
            config = ProviderConfig(provider='openai', model='gpt-4o')
            provider = get_provider(config, {})
        assert isinstance(provider, OpenAIProvider)
        assert provider.api_key == 'test-openai-key'

    @override_settings(
        GEMINI_API_KEY='test-gemini-key',
        NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST,
    )
    def test_returns_gemini_provider(self):
        with patch('ner.services.provider_factory.validate_provider_runtime_config'):
            config = ProviderConfig(provider='gemini', model='gemini-2.0-flash')
            provider = get_provider(config, {})
        assert isinstance(provider, GeminiProvider)

    @override_settings(
        AZURE_OPENAI_API_KEY='test-azure-key',
        AZURE_OPENAI_ENDPOINT='https://myresource.openai.azure.com',
        AZURE_OPENAI_DEPLOYMENT='gpt-4o-deployment',
        NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST,
    )
    def test_returns_azure_provider(self):
        with patch('ner.services.provider_factory.validate_provider_runtime_config'):
            config = ProviderConfig(provider='azure_openai', model='gpt-4o')
            provider = get_provider(config, {})
        assert isinstance(provider, AzureOpenAIProvider)

    @override_settings(GROQ_API_KEY='')
    def test_missing_api_key_raises_provider_config_error(self):
        with patch('ner.services.provider_factory.validate_provider_runtime_config'):
            config = ProviderConfig(provider='groq', model='llama3-8b-8192')
            with pytest.raises(ProviderConfigError):
                get_provider(config, {})

    def test_api_key_from_passed_dict_overrides_settings(self):
        with override_settings(GROQ_API_KEY='settings-key'):
            with patch('ner.services.provider_factory.validate_provider_runtime_config'):
                config = ProviderConfig(provider='groq', model='llama3-8b-8192')
                provider = get_provider(config, {'groq': 'dict-key'})
            assert provider.api_key == 'dict-key'
