"""Tests for DeduplicationReviewListView and ReviewCandidateResolveView."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.mark.django_db
class TestDeduplicationReviewAPI:

    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='reviewtester', password='pass')
        self.client.force_authenticate(self.user)

    def _make_candidate(self):
        from ingestion.models import Project, Document
        from ner.models import Entity, NERRun, EntityReviewCandidate
        project = Project.objects.create(name='ReviewProject', owner=self.user)
        doc = Document.objects.create(
            project=project, filename='test.txt', file_format='txt',
            processing_status='completed',
        )
        run = NERRun.objects.create(document_id=doc, provider='groq', model='llama', status='completed')
        e1 = Entity.objects.create(
            canonical_name='Alice Smith', entity_type='PERSON',
            confidence=0.9, document_id=doc, run=run, project=project,
        )
        e2 = Entity.objects.create(
            canonical_name='A. Smith', entity_type='PERSON',
            confidence=0.85, document_id=doc, run=run, project=project,
        )
        candidate = EntityReviewCandidate.objects.create(
            document=doc, left_entity=e1, right_entity=e2,
            entity_type='PERSON', similarity_score=0.92, status='pending',
        )
        return candidate, project

    def test_review_list_returns_pending(self):
        candidate, project = self._make_candidate()
        resp = self.client.get(f'/api/v1/projects/{project.id}/review/')
        assert resp.status_code == 200
        assert resp.data['pending_count'] >= 1
        assert len(resp.data['results']) >= 1

    def test_keep_separate_resolves_candidate(self):
        candidate, project = self._make_candidate()
        resp = self.client.post(
            f'/api/v1/review-candidates/{candidate.id}/resolve/',
            {'action': 'keep_separate'}, format='json',
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'kept_separate'

    def test_merge_flags_losing_entity(self):
        candidate, project = self._make_candidate()
        resp = self.client.post(
            f'/api/v1/review-candidates/{candidate.id}/resolve/',
            {'action': 'merge'}, format='json',
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'merged'
        candidate.right_entity.refresh_from_db()
        assert candidate.right_entity.is_flagged is True

    def test_non_owner_denied(self):
        candidate, project = self._make_candidate()
        other_user = User.objects.create_user(username='other_reviewtester', password='pass')
        other_client = APIClient()
        other_client.force_authenticate(other_user)
        resp = other_client.get(f'/api/v1/projects/{project.id}/review/')
        assert resp.status_code == 404
