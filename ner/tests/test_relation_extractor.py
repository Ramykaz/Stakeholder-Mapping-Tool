"""
Test suite for relation extraction service.
"""
import pytest
from unittest.mock import MagicMock
from ner.services.relation_extractor import validate_relations


def test_validate_relations_discard_dangling_refs():
    """Test that relations with dangling entity references are discarded."""
    entity1 = MagicMock(canonical_name="John Smith", id="e1")
    entity2 = MagicMock(canonical_name="Acme Corp", id="e2")
    entities = [entity1, entity2]
    
    triplets = [
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": "WORKS_AT", "confidence": 0.9},
        {"source_entity": "John Smith", "target_entity": "Unknown Entity", "label": "KNOWS", "confidence": 0.8},  # dangling
    ]
    
    validated = validate_relations(triplets, entities)
    
    assert len(validated) == 1
    assert validated[0]['label'] == 'WORKS_AT'


def test_validate_relations_discard_self_loops():
    """Test that self-loop relations are discarded."""
    entity1 = MagicMock(canonical_name="John Smith", id="e1")
    entity2 = MagicMock(canonical_name="Acme Corp", id="e2")
    entities = [entity1, entity2]
    
    triplets = [
        {"source_entity": "John Smith", "target_entity": "John Smith", "label": "MANAGES", "confidence": 0.8},  # self-loop
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": "WORKS_AT", "confidence": 0.9},
    ]
    
    validated = validate_relations(triplets, entities)
    
    assert len(validated) == 1
    assert validated[0]['label'] == 'WORKS_AT'


def test_validate_relations_discard_low_confidence():
    """Test that relations below confidence threshold are discarded."""
    entity1 = MagicMock(canonical_name="John Smith", id="e1")
    entity2 = MagicMock(canonical_name="Acme Corp", id="e2")
    entities = [entity1, entity2]
    
    triplets = [
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": "WORKS_AT", "confidence": 0.9},
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": "MAYBE_KNOWS", "confidence": 0.3},  # too low
    ]
    
    validated = validate_relations(triplets, entities)
    
    assert len(validated) == 1
    assert validated[0]['confidence'] >= 0.5


def test_validate_relations_clamps_confidence_range():
    """Test that relations with confidence outside 0.0-1.0 are clamped."""
    entity1 = MagicMock(canonical_name="John Smith", id="e1")
    entity2 = MagicMock(canonical_name="Acme Corp", id="e2")
    entities = [entity1, entity2]
    
    triplets = [
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": "WORKS_AT", "confidence": 1.5},  # clamped to 1.0
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": "MANAGES", "confidence": -0.1},  # clamped to 0.0, then discarded (<0.5)
    ]
    
    validated = validate_relations(triplets, entities)
    
    # First one is clamped to 1.0 and kept, second is clamped to 0.0 and discarded for low confidence
    assert len(validated) == 1
    assert validated[0]['confidence'] == 1.0


def test_validate_relations_label_too_long():
    """Test that relations with labels >100 chars are discarded."""
    entity1 = MagicMock(canonical_name="John Smith", id="e1")
    entity2 = MagicMock(canonical_name="Acme Corp", id="e2")
    entities = [entity1, entity2]
    
    long_label = "A" * 101
    triplets = [
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": long_label, "confidence": 0.9},
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": "WORKS_AT", "confidence": 0.9},
    ]
    
    validated = validate_relations(triplets, entities)
    
    assert len(validated) == 1
    assert validated[0]['label'] == 'WORKS_AT'


def test_validate_relations_normalizes_labels_to_uppercase():
    """Test that labels are normalized to uppercase."""
    entity1 = MagicMock(canonical_name="John Smith", id="e1")
    entity2 = MagicMock(canonical_name="Acme Corp", id="e2")
    entities = [entity1, entity2]
    
    triplets = [
        {"source_entity": "John Smith", "target_entity": "Acme Corp", "label": "works_at", "confidence": 0.9},
    ]
    
    validated = validate_relations(triplets, entities)
    
    assert len(validated) == 1
    assert validated[0]['label'] == 'WORKS_AT'
