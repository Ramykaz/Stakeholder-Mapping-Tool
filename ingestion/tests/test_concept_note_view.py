from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Project


User = get_user_model()


class TestProjectConceptNoteView(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('concept_user', 'concept@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.project = Project.objects.create(name='Concept Project', owner=self.user)

    def test_get_returns_empty_payload_when_concept_note_missing(self):
        response = self.client.get(f'/api/v1/projects/{self.project.id}/concept-note/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['project_id'], str(self.project.id))
        self.assertEqual(payload['content'], '')
        self.assertIsNone(payload['attachment_url'])
        self.assertIsNone(payload['updated_at'])
