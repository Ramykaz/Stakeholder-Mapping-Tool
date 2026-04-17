import importlib

from django.test import TestCase

from ner.services.pdf_utils import pdf_safe, resolve_pdf_fonts
from ner.services.provider_interface import (
    JointExtractionProvider,
    JointExtractionRequest,
    RelationshipTypeInput,
    normalize_provider_test_response,
)


class DummyProvider:
    def extract_joint(self, payload: JointExtractionRequest) -> dict:
        return {'entities': [], 'relationships': [], 'model': payload.model}


class TestProviderPdfInterfaceAdditional(TestCase):
    def test_pdf_safe_returns_ascii_friendly_text(self):
        text = pdf_safe('Café résumé')
        self.assertIsInstance(text, str)
        self.assertTrue(len(text) > 0)

    def test_resolve_pdf_fonts_returns_tuple(self):
        font_regular, font_bold, use_unicode = resolve_pdf_fonts()
        self.assertIsInstance(font_regular, str)
        self.assertIsInstance(font_bold, str)
        self.assertIsInstance(use_unicode, bool)

    def test_provider_interface_contract_payload(self):
        payload = JointExtractionRequest(
            chunk_text='UNDP works with WHO',
            concept_note='context',
            entity_labels=['ORGANIZATION'],
            relationship_types=[RelationshipTypeInput(name='PARTNERS_WITH', directional=False)],
            model='llama3-8b-8192',
        )
        provider: JointExtractionProvider = DummyProvider()
        out = provider.extract_joint(payload)
        self.assertEqual(out['model'], 'llama3-8b-8192')

    def test_normalize_provider_test_response_shape(self):
        normalized = normalize_provider_test_response(
            provider='groq',
            model='llama3',
            status='ok',
            latency_ms=10,
        )
        self.assertEqual(normalized['status'], 'ok')
        self.assertEqual(normalized['provider'], 'groq')

    def test_import_missing_integration_modules(self):
        for module_name in [
            'ingestion.models',
            'ingestion.services.chunker',
            'ingestion.services.embedder',
            'ingestion.services.context',
            'ingestion.services.web_source',
            'ner.models',
            'ner.serializers',
            'ner.services.pdf_utils',
            'ner.services.azure_openai_client',
            'ner.services.costing',
            'ner.services.deduplicator',
            'ner.services.gemini_client',
            'ner.services.gemini_compat',
            'ner.services.groq_client',
            'ner.services.openai_client',
            'ner.services.priority_table',
            'ner.services.provider_factory',
            'ner.services.provider_interface',
            'ner.services.provider_payloads',
            'ner.services.provider_runtime',
            'ner.services.relation_deduplicator',
            'ner.services.report_staleness',
            'ner.services.taxonomy',
            'ner.services.text_quality',
            'stakeholder_analysis.celery',
            'stakeholder_analysis.auth_views',
            'stakeholder_analysis.auth_urls',
        ]:
            module = importlib.import_module(module_name)
            self.assertIsNotNone(module)
