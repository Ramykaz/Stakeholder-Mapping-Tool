"""Backlog-closure integration smoke tests for service modules."""

from importlib import import_module


SERVICE_MODULES = [
    'ingestion.services.chunker',
    'ingestion.services.embedder',
    'ingestion.services.context',
    'ingestion.services.web_source',
    'ner.services.azure_openai_client',
    'ner.services.costing',
    'ner.services.deduplicator',
    'ner.services.gemini_client',
    'ner.services.gemini_compat',
    'ner.services.groq_client',
    'ner.services.openai_client',
    'ner.services.pdf_utils',
    'ner.services.priority_table',
    'ner.services.provider_factory',
    'ner.services.provider_interface',
    'ner.services.provider_payloads',
    'ner.services.provider_runtime',
    'ner.services.relation_deduplicator',
    'ner.services.report_staleness',
    'ner.services.taxonomy',
    'ner.services.text_quality',
]


def test_service_modules_import_cleanly():
    for module_name in SERVICE_MODULES:
        module = import_module(module_name)
        assert module is not None, f'failed to import {module_name}'


def test_pdf_utils_contract():
    pdf_utils = import_module('ner.services.pdf_utils')
    assert pdf_utils.pdf_safe('Résumé')
    regular, bold, unicode_enabled = pdf_utils.resolve_pdf_fonts()
    assert isinstance(regular, str)
    assert isinstance(bold, str)
    assert isinstance(unicode_enabled, bool)


def test_provider_interface_contract_symbols_exist():
    module = import_module('ner.services.provider_interface')
    assert hasattr(module, 'JointExtractionRequest')
    assert hasattr(module, 'JointExtractionProvider')
    assert hasattr(module, 'RelationshipTypeInput')


def test_provider_runtime_error_helpers_callable():
    runtime = import_module('ner.services.provider_runtime')
    assert callable(runtime.normalize_provider_error_kind)
    assert callable(runtime.is_rate_limit_error)
    assert callable(runtime.is_auth_config_error)
