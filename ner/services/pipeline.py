"""Entity extraction pipeline orchestration."""

import logging
import os
import time
from decimal import Decimal
from time import perf_counter

from django.conf import settings
from django.db import transaction
from ingestion.models import Document, Chunk
from ner.models import Entity, NERRun, Relation
from ner.services.deduplicator import deduplicate_entities
from ner.services.relation_deduplicator import deduplicate_relations
from ner.services.relation_extractor import extract_relations_from_chunk
from ner.services.costing import calculate_openai_cost_usd
from ner.services.provider_factory import ProviderConfig, get_provider, validate_provider_config

logger = logging.getLogger(__name__)

# In-memory extraction progress tracker (per document_id string).
# Updated during chunk processing so the frontend can poll for progress.
_extraction_progress: dict = {}  # {str(document_id): {"current": int, "total": int}}


def _resolve_provider_config(provider: str | None, model: str | None) -> ProviderConfig:
    resolved_provider = (provider or settings.NER_DEFAULT_PROVIDER).strip().lower()
    if resolved_provider not in settings.NER_PROVIDER_MODEL_ALLOWLIST:
        raise ValueError(f"Unsupported provider: {resolved_provider}")
    default_model_for_provider = settings.NER_PROVIDER_MODEL_ALLOWLIST[resolved_provider][0]
    resolved_model = (model or default_model_for_provider).strip()
    config = ProviderConfig(provider=resolved_provider, model=resolved_model)
    validate_provider_config(config, settings.NER_PROVIDER_MODEL_ALLOWLIST)
    return config


def _extract_chunk_entities(chunk_text: str, provider_config: ProviderConfig) -> dict:
    provider = get_provider(
        provider_config,
        {
            'groq': os.environ.get('GROQ_API_KEY', ''),
            'openai': os.environ.get('OPENAI_API_KEY', ''),
        },
    )
    return provider.extract_entities(chunk_text)


