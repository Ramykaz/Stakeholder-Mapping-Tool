"""Entity deduplication logic."""

import logging
from typing import List
from django.db.models import QuerySet
from ner.models import Entity

logger = logging.getLogger(__name__)


def deduplicate_entities(
    extracted_entities: List[dict],
    document,
    run=None,
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
    # Backward compatibility: older call sites passed (extracted, document, existing_entities)
    # as the 3rd positional argument.
    if existing_entities is None and isinstance(run, QuerySet):
        existing_entities = run
        run = None

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
        canonical_name = extracted.get("text", "").strip().replace("\x00", "")
        confidence = float(extracted.get("confidence", 0.5))
        chunk_id = extracted.get("chunk_id")  # Get chunk_id from extracted entity

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
            is_valid_run = run is not None and run.__class__.__name__ == 'NERRun'
            entity = Entity(
                entity_type=entity_type,
                canonical_name=canonical_name,
                raw_mentions=[canonical_name],
                confidence=confidence,
                document_id=document,
                run=run if is_valid_run else None,
                chunk_id=chunk_id,  # Set chunk_id
            )
            canonical_name_map[key] = entity
            entities_to_create.append(entity)

    return entities_to_create
