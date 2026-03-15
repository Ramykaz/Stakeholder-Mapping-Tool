"""
Test suite for relation deduplication service.
"""
import pytest
from unittest.mock import MagicMock
from ner.services.relation_deduplicator import deduplicate_relations


def test_deduplicate_relations_keeps_highest_confidence():
    """Test that deduplication keeps the instance with highest confidence."""
    document = MagicMock(id="doc-id")
    run = MagicMock(id="run-id")
    
    triplets = [
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "WORKS_AT", "confidence": 0.7},
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "WORKS_AT", "confidence": 0.9},
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "WORKS_AT", "confidence": 0.8},
    ]
    
    deduplicated = deduplicate_relations(triplets, document, run)
    
    assert len(deduplicated) == 1
    assert deduplicated[0].confidence == 0.9


def test_deduplicate_relations_normalizes_labels():
    """Test that label normalization treats 'WORKS_AT' and 'works_at' as same."""
    document = MagicMock(id="doc-id")
    run = MagicMock(id="run-id")
    
    triplets = [
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "WORKS_AT", "confidence": 0.7},
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "works_at", "confidence": 0.9},
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "  Works_At  ", "confidence": 0.8},
    ]
    
    deduplicated = deduplicate_relations(triplets, document, run)
    
    assert len(deduplicated) == 1
    assert deduplicated[0].confidence == 0.9


def test_deduplicate_relations_different_entities_preserved():
    """Test that relations with different entities are preserved."""
    document = MagicMock(id="doc-id")
    run = MagicMock(id="run-id")
    
    triplets = [
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "WORKS_AT", "confidence": 0.9},
        {"source_entity_id": "e1", "target_entity_id": "e3", "label": "WORKS_AT", "confidence": 0.8},
        {"source_entity_id": "e2", "target_entity_id": "e3", "label": "WORKS_AT", "confidence": 0.7},
    ]
    
    deduplicated = deduplicate_relations(triplets, document, run)
    
    assert len(deduplicated) == 3


def test_deduplicate_relations_different_labels_preserved():
    """Test that different labels for same entity pair are preserved."""
    document = MagicMock(id="doc-id")
    run = MagicMock(id="run-id")
    
    triplets = [
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "WORKS_AT", "confidence": 0.9},
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "MANAGES", "confidence": 0.8},
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "MENTORS", "confidence": 0.7},
    ]
    
    deduplicated = deduplicate_relations(triplets, document, run)
    
    assert len(deduplicated) == 3


def test_deduplicate_relations_empty_list():
    """Test that empty list input returns empty list."""
    document = MagicMock(id="doc-id")
    run = MagicMock(id="run-id")
    
    deduplicated = deduplicate_relations([], document, run)
    assert deduplicated == []


def test_deduplicate_relations_single_item():
    """Test that single item list is returned unchanged."""
    document = MagicMock(id="doc-id")
    run = MagicMock(id="run-id")
    
    triplets = [
        {"source_entity_id": "e1", "target_entity_id": "e2", "label": "WORKS_AT", "confidence": 0.9},
    ]
    
    deduplicated = deduplicate_relations(triplets, document, run)
    
    assert len(deduplicated) == 1
    assert deduplicated[0].confidence == 0.9
