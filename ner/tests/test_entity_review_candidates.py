"""US-06 tests for review candidate list/resolve APIs."""

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Document, Project
from ner.models import Entity, EntityReviewCandidate


User = get_user_model()


class TestEntityReviewCandidatesApi(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('reviewer', 'reviewer@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.project = Project.objects.create(name='Review Project', owner=self.user)
        self.document = Document.objects.create(
            filename='review.txt',
            file_format='txt',
            processing_status='completed',
            project=self.project,
        )
        self.left = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            normalized_name='undp',
            raw_mentions=['UNDP'],
            confidence=0.90,
            document_id=self.document,
            mention_count_dedup=1,
            needs_review=True,
        )
        self.right = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='United Nations Development Programme',
            normalized_name='united nations development programme',
            raw_mentions=['United Nations Development Programme'],
            confidence=0.85,
            document_id=self.document,
            mention_count_dedup=1,
            needs_review=True,
        )
        self.candidate = EntityReviewCandidate.objects.create(
            document=self.document,
            left_entity=self.left,
            right_entity=self.right,
            entity_type='ORGANIZATION',
            similarity_score=0.78,
            status=EntityReviewCandidate.STATUS_PENDING,
        )

    def test_list_pending_candidates(self):
        response = self.client.get(
            f'/api/v1/documents/{self.document.id}/entities/review-candidates/'
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['total_count'], 1)
        self.assertEqual(payload['candidates'][0]['id'], str(self.candidate.id))

    def test_resolve_keep_separate(self):
        response = self.client.post(
            f'/api/v1/documents/{self.document.id}/entities/review-candidates/{self.candidate.id}/resolve/',
            data={'action': 'keep_separate'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.candidate.refresh_from_db()
        self.assertEqual(self.candidate.status, EntityReviewCandidate.STATUS_KEPT_SEPARATE)

    def test_resolve_merge(self):
        response = self.client.post(
            f'/api/v1/documents/{self.document.id}/entities/review-candidates/{self.candidate.id}/resolve/',
            data={'action': 'merge'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(EntityReviewCandidate.objects.filter(id=self.candidate.id).exists())
        self.assertEqual(Entity.objects.filter(document_id=self.document).count(), 1)

    def test_resolve_stale_candidate_returns_400(self):
        self.candidate.status = EntityReviewCandidate.STATUS_KEPT_SEPARATE
        self.candidate.save(update_fields=['status'])

        response = self.client.post(
            f'/api/v1/documents/{self.document.id}/entities/review-candidates/{self.candidate.id}/resolve/',
            data={'action': 'merge'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
