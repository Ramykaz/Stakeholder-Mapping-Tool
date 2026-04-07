"""US2 tests for SMQ template, generation service, and API endpoints."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Chunk, Document, Project
from ner.models import SMQTemplate, SMQSection
from ner.services.smq_generator import generate_smq_section


User = get_user_model()


class TestSMQ(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('smq_user', 'smq@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.project = Project.objects.create(name='SMQ Project', owner=self.user)
        self.document = Document.objects.create(
            filename='smq.txt',
            file_format='txt',
            processing_status='completed',
            project=self.project,
        )
        self.chunk = Chunk.objects.create(
            document=self.document,
            text='UNDP collaborates with local ministries.',
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=8,
        )

        self.template = SMQTemplate.objects.filter(is_active=True).order_by('-created_at').first()
        self.assertIsNotNone(self.template)
        self.section = SMQSection.objects.filter(template=self.template).order_by('section_number').first()
        self.assertIsNotNone(self.section)

    def test_smq_seed_contains_eight_sections(self):
        count = SMQSection.objects.filter(template=self.template, is_active=True).count()
        self.assertEqual(count, 8)

    @patch('ner.services.smq_generator._call_provider')
    @patch('ner.services.smq_generator.search_chunks')
    @patch('ner.services.smq_generator.embed_query')
    def test_generate_smq_section_returns_answer_and_citations(self, mock_embed, mock_search, mock_call):
        mock_embed.return_value = [0.0] * 384
        mock_search.return_value = [self.chunk]
        mock_call.return_value = 'Generated SMQ answer with citation [Doc: smq.txt].'

        result = generate_smq_section(self.project, self.section)

        self.assertIn('answer_text', result)
        self.assertIn('chunk_ids_used', result)
        self.assertIn('citations', result)
        self.assertEqual(result['answer_text'], 'Generated SMQ answer with citation [Doc: smq.txt].')
        self.assertEqual(result['chunk_ids_used'], [str(self.chunk.id)])
        self.assertEqual(result['citations'][0]['doc_name'], 'smq.txt')

    def test_smq_get_and_put_endpoints_roundtrip(self):
        template_response = self.client.get('/api/v1/smq/template/')
        self.assertEqual(template_response.status_code, 200)
        self.assertEqual(len(template_response.json().get('sections', [])), 8)

        project_response = self.client.get(f'/api/v1/projects/{self.project.id}/smq/')
        self.assertEqual(project_response.status_code, 200)
        self.assertIn('answers', project_response.json())

        put_response = self.client.put(
            f'/api/v1/projects/{self.project.id}/smq/{self.section.id}/',
            data={'answer_text': 'Manual answer for testing.'},
            format='json',
        )
        self.assertEqual(put_response.status_code, 200)
        body = put_response.json()
        self.assertEqual(body['answer_text'], 'Manual answer for testing.')
        self.assertEqual(body['section_id'], str(self.section.id))
        self.assertFalse(body['ai_generated'])

    def test_smq_template_endpoint_prefers_complete_template_over_partial_newer_template(self):
        partial_template = SMQTemplate.objects.create(title='Partial Template', is_active=True)
        SMQSection.objects.create(
            template=partial_template,
            section_number=6,
            title='Stakeholder Engagement Strategies',
            question_prompts='Partial section only',
            order=0,
            is_active=True,
        )

        template_response = self.client.get('/api/v1/smq/template/')
        self.assertEqual(template_response.status_code, 200)
        sections = template_response.json().get('sections', [])
        self.assertEqual(len(sections), 8)
        self.assertEqual([section['section_number'] for section in sections], [1, 2, 3, 4, 5, 6, 7, 8])
