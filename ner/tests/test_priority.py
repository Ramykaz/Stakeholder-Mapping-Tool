"""US5 tests for stakeholder priority scoring and CSV export."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Document, Project
from ner.models import Entity, NERRun, Relation
from ner.services.priority_table import compute_priority_scores


User = get_user_model()


class TestPriorityTable(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('priority_user', 'priority@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.project = Project.objects.create(name='Priority Project', owner=self.user)
        self.document = Document.objects.create(
            filename='priority.txt',
            file_format='txt',
            processing_status='completed',
            project=self.project,
        )
        self.run = NERRun.objects.create(
            document_id=self.document,
            provider='groq',
            model='llama-3.1-8b-instant',
            status=NERRun.STATUS_COMPLETED,
            tokens_input=0,
            tokens_output=0,
            tokens_cached=0,
            cost_usd='0.000000',
        )

        self.entity_a = Entity.objects.create(
            entity_type='PERSON',
            canonical_name='Alice',
            normalized_name='alice',
            raw_mentions=['Alice'],
            confidence=0.9,
            mention_count_dedup=4,
            document_id=self.document,
            run=self.run,
            project=self.project,
        )
        self.entity_b = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            normalized_name='undp',
            raw_mentions=['UNDP'],
            confidence=0.8,
            mention_count_dedup=3,
            document_id=self.document,
            run=self.run,
            project=self.project,
        )
        self.entity_c = Entity.objects.create(
            entity_type='PERSON',
            canonical_name='Bob',
            normalized_name='bob',
            raw_mentions=['Bob'],
            confidence=0.95,
            mention_count_dedup=1,
            document_id=self.document,
            run=self.run,
            project=self.project,
        )

        Relation.objects.create(
            document_id=self.document,
            run=self.run,
            project=self.project,
            source_entity=self.entity_a,
            target_entity=self.entity_b,
            label='ENGAGES_WITH',
            confidence=0.9,
        )
        Relation.objects.create(
            document_id=self.document,
            run=self.run,
            project=self.project,
            source_entity=self.entity_b,
            target_entity=self.entity_a,
            label='COLLABORATES_WITH',
            confidence=0.9,
        )

    def test_compute_priority_scores_sorted_descending(self):
        rows = compute_priority_scores(self.project)

        self.assertGreaterEqual(len(rows), 3)
        self.assertEqual(rows[0]['name'], 'Alice')
        self.assertEqual(rows[0]['rank'], 1)
        self.assertGreaterEqual(rows[0]['priority_score'], rows[1]['priority_score'])

        zero_degree_rows = [row for row in rows if row['degree'] == 0]
        self.assertTrue(zero_degree_rows)
        self.assertEqual(rows[-1]['degree'], 0)

    def test_compute_priority_scores_type_filter(self):
        rows = compute_priority_scores(self.project, entity_type='PERSON')

        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row['entity_type'] == 'PERSON' for row in rows))

    def test_priority_csv_export_headers(self):
        response = self.client.get(
            f'/api/v1/projects/{self.project.id}/stakeholders/priority/export/csv/'
        )

        self.assertEqual(response.status_code, 200)
        csv_text = response.content.decode('utf-8').strip().splitlines()
        self.assertGreaterEqual(len(csv_text), 2)
        self.assertEqual(
            csv_text[0],
            'rank,name,category,priority_level,recommended_ask,entity_type,mention_count,avg_confidence,degree,priority_score',
        )

    @patch('ner.services.engagement_notes.generate_notes_for_project')
    def test_generate_notes_start_contract(self, mock_generate):
        mock_generate.return_value = {
            'status': 'running',
            'total_target': 2,
            'completed_count': 1,
            'current_index': 1,
            'message': 'Generated 1/2 stakeholder notes.',
        }

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/stakeholders/priority/generate-notes/',
            {'action': 'start', 'max_items': 20},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'running')
        self.assertEqual(response.data['completed_count'], 1)
        mock_generate.assert_called_once_with(str(self.project.id), action='start', max_items=20)

    @patch('ner.services.engagement_notes.generate_notes_for_project')
    def test_generate_notes_resume_contract(self, mock_generate):
        mock_generate.return_value = {
            'status': 'paused_rate_limited',
            'total_target': 5,
            'completed_count': 2,
            'current_index': 2,
            'message': 'Paused due to provider rate limit.',
        }

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/stakeholders/priority/generate-notes/',
            {'action': 'resume', 'max_items': 10},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'paused_rate_limited')
        mock_generate.assert_called_once_with(str(self.project.id), action='resume', max_items=10)

    def test_generate_notes_rejects_invalid_action(self):
        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/stakeholders/priority/generate-notes/',
            {'action': 'invalid'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'validation_error')

    def test_flag_orphans_endpoint_flags_zero_degree_only(self):
        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/stakeholders/priority/flag-orphans/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['flagged_count'], 1)

        self.entity_a.refresh_from_db()
        self.entity_b.refresh_from_db()
        self.entity_c.refresh_from_db()

        self.assertFalse(self.entity_a.is_flagged)
        self.assertFalse(self.entity_b.is_flagged)
        self.assertTrue(self.entity_c.is_flagged)
