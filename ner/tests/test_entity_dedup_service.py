"""Tests for US-06 entity dedup service behavior."""

from unittest.mock import patch

from django.test import TestCase

from ingestion.models import Document
from ner.models import Entity, EntityAlias, EntityReviewCandidate
from ner.services.entity_dedup_service import EntityDedupService


class TestEntityDedupService(TestCase):
    def setUp(self):
        self.document = Document.objects.create(
            filename='dedup.txt',
            file_format='txt',
            processing_status='completed',
        )
        self.service = EntityDedupService()

    def test_exact_normalized_match_merges_same_type(self):
        extracted = [
            {'entity_type': 'ORGANIZATION', 'text': 'Acme Initiative', 'confidence': 0.60},
            {'entity_type': 'ORGANIZATION', 'text': ' acme initiative ', 'confidence': 0.90},
        ]

        created = self.service.upsert_entities_for_save(extracted, self.document)

        self.assertEqual(len(created), 1)
        self.assertEqual(Entity.objects.filter(document_id=self.document).count(), 1)
        entity = Entity.objects.get(document_id=self.document)
        self.assertEqual(entity.normalized_name, 'acme initiative')
        self.assertEqual(entity.confidence, 0.90)

    def test_acronym_expansion_merges_into_existing_entity(self):
        existing = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='United Nations Development Programme',
            normalized_name='united nations development programme',
            raw_mentions=['United Nations Development Programme'],
            confidence=0.80,
            document_id=self.document,
            mention_count_dedup=1,
        )

        created = self.service.upsert_entities_for_save(
            [{'entity_type': 'ORGANIZATION', 'text': 'UNDP', 'confidence': 0.85}],
            self.document,
            existing_entities=Entity.objects.filter(document_id=self.document),
        )

        self.assertEqual(created, [])
        existing.refresh_from_db()
        self.assertTrue(EntityAlias.objects.filter(entity=existing, alias_text='UNDP', source='acronym').exists())

    def test_fuzzy_auto_merge_same_type(self):
        existing = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='World Health Organization',
            normalized_name='world health organization',
            raw_mentions=['World Health Organization'],
            confidence=0.75,
            document_id=self.document,
            mention_count_dedup=1,
        )

        with patch.object(EntityDedupService, '_fuzzy_score', return_value=0.91):
            created = self.service.upsert_entities_for_save(
                [{'entity_type': 'ORGANIZATION', 'text': 'World Health Org', 'confidence': 0.81}],
                self.document,
                existing_entities=Entity.objects.filter(document_id=self.document),
            )

        self.assertEqual(created, [])
        existing.refresh_from_db()
        self.assertGreaterEqual(existing.confidence, 0.81)
        self.assertTrue(EntityAlias.objects.filter(entity=existing, alias_text='World Health Org').exists())

    def test_fuzzy_borderline_creates_review_candidate(self):
        existing = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Food and Agriculture Organization',
            normalized_name='food and agriculture organization',
            raw_mentions=['Food and Agriculture Organization'],
            confidence=0.84,
            document_id=self.document,
            mention_count_dedup=1,
        )

        with patch.object(EntityDedupService, '_fuzzy_score', return_value=0.75):
            created = self.service.upsert_entities_for_save(
                [{'entity_type': 'ORGANIZATION', 'text': 'Food & Agriculture Org', 'confidence': 0.70}],
                self.document,
                existing_entities=Entity.objects.filter(document_id=self.document),
            )

        self.assertEqual(len(created), 1)
        new_entity = created[0]
        existing.refresh_from_db()
        new_entity.refresh_from_db()
        self.assertTrue(existing.needs_review)
        self.assertTrue(new_entity.needs_review)
        self.assertTrue(
            EntityReviewCandidate.objects.filter(
                document=self.document,
                status=EntityReviewCandidate.STATUS_PENDING,
            ).exists()
        )

    def test_cross_type_entities_never_merge(self):
        Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            normalized_name='undp',
            raw_mentions=['UNDP'],
            confidence=0.80,
            document_id=self.document,
            mention_count_dedup=1,
        )

        with patch.object(EntityDedupService, '_fuzzy_score', return_value=0.99):
            created = self.service.upsert_entities_for_save(
                [{'entity_type': 'LOCATION', 'text': 'UNDP', 'confidence': 0.77}],
                self.document,
                existing_entities=Entity.objects.filter(document_id=self.document),
            )

        self.assertEqual(len(created), 1)
        self.assertEqual(
            Entity.objects.filter(document_id=self.document, entity_type='ORGANIZATION').count(),
            1,
        )
        self.assertEqual(
            Entity.objects.filter(document_id=self.document, entity_type='LOCATION').count(),
            1,
        )
