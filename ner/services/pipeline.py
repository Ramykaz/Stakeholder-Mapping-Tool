"""Entity extraction pipeline orchestration."""

import logging
import os
from django.db import transaction
from ingestion.models import Document, Chunk
from ner.models import Entity
from ner.services.groq_client import extract_entities_from_chunk
from ner.services.deduplicator import deduplicate_entities

logger = logging.getLogger(__name__)


def extract_entities_for_document(document_id: str) -> dict:
    """
    Extract entities from all chunks of a document.
    
    Process:
    1. Get document by ID (404 if not found)
    2. Delete all existing entities (clean slate)
    3. Get all chunks for the document
    4. For each chunk: extract entities via Groq → deduplicate
    5. Bulk create Entity records in atomic transaction
    6. Return {entities_created: int}
    
    Args:
        document_id: UUID of the document.
    
    Returns:
        Dictionary: {entities_created: int}
    
    Raises:
        Document.DoesNotExist: If document not found.
        ValueError: If Groq API rate-limited or returns invalid data.
        RuntimeError: If extraction fails.
    """
    # Get Groq API key
    groq_api_key = os.environ.get('GROQ_API_KEY', '').strip()
    if not groq_api_key:
        raise RuntimeError("GROQ_API_KEY environment variable not set")

    try:
        # Get document (404 if not found)
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist as e:
        logger.error(f"Document {document_id} not found")
        raise

    with transaction.atomic():
        # Delete all existing entities for this document (clean slate)
        deleted_count, _ = Entity.objects.filter(document_id=document_id).delete()
        logger.info(f"Deleted {deleted_count} existing entities for document {document_id}")

        # Get all chunks for the document
        chunks = Chunk.objects.filter(document_id=document_id).order_by('id')
        if not chunks.exists():
            logger.warning(f"No chunks found for document {document_id}")
            return {"entities_created": 0}

        # Extract entities from each chunk
        all_extracted_entities = []
        chunk_count = 0

        for chunk in chunks:
            try:
                chunk_data = extract_entities_from_chunk(chunk.text, groq_api_key)
                entities = chunk_data.get("entities", [])
                
                # Attach chunk_id to each entity for reference
                for entity in entities:
                    entity["chunk_id"] = chunk.id
                    all_extracted_entities.append(entity)
                
                chunk_count += 1
                logger.info(f"Extracted {len(entities)} entities from chunk {chunk.id}")
            except ValueError as e:
                # Re-raise rate limit errors
                if "rate limit" in str(e).lower():
                    logger.error(f"Rate limit hit on chunk {chunk.id}: {e}")
                    raise
                logger.warning(f"Skipping chunk {chunk.id}: {e}")
            except Exception as e:
                logger.error(f"Error extracting from chunk {chunk.id}: {e}")
                raise

        logger.info(f"Processed {chunk_count} chunks, extracted {len(all_extracted_entities)} entities")

        # Deduplicate and create Entity records
        existing_entities = Entity.objects.filter(document_id=document_id)
        entities_to_create = deduplicate_entities(
            all_extracted_entities,
            document,
            existing_entities,
        )

        # Bulk create new entities
        if entities_to_create:
            created_entities = Entity.objects.bulk_create(entities_to_create)
            entities_created = len(created_entities)
            logger.info(f"Created {entities_created} new Entity records for document {document_id}")
        else:
            entities_created = 0
            logger.info(f"No new entities to create for document {document_id}")

        return {"entities_created": entities_created}
