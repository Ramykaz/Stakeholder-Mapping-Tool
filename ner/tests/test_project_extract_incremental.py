from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token

from ingestion.models import Document, Project


User = get_user_model()


def _authed_client(username: str) -> tuple[Client, User]:
    user = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password='Password123',
    )
    token = Token.objects.create(user=user)
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = f'Token {token.key}'
    return client, user


class TestProjectExtractEntitiesIncremental(TestCase):
    def setUp(self):
        self.client, self.user = _authed_client('extract_incremental_user')
        self.project = Project.objects.create(name='Incremental Project', owner=self.user)

    @patch('ner.views.extract_relations_for_document')
    def test_no_new_documents_returns_completed_noop(self, mock_extract):
        Document.objects.create(
            filename='already-extracted.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
            extracted_at=timezone.now(),
        )

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/',
            {},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'completed')
        self.assertEqual(payload['documents_targeted'], 0)
        self.assertEqual(payload['documents_skipped_existing'], 1)
        self.assertEqual(payload['entities_created'], 0)
        self.assertEqual(payload['relations_created'], 0)
        self.assertEqual(payload['results'], [])
        self.assertFalse(mock_extract.called)

    @patch('ner.views.extract_relations_only_for_document')
    @patch('ner.views.extract_relations_for_document')
    def test_extracts_only_unextracted_documents(self, mock_extract, mock_rel_only):
        old_doc = Document.objects.create(
            filename='old.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
            extracted_at=timezone.now(),
        )
        new_doc = Document.objects.create(
            filename='new.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
            extracted_at=None,
        )
        new_doc_2 = Document.objects.create(
            filename='new-2.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
            extracted_at=None,
        )

        mock_extract.side_effect = [
            {
                'entities_created': 2,
                'relations_created': 1,
                'run_id': 'run-1',
            },
            {
                'entities_created': 1,
                'relations_created': 1,
                'run_id': 'run-2',
            },
        ]
        mock_rel_only.return_value = {
            'relations_created': 0,
            'run_id': 'fallback-unused',
        }

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/extract-entities/',
            {},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload['documents_targeted'], 2)
        self.assertEqual(payload['documents_processed'], 2)
        self.assertEqual(payload['documents_skipped_existing'], 1)
        self.assertEqual(payload['entities_created'], 3)
        self.assertEqual(payload['relations_created'], 2)

        called_document_ids = [call.args[0] for call in mock_extract.call_args_list]
        self.assertEqual(called_document_ids, [str(new_doc.id), str(new_doc_2.id)])

        old_doc.refresh_from_db()
        new_doc.refresh_from_db()
        new_doc_2.refresh_from_db()
        self.assertIsNotNone(old_doc.extracted_at)
        self.assertIsNotNone(new_doc.extracted_at)
        self.assertIsNotNone(new_doc_2.extracted_at)
