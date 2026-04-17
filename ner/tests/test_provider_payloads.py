"""Unit tests for ner.services.provider_payloads frozen dataclasses."""

import pytest
from dataclasses import FrozenInstanceError

from ner.services.provider_payloads import (
    ProviderRelationshipType,
    ProviderExtractionRequest,
    ProviderEntityResult,
    ProviderRelationshipResult,
    ProviderUsage,
    ProviderExtractionResponse,
)


class TestProviderRelationshipType:
    def test_instantiation(self):
        rt = ProviderRelationshipType(name='FUNDS', directional=True)
        assert rt.name == 'FUNDS'
        assert rt.directional is True

    def test_non_directional(self):
        rt = ProviderRelationshipType(name='PARTNERS_WITH', directional=False)
        assert rt.directional is False

    def test_frozen_name(self):
        rt = ProviderRelationshipType(name='FUNDS', directional=True)
        with pytest.raises(FrozenInstanceError):
            rt.name = 'OTHER'

    def test_frozen_directional(self):
        rt = ProviderRelationshipType(name='FUNDS', directional=True)
        with pytest.raises(FrozenInstanceError):
            rt.directional = False


class TestProviderExtractionRequest:
    def _make(self, **kwargs):
        defaults = dict(
            chunk_text='Some text about stakeholders.',
            concept_note='A concept note.',
            entity_labels=['PERSON', 'ORG'],
            relationship_types=[ProviderRelationshipType('FUNDS', True)],
            provider='groq',
            model='llama3-8b-8192',
        )
        defaults.update(kwargs)
        return ProviderExtractionRequest(**defaults)

    def test_instantiation(self):
        req = self._make()
        assert req.chunk_text == 'Some text about stakeholders.'
        assert req.provider == 'groq'
        assert req.model == 'llama3-8b-8192'
        assert req.entity_labels == ['PERSON', 'ORG']

    def test_concept_note_none(self):
        req = self._make(concept_note=None)
        assert req.concept_note is None

    def test_empty_entity_labels(self):
        req = self._make(entity_labels=[])
        assert req.entity_labels == []

    def test_multiple_relationship_types(self):
        rts = [
            ProviderRelationshipType('FUNDS', True),
            ProviderRelationshipType('PARTNERS_WITH', False),
        ]
        req = self._make(relationship_types=rts)
        assert len(req.relationship_types) == 2

    def test_frozen(self):
        req = self._make()
        with pytest.raises(FrozenInstanceError):
            req.provider = 'openai'


class TestProviderEntityResult:
    def test_required_fields(self):
        entity = ProviderEntityResult(text='UN', label='ORG')
        assert entity.text == 'UN'
        assert entity.label == 'ORG'

    def test_confidence_defaults_to_none(self):
        entity = ProviderEntityResult(text='UN', label='ORG')
        assert entity.confidence is None

    def test_confidence_set(self):
        entity = ProviderEntityResult(text='UN', label='ORG', confidence=0.95)
        assert entity.confidence == pytest.approx(0.95)

    def test_frozen(self):
        entity = ProviderEntityResult(text='UN', label='ORG')
        with pytest.raises(FrozenInstanceError):
            entity.text = 'WHO'


class TestProviderRelationshipResult:
    def test_required_fields(self):
        rel = ProviderRelationshipResult(source_text='UNDP', type='FUNDS', target_text='NGO')
        assert rel.source_text == 'UNDP'
        assert rel.type == 'FUNDS'
        assert rel.target_text == 'NGO'

    def test_confidence_defaults_to_none(self):
        rel = ProviderRelationshipResult(source_text='A', type='B', target_text='C')
        assert rel.confidence is None

    def test_confidence_set(self):
        rel = ProviderRelationshipResult(source_text='A', type='B', target_text='C', confidence=0.8)
        assert rel.confidence == pytest.approx(0.8)

    def test_frozen(self):
        rel = ProviderRelationshipResult(source_text='A', type='B', target_text='C')
        with pytest.raises(FrozenInstanceError):
            rel.type = 'X'


class TestProviderUsage:
    def test_all_defaults_zero(self):
        usage = ProviderUsage()
        assert usage.input_tokens == 0
        assert usage.output_tokens == 0
        assert usage.cached_input_tokens == 0
        assert usage.cost_usd == 0.0

    def test_set_values(self):
        usage = ProviderUsage(input_tokens=100, output_tokens=50, cached_input_tokens=10, cost_usd=0.001)
        assert usage.input_tokens == 100
        assert usage.output_tokens == 50
        assert usage.cached_input_tokens == 10
        assert usage.cost_usd == pytest.approx(0.001)

    def test_partial_defaults(self):
        usage = ProviderUsage(input_tokens=200)
        assert usage.input_tokens == 200
        assert usage.output_tokens == 0
        assert usage.cost_usd == 0.0

    def test_frozen(self):
        usage = ProviderUsage()
        with pytest.raises(FrozenInstanceError):
            usage.input_tokens = 99


class TestProviderExtractionResponse:
    def _make_entity(self):
        return ProviderEntityResult(text='UN', label='ORG', confidence=0.9)

    def _make_rel(self):
        return ProviderRelationshipResult(source_text='UNDP', type='FUNDS', target_text='NGO')

    def test_instantiation_with_populated_lists(self):
        usage = ProviderUsage(input_tokens=50, output_tokens=20)
        response = ProviderExtractionResponse(
            entities=[self._make_entity()],
            relationships=[self._make_rel()],
            usage=usage,
        )
        assert len(response.entities) == 1
        assert len(response.relationships) == 1
        assert response.usage.input_tokens == 50

    def test_empty_entities_and_relationships(self):
        response = ProviderExtractionResponse(
            entities=[],
            relationships=[],
            usage=ProviderUsage(),
        )
        assert response.entities == []
        assert response.relationships == []

    def test_nested_entity_fields_accessible(self):
        response = ProviderExtractionResponse(
            entities=[self._make_entity()],
            relationships=[],
            usage=ProviderUsage(),
        )
        assert response.entities[0].text == 'UN'
        assert response.entities[0].label == 'ORG'

    def test_frozen(self):
        response = ProviderExtractionResponse(
            entities=[],
            relationships=[],
            usage=ProviderUsage(),
        )
        with pytest.raises(FrozenInstanceError):
            response.entities = []
