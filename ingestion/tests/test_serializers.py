"""Unit tests for ingestion serializer validation rules."""

import pytest
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model

from ingestion.models import Project, WebSource
from ingestion.serializers import ProjectWriteSerializer, WebSourceSerializer

User = get_user_model()

_ALLOWLIST = {
    'groq': ['llama3-8b-8192', 'llama3-70b-8192'],
    'openai': ['gpt-4o', 'gpt-4o-mini'],
    'azure_openai': ['gpt-4o'],
    'gemini': ['gemini-2.0-flash'],
}


class TestProjectWriteSerializerValidateProvider(TestCase):
    def test_valid_provider_accepted(self):
        s = ProjectWriteSerializer(data={'name': 'P', 'provider': 'groq'})
        s.is_valid()
        self.assertNotIn('provider', s.errors)

    def test_invalid_provider_rejected(self):
        s = ProjectWriteSerializer(data={'name': 'P', 'provider': 'anthropic'})
        s.is_valid()
        self.assertIn('provider', s.errors)

    def test_provider_normalized_to_lowercase(self):
        s = ProjectWriteSerializer(data={'name': 'P', 'provider': 'GROQ'})
        s.is_valid()
        self.assertEqual(s.validated_data.get('provider'), 'groq')

    def test_empty_provider_accepted(self):
        s = ProjectWriteSerializer(data={'name': 'P', 'provider': ''})
        s.is_valid()
        self.assertNotIn('provider', s.errors)

    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_valid_provider_model_combo_accepted(self):
        s = ProjectWriteSerializer(data={'name': 'P', 'provider': 'groq', 'model': 'llama3-8b-8192'})
        self.assertTrue(s.is_valid())

    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_invalid_model_for_provider_rejected(self):
        s = ProjectWriteSerializer(data={'name': 'P', 'provider': 'groq', 'model': 'gpt-4o'})
        self.assertFalse(s.is_valid())
        self.assertIn('model', s.errors)

    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_provider_only_assigns_default_model(self):
        s = ProjectWriteSerializer(data={'name': 'P', 'provider': 'groq'})
        self.assertTrue(s.is_valid())
        # First model in allowlist should be auto-assigned
        self.assertEqual(s.validated_data.get('model'), 'llama3-8b-8192')

    @override_settings(NER_PROVIDER_MODEL_ALLOWLIST=_ALLOWLIST, NER_DEFAULT_PROVIDER='groq')
    def test_unsupported_provider_in_allowlist_rejected(self):
        s = ProjectWriteSerializer(data={'name': 'P', 'provider': 'unknown_provider'})
        self.assertFalse(s.is_valid())


class TestWebSourceSerializerValidation(TestCase):
    def _validate(self, data):
        s = WebSourceSerializer(data=data)
        s.is_valid()
        return s

    def test_url_source_requires_url(self):
        s = self._validate({'source_type': 'url'})
        self.assertIn('url', s.errors)

    def test_crawl_source_requires_url(self):
        s = self._validate({'source_type': 'crawl'})
        self.assertIn('url', s.errors)

    def test_paste_source_requires_raw_text(self):
        s = self._validate({'source_type': 'paste', 'title': 'My notes'})
        self.assertIn('raw_text', s.errors)

    def test_paste_source_requires_title(self):
        s = self._validate({'source_type': 'paste', 'raw_text': 'Some content'})
        self.assertIn('title', s.errors)

    def test_crawl_depth_must_be_1_or_2(self):
        s = self._validate({'source_type': 'crawl', 'url': 'https://example.com', 'crawl_depth': 3})
        self.assertIn('crawl_depth', s.errors)

    def test_crawl_depth_0_rejected(self):
        s = self._validate({'source_type': 'crawl', 'url': 'https://example.com', 'crawl_depth': 0})
        self.assertIn('crawl_depth', s.errors)

    def test_crawl_depth_1_accepted(self):
        s = self._validate({'source_type': 'crawl', 'url': 'https://example.com', 'crawl_depth': 1})
        self.assertNotIn('crawl_depth', s.errors)

    def test_crawl_depth_2_accepted(self):
        s = self._validate({'source_type': 'crawl', 'url': 'https://example.com', 'crawl_depth': 2})
        self.assertNotIn('crawl_depth', s.errors)

    def test_url_with_control_chars_sanitized(self):
        s = self._validate({'source_type': 'url', 'url': 'https://example.com/\x00path'})
        s.is_valid()
        if 'url' not in s.errors:
            self.assertNotIn('\x00', s.validated_data.get('url', ''))

    def test_valid_url_source_passes(self):
        s = self._validate({'source_type': 'url', 'url': 'https://example.com/article'})
        self.assertNotIn('url', s.errors)

    def test_valid_paste_source_passes(self):
        s = self._validate({'source_type': 'paste', 'raw_text': 'Content here', 'title': 'My paste'})
        self.assertFalse(bool(s.errors))
