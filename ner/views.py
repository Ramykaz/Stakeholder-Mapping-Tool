"""REST API views for NER pipeline."""

import logging
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.http import Http404
from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ingestion.models import Document, Project, get_or_create_default_project
from .models import Entity, NERRun, Relation, EntityLabel, RelationshipType, EntityReviewCandidate
from .serializers import (
    EntitySerializer,
    CytoscapeNodeSerializer,
    NERRunSerializer,
    RelationSerializer,
    EntityLabelSerializer,
    RelationshipTypeSerializer,
    EntityReviewCandidateSerializer,
    GlobalEntityProfileSerializer,
    ContextualSummaryRequestSerializer,
)
from .services.pipeline import extract_entities_for_document, extract_relations_for_document, extract_relations_only_for_document, _extraction_progress, get_active_entity_style_map
from .services.contextual_summary import get_or_generate_summary
from .services.entity_dedup_service import EntityDedupService
from .services.provider_runtime import ProviderConfigError

logger = logging.getLogger(__name__)
_entity_dedup_service = EntityDedupService()


class AuthenticatedAPIView(APIView):
    permission_classes = [IsAuthenticated]


def _get_document_for_user_or_404(document_id, user):
    return get_object_or_404(Document.objects.select_related('project'), id=document_id, project__owner=user)


def _get_project_for_user_or_404(project_id, user):
    return get_object_or_404(Project, id=project_id, owner=user)


def _get_entity_for_user_or_404(entity_id, user):
    return get_object_or_404(Entity, id=entity_id, document_id__project__owner=user)


def _resolve_document_project(document: Document, user=None) -> Project:
    if document.project_id:
        return document.project
    project = get_or_create_default_project(owner=user)
    document.project = project
    document.save(update_fields=['project'])
    return project


def _get_project_concept_note_text(project: Project) -> str | None:
    concept_note = getattr(project, 'concept_note', None)
    if not concept_note:
        return None
    text = (concept_note.content or '').strip()
    return text or None


def _active_entity_style_map() -> dict:
    return get_active_entity_style_map()


