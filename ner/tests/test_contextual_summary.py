"""Unit/integration tests for ner.services.contextual_summary."""

import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from ingestion.models import Project

User = get_user_model()


class TestResolveTimeoutSeconds:
    def test_provider_floor_applied_when_request_is_lower(self):
        from ner.services.contextual_summary import _resolve_timeout_seconds
        # groq floor is 45s — requesting 10s should return 45
        result = _resolve_timeout_seconds('groq', 10)
        assert result >= 45

    def test_requested_timeout_used_when_above_floor(self):
        from ner.services.contextual_summary import _resolve_timeout_seconds
        result = _resolve_timeout_seconds('groq', 120)
        assert result == 120

    def test_azure_openai_has_higher_floor(self):
        from ner.services.contextual_summary import _resolve_timeout_seconds
        groq_result = _resolve_timeout_seconds('groq', 1)
        azure_result = _resolve_timeout_seconds('azure_openai', 1)
        assert azure_result >= groq_result

    def test_unknown_provider_uses_default(self):
        from ner.services.contextual_summary import _resolve_timeout_seconds, DEFAULT_TIMEOUT_SECONDS
        result = _resolve_timeout_seconds('unknown_provider', 1)
        assert result == DEFAULT_TIMEOUT_SECONDS

    def test_zero_timeout_replaced_by_floor(self):
        from ner.services.contextual_summary import _resolve_timeout_seconds
        result = _resolve_timeout_seconds('groq', 0)
        assert result >= 1


class TestGetOrGenerateSummary(TestCase):
    def setUp(self):
        from ingestion.models import Document
        self.user = User.objects.create_user('summary_user', 'sum@example.com', 'Pass123')
        self.project = Project.objects.create(name='Summary Project', owner=self.user)
        self.document = Document.objects.create(
            filename='test.txt', file_format='txt', project=self.project
        )

    def _make_entity(self, name='TestEntity'):
        from ner.models import Entity
        return Entity.objects.create(
            project=self.project,
            document_id=self.document,
            entity_type='ORG',
            canonical_name=name,
            normalized_name=name.lower(),
            raw_mentions=[name],
            confidence=0.9,
            mention_count_dedup=1,
        )

    def test_cached_summary_returned_without_calling_llm(self):
        from ner.services.contextual_summary import get_or_generate_summary
        from ner.models import ContextualEntitySummary

        entity = self._make_entity('CachedOrg')
        now = timezone.now()
        ContextualEntitySummary.objects.create(
            entity=entity,
            project=self.project,
            summary_text='Cached summary text.',
            generated_by_provider='groq',
            generated_at=now,
            expires_at=now + __import__('datetime').timedelta(hours=24),
            evidence_hash='abc123',
        )

        with patch('ner.services.contextual_summary._generate_summary_text') as mock_gen:
            result = get_or_generate_summary(
                entity=entity, project=self.project, refresh=False
            )

        mock_gen.assert_not_called()
        assert result['source'] == 'cache'
        assert result['summary'] == 'Cached summary text.'

    def test_insufficient_evidence_returns_fallback(self):
        from ner.services.contextual_summary import get_or_generate_summary

        entity = self._make_entity('NoEvidenceOrg')

        with patch('ner.services.semantic_search.search_chunks_for_entity', return_value=[]):
            result = get_or_generate_summary(
                entity=entity, project=self.project, refresh=False
            )

        assert result['summary'] is None
        assert result['reason'] == 'insufficient_evidence'

    def test_timeout_returns_timeout_fallback(self):
        from ner.services.contextual_summary import get_or_generate_summary
        from concurrent.futures import TimeoutError as FutureTimeoutError

        entity = self._make_entity('TimeoutOrg')

        with patch('ner.services.semantic_search.search_chunks_for_entity') as mock_search:
            mock_chunk = MagicMock()
            mock_chunk.text = 'Some evidence text'
            mock_search.return_value = [mock_chunk]

            with patch('ner.services.contextual_summary.ThreadPoolExecutor') as mock_pool_cls:
                mock_pool = MagicMock()
                mock_pool.__enter__ = MagicMock(return_value=mock_pool)
                mock_pool.__exit__ = MagicMock(return_value=False)
                mock_future = MagicMock()
                mock_future.result.side_effect = FutureTimeoutError()
                mock_pool.submit.return_value = mock_future
                mock_pool_cls.return_value = mock_pool

                result = get_or_generate_summary(
                    entity=entity, project=self.project, refresh=False
                )

        assert result['reason'] == 'timeout'
        assert result['retryable'] is True
