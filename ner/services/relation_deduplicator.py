"""Relation deduplication logic."""

import logging
from typing import List
from django.db.models import Model
from ner.models import Relation, RelationshipType

logger = logging.getLogger(__name__)


def deduplicate_relations(
    extracted_relations: List[dict],
    document,
    run,
) -> List[Relation]:
    """
    Deduplicate relations by composite key: (document_id, source_entity_id, normalized_label, target_entity_id).
    
    Deduplication logic:
    - Normalize label (lowercase + trim whitespace)
    - Group by (document, source_entity, normalized_label, target_entity)
    - If duplicate: keep highest confidence instance
    - Return list of Relation objects ready for bulk_create
    
    Args:
        extracted_relations: List of validated relation dicts with:
            {source_entity_id, target_entity_id, label, confidence}
        document: Document instance
        run: NERRun instance
        
    Returns:
        List of Relation objects ready for bulk_create
    """
    dedup_map = {}  # key: (source_id, normalized_label, target_id) -> best relation
    directional_by_label = {
        str(row['name']).strip().lower(): bool(row['directional'])
        for row in RelationshipType.objects.values('name', 'directional')
    }
    
    for rel_data in extracted_relations:
        source_id = rel_data["source_entity_id"]
        target_id = rel_data["target_entity_id"]
        label = rel_data["label"].replace("\x00", "")
        confidence = rel_data["confidence"]
        
        # Normalize label for deduplication (lowercase + trim)
        normalized_label = label.strip().lower()
        
        is_directional = directional_by_label.get(normalized_label, True)
        if is_directional:
            key_source_id = source_id
            key_target_id = target_id
        else:
            ordered = sorted([source_id, target_id], key=lambda item: str(item))
            key_source_id = ordered[0]
            key_target_id = ordered[1]

        # Composite key (canonical for non-directional labels)
        key = (key_source_id, normalized_label, key_target_id)
        
        if key in dedup_map:
            # Duplicate found - keep higher confidence
            existing_confidence = dedup_map[key]["confidence"]
            if confidence > existing_confidence:
                logger.debug(
                    "Dedup: replacing relation %s → %s → %s (old conf=%.2f, new conf=%.2f)",
                    source_id, label, target_id, existing_confidence, confidence,
                )
                dedup_map[key] = {
                    "source_entity_id": key_source_id,
                    "target_entity_id": key_target_id,
                    "label": label,  # Keep original case from best instance
                    "confidence": confidence,
                }
            else:
                logger.debug(
                    "Dedup: keeping existing relation %s → %s → %s (existing conf=%.2f >= new conf=%.2f)",
                    source_id, label, target_id, existing_confidence, confidence,
                )
        else:
            # New unique relation
            dedup_map[key] = {
                "source_entity_id": key_source_id,
                "target_entity_id": key_target_id,
                "label": label,
                "confidence": confidence,
            }
    
    # Build Relation objects
    relations_to_create = []
    document_obj = document if isinstance(document, Model) else None
    document_fk_id = getattr(document, 'id', document)
    run_obj = run if isinstance(run, Model) else None
    run_fk_id = getattr(run, 'id', run)

    for rel_data in dedup_map.values():
        relation_kwargs = {
            "source_entity_id": rel_data["source_entity_id"],
            "target_entity_id": rel_data["target_entity_id"],
            "label": rel_data["label"],
            "confidence": rel_data["confidence"],
        }
        if document_obj is not None:
            relation_kwargs['document_id'] = document_obj
        else:
            relation_kwargs['document_id_id'] = document_fk_id
        if run_obj is not None:
            relation_kwargs['run'] = run_obj
        else:
            relation_kwargs['run_id'] = run_fk_id

        relation = Relation(**relation_kwargs)
        relations_to_create.append(relation)
    
    logger.info(
        "[RELATION_DEDUP] input=%d  deduplicated=%d  duplicates_removed=%d",
        len(extracted_relations),
        len(relations_to_create),
        len(extracted_relations) - len(relations_to_create),
    )
    
    return relations_to_create
