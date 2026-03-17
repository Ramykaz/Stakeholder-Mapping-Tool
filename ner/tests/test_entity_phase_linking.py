"""US-06 tests for phase variant parent-link behavior."""

from django.test import TestCase

from ingestion.models import Document
from ner.models import Entity
from ner.services.entity_dedup_service import EntityDedupService


class TestEntityPhaseLinking(TestCase):
    def setUp(self):
        self.document = Document.objects.create(
            filename='phase.txt',
            file_format='txt',
            processing_status='completed',
        )
        self.service = EntityDedupService()

    def test_phase_variant_is_linked_to_parent_entity(self):
        parent = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP Initiative',
            normalized_name='undp initiative',
            raw_mentions=['UNDP Initiative'],
            confidence=0.90,
            document_id=self.document,
            mention_count_dedup=1,
        )

        created = self.service.upsert_entities_for_save(
            [{'entity_type': 'ORGANIZATION', 'text': 'UNDP Initiative Phase 1', 'confidence': 0.83}],
            self.document,
            existing_entities=Entity.objects.filter(document_id=self.document),
        )

        self.assertEqual(len(created), 1)
        phase_entity = created[0]
        self.assertEqual(phase_entity.parent_entity_id, parent.id)

    def test_phase_variant_not_auto_merged_even_with_high_similarity(self):
        Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='Country Program',
            normalized_name='country program',
            raw_mentions=['Country Program'],
            confidence=0.88,
            document_id=self.document,
            mention_count_dedup=1,
        )

        created = self.service.upsert_entities_for_save(
            [{'entity_type': 'ORGANIZATION', 'text': 'Country Program 2026', 'confidence': 0.84}],
            self.document,
            existing_entities=Entity.objects.filter(document_id=self.document),
        )

        self.assertEqual(len(created), 1)
        self.assertEqual(Entity.objects.filter(document_id=self.document).count(), 2)
