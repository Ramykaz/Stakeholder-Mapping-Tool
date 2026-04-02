"""US3 tests for extraction guidance prompt injection behavior."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from ingestion.models import Chunk, Document, ExtractionGuidance, Project
from ner.services.pipeline import extract_relations_for_document


User = get_user_model()


class TestGuidanceInjection(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('guidance_user', 'guidance@example.com', 'Password123')
        self.project = Project.objects.create(name='Guidance Project', owner=self.user)
        self.document = Document.objects.create(
            filename='guidance.txt',
            file_format='txt',
            processing_status='completed',
            project=self.project,
        )
        self.chunk = Chunk.objects.create(
            document=self.document,
            text='Alice works with UNDP in Nairobi.',
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=10,
        )

    @patch('ner.services.pipeline.get_active_relationship_types')
    @patch('ner.services.pipeline.get_active_entity_labels')
    @patch('ner.services.pipeline._extract_chunk_joint')
    def test_guidance_items_included_and_ordered(self, mock_joint, mock_labels, mock_rels):
        mock_labels.return_value = ['PERSON', 'ORGANIZATION']
        mock_rels.return_value = [{'name': 'WORKS_WITH', 'directional': True}]
        mock_joint.return_value = {'entities': [], 'relationships': []}

        ExtractionGuidance.objects.create(project=self.project, text='Second rule', order=2)
        ExtractionGuidance.objects.create(project=self.project, text='First rule', order=1)

        extract_relations_for_document(
            str(self.document.id),
            provider='groq',
            model='llama-3.1-8b-instant',
            concept_note='Base context',
        )

        _, kwargs = mock_joint.call_args
        guided_context = kwargs['concept_note']
        self.assertIn('Base context', guided_context)
        self.assertIn('Additional extraction guidance (highest priority):', guided_context)
        self.assertLess(guided_context.index('- First rule'), guided_context.index('- Second rule'))

    @patch('ner.services.pipeline.get_active_relationship_types')
    @patch('ner.services.pipeline.get_active_entity_labels')
    @patch('ner.services.pipeline._extract_chunk_joint')
    def test_empty_guidance_does_not_add_guidance_block(self, mock_joint, mock_labels, mock_rels):
        mock_labels.return_value = ['PERSON']
        mock_rels.return_value = [{'name': 'WORKS_WITH', 'directional': True}]
        mock_joint.return_value = {'entities': [], 'relationships': []}

        extract_relations_for_document(
            str(self.document.id),
            provider='groq',
            model='llama-3.1-8b-instant',
            concept_note='Plain context only',
        )

        _, kwargs = mock_joint.call_args
        guided_context = kwargs['concept_note']
        self.assertEqual(guided_context, 'Plain context only')
        self.assertNotIn('Additional extraction guidance (highest priority):', guided_context)

    @patch('ner.services.pipeline.get_active_relationship_types')
    @patch('ner.services.pipeline.get_active_entity_labels')
    @patch('ner.services.pipeline._extract_chunk_joint')
    def test_guidance_without_base_context_still_injected(self, mock_joint, mock_labels, mock_rels):
        mock_labels.return_value = ['PERSON']
        mock_rels.return_value = [{'name': 'WORKS_WITH', 'directional': True}]
        mock_joint.return_value = {'entities': [], 'relationships': []}

        ExtractionGuidance.objects.create(project=self.project, text='Focus on institutions', order=0)

        extract_relations_for_document(
            str(self.document.id),
            provider='groq',
            model='llama-3.1-8b-instant',
            concept_note='',
        )

        _, kwargs = mock_joint.call_args
        guided_context = kwargs['concept_note']
        self.assertIn('Additional extraction guidance (highest priority):', guided_context)
        self.assertIn('- Focus on institutions', guided_context)
