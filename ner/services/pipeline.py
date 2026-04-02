"""Entity extraction pipeline orchestration."""

import logging
import os
import re
import time
from decimal import Decimal
from time import perf_counter

from django.conf import settings
from django.db import transaction
from ingestion.models import Document, Chunk, ExtractionGuidance
from ner.models import Entity, NERRun, Relation, EntityLabel
from ner.services.entity_dedup_service import EntityDedupService
from ner.services.relation_deduplicator import deduplicate_relations
from ner.services.relation_extractor import extract_relations_from_chunk
from ner.services.costing import calculate_openai_cost_usd
from ner.services.taxonomy import get_active_entity_labels, get_active_relationship_types
from ner.services.provider_factory import ProviderConfig, get_provider, validate_provider_config
from ner.services.provider_interface import JointExtractionRequest, RelationshipTypeInput

logger = logging.getLogger(__name__)

# In-memory extraction progress tracker (per document_id string).
# Updated during chunk processing so the frontend can poll for progress.
_extraction_progress: dict = {}  # {str(document_id): {"current": int, "total": int}}
_entity_dedup_service = EntityDedupService()


def get_active_entity_style_map() -> dict[str, dict[str, str]]:
    """Return deterministic node style map derived from active taxonomy labels."""
    label_rows = EntityLabel.objects.filter(active=True).values('name', 'node_shape', 'color')
    style_map = {
        str(row['name']).strip().upper(): {
            'shape': row['node_shape'] or 'ellipse',
            'color': row['color'] or '#9ca3af',
        }
        for row in label_rows
    }
    if not style_map:
        return {
            'PERSON': {'shape': 'ellipse', 'color': '#3b82f6'},
            'ORGANIZATION': {'shape': 'rectangle', 'color': '#8b5cf6'},
            'LOCATION': {'shape': 'diamond', 'color': '#10b981'},
            'ROLE': {'shape': 'hexagon', 'color': '#f59e0b'},
        }
    return style_map


def _deduplicate_entities_for_save(
    extracted_entities: list[dict],
    document,
    run: NERRun | None = None,
    existing_entities=None,
) -> list[Entity]:
    return _entity_dedup_service.upsert_entities_for_save(
        extracted_entities=extracted_entities,
        document=document,
        run=run,
        existing_entities=existing_entities,
    )


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


def _extract_chunk_joint(
    chunk_text: str,
    provider_config: ProviderConfig,
    concept_note: str | None,
    entity_labels: list[str],
    relationship_types: list[dict],
) -> dict:
    provider = get_provider(
        provider_config,
        {
            'groq': os.environ.get('GROQ_API_KEY', ''),
            'openai': os.environ.get('OPENAI_API_KEY', ''),
            'azure_openai': os.environ.get('AZURE_OPENAI_API_KEY', ''),
            'gemini': os.environ.get('GEMINI_API_KEY', ''),
        },
    )

    rel_inputs = [
        RelationshipTypeInput(name=str(item.get('name', '')), directional=bool(item.get('directional', True)))
        for item in relationship_types
        if str(item.get('name', '')).strip()
    ]
    payload = JointExtractionRequest(
        chunk_text=chunk_text,
        concept_note=concept_note,
        entity_labels=entity_labels,
        relationship_types=rel_inputs,
        model=provider_config.model,
    )
    return provider.extract_joint(payload)


def _normalize_text(value: str | None) -> str:
    return (value or '').strip().lower()


def _compose_guided_context(document: Document, concept_note: str | None) -> str | None:
    base_context = (concept_note or '').strip()
    guidance_items = list(
        ExtractionGuidance.objects
        .filter(project=document.project)
        .order_by('order', 'created_at')
        .values_list('text', flat=True)
    )
    guidance_items = [str(item).strip() for item in guidance_items if str(item).strip()]
    if not guidance_items:
        return base_context or None

    guidance_block = "\n".join(f"- {item}" for item in guidance_items)
    if base_context:
        return (
            f"{base_context}\n\n"
            "Additional extraction guidance (highest priority):\n"
            f"{guidance_block}"
        )
    return (
        "Additional extraction guidance (highest priority):\n"
        f"{guidance_block}"
    )


def _entity_text_candidates(value: str | None) -> list[str]:
    base = _normalize_text(value)
    if not base:
        return []

    collapsed = re.sub(r'\s+', ' ', base).strip()
    without_parens = re.sub(r'\s*\([^)]*\)\s*', ' ', collapsed)
    without_symbols = re.sub(r'[^a-z0-9\s-]', ' ', without_parens)
    normalized = re.sub(r'\s+', ' ', without_symbols).strip()

    candidates: list[str] = []
    for item in (collapsed, without_parens.strip(), normalized):
        if item and item not in candidates:
            candidates.append(item)
    return candidates