def extract_entities_for_document(
    document_id: str,
    provider: str | None = None,
    model: str | None = None,
) -> dict:
    """
    Extract entities from all chunks of a document.
    
    Process:
    1. Get document by ID (404 if not found)
    2. Delete all existing entities (clean slate)
    3. Get all chunks for the document
    4. For each chunk: extract entities via Groq → deduplicate
    5. Bulk create Entity records in atomic transaction
    6. Return extraction summary
    
    Args:
        document_id: UUID of the document.
    
    Returns:
        Dictionary containing entity count, run metadata, and chunk processing stats.
    
    Raises:
        Document.DoesNotExist: If document not found.
        ValueError: If Groq API rate-limited or returns invalid data.
        RuntimeError: If extraction fails.
    """
    provider_config = _resolve_provider_config(provider, model)

    try:
        # Get document (404 if not found)
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found")
        raise

    _t_ner_start = perf_counter()
    logger.info(
        "[NER] START  document=%s  provider=%s  model=%s",
        document_id, provider_config.provider, provider_config.model,
    )

    with transaction.atomic():
        run = NERRun.objects.create(
            document_id=document,
            provider=provider_config.provider,
            model=provider_config.model,
            status=NERRun.STATUS_PENDING,
            tokens_input=0,
            tokens_output=0,
            tokens_cached=0,
            cost_usd=Decimal('0.000000'),
        )

        # Delete all existing entities for this document (clean slate)
        _t0 = perf_counter()
        deleted_count, _ = Entity.objects.filter(document_id=document_id).delete()
        logger.info("[NER] step=delete_existing  deleted=%d  duration=%.2fs", deleted_count, perf_counter() - _t0)

        # Get all chunks for the document (materialise to list so we have total_count upfront)
        _t0 = perf_counter()
        chunks = list(Chunk.objects.filter(document_id=document_id).order_by('id'))
        logger.info("[NER] step=load_chunks  chunks=%d  duration=%.2fs", len(chunks), perf_counter() - _t0)
        if not chunks:
            logger.warning(f"No chunks found for document {document_id}")
            return {
                "entities_created": 0,
                "total_chunks": 0,
                "processed_chunks": 0,
                "rate_limited_chunks": 0,
                "skipped_chunks": 0,
            }

        _extraction_progress[str(document_id)] = {"current": 0, "total": len(chunks)}

        # Extract entities from each chunk
        all_extracted_entities = []
        chunk_count = 0
        rate_limited_chunks = 0
        skipped_chunks = 0
        tokens_input_total = 0
        tokens_output_total = 0
        tokens_cached_total = 0

        _t_chunks_start = perf_counter()
        for chunk in chunks:
            try:
                # Throttle only for Groq free tier (30 RPM → need ≥2s between requests)
                if chunk_count > 0 and provider_config.provider == 'groq':
                    time.sleep(2.5)
                _t_chunk = perf_counter()
                chunk_data = _extract_chunk_entities(chunk.text, provider_config)
                _chunk_duration = perf_counter() - _t_chunk
                entities = chunk_data.get("entities", [])
                tok_in = int(chunk_data.get("tokens_input", 0) or 0)
                tok_out = int(chunk_data.get("tokens_output", 0) or 0)
                tok_cached = int(chunk_data.get("tokens_cached", 0) or 0)
                tokens_input_total += tok_in
                tokens_output_total += tok_out
                tokens_cached_total += tok_cached

                # Attach chunk_id to each entity for reference
                for entity in entities:
                    entity["chunk_id"] = chunk
                    all_extracted_entities.append(entity)

                chunk_count += 1
                _extraction_progress[str(document_id)]["current"] = chunk_count
                logger.info(
                    "[NER] chunk=%d/%d  entities=%d  tok_in=%d  tok_out=%d  duration=%.2fs  chunk_id=%s",
                    chunk_count, len(chunks), len(entities), tok_in, tok_out, _chunk_duration, chunk.id,
                )
            except ValueError as e:
                if "rate limit" in str(e).lower():
                    rate_limited_chunks += 1
                    logger.warning(f"Rate limit hit on chunk {chunk.id}; skipping and continuing")
                    continue
                skipped_chunks += 1
                logger.warning(f"Skipping chunk {chunk.id}: {e}")
            except Exception as e:
                logger.error(f"Error extracting from chunk {chunk.id}: {e}")
                raise

        _extraction_progress.pop(str(document_id), None)
        logger.info(
            "[NER] step=all_chunks_done  chunks=%d  entities_raw=%d  duration=%.2fs",
            chunk_count, len(all_extracted_entities), perf_counter() - _t_chunks_start,
        )

        # Deduplicate and create Entity records
        _t0 = perf_counter()
        existing_entities = Entity.objects.filter(document_id=document_id)
        entities_to_create = deduplicate_entities(
            all_extracted_entities,
            document,
            run=run,
            existing_entities=existing_entities,
        )
        logger.info("[NER] step=deduplicate  in=%d  out=%d  duration=%.2fs", len(all_extracted_entities), len(entities_to_create), perf_counter() - _t0)

        # Bulk create new entities
        _t0 = perf_counter()
        if entities_to_create:
            created_entities = Entity.objects.bulk_create(entities_to_create)
            entities_created = len(created_entities)
        else:
            entities_created = 0
        logger.info("[NER] step=bulk_create  entities=%d  duration=%.2fs", entities_created, perf_counter() - _t0)

        run.status = NERRun.STATUS_COMPLETED
        run.tokens_input = tokens_input_total
        run.tokens_output = tokens_output_total
        run.tokens_cached = tokens_cached_total
        run.duration_seconds = perf_counter() - _t_ner_start
        if provider_config.provider == 'openai':
            run.cost_usd = calculate_openai_cost_usd(
                provider_config.model,
                tokens_input_total,
                tokens_output_total,
                tokens_cached_total,
            )
        else:
            run.cost_usd = Decimal('0.000000')
        run.save(update_fields=['status', 'tokens_input', 'tokens_output', 'tokens_cached', 'cost_usd', 'duration_seconds'])

        logger.info(
            "[NER] DONE  document=%s  entities=%d  tok_in=%d  tok_out=%d  cost_usd=%s  total=%.2fs",
            document_id, entities_created, tokens_input_total, tokens_output_total,
            run.cost_usd, perf_counter() - _t_ner_start,
        )

        return {
            "entities_created": entities_created,
            "total_chunks": len(chunks),
            "processed_chunks": chunk_count,
            "rate_limited_chunks": rate_limited_chunks,
            "skipped_chunks": skipped_chunks,
            "run_id": str(run.id),
            "provider": run.provider,
            "model": run.model,
            "tokens_input": run.tokens_input,
            "tokens_output": run.tokens_output,
            "tokens_cached": run.tokens_cached,
            "cost_usd": str(run.cost_usd),
            "duration_seconds": run.duration_seconds,
        }