class EntityLabelAdminView(APIView):
    """Admin-only list/create endpoint for entity labels."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        queryset = EntityLabel.objects.all().order_by('display_order', 'name')
        serializer = EntityLabelSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = EntityLabelSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class EntityLabelAdminDetailView(APIView):
    """Admin-only patch/delete endpoint for entity labels."""

    permission_classes = [IsAdminUser]

    def patch(self, request, id):
        obj = get_object_or_404(EntityLabel, id=id)
        serializer = EntityLabelSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        obj = get_object_or_404(EntityLabel, id=id)
        in_use = Entity.objects.filter(entity_type__iexact=obj.name).exists()
        if in_use:
            return Response(
                {
                    'error': 'entity_label_in_use',
                    'detail': 'This label is referenced by historical extraction data. Deactivate it instead.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RelationshipTypeAdminView(APIView):
    """Admin-only list/create endpoint for relationship types."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        queryset = RelationshipType.objects.all().order_by('display_order', 'name')
        serializer = RelationshipTypeSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = RelationshipTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RelationshipTypeAdminDetailView(APIView):
    """Admin-only patch/delete endpoint for relationship types."""

    permission_classes = [IsAdminUser]

    def patch(self, request, id):
        obj = get_object_or_404(RelationshipType, id=id)
        serializer = RelationshipTypeSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        obj = get_object_or_404(RelationshipType, id=id)
        in_use = Relation.objects.filter(label__iexact=obj.name).exists()
        if in_use:
            return Response(
                {
                    'error': 'relationship_type_in_use',
                    'detail': 'This relationship type is referenced by historical extraction data. Deactivate it instead.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _resolve_provider_and_model(request) -> tuple[str, str]:
    """Resolve and validate provider/model from request payload with settings defaults."""
    payload = request.data if isinstance(request.data, dict) else {}
    provider = str(payload.get('provider') or settings.NER_DEFAULT_PROVIDER).strip().lower()
    model = str(payload.get('model') or '').strip()

    if provider not in settings.NER_PROVIDER_MODEL_ALLOWLIST:
        raise ValueError(f"Unsupported provider '{provider}'")

    if not model:
        model = settings.NER_PROVIDER_MODEL_ALLOWLIST[provider][0]

    if model not in settings.NER_PROVIDER_MODEL_ALLOWLIST[provider]:
        raise ValueError(f"Unsupported model '{model}' for provider '{provider}'")

    return provider, model


def handle_groq_error(exception):
    """Convert Groq exceptions to DRF responses."""
    error_msg = str(exception).lower()
    if isinstance(exception, ProviderConfigError) or 'api_key' in error_msg or 'credential' in error_msg:
        provider = getattr(exception, 'provider', None)
        provider_name = str(provider or 'selected provider')
        return Response(
            {
                'error': {
                    'code': 'PROVIDER_CONFIG_ERROR',
                    'message': f'{provider_name} credentials are missing or invalid.',
                    'detail': str(exception),
                    'remediation': [
                        'Provide valid credentials for selected provider',
                        'Or choose another configured provider',
                    ],
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if "rate limit" in error_msg or "429" in str(exception):
        provider = getattr(exception, 'provider', None)
        provider_name = str(provider or 'selected provider')
        provider_lower = provider_name.lower()
        guidance = 'Switch to OpenAI provider in the extraction controls and retry.' if provider_lower == 'groq' else 'Switch to another configured provider and retry.'
        return Response(
            {
                'error': {
                    'code': 'PROVIDER_RATE_LIMITED',
                    'message': f'{provider_name} is currently rate limited.',
                    'detail': f'{provider_name} API rate limit exceeded.',
                    'remediation': [guidance],
                },
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    logger.error(f"LLM provider error: {exception}")
    return Response(
        {
            'error': 'extraction_failed',
            'detail': 'Failed to extract entities from document',
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class ExtractEntitiesView(AuthenticatedAPIView):
    """Extract entities from a document using Groq Llama 3.
    
    POST /api/v1/documents/{id}/extract-entities/
    
    Response (201 Created):
    {
        "status": "extraction_completed",
        "document_id": "...",
        "entities_created": 8,
        "message": "Entity extraction completed. Previous entities have been replaced."
    }
    """

    def post(self, request, id):
        """Extract entities for document (synchronous)."""
        try:
            # Verify document exists
            try:
                document = _get_document_for_user_or_404(id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            provider, model = _resolve_provider_and_model(request)
            _resolve_document_project(document, user=request.user)
            logger.info(f"[EXTRACTION MODE] Entities-only extraction started for document_id={id}")

            # Extract entities (synchronous)
            result = extract_entities_for_document(id, provider=provider, model=model)
            entities_created = result.get('entities_created', 0)
            total_chunks = result.get('total_chunks', 0)
            processed_chunks = result.get('processed_chunks', 0)
            rate_limited_chunks = result.get('rate_limited_chunks', 0)
            skipped_chunks = result.get('skipped_chunks', 0)

            partial = rate_limited_chunks > 0 or skipped_chunks > 0
            message = 'Entity extraction completed. Previous entities have been replaced.'
            if partial:
                message = (
                    'Entity extraction completed with partial results. '
                    'Some chunks were skipped due to rate limits or parse issues.'
                )

            return Response(
                {
                    'status': 'extraction_completed',
                    'document_id': str(id),
                    'entities_created': entities_created,
                    'run_id': result.get('run_id'),
                    'provider': result.get('provider', provider),
                    'model': result.get('model', model),
                    'tokens_input': result.get('tokens_input'),
                    'tokens_output': result.get('tokens_output'),
                    'tokens_cached': result.get('tokens_cached'),
                    'cost_usd': result.get('cost_usd'),
                    'total_chunks': total_chunks,
                    'processed_chunks': processed_chunks,
                    'rate_limited_chunks': rate_limited_chunks,
                    'skipped_chunks': skipped_chunks,
                    'partial': partial,
                    'message': message,
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            error_msg = str(e).lower()
            if 'rate limit' in error_msg or '429' in error_msg:
                return handle_groq_error(e)
            return Response(
                {
                    'error': 'invalid_parameter',
                    'detail': str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Extraction error: {e}", exc_info=True)
            return handle_groq_error(e)


class ExtractEntitiesRelationsView(AuthenticatedAPIView):
    """Extract entities AND relations from a document (single-call per chunk).
    
    POST /api/v1/documents/{id}/extract-entities-relations/
    
    Request body:
    {
        "provider": "groq" | "openai",
        "model": "llama-3.1-8b-instant" | "gpt-4o-mini" | ...
    }
    
    Response (201 Created):
    {
        "status": "completed",
        "document_id": "...",
        "entities_created": 12,
        "relations_created": 8,
        "run_id": "...",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "tokens_input": 3420,
        "tokens_output": 1280,
        "tokens_cached": 512,
        "cost_usd": "0.002340",
        "duration_seconds": 8.4
    }
    """

    def post(self, request, id):
        """Extract entities and relations for document (synchronous, joint extraction)."""
        try:
            # Verify document exists
            try:
                document = _get_document_for_user_or_404(id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            provider, model = _resolve_provider_and_model(request)
            project = _resolve_document_project(document, user=request.user)
            concept_note = _get_project_concept_note_text(project)
            logger.info(f"[EXTRACTION MODE] Joint extraction (entities + relations) started for document_id={id}")

            # Extract entities and relations (synchronous, one call per chunk)
            result = extract_relations_for_document(id, provider=provider, model=model, concept_note=concept_note)

            return Response(
                {
                    'status': 'completed',
                    'document_id': str(id),
                    'entities_created': result.get('entities_created', 0),
                    'relations_created': result.get('relations_created', 0),
                    'run_id': result.get('run_id'),
                    'provider': result.get('provider', provider),
                    'model': result.get('model', model),
                    'tokens_input': result.get('tokens_input'),
                    'tokens_output': result.get('tokens_output'),
                    'tokens_cached': result.get('tokens_cached'),
                    'cost_usd': result.get('cost_usd'),
                    'duration_seconds': result.get('duration_seconds'),
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            error_msg = str(e).lower()
            if 'rate limit' in error_msg or '429' in error_msg:
                return handle_groq_error(e)
            return Response(
                {
                    'error': 'invalid_parameter',
                    'detail': str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Relation extraction error: {e}", exc_info=True)
            return handle_groq_error(e)


class ExtractRelationsOnlyView(AuthenticatedAPIView):
    """Extract ONLY relations from a document that already has entities extracted.

    POST /api/v1/documents/{id}/extract-relations/

    Request body: {"provider": "openai", "model": "gpt-4o-mini"}

    Response (201 Created):
    {
        "status": "completed",
        "document_id": "...",
        "relations_created": 13,
        ...
    }
    """

    def post(self, request, id):
        try:
            try:
                _get_document_for_user_or_404(id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {'error': 'document_not_found', 'detail': f'Document {id} does not exist'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            provider, model = _resolve_provider_and_model(request)
            logger.info(f"[EXTRACTION MODE] Relations-only extraction started for document_id={id}")

            result = extract_relations_only_for_document(id, provider=provider, model=model)

            return Response(
                {
                    'status': 'completed',
                    'document_id': str(id),
                    'relations_created': result.get('relations_created', 0),
                    'run_id': result.get('run_id'),
                    'provider': result.get('provider', provider),
                    'model': result.get('model', model),
                    'tokens_input': result.get('tokens_input'),
                    'tokens_output': result.get('tokens_output'),
                    'tokens_cached': result.get('tokens_cached'),
                    'cost_usd': result.get('cost_usd'),
                    'duration_seconds': result.get('duration_seconds'),
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            error_msg = str(e).lower()
            if 'rate limit' in error_msg or '429' in error_msg:
                return handle_groq_error(e)
            return Response(
                {'error': 'invalid_parameter', 'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Relations-only extraction error: {e}", exc_info=True)
            return handle_groq_error(e)


class RelationsView(AuthenticatedAPIView):
    """Retrieve all relations for a document.
    
    GET /api/v1/documents/{id}/relations/
    
    Response (200 OK):
    [
        {
            "id": "...",
            "document_id": "...",
            "run_id": "...",
            "source_entity_id": "...",
            "source_entity_name": "Sarah Chen",
            "target_entity_id": "...",
            "target_entity_name": "Apex Corp",
            "label": "REPORTS_TO",
            "confidence": 0.87,
            "created_at": "2026-03-15T..."
        },
        ...
    ]
    """

    def get(self, request, id):
        """Get all relations for a document."""
        try:
            # Verify document exists
            try:
                _get_document_for_user_or_404(id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get relations for document with eager loading of related entities
            relations = Relation.objects.filter(document_id=id, document_id__project__owner=request.user).select_related(
                'source_entity',
                'target_entity',
                'run',
            ).order_by('-created_at')

            # Optional: filter by confidence_min
            confidence_min = request.query_params.get('confidence_min')
            if confidence_min is not None:
                try:
                    confidence_min = float(confidence_min)
                    relations = relations.filter(confidence__gte=confidence_min)
                except (ValueError, TypeError):
                    pass  # Ignore invalid confidence_min

            serializer = RelationSerializer(relations, many=True)
            
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error retrieving relations: {e}", exc_info=True)
            return Response(
                {
                    'error': 'retrieval_failed',
                    'detail': 'Failed to retrieve relations',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DocumentEntitiesView(AuthenticatedAPIView):
    """Retrieve all entities for a document.
    
    GET /api/v1/documents/{id}/entities/
    
    Response (200 OK):
    {
        "document_id": "...",
        "entities": [...],
        "total_count": 5
    }
    """

    def get(self, request, id):
        """Get all entities for a document."""
        try:
            # Verify document exists
            try:
                _get_document_for_user_or_404(id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Get entities for document with optional filtering
            entities = Entity.objects.filter(document_id=id, document_id__project__owner=request.user).select_related('parent_entity').prefetch_related('aliases')

            # Optional: filter by entity_type
            entity_type = request.query_params.get('entity_type')
            if entity_type:
                entity_type = entity_type.upper()
                valid_types = [t[0] for t in Entity.ENTITY_TYPES]
                if entity_type not in valid_types:
                    return Response(
                        {
                            'error': 'invalid_parameter',
                            'detail': f'entity_type must be one of: {", ".join(valid_types)}',
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                entities = entities.filter(entity_type=entity_type)

            # Optional: filter by confidence_min
            confidence_min = request.query_params.get('confidence_min')
            if confidence_min is not None:
                try:
                    confidence_min = float(confidence_min)
                    entities = entities.filter(confidence__gte=confidence_min)
                except (ValueError, TypeError):
                    pass  # Ignore invalid confidence_min

            entities = entities.order_by('-created_at')
            serializer = EntitySerializer(entities, many=True)
            data = serializer.data

            return Response(
                {
                    'document_id': str(id),
                    'entities': data,
                    'total_count': len(data),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Error retrieving entities: {e}", exc_info=True)
            return Response(
                {
                    'error': 'retrieval_failed',
                    'detail': 'Failed to retrieve entities',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class EntityReviewCandidatesView(AuthenticatedAPIView):
    """List pending entity review candidates for a document."""

    def get(self, request, id):
        try:
            try:
                _get_document_for_user_or_404(id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            candidates = (
                EntityReviewCandidate.objects.filter(
                    document_id=id,
                    status=EntityReviewCandidate.STATUS_PENDING,
                )
                .select_related('left_entity', 'right_entity', 'resolved_by')
                .order_by('-created_at')
            )

            serializer = EntityReviewCandidateSerializer(candidates, many=True)
            return Response(
                {
                    'document_id': str(id),
                    'candidates': serializer.data,
                    'total_count': len(serializer.data),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Error retrieving review candidates: {e}", exc_info=True)
            return Response(
                {
                    'error': 'retrieval_failed',
                    'detail': 'Failed to retrieve review candidates',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class EntityReviewResolveView(AuthenticatedAPIView):
    """Resolve a pending review candidate via merge or keep-separate action."""

    def post(self, request, id, candidate_id):
        try:
            action = str((request.data or {}).get('action', '')).strip().lower()
            target_entity_id = (request.data or {}).get('target_entity_id')
            if action not in ('merge', 'keep_separate'):
                return Response(
                    {
                        'error': 'invalid_parameter',
                        'detail': 'action must be one of: merge, keep_separate',
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            candidate = get_object_or_404(
                EntityReviewCandidate.objects.select_related('left_entity', 'right_entity'),
                id=candidate_id,
                document_id=id,
            )

            try:
                resolved = _entity_dedup_service.resolve_review_candidate(
                    candidate,
                    action,
                    target_entity_id=target_entity_id,
                    user=request.user,
                )
            except ValueError as exc:
                return Response(
                    {
                        'error': 'invalid_parameter',
                        'detail': str(exc),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    'status': 'resolved',
                    'action': action,
                    'candidate_id': str(resolved.id),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Error resolving review candidate: {e}", exc_info=True)
            return Response(
                {
                    'error': 'resolve_failed',
                    'detail': 'Failed to resolve review candidate',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GraphNodesView(APIView):
    """Retrieve entities as Cytoscape.js nodes and relations as edges.
    
    GET /api/v1/graph/?document_id={id}
    
    Response (200 OK):
    {
        "document_id": "...",
        "nodes": [
            {
                "data": {
                    "id": "entity-uuid",
                    "label": "Sarah Chen",
                    "entity_type": "PERSON",
                    "shape": "ellipse",
                    "confidence": 0.92
                }
            },
            ...
        ],
        "edges": [
            {
                "data": {
                    "id": "relation-uuid",
                    "source": "source-entity-uuid",
                    "target": "target-entity-uuid",
                    "label": "REPORTS_TO",
                    "confidence": 0.87
                }
            },
            ...
        ],
        "total_nodes": 5,
        "total_edges": 3
    }
    """

    permission_classes = [IsAuthenticated]

    # Node shape mapping by entity type
    SHAPE_MAP = {
        'PERSON': 'ellipse',
        'ORGANIZATION': 'rectangle',
        'LOCATION': 'diamond',
        'ROLE': 'hexagon',
    }

    def get(self, request):
        """Get graph nodes and edges for a document."""
        try:
            # Get document_id from query parameters
            document_id = request.query_params.get('document_id')
            if not document_id:
                return Response(
                    {
                        'error': 'missing_parameter',
                        'detail': 'Required query parameter: document_id',
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Verify document exists
            try:
                _get_document_for_user_or_404(document_id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {document_id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Optional: filter by confidence_min
            confidence_min = request.query_params.get('confidence_min')
            confidence_threshold = None
            if confidence_min is not None:
                try:
                    confidence_threshold = float(confidence_min)
                except (ValueError, TypeError):
                    pass  # Ignore invalid confidence_min

            # Get entities for nodes
            entities = Entity.objects.filter(document_id=document_id, document_id__project__owner=request.user).select_related('parent_entity')
            if confidence_threshold is not None:
                entities = entities.filter(confidence__gte=confidence_threshold)
            entities = entities.order_by('entity_type', 'canonical_name')

            style_map = _active_entity_style_map()
            default_style = {'shape': 'ellipse', 'color': '#9ca3af'}

            entity_ids = {str(entity.id) for entity in entities}
            degree_map = {entity_id: 0 for entity_id in entity_ids}

            relations_for_degree = Relation.objects.filter(document_id=document_id, document_id__project__owner=request.user)
            if confidence_threshold is not None:
                relations_for_degree = relations_for_degree.filter(confidence__gte=confidence_threshold)
            for rel in relations_for_degree.only('source_entity_id', 'target_entity_id'):
                source_id = str(rel.source_entity_id)
                target_id = str(rel.target_entity_id)
                if source_id in degree_map and target_id in degree_map:
                    degree_map[source_id] += 1
                    degree_map[target_id] += 1

            # Build nodes array with shape mapping
            nodes = []
            for entity in entities:
                style = style_map.get(entity.entity_type, default_style)
                nodes.append({
                    "id": str(entity.id),
                    "label": entity.canonical_name,
                    "entity_type": entity.entity_type,
                    "degree": degree_map.get(str(entity.id), 0),
                    "style": style,
                    "data": {
                        "id": str(entity.id),
                        "label": entity.canonical_name,
                        "entity_type": entity.entity_type,
                        "shape": style.get('shape', self.SHAPE_MAP.get(entity.entity_type, 'ellipse')),
                        "color": style.get('color', '#9ca3af'),
                        "degree": degree_map.get(str(entity.id), 0),
                        "confidence": entity.confidence,
                        "document_id": str(entity.document_id_id),
                        "chunk_id": str(entity.chunk_id_id) if entity.chunk_id_id else None,
                        "raw_mentions_count": len(entity.raw_mentions),
                        "parent_entity_id": str(entity.parent_entity_id) if entity.parent_entity_id else None,
                        "needs_review": entity.needs_review,
                        "mention_count_dedup": entity.mention_count_dedup,
                    }
                })

            # Get relations for edges (only include if both source and target are in  filtered entities)
            relations = Relation.objects.filter(document_id=document_id, document_id__project__owner=request.user).select_related(
                'source_entity',
                'target_entity',
            )
            if confidence_threshold is not None:
                relations = relations.filter(confidence__gte=confidence_threshold)

            # Build edges array
            edges = []
            for relation in relations:
                source_id = str(relation.source_entity.id)
                target_id = str(relation.target_entity.id)
                
                # Only include edge if both entities are in the filtered node set
                if source_id in entity_ids and target_id in entity_ids:
                    edges.append({
                        "data": {
                            "id": str(relation.id),
                            "source": source_id,
                            "target": target_id,
                            "label": relation.label,
                            "confidence": relation.confidence,
                        }
                    })

            return Response(
                {
                    'document_id': str(document_id),
                    'nodes': nodes,
                    'edges': edges,
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Error retrieving graph: {e}", exc_info=True)
            return Response(
                {
                    'error': 'retrieval_failed',
                    'detail': 'Failed to retrieve graph',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ProjectExtractEntitiesView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/extract-entities/."""

    def post(self, request, id):
        try:
            project = _get_project_for_user_or_404(id, request.user)
            document_id = request.data.get('document_id') if isinstance(request.data, dict) else None
            documents = []
            if document_id:
                document = _get_document_for_user_or_404(document_id, request.user)
                if document.project_id != project.id:
                    return Response(
                        {'error': 'document_not_in_project'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                documents = [document]
            else:
                documents = list(Document.objects.filter(project=project).order_by('upload_timestamp'))
                if not documents:
                    return Response(
                        {'error': 'no_project_documents', 'detail': 'Project has no uploaded documents.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            provider, model = _resolve_provider_and_model(request)
            concept_note = _get_project_concept_note_text(project)
            total_entities_created = 0
            total_relations_created = 0
            per_document_results = []

            for document in documents:
                result = extract_relations_for_document(
                    str(document.id),
                    provider=provider,
                    model=model,
                    concept_note=concept_note,
                )

                fallback_used = False
                if result.get('relations_created', 0) == 0 and result.get('entities_created', 0) >= 2:
                    fallback = extract_relations_only_for_document(str(document.id), provider=provider, model=model)
                    result = {
                        **result,
                        'relations_created': fallback.get('relations_created', 0),
                        'run_id': fallback.get('run_id') or result.get('run_id'),
                    }
                    fallback_used = True

                doc_entities = int(result.get('entities_created', 0) or 0)
                doc_relations = int(result.get('relations_created', 0) or 0)
                total_entities_created += doc_entities
                total_relations_created += doc_relations
                per_document_results.append(
                    {
                        'document_id': str(document.id),
                        'entities_created': doc_entities,
                        'relations_created': doc_relations,
                        'run_id': result.get('run_id'),
                        'fallback_relations_run': fallback_used,
                    }
                )

            if len(documents) == 1:
                only = per_document_results[0]
                return Response(
                    {
                        'status': 'completed',
                        'project_id': str(project.id),
                        'document_id': only['document_id'],
                        'entities_created': only['entities_created'],
                        'relations_created': only['relations_created'],
                        'run_id': only['run_id'],
                        'provider': provider,
                        'model': model,
                        'fallback_relations_run': only['fallback_relations_run'],
                    },
                    status=status.HTTP_201_CREATED,
                )

            return Response(
                {
                    'status': 'completed',
                    'project_id': str(project.id),
                    'documents_processed': len(documents),
                    'entities_created': total_entities_created,
                    'relations_created': total_relations_created,
                    'provider': provider,
                    'model': model,
                    'results': per_document_results,
                },
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            error_msg = str(e).lower()
            if 'rate limit' in error_msg or '429' in error_msg:
                return handle_groq_error(e)
            return Response(
                {
                    'error': 'invalid_parameter',
                    'detail': str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Project extraction error: {e}", exc_info=True)
            return handle_groq_error(e)


class ProjectEntitiesView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/entities/."""

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        entities = Entity.objects.filter(project=project).select_related('parent_entity').prefetch_related('aliases').order_by('-created_at')
        serializer = EntitySerializer(entities, many=True)
        return Response(
            {
                'project_id': str(project.id),
                'entities': serializer.data,
                'total_count': len(serializer.data),
            },
            status=status.HTTP_200_OK,
        )


class ProjectGraphView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/graph/."""

    SHAPE_MAP = GraphNodesView.SHAPE_MAP

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        entities = Entity.objects.filter(project=project, is_flagged=False).order_by('entity_type', 'canonical_name')
        style_map = _active_entity_style_map()
        default_style = {'shape': 'ellipse', 'color': '#9ca3af'}
        entity_ids = {str(entity.id) for entity in entities}
        degree_map = {entity_id: 0 for entity_id in entity_ids}

        relation_qs = Relation.objects.filter(project=project).select_related('source_entity', 'target_entity')
        for relation in relation_qs:
            source_id = str(relation.source_entity_id)
            target_id = str(relation.target_entity_id)
            if source_id in degree_map and target_id in degree_map:
                degree_map[source_id] += 1
                degree_map[target_id] += 1

        nodes = [
            {
                'id': str(entity.id),
                'label': entity.canonical_name,
                'entity_type': entity.entity_type,
                'degree': degree_map.get(str(entity.id), 0),
                'style': style_map.get(entity.entity_type, default_style),
                'data': {
                    'id': str(entity.id),
                    'label': entity.canonical_name,
                    'entity_type': entity.entity_type,
                    'shape': style_map.get(entity.entity_type, default_style).get('shape', self.SHAPE_MAP.get(entity.entity_type, 'ellipse')),
                    'color': style_map.get(entity.entity_type, default_style).get('color', '#9ca3af'),
                    'degree': degree_map.get(str(entity.id), 0),
                    'confidence': entity.confidence,
                },
            }
            for entity in entities
        ]
        entity_ids = {str(item['id']) for item in nodes}
        relations = relation_qs
        edges = []
        for relation in relations:
            source_id = str(relation.source_entity_id)
            target_id = str(relation.target_entity_id)
            if source_id in entity_ids and target_id in entity_ids:
                edges.append(
                    {
                        'data': {
                            'id': str(relation.id),
                            'source': source_id,
                            'target': target_id,
                            'label': relation.label,
                            'confidence': relation.confidence,
                        }
                    }
                )

        return Response(
            {
                'project_id': str(project.id),
                'nodes': nodes,
                'edges': edges,
                'total_nodes': len(nodes),
                'total_edges': len(edges),
            },
            status=status.HTTP_200_OK,
        )


class ProjectQueryView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/query/

    Accepts {"query": "..."} and returns matching entity IDs via pgvector semantic search.
    When the query looks like a natural language question, also calls the LLM for an answer.
    """

    def post(self, request, id):
        from .services.semantic_search import search_entity_ids_for_project, search_chunks_for_entity
        from .services.nl_query import is_nl_question, answer_nl_query

        project = _get_project_for_user_or_404(id, request.user)
        query = (request.data.get('query') or '').strip()
        if not query:
            return Response({'error': 'query is required'}, status=status.HTTP_400_BAD_REQUEST)

        entity_ids = search_entity_ids_for_project(project, query, top_k=20)
        count = len(entity_ids)

        nl = is_nl_question(query)
        answer = None

        if nl:
            top_k_chunks = search_chunks_for_entity(project, query, top_k=10)
            chunk_texts = [c.text for c in top_k_chunks if c.text]
            provider = (getattr(project, 'provider', '') or '').strip() or settings.NER_DEFAULT_PROVIDER
            model = (getattr(project, 'model', '') or '').strip() or settings.NER_DEFAULT_MODEL
            answer = answer_nl_query(project, query, chunk_texts, provider, model)

        return Response({
            'query': query,
            'is_nl_query': nl,
            'answer': answer,
            'entity_ids': entity_ids,
            'count': count,
        }, status=status.HTTP_200_OK)


class GlobalEntityProfileView(AuthenticatedAPIView):
    """GET /api/v1/entities/{id}/."""

    def get(self, request, id):
        entity = get_object_or_404(Entity, id=id, document_id__project__owner=request.user)
        serializer = GlobalEntityProfileSerializer(entity, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class EntityProfileView(AuthenticatedAPIView):
    """GET /api/v1/entities/{id}/profile/."""

    def get(self, request, id):
        entity = _get_entity_for_user_or_404(id, request.user)
        serializer = GlobalEntityProfileSerializer(entity, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class EntitySummaryView(AuthenticatedAPIView):
    """POST /api/v1/entities/{id}/summary/."""

    def post(self, request, id):
        entity = _get_entity_for_user_or_404(id, request.user)
        serializer = ContextualSummaryRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project_id = serializer.validated_data['project_id']
        refresh = serializer.validated_data.get('refresh', False)
        project = _get_project_for_user_or_404(project_id, request.user)

        entity_in_project = Entity.objects.filter(
            canonical_name=entity.canonical_name,
            project=project,
            document_id__project__owner=request.user,
        ).exists()
        if not entity_in_project:
            return Response(
                {
                    'error': 'entity_not_in_project',
                    'detail': 'Entity is not linked to the selected project context.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        project_provider = (getattr(project, 'provider', '') or '').strip() or settings.NER_DEFAULT_PROVIDER
        project_model = (getattr(project, 'model', '') or '').strip() or settings.NER_DEFAULT_MODEL
        summary_payload = get_or_generate_summary(
            entity=entity,
            project=project,
            refresh=refresh,
            timeout_seconds=8,
            provider=project_provider,
            model=project_model,
        )

        status_code = summary_payload.pop('status_code', status.HTTP_200_OK)
        return Response(summary_payload, status=status_code)


class DocumentRunsView(AuthenticatedAPIView):
    """Retrieve all NER extraction runs for a document."""

    def get(self, request, id):
        """Get provider/model usage history for a document."""
        try:
            try:
                _get_document_for_user_or_404(id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {
                        'error': 'document_not_found',
                        'detail': f'Document with ID {id} does not exist',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            runs = NERRun.objects.filter(document_id=id, document_id__project__owner=request.user).order_by('-created_at')
            serializer = NERRunSerializer(runs, many=True)

            return Response(
                {
                    'document_id': str(id),
                    'runs': serializer.data,
                    'total_count': len(serializer.data),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Error retrieving run history: {e}", exc_info=True)
            return Response(
                {
                    'error': 'retrieval_failed',
                    'detail': 'Failed to retrieve run history',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ---------------------------------------------------------------------------
# T017 — Entity Flag View
# ---------------------------------------------------------------------------
class EntityFlagView(AuthenticatedAPIView):
    """POST /api/v1/entities/{id}/flag/"""

    def post(self, request, id):
        entity = get_object_or_404(Entity, id=id, project__owner=request.user)
        is_flagged = request.data.get('is_flagged')
        if is_flagged is None:
            return Response({'error': 'is_flagged is required'}, status=status.HTTP_400_BAD_REQUEST)
        entity.is_flagged = bool(is_flagged)
        entity.save(update_fields=['is_flagged'])
        return Response({
            'id': str(entity.id),
            'canonical_name': entity.canonical_name,
            'is_flagged': entity.is_flagged,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# T013/T023 — Documents with stats + Dedup review views
# ---------------------------------------------------------------------------
class ProjectFlaggedCountView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/flagged-count/"""

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        count = Entity.objects.filter(project=project, is_flagged=True).count()
        return Response({'project_id': str(id), 'flagged_count': count}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# T023 — Dedup Review List
# ---------------------------------------------------------------------------
class DeduplicationReviewListView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/review/"""

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        candidates = (
            EntityReviewCandidate.objects
            .filter(document__project=project, status='pending')
            .select_related('left_entity', 'right_entity')
            .order_by('-similarity_score')[:50]
        )

        results = []
        for c in candidates:
            left_chunk = None
            if c.left_entity.chunk_id_id:
                from ingestion.models import Chunk
                chunk = getattr(c.left_entity, 'chunk_id', None)
                if chunk:
                    left_chunk = (chunk.text or '')[:280]

            results.append({
                'id': str(c.id),
                'left_entity': {
                    'id': str(c.left_entity.id),
                    'name': c.left_entity.canonical_name,
                    'type': c.left_entity.entity_type,
                },
                'right_entity': {
                    'id': str(c.right_entity.id),
                    'name': c.right_entity.canonical_name,
                    'type': c.right_entity.entity_type,
                },
                'similarity_score': c.similarity_score,
                'mention_context': left_chunk,
            })

        pending_count = EntityReviewCandidate.objects.filter(
            document__project=project, status='pending'
        ).count()

        return Response({
            'project_id': str(id),
            'pending_count': pending_count,
            'results': results,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# T024 — Review Candidate Resolve
# ---------------------------------------------------------------------------
class ReviewCandidateResolveView(AuthenticatedAPIView):
    """POST /api/v1/review-candidates/{id}/resolve/"""

    def post(self, request, id):
        from .services.dedup_review import resolve_review_candidate

        candidate = get_object_or_404(
            EntityReviewCandidate,
            id=id,
            document__project__owner=request.user,
        )
        if candidate.status != 'pending':
            return Response({'error': 'candidate already resolved'}, status=status.HTTP_409_CONFLICT)

        action = (request.data.get('action') or '').strip()
        if action not in ('merge', 'keep_separate'):
            return Response(
                {'error': 'action must be "merge" or "keep_separate"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            candidate = resolve_review_candidate(candidate, action, request.user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'id': str(candidate.id),
            'status': candidate.status,
            'resolved_at': candidate.resolved_at,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# T030 — Entity Mention Timeline
# ---------------------------------------------------------------------------
class EntityTimelineView(AuthenticatedAPIView):
    """GET /api/v1/entities/{id}/timeline/?project_id={id}"""

    def get(self, request, id):
        from ingestion.models import Chunk

        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response({'error': 'project_id query param required'}, status=status.HTTP_400_BAD_REQUEST)

        entity = get_object_or_404(Entity, id=id)
        project = _get_project_for_user_or_404(project_id, request.user)

        chunks = (
            Chunk.objects
            .filter(document__project=project, text__icontains=entity.canonical_name)
            .select_related('document')
            .order_by('document__upload_timestamp')
        )

        seen_docs: set[str] = set()
        timeline = []
        for chunk in chunks:
            doc_id = str(chunk.document_id)
            if doc_id in seen_docs:
                continue
            seen_docs.add(doc_id)

            text = chunk.text or ''
            name_lower = entity.canonical_name.lower()
            idx = text.lower().find(name_lower)
            if idx >= 0:
                start = max(0, idx - 100)
                end = min(len(text), idx + len(entity.canonical_name) + 100)
                snippet = text[start:end].strip()
            else:
                snippet = text[:280].strip()

            timeline.append({
                'document_id': doc_id,
                'document_name': chunk.document.filename,
                'uploaded_at': chunk.document.upload_timestamp,
                'context_snippet': snippet,
            })

        return Response({
            'entity_id': str(id),
            'project_id': str(project_id),
            'timeline': timeline,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# T033 — Global Entity List
# ---------------------------------------------------------------------------
class GlobalEntityListView(AuthenticatedAPIView):
    """GET /api/v1/entities/ — cross-project entity list for authenticated user."""

    def get(self, request):
        from django.db.models import Count, Min, Max

        entity_type = request.query_params.get('type')
        qs = (
            Entity.objects
            .filter(project__owner=request.user, is_flagged=False)
            .values('id', 'canonical_name', 'entity_type', 'project_id')
        )

        # Aggregate at canonical_name level across projects
        agg = (
            Entity.objects
            .filter(project__owner=request.user, is_flagged=False)
            .values('canonical_name', 'entity_type')
            .annotate(
                project_count=Count('project', distinct=True),
                document_count=Count('document_id', distinct=True),
                confidence_min=Min('confidence'),
                confidence_max=Max('confidence'),
            )
            .order_by('-project_count', 'canonical_name')
        )

        if entity_type:
            agg = agg.filter(entity_type=entity_type.upper())

        page_size = 50
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (ValueError, TypeError):
            page = 1
        offset = (page - 1) * page_size
        total = agg.count()
        results = list(agg[offset:offset + page_size])

        # Attach a representative entity ID (first match) for linking
        for item in results:
            rep = (
                Entity.objects
                .filter(
                    canonical_name=item['canonical_name'],
                    entity_type=item['entity_type'],
                    project__owner=request.user,
                )
                .values('id', 'project_id')
                .first()
            )
            item['representative_id'] = str(rep['id']) if rep else None
            item['representative_project_id'] = str(rep['project_id']) if rep else None

        return Response({
            'count': total,
            'page': page,
            'results': results,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# T038 — Project Provider View
# ---------------------------------------------------------------------------
_PROVIDER_MODELS: dict[str, list[str]] = {
    'groq': ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    'openai': ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    'azure_openai': ['gpt-4o', 'gpt-35-turbo'],
    'gemini': ['gemini-1.5-flash', 'gemini-1.5-pro'],
}

_PROVIDER_ENV_KEYS: dict[str, str] = {
    'groq': 'GROQ_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'azure_openai': 'AZURE_OPENAI_API_KEY',
    'gemini': 'GEMINI_API_KEY',
}


class ProjectProviderView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/providers/"""

    def get(self, request, id):
        import os
        project = _get_project_for_user_or_404(id, request.user)
        current_provider = (getattr(project, 'provider', '') or '').strip() or settings.NER_DEFAULT_PROVIDER
        current_model = (getattr(project, 'model', '') or '').strip() or settings.NER_DEFAULT_MODEL

        providers = []
        for name, env_key in _PROVIDER_ENV_KEYS.items():
            available = bool(os.environ.get(env_key, '').strip())
            providers.append({
                'name': name,
                'available': available,
                'models': _PROVIDER_MODELS.get(name, []),
            })

        return Response({
            'project_id': str(id),
            'current_provider': current_provider,
            'current_model': current_model,
            'providers': providers,
        }, status=status.HTTP_200_OK)


class ExtractionProgressView(AuthenticatedAPIView):
    """Lightweight polling endpoint for chunk-level extraction progress.

    GET /api/v1/documents/{id}/extraction-progress/

    Response:
    {
        "in_progress": true,
        "current": 5,
        "total": 34
    }

    Returns {"in_progress": false, "current": 0, "total": 0} when no extraction
    is currently running for the given document.
    """

    def get(self, request, id):
        progress = _extraction_progress.get(str(id))
        if progress is None:
            return Response(
                {'in_progress': False, 'current': 0, 'total': 0},
                status=status.HTTP_200_OK,
            )
        return Response(
            {
                'in_progress': True,
                'current': progress['current'],
                'total': progress['total'],
            },
            status=status.HTTP_200_OK,
        )