def _resolve_entity_by_relation_text(text: str | None, lookup: dict[str, Entity]) -> Entity | None:
    candidates = _entity_text_candidates(text)
    if not candidates:
        return None

    for candidate in candidates:
        entity = lookup.get(candidate)
        if entity:
            return entity

    for candidate in candidates:
        if len(candidate) < 4:
            continue
        prefix_matches = [entity for key, entity in lookup.items() if key.startswith(candidate) or candidate.startswith(key)]
        unique_matches = {str(entity.id): entity for entity in prefix_matches}
        if len(unique_matches) == 1:
            return next(iter(unique_matches.values()))

    return None


def _normalize_joint_entities(raw_entities: list, chunk: Chunk) -> list[dict]:
    normalized = []
    for entity in raw_entities or []:
        if not isinstance(entity, dict):
            continue
        text = str(entity.get('text') or entity.get('name') or '').strip()
        if not text:
            continue
        label = str(entity.get('entity_type') or entity.get('label') or '').strip().upper()
        if not label:
            continue
        confidence = entity.get('confidence', 0.5)
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))
        normalized.append(
            {
                'entity_type': label,
                'text': text,
                'confidence': confidence,
                'chunk_id': chunk,
            }
        )
    return normalized


def _normalize_joint_relationships(raw_relationships: list) -> list[dict]:
    normalized = []
    for rel in raw_relationships or []:
        if not isinstance(rel, dict):
            continue
        source_text = str(rel.get('source_text') or rel.get('source_entity') or rel.get('source') or '').strip()
        target_text = str(rel.get('target_text') or rel.get('target_entity') or rel.get('target') or '').strip()
        rel_type = str(rel.get('type') or rel.get('label') or rel.get('relation') or '').strip()
        if not source_text or not target_text or not rel_type:
            continue
        confidence = rel.get('confidence', 0.5)
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))
        normalized.append(
            {
                'source_text': source_text,
                'target_text': target_text,
                'type': rel_type,
                'confidence': confidence,
            }
        )
    return normalized


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
        entities_to_create = _deduplicate_entities_for_save(
            all_extracted_entities,
            document,
            run=run,
            existing_entities=existing_entities,
        )
        logger.info("[NER] step=deduplicate  in=%d  out=%d  duration=%.2fs", len(all_extracted_entities), len(entities_to_create), perf_counter() - _t0)

        # Dedup service persists entities directly and returns created records.
        _t0 = perf_counter()
        created_entities = entities_to_create
        entities_created = len(created_entities)
        logger.info("[NER] step=upsert_entities  entities_created=%d  duration=%.2fs", entities_created, perf_counter() - _t0)

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
    concept_note: str | None = None,
) -> dict:
    """Extract entities and relations in one provider call per chunk."""
    provider_config = _resolve_provider_config(provider, model)

    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found")
        raise

    effective_concept_note = _compose_guided_context(document, concept_note)

    _t_total_start = perf_counter()
    logger.info(
        "[NER+REL-JOINT] START  document=%s  provider=%s  model=%s",
        document_id, provider_config.provider, provider_config.model,
    )

    active_entity_labels = get_active_entity_labels()
    active_relationship_types = get_active_relationship_types()
    if not active_entity_labels:
        logger.error(
            "[NER+REL-JOINT] taxonomy_error  document=%s  reason=no_active_entity_labels  remediation=activate_at_least_one_entity_label",
            document_id,
        )
        raise ValueError("No active entity labels configured. Activate at least one entity label.")
    if not active_relationship_types:
        logger.error(
            "[NER+REL-JOINT] taxonomy_error  document=%s  reason=no_active_relationship_types  remediation=activate_at_least_one_relationship_type",
            document_id,
        )
        raise ValueError("No active relationship types configured. Activate at least one relationship type.")

    logger.info(
        "[NER+REL-JOINT] taxonomy_loaded  entity_labels=%d  relationship_types=%d",
        len(active_entity_labels),
        len(active_relationship_types),
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
            "[NER+REL-JOINT] step=delete_existing  entities=%d  relations=%d  duration=%.2fs",
            deleted_entities, deleted_relations, perf_counter() - _t0,
        )

        # Get all chunks
        _t0 = perf_counter()
        chunks = list(Chunk.objects.filter(document_id=document_id).order_by('id'))
        logger.info("[NER+REL-JOINT] step=load_chunks  chunks=%d  duration=%.2fs", len(chunks), perf_counter() - _t0)
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

        _extraction_progress[str(document_id)] = {"current": 0, "total": len(chunks)}

        # Joint extraction per chunk (single provider call)
        all_extracted_entities = []
        all_extracted_relations = []
        chunk_count = 0
        tokens_input_total = 0
        tokens_output_total = 0
        tokens_cached_total = 0

        _t_joint_start = perf_counter()
        for chunk in chunks:
            try:
                if chunk_count > 0 and provider_config.provider == 'groq':
                    time.sleep(2.5)

                _t_chunk = perf_counter()
                chunk_data = _extract_chunk_joint(
                    chunk.text,
                    provider_config,
                    concept_note=effective_concept_note,
                    entity_labels=active_entity_labels,
                    relationship_types=active_relationship_types,
                )
                _chunk_duration = perf_counter() - _t_chunk

                entities = _normalize_joint_entities(chunk_data.get("entities", []), chunk)
                relations = _normalize_joint_relationships(chunk_data.get("relationships", []))
                tok_in = int(chunk_data.get("tokens_input", 0) or 0)
                tok_out = int(chunk_data.get("tokens_output", 0) or 0)
                tok_cached = int(chunk_data.get("tokens_cached", 0) or 0)
                tokens_input_total += tok_in
                tokens_output_total += tok_out
                tokens_cached_total += tok_cached

                all_extracted_entities.extend(entities)
                all_extracted_relations.extend(relations)

                chunk_count += 1
                _extraction_progress[str(document_id)]["current"] = chunk_count
                logger.info(
                    "[NER+REL-JOINT] chunk=%d/%d  entities=%d  relations=%d  tok_in=%d  tok_out=%d  duration=%.2fs",
                    chunk_count, len(chunks), len(entities), len(relations), tok_in, tok_out, _chunk_duration,
                )
            except ValueError as e:
                if "rate limit" in str(e).lower():
                    logger.error(f"Rate limit hit on joint extraction chunk {chunk.id}: {e}")
                    raise
                logger.warning(f"Skipping joint extraction for chunk {chunk.id}: {e}")
            except Exception as e:
                logger.error(f"Error extracting joint payload from chunk {chunk.id}: {e}")
                raise

        _extraction_progress.pop(str(document_id), None)
        logger.info(
            "[NER+REL-JOINT] step=chunk_extraction_done  chunks=%d  entities_raw=%d  relations_raw=%d  duration=%.2fs",
            chunk_count,
            len(all_extracted_entities),
            len(all_extracted_relations),
            perf_counter() - _t_joint_start,
        )

        linked_entity_names = {
            _normalize_text(item.get('source_text'))
            for item in all_extracted_relations
            if _normalize_text(item.get('source_text'))
        }
        linked_entity_names.update(
            {
                _normalize_text(item.get('target_text'))
                for item in all_extracted_relations
                if _normalize_text(item.get('target_text'))
            }
        )
        logger.info(
            "[NER+REL-JOINT] step=linked_entity_filter  raw_entities=%d  linked_names=%d",
            len(all_extracted_entities),
            len(linked_entity_names),
        )

        # Persist deduplicated entities even when relations are empty.
        # This avoids user-visible false negatives where extraction ran but
        # reported 0 entities simply because no relationship triplets survived.
        _t0 = perf_counter()
        entities_to_create = _deduplicate_entities_for_save(
            all_extracted_entities,
            document,
            run=run,
            existing_entities=Entity.objects.none(),
        )
        logger.info(
            "[NER+REL-JOINT] step=entity_deduplicate  in=%d  out=%d  duration=%.2fs",
            len(all_extracted_entities), len(entities_to_create), perf_counter() - _t0,
        )

        _t0 = perf_counter()
        created_entities = entities_to_create
        entities_created = len(created_entities)
        logger.info("[NER+REL-JOINT] step=entity_upsert  entities_created=%d  duration=%.2fs", entities_created, perf_counter() - _t0)

        if entities_created < 2:
            relations_created = 0
            logger.info("[NER+REL-JOINT] Skipping relation persistence: fewer than 2 linked entities")
        else:
            entity_by_name: dict[str, Entity] = {}
            for entity in Entity.objects.filter(document_id=document, run=run):
                for key in _entity_text_candidates(entity.canonical_name):
                    entity_by_name.setdefault(key, entity)
                for mention in entity.raw_mentions or []:
                    for key in _entity_text_candidates(str(mention)):
                        entity_by_name.setdefault(key, entity)

            relation_inputs = []
            for rel in all_extracted_relations:
                source = _resolve_entity_by_relation_text(rel.get('source_text'), entity_by_name)
                target = _resolve_entity_by_relation_text(rel.get('target_text'), entity_by_name)
                if not source or not target:
                    continue
                if source.id == target.id:
                    continue
                relation_inputs.append(
                    {
                        'source_entity_id': source.id,
                        'target_entity_id': target.id,
                        'label': str(rel.get('type', '')).strip(),
                        'confidence': rel.get('confidence', 0.5),
                    }
                )

            _t0 = perf_counter()
            relations_to_create = deduplicate_relations(relation_inputs, document, run)
            logger.info(
                "[NER+REL-JOINT] step=relation_deduplicate  in=%d  out=%d  duration=%.2fs",
                len(relation_inputs), len(relations_to_create), perf_counter() - _t0,
            )

            _t0 = perf_counter()
            if relations_to_create:
                created_relations = Relation.objects.bulk_create(relations_to_create)
                relations_created = len(created_relations)
            else:
                relations_created = 0
            logger.info(
                "[NER+REL-JOINT] step=relation_bulk_create  relations=%d  duration=%.2fs",
                relations_created,
                perf_counter() - _t0,
            )

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
            "[NER+REL-JOINT] DONE  document=%s  entities=%d  relations=%d  tok_in=%d  tok_out=%d  cost_usd=%s  total=%.2fs",
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
            OpenAI = __import__('openai', fromlist=['OpenAI']).OpenAI
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