def extract_relations_for_document(
    document_id: str,
    provider: str | None = None,
    model: str | None = None,
) -> dict:
    """
    Extract entities AND relations from all chunks of a document (two-pass extraction).
    
    Process:
    1. Get document by ID (404 if not found)
    2. Delete all existing entities and relations (clean slate)
    3. FIRST PASS: Extract entities from all chunks → deduplicate → save
    4. SECOND PASS: For each chunk, extract relations using entities in that chunk
    5. Deduplicate relations across chunks → save
    6. Return {entities_created: int, relations_created: int, ...}
    
    Args:
        document_id: UUID of the document
        provider: Provider name ('groq' or 'openai')
        model: Model name
    
    Returns:
        Dictionary: {
            entities_created: int,
            relations_created: int,
            run_id: str,
            provider: str,
            model: str,
            tokens_input: int,
            tokens_output: int,
            tokens_cached: int,
            cost_usd: str,
            duration_seconds: float,
        }
    
    Raises:
        Document.DoesNotExist: If document not found
        ValueError: If API rate-limited or returns invalid data
        RuntimeError: If extraction fails
    """
    provider_config = _resolve_provider_config(provider, model)

    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found")
        raise

    _t_total_start = perf_counter()
    logger.info(
        "[NER+REL] START  document=%s  provider=%s  model=%s",
        document_id, provider_config.provider, provider_config.model,
    )

    with transaction.atomic():
        run = NERRun.objects.create(
            document_id=document,
            provider=provider_config.provider,
            model=provider_config.model,
            status=NERRun.STATUS_PENDING,
            tokens_input=0,
            tokens_output=0,
            tokens_cached=0,
            cost_usd=Decimal('0.000000'),
            relations_created=0,  # Mark this as a relation extraction run
        )

        # Clean slate: delete all existing entities and relations
        _t0 = perf_counter()
        deleted_entities, _ = Entity.objects.filter(document_id=document_id).delete()
        deleted_relations, _ = Relation.objects.filter(document_id=document_id).delete()
        logger.info(
            "[NER+REL] step=delete_existing  entities=%d  relations=%d  duration=%.2fs",
            deleted_entities, deleted_relations, perf_counter() - _t0,
        )

        # Get all chunks
        _t0 = perf_counter()
        chunks = list(Chunk.objects.filter(document_id=document_id).order_by('id'))
        logger.info("[NER+REL] step=load_chunks  chunks=%d  duration=%.2fs", len(chunks), perf_counter() - _t0)
        if not chunks:
            logger.warning(f"No chunks found for document {document_id}")
            run.status = NERRun.STATUS_COMPLETED
            run.save()
            return {
                "entities_created": 0,
                "relations_created": 0,
                "run_id": str(run.id),
                "provider": run.provider,
                "model": run.model,
                "tokens_input": 0,
                "tokens_output": 0,
                "tokens_cached": 0,
                "cost_usd": "0.000000",
                "duration_seconds": 0.0,
            }

        _extraction_progress[str(document_id)] = {"current": 0, "total": len(chunks) * 2}  # 2 passes

        # ===== FIRST PASS: ENTITY EXTRACTION =====
        logger.info("[NER+REL] === FIRST PASS: ENTITY EXTRACTION ===")
        all_extracted_entities = []
        chunk_count = 0
        tokens_input_total = 0
        tokens_output_total = 0
        tokens_cached_total = 0

        provider_instance = get_provider(
            provider_config,
            {
                'groq': os.environ.get('GROQ_API_KEY', ''),
                'openai': os.environ.get('OPENAI_API_KEY', ''),
            },
        )

        _t_entities_start = perf_counter()
        for chunk in chunks:
            try:
                if chunk_count > 0 and provider_config.provider == 'groq':
                    time.sleep(2.5)
                
                _t_chunk = perf_counter()
                chunk_data = provider_instance.extract_entities(chunk.text)
                _chunk_duration = perf_counter() - _t_chunk
                
                entities = chunk_data.get("entities", [])
                tok_in = int(chunk_data.get("tokens_input", 0) or 0)
                tok_out = int(chunk_data.get("tokens_output", 0) or 0)
                tok_cached = int(chunk_data.get("tokens_cached", 0) or 0)
                tokens_input_total += tok_in
                tokens_output_total += tok_out
                tokens_cached_total += tok_cached

                for entity in entities:
                    entity["chunk_id"] = chunk
                    all_extracted_entities.append(entity)

                chunk_count += 1
                _extraction_progress[str(document_id)]["current"] = chunk_count
                logger.info(
                    "[NER+REL] ENTITIES chunk=%d/%d  entities=%d  tok_in=%d  tok_out=%d  duration=%.2fs",
                    chunk_count, len(chunks), len(entities), tok_in, tok_out, _chunk_duration,
                )
            except ValueError as e:
                if "rate limit" in str(e).lower():
                    logger.error(f"Rate limit hit on entity extraction chunk {chunk.id}: {e}")
                    raise
                logger.warning(f"Skipping entity extraction for chunk {chunk.id}: {e}")
            except Exception as e:
                logger.error(f"Error extracting entities from chunk {chunk.id}: {e}")
                raise

        logger.info(
            "[NER+REL] step=entity_extraction_done  chunks=%d  entities_raw=%d  duration=%.2fs",
            chunk_count, len(all_extracted_entities), perf_counter() - _t_entities_start,
        )

        # Deduplicate and save entities
        _t0 = perf_counter()
        entities_to_create = deduplicate_entities(
            all_extracted_entities,
            document,
            run=run,
            existing_entities=Entity.objects.none(),
        )
        logger.info(
            "[NER+REL] step=entity_deduplicate  in=%d  out=%d  duration=%.2fs",
            len(all_extracted_entities), len(entities_to_create), perf_counter() - _t0,
        )

        _t0 = perf_counter()
        if entities_to_create:
            created_entities = Entity.objects.bulk_create(entities_to_create)
            entities_created = len(created_entities)
        else:
            entities_created = 0
        logger.info("[NER+REL] step=entity_bulk_create  entities=%d  duration=%.2fs", entities_created, perf_counter() - _t0)

        # ===== SECOND PASS: RELATION EXTRACTION =====
        logger.info("[NER+REL] === SECOND PASS: RELATION EXTRACTION ===")
        
        if entities_created < 2:
            logger.info("[NER+REL] Skipping relation extraction: fewer than 2 entities found")
            relations_created = 0
        else:
            all_extracted_relations = []
            
            # Get provider client for relation extraction
            if provider_config.provider == 'groq':
                from groq import Groq
                provider_client = Groq(api_key=os.environ.get('GROQ_API_KEY', ''))
            else:  # openai
                from openai import OpenAI
                provider_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY', ''))
            
            _t_relations_start = perf_counter()
            chunk_count = 0
            logger.info(f"[NER+REL] Starting relation extraction loop, chunks={len(chunks)}")
            for chunk in chunks:
                logger.info(f"[NER+REL] Processing chunk {chunk_count + 1}/{len(chunks)}, chunk.id={chunk.id}")
                try:
                    if chunk_count > 0 and provider_config.provider == 'groq':
                        time.sleep(2.5)
                    
                    # Get entities that were found in this chunk
                    entities_in_chunk = Entity.objects.filter(
                        document_id=document,
                        chunk_id=chunk.id,
                        run=run,
                    )
                    
                    entities_count = entities_in_chunk.count()
                    logger.info(
                        "[NER+REL] RELATIONS chunk=%d/%d  chunk_id=%s  entities_found=%d",
                        chunk_count + 1, len(chunks), chunk.id, entities_count,
                    )
                    
                    if entities_count < 2:
                        logger.info(
                            "[NER+REL] RELATIONS chunk=%d/%d  skipped (need >=2 entities, found %d)",
                            chunk_count + 1, len(chunks), entities_count,
                        )
                        chunk_count += 1
                        _extraction_progress[str(document_id)]["current"] = len(chunks) + chunk_count
                        continue
                    
                    _t_chunk = perf_counter()
                    chunk_relations = extract_relations_from_chunk(
                        chunk.text,
                        list(entities_in_chunk),
                        provider_client,
                        provider_config.model,
                    )
                    _chunk_duration = perf_counter() - _t_chunk
                    
                    relations = chunk_relations.get("relations", [])
                    tok_in = int(chunk_relations.get("tokens_input", 0) or 0)
                    tok_out = int(chunk_relations.get("tokens_output", 0) or 0)
                    tok_cached = int(chunk_relations.get("tokens_cached", 0) or 0)
                    tokens_input_total += tok_in
                    tokens_output_total += tok_out
                    tokens_cached_total += tok_cached
                    
                    all_extracted_relations.extend(relations)
                    
                    chunk_count += 1
                    _extraction_progress[str(document_id)]["current"] = len(chunks) + chunk_count
                    logger.info(
                        "[NER+REL] RELATIONS chunk=%d/%d  relations=%d  tok_in=%d  tok_out=%d  duration=%.2fs",
                        chunk_count, len(chunks), len(relations), tok_in, tok_out, _chunk_duration,
                    )
                except ValueError as e:
                    if "rate limit" in str(e).lower():
                        logger.error(f"Rate limit hit on relation extraction chunk {chunk.id}: {e}")
                        raise
                    logger.warning(f"Skipping relation extraction for chunk {chunk.id}: {e}")
                except Exception as e:
                    logger.error(f"Error extracting relations from chunk {chunk.id}: {e}")
                    raise

            _extraction_progress.pop(str(document_id), None)
            logger.info(
                "[NER+REL] step=relation_extraction_done  chunks=%d  relations_raw=%d  duration=%.2fs",
                chunk_count, len(all_extracted_relations), perf_counter() - _t_relations_start,
            )

            # Deduplicate and save relations
            _t0 = perf_counter()
            relations_to_create = deduplicate_relations(
                all_extracted_relations,
                document,
                run,
            )
            logger.info(
                "[NER+REL] step=relation_deduplicate  in=%d  out=%d  duration=%.2fs",
                len(all_extracted_relations), len(relations_to_create), perf_counter() - _t0,
            )
            
            # Log sample relations
            if relations_to_create:
                sample_size = min(5, len(relations_to_create))
                sample_relations = []
                for rel in relations_to_create[:sample_size]:
                    sample_relations.append(
                        f"{rel.source_entity.canonical_name} --[{rel.label}]--> {rel.target_entity.canonical_name} ({rel.confidence:.2f})"
                    )
                logger.info(f"[NER+REL] Sample relations (first {sample_size}): {'; '.join(sample_relations)}")

            _t0 = perf_counter()
            if relations_to_create:
                created_relations = Relation.objects.bulk_create(relations_to_create)
                relations_created = len(created_relations)
            else:
                relations_created = 0
            logger.info("[NER+REL] step=relation_bulk_create  relations=%d  duration=%.2fs", relations_created, perf_counter() - _t0)

        # Update run with final stats
        run.status = NERRun.STATUS_COMPLETED
        run.tokens_input = tokens_input_total
        run.tokens_output = tokens_output_total
        run.tokens_cached = tokens_cached_total
        run.relations_created = relations_created
        run.duration_seconds = perf_counter() - _t_total_start
        
        if provider_config.provider == 'openai':
            run.cost_usd = calculate_openai_cost_usd(
                provider_config.model,
                tokens_input_total,
                tokens_output_total,
                tokens_cached_total,
            )
        else:
            run.cost_usd = Decimal('0.000000')
        
        run.save(update_fields=[
            'status', 'tokens_input', 'tokens_output', 'tokens_cached',
            'cost_usd', 'duration_seconds', 'relations_created',
        ])

        logger.info(
            "[NER+REL] DONE  document=%s  entities=%d  relations=%d  tok_in=%d  tok_out=%d  cost_usd=%s  total=%.2fs",
            document_id, entities_created, relations_created,
            tokens_input_total, tokens_output_total, run.cost_usd, perf_counter() - _t_total_start,
        )

        return {
            "entities_created": entities_created,
            "relations_created": relations_created,
            "run_id": str(run.id),
            "provider": run.provider,
            "model": run.model,
            "tokens_input": run.tokens_input,
            "tokens_output": run.tokens_output,
            "tokens_cached": run.tokens_cached,
            "cost_usd": str(run.cost_usd),
            "duration_seconds": run.duration_seconds,
        }


