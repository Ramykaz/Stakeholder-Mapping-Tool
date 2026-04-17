"""Unit/integration tests for ner.management.commands.cleanup_orphan_entities."""

from io import StringIO
from unittest.mock import patch
from django.test import TestCase
from django.core.management import call_command
from django.contrib.auth import get_user_model

User = get_user_model()


class TestCleanupOrphanEntitiesCommand(TestCase):
    def setUp(self):
        from ingestion.models import Project
        self.user = User.objects.create_user('cmd_user', 'cmd@example.com', 'Pass123')
        self.project = Project.objects.create(name='Cleanup Project', owner=self.user)

    def _call_cmd(self, **kwargs):
        out = StringIO()
        call_command('cleanup_orphan_entities', stdout=out, **kwargs)
        return out.getvalue()

    @patch('ner.management.commands.cleanup_orphan_entities.cleanup_orphan_entities')
    def test_no_orphans_prints_success_message(self, mock_cleanup):
        mock_cleanup.return_value = {'matched_entities': 0, 'deleted_records': 0, 'entity_ids': []}
        output = self._call_cmd()
        assert 'No orphan entities found' in output

    @patch('ner.management.commands.cleanup_orphan_entities.cleanup_orphan_entities')
    def test_orphans_found_prints_deleted_count(self, mock_cleanup):
        mock_cleanup.return_value = {'matched_entities': 5, 'deleted_records': 5, 'entity_ids': []}
        output = self._call_cmd()
        assert '5' in output

    @patch('ner.management.commands.cleanup_orphan_entities.cleanup_orphan_entities')
    def test_project_id_argument_passed_to_service(self, mock_cleanup):
        mock_cleanup.return_value = {'matched_entities': 0, 'deleted_records': 0, 'entity_ids': []}
        self._call_cmd(project_id=str(self.project.id))
        mock_cleanup.assert_called_once_with(project_id=str(self.project.id))

    @patch('ner.management.commands.cleanup_orphan_entities.cleanup_orphan_entities')
    def test_no_project_id_passes_none(self, mock_cleanup):
        mock_cleanup.return_value = {'matched_entities': 0, 'deleted_records': 0, 'entity_ids': []}
        self._call_cmd()
        mock_cleanup.assert_called_once_with(project_id=None)


class TestCleanupOrphanEntitiesService(TestCase):
    """Integration tests for cleanup_orphan_entities() service function."""

    def setUp(self):
        from ingestion.models import Project, Document
        self.user = User.objects.create_user('svc_user', 'svc@example.com', 'Pass123')
        self.project = Project.objects.create(name='Service Cleanup', owner=self.user)
        self.document = Document.objects.create(
            filename='svc_test.txt', file_format='txt', project=self.project
        )

    def test_no_orphans_returns_zero_counts(self):
        from ner.services.pipeline import cleanup_orphan_entities
        result = cleanup_orphan_entities()
        assert result['matched_entities'] == 0
        assert result['deleted_records'] == 0

    def test_entity_without_mentions_is_orphan(self):
        from ner.services.pipeline import cleanup_orphan_entities
        from ner.models import Entity

        # Create entity with no mentions
        entity = Entity.objects.create(
            project=self.project,
            document_id=self.document,
            entity_type='ORG',
            canonical_name='OrphanOrg',
            normalized_name='orphanorg',
            raw_mentions=['OrphanOrg'],
            confidence=0.8,
            mention_count_dedup=0,
        )

        result = cleanup_orphan_entities()
        assert result['matched_entities'] >= 1
        assert Entity.objects.filter(id=entity.id).count() == 0

    def test_project_id_filter_scopes_deletion(self):
        from ner.services.pipeline import cleanup_orphan_entities
        from ner.models import Entity
        from ingestion.models import Project

        from ingestion.models import Document
        other_project = Project.objects.create(name='Other', owner=self.user)
        other_document = Document.objects.create(
            filename='other_test.txt', file_format='txt', project=other_project
        )
        entity_in_scope = Entity.objects.create(
            project=self.project,
            document_id=self.document,
            entity_type='ORG',
            canonical_name='InScopeOrg',
            normalized_name='inscopeorg',
            raw_mentions=['InScopeOrg'],
            confidence=0.8,
            mention_count_dedup=0,
        )
        entity_out_of_scope = Entity.objects.create(
            project=other_project,
            document_id=other_document,
            entity_type='ORG',
            canonical_name='OutOfScopeOrg',
            normalized_name='outofscopeorg',
            raw_mentions=['OutOfScopeOrg'],
            confidence=0.8,
            mention_count_dedup=0,
        )

        cleanup_orphan_entities(project_id=str(self.project.id))

        assert Entity.objects.filter(id=entity_in_scope.id).count() == 0
        assert Entity.objects.filter(id=entity_out_of_scope.id).count() == 1
