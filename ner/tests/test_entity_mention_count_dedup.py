"""US-06 tests for mention deduplicated count behavior."""

from django.test import TestCase

from ingestion.models import Document
from ner.models import Entity
from ner.services.entity_dedup_service import EntityDedupService


class TestEntityMentionCountDedup(TestCase):
    def setUp(self):
        self.document = Document.objects.create(
            filename='mentions.txt',
            file_format='txt',
            processing_status='completed',
        )
        self.service = EntityDedupService()

    def test_mention_count_dedup_uses_unique_normalized_mentions(self):
        existing = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='World Bank',
            normalized_name='world bank',
            raw_mentions=['World Bank'],
            confidence=0.70,
            document_id=self.document,
            mention_count_dedup=1,
        )

        self.service.upsert_entities_for_save(
            [
                {'entity_type': 'ORGANIZATION', 'text': 'world bank', 'confidence': 0.71},
                {'entity_type': 'ORGANIZATION', 'text': '  World   Bank ', 'confidence': 0.72},
                {'entity_type': 'ORGANIZATION', 'text': 'WorldBank', 'confidence': 0.73},
            ],
            self.document,
            existing_entities=Entity.objects.filter(document_id=self.document),
        )

        existing.refresh_from_db()
        self.assertEqual(existing.mention_count_dedup, 2)