def extract_relations_only_for_document(
    document_id: str,
    provider: str | None = None,
    model: str | None = None,
) -> dict:
    """
    Extract ONLY relations for a document that already has entities in the DB.
    Does NOT delete or re-extract entities — only clears existing relations
    and runs the second-pass relation extraction loop.

    Args:
        document_id: UUID of the document
        provider: Provider name ('groq' or 'openai')
        model: Model name

    Returns:
        Dictionary: {relations_created, run_id, provider, model,
                     tokens_input, tokens_output, tokens_cached, cost_usd, duration_seconds}

    Raises:
        Document.DoesNotExist: If document not found
        ValueError: If fewer than 2 entities exist, or rate-limited
        RuntimeError: If extraction fails
    """
    from collections import defaultdict

    provider_config = _resolve_provider_config(provider, model)

    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found")
        raise

    entity_count = Entity.objects.filter(document_id=document_id).count()
    if entity_count < 2:
        raise ValueError(
            f"Cannot extract relations: document has only {entity_count} "
            f"entit{'y' if entity_count == 1 else 'ies'}. Run entity extraction first."
        )

    _t_total_start = perf_counter()
    logger.info(
        "[REL-ONLY] START  document=%s  provider=%s  model=%s  existing_entities=%d",
        document_id, provider_config.provider, provider_config.model, entity_count,
    )

    with transaction.atomic():
        run = NERRun.objects.create(
            document_id=document,
            provider=provider_config.provider,
            model=provider_config.model,
            status=NERRun.STATUS_PENDING,
            tokens_input=0,
            tokens_output=0,
            tokens_cached=0,
            cost_usd=Decimal('0.000000'),
            relations_created=0,
        )

        # Delete only existing relations — keep entities intact
        _t0 = perf_counter()
        deleted_relations, _ = Relation.objects.filter(document_id=document_id).delete()
        logger.info(
            "[REL-ONLY] step=delete_existing_relations  relations=%d  duration=%.2fs",
            deleted_relations, perf_counter() - _t0,
        )

        # Load chunks
        _t0 = perf_counter()
        chunks = list(Chunk.objects.filter(document_id=document_id).order_by('id'))
        logger.info("[REL-ONLY] step=load_chunks  chunks=%d  duration=%.2fs", len(chunks), perf_counter() - _t0)
        if not chunks:
            raise ValueError("No chunks found for document")

        # Load all entities grouped by chunk_id
        _t0 = perf_counter()
        all_entities = list(Entity.objects.filter(document_id=document_id))
        entities_by_chunk: dict = defaultdict(list)
        for entity in all_entities:
            entities_by_chunk[entity.chunk_id_id].append(entity)
        # Name map for sample logging (avoids N+1 queries)
        entity_id_to_name = {entity.id: entity.canonical_name for entity in all_entities}
        null_chunk_count = len(entities_by_chunk.get(None, []))
        if null_chunk_count > 0:
            logger.warning(
                "[REL-ONLY] %d entities have no chunk_id and will be skipped",
                null_chunk_count,
            )
        logger.info("[REL-ONLY] step=load_entities  total=%d  duration=%.2fs", len(all_entities), perf_counter() - _t0)

        # Build provider client
        if provider_config.provider == 'groq':
            from groq import Groq
            provider_client = Groq(api_key=os.environ.get('GROQ_API_KEY', ''))
        else:
            from openai import OpenAI
            provider_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY', ''))

        _extraction_progress[str(document_id)] = {"current": 0, "total": len(chunks)}

        all_extracted_relations = []
        tokens_input_total = 0
        tokens_output_total = 0
        tokens_cached_total = 0
        chunk_count = 0
        _t_relations_start = perf_counter()

        for chunk in chunks:
            try:
                if chunk_count > 0 and provider_config.provider == 'groq':
                    time.sleep(2.5)

                entities_in_chunk = entities_by_chunk.get(chunk.id, [])
                entities_count = len(entities_in_chunk)
                logger.info(
                    "[REL-ONLY] chunk=%d/%d  chunk_id=%s  entities_found=%d",
                    chunk_count + 1, len(chunks), chunk.id, entities_count,
                )

                if entities_count < 2:
                    logger.info(
                        "[REL-ONLY] chunk=%d/%d  skipped (need >=2 entities, found %d)",
                        chunk_count + 1, len(chunks), entities_count,
                    )
                    chunk_count += 1
                    _extraction_progress[str(document_id)]["current"] = chunk_count
                    continue

                _t_chunk = perf_counter()
                chunk_relations = extract_relations_from_chunk(
                    chunk.text,
                    entities_in_chunk,
                    provider_client,
                    provider_config.model,
                )
                _chunk_duration = perf_counter() - _t_chunk

                relations = chunk_relations.get("relations", [])
                tok_in = int(chunk_relations.get("tokens_input", 0) or 0)
                tok_out = int(chunk_relations.get("tokens_output", 0) or 0)
                tok_cached = int(chunk_relations.get("tokens_cached", 0) or 0)
                tokens_input_total += tok_in
                tokens_output_total += tok_out
                tokens_cached_total += tok_cached
                all_extracted_relations.extend(relations)
                chunk_count += 1
                _extraction_progress[str(document_id)]["current"] = chunk_count
                logger.info(
                    "[REL-ONLY] chunk=%d/%d  relations=%d  tok_in=%d  tok_out=%d  duration=%.2fs",
                    chunk_count, len(chunks), len(relations), tok_in, tok_out, _chunk_duration,
                )
            except ValueError as e:
                if "rate limit" in str(e).lower():
                    logger.error(f"Rate limit hit on chunk {chunk.id}: {e}")
                    raise
                logger.warning(f"Skipping relation extraction for chunk {chunk.id}: {e}")
            except Exception as e:
                logger.error(f"Error extracting relations from chunk {chunk.id}: {e}")
                raise

        _extraction_progress.pop(str(document_id), None)
        logger.info(
            "[REL-ONLY] step=extraction_done  chunks=%d  relations_raw=%d  duration=%.2fs",
            chunk_count, len(all_extracted_relations), perf_counter() - _t_relations_start,
        )

        # Deduplicate
        _t0 = perf_counter()
        relations_to_create = deduplicate_relations(all_extracted_relations, document, run)
        logger.info(
            "[REL-ONLY] step=deduplicate  in=%d  out=%d  duration=%.2fs",
            len(all_extracted_relations), len(relations_to_create), perf_counter() - _t0,
        )

        # Sample log using pre-loaded entity name map
        if relations_to_create:
            sample = relations_to_create[:5]
            sample_str = "; ".join(
                f"{entity_id_to_name.get(r.source_entity_id, '?')} --[{r.label}]--> "
                f"{entity_id_to_name.get(r.target_entity_id, '?')} ({r.confidence:.2f})"
                for r in sample
            )
            logger.info("[REL-ONLY] Sample (first %d): %s", len(sample), sample_str)

        # Bulk create
        _t0 = perf_counter()
        if relations_to_create:
            created_relations = Relation.objects.bulk_create(relations_to_create)
            relations_created = len(created_relations)
        else:
            relations_created = 0
        logger.info("[REL-ONLY] step=bulk_create  relations=%d  duration=%.2fs", relations_created, perf_counter() - _t0)

        # Finalize run
        run.status = NERRun.STATUS_COMPLETED
        run.tokens_input = tokens_input_total
        run.tokens_output = tokens_output_total
        run.tokens_cached = tokens_cached_total
        run.relations_created = relations_created
        run.duration_seconds = perf_counter() - _t_total_start
        if provider_config.provider == 'openai':
            run.cost_usd = calculate_openai_cost_usd(
                provider_config.model,
                tokens_input_total,
                tokens_output_total,
                tokens_cached_total,
            )
        else:
            run.cost_usd = Decimal('0.000000')
        run.save(update_fields=[
            'status', 'tokens_input', 'tokens_output', 'tokens_cached',
            'cost_usd', 'duration_seconds', 'relations_created',
        ])

        logger.info(
            "[REL-ONLY] DONE  document=%s  relations=%d  tok_in=%d  tok_out=%d  cost_usd=%s  total=%.2fs",
            document_id, relations_created, tokens_input_total, tokens_output_total,
            run.cost_usd, perf_counter() - _t_total_start,
        )

        return {
            "relations_created": relations_created,
            "run_id": str(run.id),
            "provider": run.provider,
            "model": run.model,
            "tokens_input": run.tokens_input,
            "tokens_output": run.tokens_output,
            "tokens_cached": run.tokens_cached,
            "cost_usd": str(run.cost_usd),
            "duration_seconds": run.duration_seconds,
        }

