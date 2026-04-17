"""Unit/integration tests for ner.services.engagement_notes."""

from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.test import TestCase

from ingestion.models import Project

User = get_user_model()

PATCH_CLOSE = 'ner.services.engagement_notes.close_old_connections'


class TestGenerateNotesForProject(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('notes_user', 'notes@example.com', 'Pass123')
        self.project = Project.objects.create(name='Notes Project', owner=self.user)

    @patch(PATCH_CLOSE)
    def test_project_not_found_returns_error_status(self, _close):
        from ner.services.engagement_notes import generate_notes_for_project
        result = generate_notes_for_project('00000000-0000-0000-0000-000000000000')
        assert result['status'] == 'error'
        assert result['total_target'] == 0

    @patch(PATCH_CLOSE)
    @patch('ner.services.engagement_notes.compute_priority_scores')
    def test_no_entities_returns_completed_immediately(self, mock_scores, _close):
        from ner.services.engagement_notes import generate_notes_for_project
        mock_scores.return_value = []
        result = generate_notes_for_project(str(self.project.id))
        assert result['status'] == 'completed'
        assert result['total_target'] == 0

    @patch(PATCH_CLOSE)
    @patch('ner.services.engagement_notes.compute_priority_scores')
    def test_stop_action_returns_cancelled(self, mock_scores, _close):
        from ner.services.engagement_notes import generate_notes_for_project
        mock_scores.return_value = [{'entity_id': '1', 'name': 'UNDP'}]
        result = generate_notes_for_project(str(self.project.id), action='stop')
        assert result['status'] == 'cancelled'

    @patch(PATCH_CLOSE)
    @patch('ner.services.engagement_notes._call_provider')
    @patch('ner.services.engagement_notes.search_chunks_for_entity')
    @patch('ner.services.engagement_notes.resolve_provider_model_for_project')
    @patch('ner.services.engagement_notes.compute_priority_scores')
    def test_successful_note_generation(
        self, mock_scores, mock_resolve, mock_search, mock_call, _close
    ):
        from ner.services.engagement_notes import generate_notes_for_project
        from ner.models import Entity
        from ingestion.models import Document

        document = Document.objects.create(
            filename='test.txt', file_format='txt', project=self.project
        )
        entity = Entity.objects.create(
            project=self.project,
            document_id=document,
            entity_type='ORG',
            canonical_name='UNDP',
            normalized_name='undp',
            raw_mentions=['UNDP'],
            confidence=0.9,
            mention_count_dedup=1,
        )

        mock_scores.return_value = [{'entity_id': str(entity.id), 'name': 'UNDP'}]
        mock_resolve.return_value = MagicMock(provider='groq', model='llama3-8b-8192')
        mock_search.return_value = []
        mock_call.return_value = 'Engage UNDP through bilateral meetings.'

        result = generate_notes_for_project(str(self.project.id))

        assert result['status'] in ('completed', 'running')
        assert result['completed_count'] >= 1

    @patch(PATCH_CLOSE)
    @patch('ner.services.engagement_notes._call_provider')
    @patch('ner.services.engagement_notes.search_chunks_for_entity')
    @patch('ner.services.engagement_notes.resolve_provider_model_for_project')
    @patch('ner.services.engagement_notes.compute_priority_scores')
    def test_rate_limit_returns_paused_status(
        self, mock_scores, mock_resolve, mock_search, mock_call, _close
    ):
        from ner.services.engagement_notes import generate_notes_for_project
        from ner.models import Entity
        from ingestion.models import Document

        document = Document.objects.create(
            filename='test2.txt', file_format='txt', project=self.project
        )
        entity = Entity.objects.create(
            project=self.project,
            document_id=document,
            entity_type='ORG',
            canonical_name='UNICEF',
            normalized_name='unicef',
            raw_mentions=['UNICEF'],
            confidence=0.9,
            mention_count_dedup=1,
        )

        mock_scores.return_value = [{'entity_id': str(entity.id), 'name': 'UNICEF'}]
        mock_resolve.return_value = MagicMock(provider='groq', model='llama3-8b-8192')
        mock_search.return_value = []
        mock_call.side_effect = Exception('429 rate limit exceeded')

        result = generate_notes_for_project(str(self.project.id))
        assert result['status'] == 'paused_rate_limited'
