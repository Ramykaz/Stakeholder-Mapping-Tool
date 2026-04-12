"""Contextual summary API tests for cache/refresh/timeout behavior."""

from unittest.mock import patch
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from ner.models import ContextualEntitySummary
from ner.services.contextual_summary import _resolve_timeout_seconds
from ner.tests.factories import (
    create_entity,
    create_project_with_document,
    create_relation,
    create_run_for_document,
    create_user_with_token,
)


class TestContextualSummaryApi(APITestCase):
    def setUp(self):
        self.user, token = create_user_with_token('summary_owner')
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.project, self.document = create_project_with_document(self.user)
        self.run = create_run_for_document(self.document)
        self.entity = create_entity(self.document, self.run, self.project, name='UNDP')

    def test_summary_returns_cached_value_when_available(self):
        cache = ContextualEntitySummary.objects.create(
            entity=self.entity,
            project=self.project,
            summary_text='Cached narrative',
            generated_by_provider='internal',
            expires_at=timezone.now() + timedelta(hours=24),
        )

        response = self.client.post(
            f'/api/v1/entities/{self.entity.id}/summary/',
            data={'project_id': str(self.project.id), 'refresh': False},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['summary'], cache.summary_text)
        self.assertEqual(payload['source'], 'cache')

    @patch('ner.services.contextual_summary._generate_summary_text', return_value=('Fresh narrative', []))
    def test_summary_refresh_regenerates(self, _mock_generate):
        ContextualEntitySummary.objects.create(
            entity=self.entity,
            project=self.project,
            summary_text='Old narrative',
            generated_by_provider='internal',
            expires_at=timezone.now() + timedelta(hours=24),
        )

        response = self.client.post(
            f'/api/v1/entities/{self.entity.id}/summary/',
            data={'project_id': str(self.project.id), 'refresh': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['summary'], 'Fresh narrative')
        self.assertEqual(response.json()['source'], 'provider')

    @patch('ner.services.contextual_summary._generate_summary_text', return_value=('**UNDP** is central to delivery.', []))
    def test_summary_refresh_normalizes_markdown_artifacts(self, _mock_generate):
        response = self.client.post(
            f'/api/v1/entities/{self.entity.id}/summary/',
            data={'project_id': str(self.project.id), 'refresh': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['summary'], 'UNDP is central to delivery.')
        self.assertNotIn('*', payload['summary'])

    @patch('ner.views.get_or_generate_summary')
    def test_summary_timeout_returns_fallback_retryable(self, mock_summary):
        mock_summary.return_value = {
            'entity_id': str(self.entity.id),
            'project_id': str(self.project.id),
            'summary': None,
            'fallback_message': 'Summary unavailable right now. Try again.',
            'retryable': True,
            'reason': 'timeout_or_provider_unavailable',
            'status_code': 503,
        }

        response = self.client.post(
            f'/api/v1/entities/{self.entity.id}/summary/',
            data={'project_id': str(self.project.id), 'refresh': True},
            format='json',
        )

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload['retryable'], True)
        self.assertIn('fallback_message', payload)

    @patch('ner.services.semantic_search.search_chunks_for_entity', return_value=[])
    @patch('ner.services.contextual_summary._generate_summary_text', return_value=('Relation-grounded summary', []))
    def test_summary_generated_when_relation_exists_with_sparse_chunk_evidence(self, _mock_generate, _mock_search):
        peer = create_entity(self.document, self.run, self.project, name='Ministry Partner')
        create_relation(self.document, self.run, self.project, source=self.entity, target=peer)

        response = self.client.post(
            f'/api/v1/entities/{self.entity.id}/summary/',
            data={'project_id': str(self.project.id), 'refresh': False},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['summary'], 'Relation-grounded summary')
        self.assertEqual(payload['source'], 'provider')


class TestContextualSummaryTimeouts(APITestCase):
    def test_resolve_timeout_uses_provider_floor_for_azure(self):
        self.assertEqual(_resolve_timeout_seconds('azure_openai', 30), 90)

    def test_resolve_timeout_respects_higher_requested_timeout(self):
        self.assertEqual(_resolve_timeout_seconds('azure_openai', 120), 120)

    def test_resolve_timeout_uses_default_floor_for_unknown_provider(self):
        self.assertEqual(_resolve_timeout_seconds('custom_provider', 20), 75)
