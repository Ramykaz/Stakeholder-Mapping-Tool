from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token

from ingestion.models import Document, Project
from ner.models import Entity, EntityMention, NERRun, Relation


User = get_user_model()


def _authed_client(username: str):
    user = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password='Password123',
    )
    token = Token.objects.create(user=user)
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = f'Token {token.key}'
    return client, user


class TestProjectDocumentEndpoints(TestCase):
    def setUp(self):
        self.client, self.user = _authed_client('doc_endpoints_user')
        self.project = Project.objects.create(name='Docs Project', owner=self.user)
        self.document = Document.objects.create(
            filename='source.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
            raw_text='Raw mention of UNDP in source text.',
            cleaned_text='Cleaned mention of UNDP in source text.',
            extracted_at=timezone.now(),
        )

    def test_project_documents_get_marks_extracting_state_when_pending_run_exists(self):
        NERRun.objects.create(
            document_id=self.document,
            provider='groq',
            model='llama-3.1-8b-instant',
            status=NERRun.STATUS_PENDING,
        )

        response = self.client.get(f'/api/v1/projects/{self.project.id}/documents/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]['id'], str(self.document.id))
        self.assertEqual(payload[0]['extraction_state'], 'extracting')

    def test_project_document_status_returns_extracted_state_with_timestamp(self):
        response = self.client.get(f'/api/v1/projects/{self.project.id}/documents/{self.document.id}/status/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['extraction_state'], 'extracted')
        self.assertIsNotNone(payload['extracted_at'])

    def test_project_document_context_prioritizes_cleaned_text_and_focus_snippets(self):
        response = self.client.get(
            f'/api/v1/projects/{self.project.id}/documents/{self.document.id}/context/?focus=UNDP'
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['text_source'], 'cleaned_text')
        self.assertIn('UNDP', payload['cleaned_text'])
        self.assertGreaterEqual(len(payload['snippets']), 1)

    @patch('ner.services.pipeline.extract_relations_only_for_document')
    @patch('ner.services.pipeline.extract_relations_for_document')
    def test_project_document_reextract_runs_and_sets_extracted_at(self, mock_joint, mock_rel_only):
        self.document.extracted_at = timezone.now()
        self.document.save(update_fields=['extracted_at'])

        mock_joint.return_value = {
            'entities_created': 3,
            'relations_created': 0,
            'run_id': 'joint-run',
        }
        mock_rel_only.return_value = {
            'relations_created': 2,
            'run_id': 'fallback-run',
        }

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/documents/{self.document.id}/reextract/',
            data={'provider': 'groq', 'model': 'llama-3.1-8b-instant'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'completed')
        self.assertEqual(payload['entities_created'], 3)
        self.assertEqual(payload['relations_created'], 2)

        self.document.refresh_from_db()
        self.assertIsNotNone(self.document.extracted_at)
        self.assertTrue(mock_joint.called)
        self.assertTrue(mock_rel_only.called)

    def test_project_document_reextract_returns_404_for_foreign_project(self):
        other_client, other_user = _authed_client('other_doc_user')
        other_project = Project.objects.create(name='Other Project', owner=other_user)
        other_document = Document.objects.create(
            filename='other.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=other_project,
        )

        response = self.client.post(
            f'/api/v1/projects/{other_project.id}/documents/{other_document.id}/reextract/',
            data={},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 404)

    def test_project_documents_counts_use_review_semantics(self):
        secondary_document = Document.objects.create(
            filename='secondary.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
            cleaned_text='Secondary document text about UNDP governance partnerships.',
        )

        unflagged_entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            confidence=0.94,
            document_id=secondary_document,
            project=self.project,
        )
        flagged_entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Noise Entity',
            confidence=0.30,
            is_flagged=True,
            document_id=self.document,
            project=self.project,
        )
        partner_entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Municipal Authority',
            confidence=0.88,
            document_id=secondary_document,
            project=self.project,
        )

        EntityMention.objects.create(
            entity=unflagged_entity,
            document=self.document,
            excerpt='Cleaned mention of UNDP in source text.',
            confidence_score=0.94,
        )
        EntityMention.objects.create(
            entity=flagged_entity,
            document=self.document,
            excerpt='Noise mention that should not count.',
            confidence_score=0.20,
        )

        run = NERRun.objects.create(
            document_id=secondary_document,
            provider='groq',
            model='llama-3.1-8b-instant',
            status=NERRun.STATUS_COMPLETED,
        )
        Relation.objects.create(
            document_id=secondary_document,
            source_document=self.document,
            run=run,
            project=self.project,
            source_entity=unflagged_entity,
            target_entity=partner_entity,
            label='COORDINATES_WITH',
            confidence=0.71,
        )

        response = self.client.get(f'/api/v1/projects/{self.project.id}/documents/?include_stats=true')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        row = next(item for item in payload if item['id'] == str(self.document.id))

        self.assertEqual(row['entity_count'], 1)
        self.assertEqual(row['relation_count'], 1)
        self.assertIsNotNone(row['stats'])
        self.assertEqual(row['stats']['entity_count'], 1)
        self.assertEqual(row['stats']['relation_count'], 1)
