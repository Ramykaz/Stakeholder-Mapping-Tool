"""Tests for EntityFlagView and graph exclusion of flagged entities."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


User = get_user_model()


@pytest.mark.django_db
class TestEntityFlagView:

    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='flagtester', password='pass')
        self.client.force_authenticate(self.user)

    def _make_entity(self):
        from ingestion.models import Project, Document
        from ner.models import Entity, NERRun
        project = Project.objects.create(name='FlagProject', owner=self.user)
        doc = Document.objects.create(
            project=project, filename='test.txt', file_format='txt',
            processing_status='completed',
        )
        run = NERRun.objects.create(document_id=doc, provider='groq', model='llama', status='completed')
        entity = Entity.objects.create(
            canonical_name='Test Entity', entity_type='PERSON',
            confidence=0.9, document_id=doc, run=run, project=project,
        )
        return entity, project

    def test_flag_sets_is_flagged_true(self):
        entity, _ = self._make_entity()
        resp = self.client.post(f'/api/v1/entities/{entity.id}/flag/', {'is_flagged': True}, format='json')
        assert resp.status_code == 200
        entity.refresh_from_db()
        assert entity.is_flagged is True

    def test_unflag_restores_entity(self):
        entity, _ = self._make_entity()
        entity.is_flagged = True
        entity.save()
        resp = self.client.post(f'/api/v1/entities/{entity.id}/flag/', {'is_flagged': False}, format='json')
        assert resp.status_code == 200
        entity.refresh_from_db()
        assert entity.is_flagged is False

    def test_flagged_entity_absent_from_graph_api(self):
        entity, project = self._make_entity()
        entity.is_flagged = True
        entity.save()
        resp = self.client.get(f'/api/v1/projects/{project.id}/graph/')
        assert resp.status_code == 200
        node_ids = [n['id'] for n in resp.data['nodes']]
        assert str(entity.id) not in node_ids
