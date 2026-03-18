"""Contextual summary API tests for cache/refresh/timeout behavior."""

from unittest.mock import patch
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from ner.models import ContextualEntitySummary
from ner.tests.factories import (
    create_entity,
    create_project_with_document,
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

    @patch('ner.services.contextual_summary._generate_summary_text', return_value='Fresh narrative')
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
