"""Entity deduplication logic."""

import logging
from typing import List
from django.db.models import QuerySet
from ner.models import Entity

logger = logging.getLogger(__name__)


def deduplicate_entities(
    extracted_entities: List[dict],
    document,
    existing_entities: QuerySet = None,
) -> List[Entity]:
    """
    Merge extracted entities with existing ones by canonical_name.

    Deduplication logic:
    - Group by (canonical_name, document_id, entity_type)
    - If entity exists: merge raw_mentions, update confidence (use max)
    - If new: create Entity object
    
    Args:
        extracted_entities: List of {entity_type, text, confidence} from Groq.
        document: Document instance (or UUID that will be used to set FK).
        existing_entities: QuerySet of existing Entity objects for the document (optional).
    
    Returns:
        List of Entity objects ready for bulk_create or update.
    """
    entities_to_create = []
    canonical_name_map = {}

    if existing_entities is None:
        existing_entities = Entity.objects.none()

    # Build map of existing entities
    for entity in existing_entities:
        key = (entity.canonical_name, entity.entity_type)
        canonical_name_map[key] = entity

    # Process extracted entities
    for extracted in extracted_entities:
        entity_type = extracted.get("entity_type", "").upper()
        canonical_name = extracted.get("text", "").strip()
        confidence = float(extracted.get("confidence", 0.5))

        if not canonical_name or not entity_type:
            logger.warning(f"Skipping invalid entity: {extracted}")
            continue

        if confidence < 0.0 or confidence > 1.0:
            logger.warning(f"Invalid confidence {confidence} for {canonical_name}")
            confidence = max(0.0, min(1.0, confidence))

        key = (canonical_name, entity_type)

        if key in canonical_name_map:
            # Merge with existing entity
            entity = canonical_name_map[key]
            existing_mentions = set(entity.raw_mentions or [])
            existing_mentions.add(canonical_name)
            entity.raw_mentions = list(existing_mentions)
            entity.confidence = max(entity.confidence, confidence)
        else:
            # Create new entity
            entity = Entity(
                entity_type=entity_type,
                canonical_name=canonical_name,
                raw_mentions=[canonical_name],
                confidence=confidence,
                document=document,
            )
            canonical_name_map[key] = entity
            entities_to_create.append(entity)

    return entities_to_create
