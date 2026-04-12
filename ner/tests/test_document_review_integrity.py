from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
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


class TestDocumentReviewIntegrity(TestCase):
    def setUp(self):
        self.client, self.user = _authed_client('review_integrity_user')
        self.project = Project.objects.create(name='Review Integrity', owner=self.user)
        self.review_document = Document.objects.create(
            filename='review.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
            cleaned_text='UNDP coordinates municipal resilience planning in Accra with city authorities.',
        )
        self.other_document = Document.objects.create(
            filename='other.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
            cleaned_text='Cross-document storage for canonical entities.',
        )

    def test_entities_endpoint_is_mention_backed_and_excerpt_contains_entity(self):
        entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            confidence=0.92,
            document_id=self.other_document,
            project=self.project,
        )
        EntityMention.objects.create(
            entity=entity,
            document=self.review_document,
            excerpt='Municipal resilience planning with city authorities.',
            confidence_score=0.92,
        )

        response = self.client.get(
            f'/api/v1/projects/{self.project.id}/documents/{self.review_document.id}/entities/'
        )

        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['canonical_name'], 'UNDP')
        self.assertIn('undp', rows[0]['excerpt'].lower())
        self.assertEqual(rows[0]['mention_count_in_doc'], 1)

    def test_entities_endpoint_falls_back_to_document_entities_without_mentions(self):
        Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Legacy Entity',
            confidence=0.73,
            document_id=self.review_document,
            project=self.project,
        )

        response = self.client.get(
            f'/api/v1/projects/{self.project.id}/documents/{self.review_document.id}/entities/'
        )

        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['canonical_name'], 'Legacy Entity')
        self.assertEqual(rows[0]['mention_count_in_doc'], 1)

    def test_relationships_endpoint_uses_source_document_evidence(self):
        source_entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            confidence=0.91,
            document_id=self.other_document,
            project=self.project,
        )
        target_entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='City Authorities',
            confidence=0.89,
            document_id=self.other_document,
            project=self.project,
        )

        run = NERRun.objects.create(
            document_id=self.other_document,
            provider='groq',
            model='llama-3.1-8b-instant',
            status=NERRun.STATUS_COMPLETED,
        )
        Relation.objects.create(
            document_id=self.other_document,
            source_document=self.review_document,
            run=run,
            project=self.project,
            source_entity=source_entity,
            target_entity=target_entity,
            label='COORDINATES_WITH',
            confidence=0.77,
            excerpt='',
        )

        response = self.client.get(
            f'/api/v1/projects/{self.project.id}/documents/{self.review_document.id}/relationships/'
        )

        self.assertEqual(response.status_code, 200)
        rows = response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['source_document_id'], str(self.review_document.id))
        excerpt = (rows[0].get('excerpt') or '').lower()
        self.assertIn('undp', excerpt)
        self.assertIn('city authorities', excerpt)
