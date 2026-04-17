from django.contrib.auth import get_user_model
from django.test import TestCase

from ingestion.models import Document, Project
from ner.models import Entity, NERRun, Relation, EntityLabel, RelationshipType
from ner.serializers import EntitySerializer, RelationSerializer

User = get_user_model()


class TestNerModelsSerializersAdditional(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('ner_extra', 'ner_extra@example.com', 'Pass123')
        self.project = Project.objects.create(name='NER Additional', owner=self.user)
        self.doc = Document.objects.create(
            project=self.project,
            filename='a.txt',
            file_format=Document.FORMAT_TXT,
            processing_status=Document.STATUS_COMPLETED,
        )
        self.run = NERRun.objects.create(document_id=self.doc, provider='groq', model='llama3-8b-8192')

    def test_entity_defaults_and_str(self):
        entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            normalized_name='undp',
            raw_mentions=['UNDP'],
            confidence=0.95,
            document_id=self.doc,
            run=self.run,
            project=self.project,
        )
        self.assertFalse(entity.is_flagged)
        self.assertIn('UNDP', str(entity))

    def test_relation_str_and_serializer_shape(self):
        left = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNDP',
            normalized_name='undp',
            raw_mentions=['UNDP'],
            confidence=0.95,
            document_id=self.doc,
            run=self.run,
            project=self.project,
        )
        right = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='WHO',
            normalized_name='who',
            raw_mentions=['WHO'],
            confidence=0.91,
            document_id=self.doc,
            run=self.run,
            project=self.project,
        )
        relation = Relation.objects.create(
            document_id=self.doc,
            run=self.run,
            project=self.project,
            source_entity=left,
            target_entity=right,
            label='PARTNERS_WITH',
            confidence=0.88,
        )
        serialized = RelationSerializer(relation).data
        self.assertEqual(serialized['label'], 'PARTNERS_WITH')
        self.assertIn('UNDP', str(relation))

    def test_entity_serializer_includes_core_fields(self):
        entity = Entity.objects.create(
            entity_type='ORGANIZATION',
            canonical_name='UNICEF',
            normalized_name='unicef',
            raw_mentions=['UNICEF'],
            confidence=0.93,
            document_id=self.doc,
            run=self.run,
            project=self.project,
        )
        payload = EntitySerializer(entity).data
        self.assertEqual(payload['canonical_name'], 'UNICEF')
        self.assertIn('mention_count_dedup', payload)

    def test_taxonomy_model_strings(self):
        label = EntityLabel.objects.create(name='Organization Extra', node_shape='ellipse', color='#fff')
        rel = RelationshipType.objects.create(name='FUNDS_EXTRA', directional=True, color='#fff')
        self.assertEqual(str(label), 'Organization Extra')
        self.assertEqual(str(rel), 'FUNDS_EXTRA')
