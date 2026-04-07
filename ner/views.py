"""REST API views for NER pipeline."""

import csv
import io
import logging
import time
from datetime import timedelta
from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ingestion.models import Document, Project, get_or_create_default_project
from ingestion.services.context import get_project_context
from .models import (
    Entity,
    NERRun,
    Relation,
    EntityLabel,
    RelationshipType,
    EntityReviewCandidate,
    SMQTemplate,
    SMQSection,
    ProjectSMQResponse,
    ProjectSMQAnswer,
    ReportSection,
    EngagementNote,
)
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
    SMQTemplateSerializer,
    ProjectSMQResponseSerializer,
    ProjectSMQAnswerSerializer,
    ReportSectionSerializer,
    StakeholderPrioritySerializer,
    LLMConnectionTestSerializer,
    ReportExportStatusSerializer,
)
from .services.pipeline import extract_entities_for_document, extract_relations_for_document, extract_relations_only_for_document, _extraction_progress, get_active_entity_style_map
from .services.report_staleness import flag_stale_report_sections
from .services.contextual_summary import get_or_generate_summary
from .services.entity_dedup_service import EntityDedupService
from .services.pdf_utils import pdf_safe, resolve_pdf_fonts
from .services.provider_runtime import ProviderConfigError, classify_provider_error, validate_provider_runtime_config
from .services.provider_factory import resolve_provider_model
from .services.smq_generator import generate_smq_section
from .services.priority_table import compute_priority_scores
from .tasks import (
    generate_report_sections_task,
    regenerate_report_section_task,
    generate_priority_notes_task,
    generate_workplan_task,
)

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
    text = (get_project_context(project) or '').strip()
    return text or None


def _active_entity_style_map() -> dict:
    return get_active_entity_style_map()


def _get_preferred_smq_template() -> SMQTemplate | None:
    return (
        SMQTemplate.objects.filter(is_active=True)
        .annotate(
            active_section_count=models.Count(
                'sections',
                filter=models.Q(sections__is_active=True),
                distinct=True,
            ),
            default_template_rank=models.Case(
                models.When(title='Stakeholder Mapping Questionnaire', then=models.Value(0)),
                default=models.Value(1),
                output_field=models.IntegerField(),
            ),
        )
        .order_by('-active_section_count', 'default_template_rank', '-created_at')
        .first()
    )


def _default_smq_answer_from_context(project: Project, section: SMQSection) -> str:
    context = get_project_context(project).strip()
    if not context:
        return ''

    try:
        profile = project.initiative_profile
    except Exception:
        profile = None

    core_objectives = getattr(profile, 'core_objectives', '') if profile else ''
    expected_outcomes = getattr(profile, 'expected_outcomes', '') if profile else ''
    stakeholder_focus = getattr(profile, 'stakeholder_focus', '') if profile else ''
    geography = getattr(profile, 'geography', '') if profile else ''
    thematic_area = getattr(profile, 'thematic_area', '') if profile else ''
    host_organization = getattr(profile, 'host_organization', '') if profile else ''
    country = getattr(profile, 'country', '') if profile else ''
    target_beneficiaries = getattr(profile, 'target_beneficiaries', '') if profile else ''
    success_metrics = getattr(profile, 'success_metrics', '') if profile else ''

    section_defaults = {
        1: core_objectives or context,
        2: stakeholder_focus or target_beneficiaries or context,
        3: '\n'.join(filter(None, [host_organization, geography, country, thematic_area])) or context,
        4: '\n'.join(filter(None, [stakeholder_focus, target_beneficiaries, thematic_area])) or context,
        5: '\n'.join(filter(None, [expected_outcomes, success_metrics])) or context,
        6: expected_outcomes or success_metrics or context,
        7: '\n'.join(filter(None, [core_objectives, expected_outcomes, stakeholder_focus])) or context,
        8: success_metrics or expected_outcomes or context,
    }
    return section_defaults.get(section.section_number, context).strip()


def _report_task_cache_key(project_id: str) -> str:
    return f"report_generation_tasks:{project_id}"


def _report_cancel_cache_key(project_id: str) -> str:
    return f"report_generation_cancel:{project_id}"


def _persona_generation_cache_key(project_id: str) -> str:
    return f"persona_generation_status:{project_id}"


def _workplan_generation_cache_key(project_id: str) -> str:
    return f"workplan_generation_status:{project_id}"


def _set_generation_status(cache_key: str, status_value: str, message: str = '') -> None:
    cache.set(cache_key, {'status': status_value, 'message': message}, timeout=60 * 60)


def _get_generation_status(cache_key: str, fallback_status: str) -> dict:
    cached = cache.get(cache_key) or {}
    if not isinstance(cached, dict):
        return {'status': fallback_status, 'message': ''}
    status_value = cached.get('status') or fallback_status
    message = cached.get('message') or ''
    return {'status': status_value, 'message': message}


def _mark_stuck_report_sections(project: Project, timeout_minutes: int = 10) -> int:
    cutoff = timezone.now() - timedelta(minutes=timeout_minutes)
    stuck_qs = ReportSection.objects.filter(
        project=project,
        status__in=[ReportSection.STATUS_PENDING, ReportSection.STATUS_GENERATING],
        updated_at__lt=cutoff,
    )
    return stuck_qs.update(
        status=ReportSection.STATUS_ERROR,
        error_message='Generation timed out. Please retry or use Stop generation and restart.',
    )


class EntityLabelAdminView(APIView):
    """List/create endpoint for entity labels. GET is open to all authenticated users; write operations require admin."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = EntityLabel.objects.all().order_by('display_order', 'name')
        serializer = EntityLabelSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = EntityLabelSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class EntityLabelAdminDetailView(APIView):
    """Patch/delete endpoint for entity labels. Requires admin."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        obj = get_object_or_404(EntityLabel, id=id)
        serializer = EntityLabelSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
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
    """List/create endpoint for relationship types. GET is open to all authenticated users; write operations require admin."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = RelationshipType.objects.all().order_by('display_order', 'name')
        serializer = RelationshipTypeSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = RelationshipTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RelationshipTypeAdminDetailView(APIView):
    """Patch/delete endpoint for relationship types. Requires admin."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        obj = get_object_or_404(RelationshipType, id=id)
        serializer = RelationshipTypeSerializer(obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
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


def _resolve_provider_and_model(request, project=None) -> tuple[str, str]:
    """Resolve provider/model using request payload with project-aware fallback defaults."""
    payload = request.data if isinstance(request.data, dict) else {}
    provider = str(payload.get('provider') or '').strip().lower() or (getattr(project, 'provider', '') or '').strip().lower() or None
    model = str(payload.get('model') or '').strip() or (getattr(project, 'model', '') or '').strip() or None
    resolved = resolve_provider_model(provider, model)
    return resolved.provider, resolved.model


def handle_groq_error(exception):
    """Convert provider exceptions to normalized DRF error responses."""
    error_msg = str(exception).lower()
    if isinstance(exception, ProviderConfigError) or 'api_key' in error_msg or 'credential' in error_msg:
        provider = getattr(exception, 'provider', None)
        provider_name = str(provider or 'selected provider')
        return Response(
            {
                'error': 'llm_error',
                'error_kind': 'configuration',
                'detail': str(exception),
                'provider_error': {
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
                'error': 'llm_error',
                'error_kind': 'rate_limit',
                'detail': f'{provider_name} API rate limit exceeded.',
                'provider_error': {
                    'code': 'PROVIDER_RATE_LIMITED',
                    'message': f'{provider_name} is currently rate limited.',
                    'detail': f'{provider_name} API rate limit exceeded.',
                    'remediation': [guidance],
                },
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if 'timeout' in error_msg or 'timed out' in error_msg:
        return Response(
            {
                'error': 'llm_error',
                'error_kind': 'timeout',
                'detail': 'Provider request timed out. Please retry.',
                'error_payload': {
                    'code': 'PROVIDER_TIMEOUT',
                    'message': 'Provider request timed out. Please retry.',
                },
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    normalized_kind = classify_provider_error(exception)
    logger.error(f"LLM provider error: {exception}")
    return Response(
        {
            'error': 'llm_error',
            'error_kind': normalized_kind,
            'detail': 'Provider request failed. Please try again.',
            'error_payload': {
                'code': 'PROVIDER_ERROR',
                'message': 'Provider request failed. Please try again.',
            },
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
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

            project = _resolve_document_project(document, user=request.user)
            provider, model = _resolve_provider_and_model(request, project=project)
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

            project = _resolve_document_project(document, user=request.user)
            provider, model = _resolve_provider_and_model(request, project=project)
            concept_note = _get_project_concept_note_text(project)
            logger.info(f"[EXTRACTION MODE] Joint extraction (entities + relations) started for document_id={id}")

            # Extract entities and relations (synchronous, one call per chunk)
            result = extract_relations_for_document(id, provider=provider, model=model, concept_note=concept_note)

            # Flag existing report sections as stale when new entities are extracted
            if result.get('entities_created', 0) > 0:
                flag_stale_report_sections(str(project.id))

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
                document = _get_document_for_user_or_404(id, request.user)
            except (Document.DoesNotExist, Http404):
                return Response(
                    {'error': 'document_not_found', 'detail': f'Document {id} does not exist'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            project = _resolve_document_project(document, user=request.user)
            provider, model = _resolve_provider_and_model(request, project=project)
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

            provider, model = _resolve_provider_and_model(request, project=project)
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

            # Flag existing report sections as stale when new entities are extracted
            if total_entities_created > 0:
                flag_stale_report_sections(str(project.id))

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
        from django.db.models import Q
        from ingestion.models import Chunk
        from ner.models import Entity, Relation, EngagementNote, ReportSection

        project = _get_project_for_user_or_404(id, request.user)
        query = (request.data.get('query') or '').strip()
        if not query:
            return Response({'error': 'query is required'}, status=status.HTTP_400_BAD_REQUEST)

        entity_ids = search_entity_ids_for_project(project, query, top_k=24)

        # Lexical fallback: add strongly matching entity names when embedding retrieval misses terms.
        lexical_tokens = [token.strip().lower() for token in query.split() if len(token.strip()) >= 3]
        if lexical_tokens:
            lexical_q = Q()
            for token in lexical_tokens[:8]:
                lexical_q |= Q(canonical_name__icontains=token)
            lexical_entity_ids = list(
                Entity.objects.filter(project=project, is_flagged=False)
                .filter(lexical_q)
                .values_list('id', flat=True)[:24]
            )
            lexical_ids_str = [str(item) for item in lexical_entity_ids]
            merged_ids = []
            seen = set()
            for item in entity_ids + lexical_ids_str:
                if item in seen:
                    continue
                seen.add(item)
                merged_ids.append(item)
            entity_ids = merged_ids[:30]

        count = len(entity_ids)

        nl = is_nl_question(query)
        answer = None

        if nl:
            top_k_chunks = list(search_chunks_for_entity(project, query, top_k=12))

            # Keyword reinforcement: include chunks containing key terms for better grounded answers.
            keyword_chunks = []
            if lexical_tokens:
                keyword_q = Q()
                for token in lexical_tokens[:6]:
                    keyword_q |= Q(text__icontains=token)
                keyword_chunks = list(
                    Chunk.objects.filter(document__project=project)
                    .filter(keyword_q)
                    .order_by('-document__upload_timestamp', 'chunk_index')[:12]
                )

            merged_chunks = []
            seen_chunk_ids = set()
            for chunk in top_k_chunks + keyword_chunks:
                if not chunk or not chunk.text:
                    continue
                chunk_id = str(chunk.id)
                if chunk_id in seen_chunk_ids:
                    continue
                seen_chunk_ids.add(chunk_id)
                merged_chunks.append(chunk)

            chunk_texts = [c.text for c in merged_chunks[:14] if c.text]

            # Grounded fallback context from existing project artifacts.
            if len(chunk_texts) < 3:
                fallback_context: list[str] = []

                # Initiative profile / concept-note context
                concept_text = ''
                try:
                    concept_note = project.concept_note
                    concept_text = (getattr(concept_note, 'content', '') or '').strip()
                except Exception:
                    concept_text = ''
                if concept_text:
                    fallback_context.append(f"[Initiative Profile] {concept_text[:1200]}")

                # Recent completed report sections as curated evidence
                report_sections = ReportSection.objects.filter(project=project, status='done').order_by('section__section_number')[:6]
                for section in report_sections:
                    text = (section.generated_text or '').strip()
                    if text:
                        fallback_context.append(
                            f"[Report Section {section.section.section_number}: {section.section.title}] {text[:900]}"
                        )

                # Entity + relation summaries for relational questions
                entity_summary = list(
                    Entity.objects.filter(project=project, is_flagged=False)
                    .order_by('-mention_count_dedup')
                    .values_list('canonical_name', flat=True)[:20]
                )
                if entity_summary:
                    fallback_context.append(f"[Entities] {', '.join(entity_summary)}")

                relation_rows = Relation.objects.filter(project=project).select_related('source_entity', 'target_entity')[:30]
                if relation_rows:
                    relation_lines = [
                        f"{rel.source_entity.canonical_name} --{rel.label}--> {rel.target_entity.canonical_name}"
                        for rel in relation_rows
                    ]
                    fallback_context.append('[Relations]\n' + '\n'.join(relation_lines))

                note_rows = EngagementNote.objects.filter(project=project).select_related('entity')[:20]
                if note_rows:
                    note_lines = [
                        f"{note.entity.canonical_name}: {(note.note_text or '').strip()[:220]}"
                        for note in note_rows if (note.note_text or '').strip()
                    ]
                    if note_lines:
                        fallback_context.append('[Stakeholder Notes]\n' + '\n'.join(note_lines))

                chunk_texts.extend(fallback_context[:8])

            provider = (getattr(project, 'provider', '') or '').strip() or settings.NER_DEFAULT_PROVIDER
            model = (getattr(project, 'model', '') or '').strip() or settings.NER_DEFAULT_MODEL
            try:
                answer = answer_nl_query(project, query, chunk_texts, provider, model)
            except Exception as exc:
                error_kind = classify_provider_error(exc)
                return Response(
                    {
                        'error': 'llm_error',
                        'error_kind': error_kind,
                        'detail': str(exc),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return Response({
            'query': query,
            'is_nl_query': nl,
            'answer': answer,
            'entity_ids': entity_ids,
            'count': count,
        }, status=status.HTTP_200_OK)


class SMQTemplateView(AuthenticatedAPIView):
    """GET /api/v1/smq/template/."""

    def get(self, request):
        template = _get_preferred_smq_template()
        if not template:
            return Response({'error': 'smq_template_not_found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SMQTemplateSerializer(template)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectSMQView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/smq/."""

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        response_obj, _ = ProjectSMQResponse.objects.get_or_create(project=project)

        template = _get_preferred_smq_template()
        if template:
            sections = SMQSection.objects.filter(template=template, is_active=True).order_by('order', 'section_number')
            for section in sections:
                answer, _ = ProjectSMQAnswer.objects.get_or_create(response=response_obj, section=section)
                if not (answer.answer_text or '').strip():
                    default_answer = _default_smq_answer_from_context(project, section)
                    if default_answer:
                        answer.answer_text = default_answer
                        answer.ai_generated = True
                        answer.is_stale = False
                        answer.save(update_fields=['answer_text', 'ai_generated', 'is_stale', 'updated_at'])

        serializer = ProjectSMQResponseSerializer(response_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectSMQAnswerView(AuthenticatedAPIView):
    """PUT /api/v1/projects/{id}/smq/{section_id}/."""

    def put(self, request, id, section_id):
        project = _get_project_for_user_or_404(id, request.user)
        section = get_object_or_404(SMQSection, id=section_id)
        response_obj, _ = ProjectSMQResponse.objects.get_or_create(project=project)
        answer, _ = ProjectSMQAnswer.objects.get_or_create(response=response_obj, section=section)

        answer_text = str((request.data or {}).get('answer_text') or '').strip()
        notes_text = str((request.data or {}).get('notes_text') or '').strip()
        answer.answer_text = answer_text
        answer.notes_text = notes_text
        answer.ai_generated = False
        answer.is_stale = False
        answer.save(update_fields=['answer_text', 'notes_text', 'ai_generated', 'is_stale', 'updated_at'])

        serializer = ProjectSMQAnswerSerializer(answer)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectSMQGenerateView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/smq/{section_id}/generate/."""

    def post(self, request, id, section_id):
        project = _get_project_for_user_or_404(id, request.user)
        section = get_object_or_404(SMQSection, id=section_id)
        response_obj, _ = ProjectSMQResponse.objects.get_or_create(project=project)
        answer, _ = ProjectSMQAnswer.objects.get_or_create(response=response_obj, section=section)

        try:
            generated = generate_smq_section(project, section, notes_text=(answer.notes_text or ''))
        except Exception as exc:
            logger.exception('SMQ section generation failed project=%s section=%s', project.id, section.id)
            error_kind = classify_provider_error(exc)
            return Response(
                {'error': 'llm_error', 'error_kind': error_kind, 'detail': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        answer.answer_text = generated.get('answer_text', '')
        answer.ai_generated = True
        answer.is_stale = False
        answer.last_generated_at = timezone.now()
        answer.chunk_ids_used = generated.get('chunk_ids_used', [])
        answer.save(
            update_fields=[
                'answer_text',
                'ai_generated',
                'is_stale',
                'last_generated_at',
                'chunk_ids_used',
                'updated_at',
            ]
        )

        return Response(
            {
                'section_id': str(section.id),
                'answer_text': answer.answer_text,
                'notes_text': answer.notes_text,
                'ai_generated': answer.ai_generated,
                'chunk_ids_used': answer.chunk_ids_used,
                'citations': generated.get('citations', []),
            },
            status=status.HTTP_200_OK,
        )


class ProjectReportView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/report/."""

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        _mark_stuck_report_sections(project)
        template = _get_preferred_smq_template()
        if not template:
            return Response({'project': str(project.id), 'sections': []}, status=status.HTTP_200_OK)

        sections = list(SMQSection.objects.filter(template=template, is_active=True).order_by('order', 'section_number'))
        for section in sections:
            ReportSection.objects.get_or_create(project=project, section=section)

        queryset = ReportSection.objects.filter(project=project, section__in=sections).select_related('section').order_by('section__order', 'section__section_number')
        payload = ReportSectionSerializer(queryset, many=True).data
        return Response({'project': str(project.id), 'sections': payload}, status=status.HTTP_200_OK)


class ProjectReportGenerateView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/report/generate/."""

    def post(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        if not project.documents.exists():
            return Response({'error': 'no_documents'}, status=status.HTTP_400_BAD_REQUEST)

        template = _get_preferred_smq_template()
        if not template:
            return Response({'error': 'smq_template_not_found'}, status=status.HTTP_404_NOT_FOUND)

        requested = (request.data or {}).get('sections', 'all')
        custom_instruction = str(
            (request.data or {}).get('custom_instruction')
            or (request.data or {}).get('customInstruction')
            or ''
        ).strip()
        if requested == 'all':
            section_ids = [str(section.id) for section in SMQSection.objects.filter(template=template, is_active=True).order_by('order', 'section_number')]
        elif isinstance(requested, list):
            section_ids = [str(item) for item in requested]
        else:
            return Response({'error': 'validation_error', 'detail': 'sections must be "all" or an array of section ids'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cache.delete(_report_cancel_cache_key(str(project.id)))
            task = generate_report_sections_task.delay(str(project.id), section_ids, custom_instruction)
            task_ids = cache.get(_report_task_cache_key(str(project.id))) or []
            task_ids = [task.id] + [tid for tid in task_ids if tid != task.id]
            cache.set(_report_task_cache_key(str(project.id)), task_ids[:25], timeout=60 * 60)
            return Response(
                {
                    'status': 'generating',
                    'sections_queued': len(section_ids),
                    'message': 'Generation started. Poll /report/ for status.',
                },
                status=status.HTTP_202_ACCEPTED,
            )
        except Exception as exc:
            return Response(
                {
                    'error': 'llm_error',
                    'error_kind': classify_provider_error(exc),
                    'detail': 'Failed to start report generation. Please retry.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class ProjectReportRegenerateView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/report/regenerate/{section_id}/."""

    def post(self, request, id, section_id):
        project = _get_project_for_user_or_404(id, request.user)
        section = get_object_or_404(SMQSection, id=section_id)
        custom_instruction = str(
            (request.data or {}).get('custom_instruction')
            or (request.data or {}).get('customInstruction')
            or ''
        ).strip()

        report_section, _ = ReportSection.objects.get_or_create(project=project, section=section)
        report_section.status = ReportSection.STATUS_PENDING
        report_section.error_message = ''
        report_section.save(update_fields=['status', 'error_message', 'updated_at'])

        try:
            cache.delete(_report_cancel_cache_key(str(project.id)))
            task = regenerate_report_section_task.delay(str(project.id), str(section.id), custom_instruction)
            task_ids = cache.get(_report_task_cache_key(str(project.id))) or []
            task_ids = [task.id] + [tid for tid in task_ids if tid != task.id]
            cache.set(_report_task_cache_key(str(project.id)), task_ids[:25], timeout=60 * 60)
            return Response({'status': 'generating', 'section_id': str(section.id)}, status=status.HTTP_202_ACCEPTED)
        except Exception as exc:
            return Response(
                {
                    'error': 'llm_error',
                    'error_kind': classify_provider_error(exc),
                    'detail': 'Failed to start section regeneration. Please retry.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class ProjectReportStopGenerationView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/report/stop/."""

    def post(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)

        cache.set(_report_cancel_cache_key(str(project.id)), True, timeout=60 * 60)

        task_ids = cache.get(_report_task_cache_key(str(project.id))) or []
        revoked = 0
        for task_id in task_ids:
            try:
                from celery import current_app

                current_app.control.revoke(task_id, terminate=True)
                revoked += 1
            except Exception:
                continue

        updated = ReportSection.objects.filter(
            project=project,
            status__in=[ReportSection.STATUS_PENDING, ReportSection.STATUS_GENERATING],
        ).update(
            status=ReportSection.STATUS_ERROR,
            error_message='Generation stopped by user.',
        )

        return Response(
            {
                'status': 'stopped',
                'revoked_tasks': revoked,
                'sections_updated': updated,
            },
            status=status.HTTP_200_OK,
        )


class ProjectReportSectionDetailView(AuthenticatedAPIView):
    """PUT /api/v1/projects/{id}/report/{section_id}/."""

    def put(self, request, id, section_id):
        project = _get_project_for_user_or_404(id, request.user)
        section = get_object_or_404(SMQSection, id=section_id)
        generated_text = str((request.data or {}).get('generated_text') or '').strip()

        report_section, _ = ReportSection.objects.get_or_create(project=project, section=section)
        report_section.generated_text = generated_text
        report_section.status = ReportSection.STATUS_DONE
        report_section.error_message = ''
        report_section.generated_at = timezone.now()
        report_section.save(update_fields=['generated_text', 'status', 'error_message', 'generated_at', 'updated_at'])

        serializer = ReportSectionSerializer(report_section)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectReportExportPDFView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/report/export/pdf/."""

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        template = _get_preferred_smq_template()
        if not template:
            return Response({'error': 'smq_template_not_found'}, status=status.HTTP_404_NOT_FOUND)

        sections = list(
            ReportSection.objects
            .filter(project=project, section__template=template, section__is_active=True)
            .select_related('section')
            .order_by('section__order', 'section__section_number')
        )
        incomplete = [item.section.section_number for item in sections if item.status != ReportSection.STATUS_DONE]
        if incomplete:
            return Response({'error': 'sections_incomplete', 'pending_sections': incomplete}, status=status.HTTP_409_CONFLICT)

        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
        font_regular, font_bold, use_unicode = resolve_pdf_fonts()
        def _s(value: str) -> str:
            return str(value) if use_unicode else pdf_safe(value)

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('ReportTitle', parent=styles['Heading1'], fontName=font_bold, fontSize=18, textColor=colors.black)
        heading_style = ParagraphStyle('SectionHeading', parent=styles['Heading2'], fontName=font_bold, fontSize=13)
        body_style = ParagraphStyle('SectionBody', parent=styles['BodyText'], fontName=font_regular, fontSize=10, leading=14)

        story = [
            Paragraph(_s(f"Stakeholder Report — {project.name}"), title_style),
            Spacer(1, 8),
            Paragraph(_s(f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M UTC')}"), body_style),
            Spacer(1, 14),
        ]

        for section in sections:
            story.append(Paragraph(_s(f"{section.section.section_number}. {section.section.title}"), heading_style))
            story.append(Spacer(1, 4))
            story.append(Paragraph(_s((section.generated_text or '').replace('\n', '<br/>')), body_style))
            story.append(Spacer(1, 6))
            for citation in section.citations or []:
                doc_name = citation.get('doc_name', 'Document')
                snippet = citation.get('snippet', '')
                story.append(Paragraph(_s(f"[Doc: {doc_name}] {snippet}"), body_style))
            story.append(Spacer(1, 12))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="stakeholder-report-{project.name}.pdf"'
        return response


class ProjectPriorityTableView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/stakeholders/priority/."""

    PAGE_SIZE = 50

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        entity_type = (request.query_params.get('entity_type') or '').strip() or None
        try:
            page = max(1, int(request.query_params.get('page', 1) or 1))
        except (TypeError, ValueError):
            page = 1

        rows = compute_priority_scores(project, entity_type=entity_type)
        total = len(rows)
        start = (page - 1) * self.PAGE_SIZE
        end = start + self.PAGE_SIZE
        page_rows = rows[start:end]

        serializer = StakeholderPrioritySerializer(page_rows, many=True)
        total_pages = (total + self.PAGE_SIZE - 1) // self.PAGE_SIZE if total else 1

        return Response(
            {
                'count': total,
                'page': page,
                'total_pages': total_pages,
                'results': serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class ProjectPriorityGenerateNotesView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/stakeholders/priority/generate-notes/."""

    def post(self, request, id):
        from ner.services.engagement_notes import generate_notes_for_project

        project = _get_project_for_user_or_404(id, request.user)
        payload = request.data if isinstance(request.data, dict) else {}
        action = str(payload.get('action') or 'start').strip().lower()
        if action not in {'start', 'resume'}:
            return Response(
                {'error': 'validation_error', 'detail': 'action must be "start" or "resume"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_items = payload.get('max_items', 20)
        try:
            max_items = int(max_items)
        except (TypeError, ValueError):
            max_items = 20

        result = generate_notes_for_project(str(project.id), action=action, max_items=max_items)
        return Response(result, status=status.HTTP_200_OK)


class ProjectPriorityFlagOrphansView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/stakeholders/priority/flag-orphans/."""

    def post(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        rows = compute_priority_scores(project)
        orphan_entity_ids = [row['entity_id'] for row in rows if int(row.get('degree', 0) or 0) == 0]

        if not orphan_entity_ids:
            return Response(
                {
                    'project_id': str(project.id),
                    'flagged_count': 0,
                    'flagged_entity_ids': [],
                    'detail': 'No isolated stakeholders found.',
                },
                status=status.HTTP_200_OK,
            )

        updated = Entity.objects.filter(
            project=project,
            id__in=orphan_entity_ids,
            is_flagged=False,
        ).update(is_flagged=True)

        return Response(
            {
                'project_id': str(project.id),
                'flagged_count': int(updated),
                'flagged_entity_ids': orphan_entity_ids,
                'detail': f'Flagged {updated} isolated stakeholder(s).',
            },
            status=status.HTTP_200_OK,
        )


class ProjectPriorityExportCSVView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/stakeholders/priority/export/csv/."""

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        entity_type = (request.query_params.get('entity_type') or '').strip() or None
        rows = compute_priority_scores(project, entity_type=entity_type)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'rank',
            'name',
            'category',
            'priority_level',
            'recommended_ask',
            'entity_type',
            'mention_count',
            'avg_confidence',
            'degree',
            'priority_score',
        ])
        for row in rows:
            writer.writerow([
                row['rank'],
                row['name'],
                row.get('category') or '',
                row.get('priority_level') or '',
                row.get('recommended_ask') or '',
                row['entity_type'],
                row['mention_count'],
                row['avg_confidence'],
                row['degree'],
                row['priority_score'],
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="stakeholder-priority-{project.name}.csv"'
        return response


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
            timeout_seconds=30,
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


class UserFlaggedEntitiesView(AuthenticatedAPIView):
    """GET /api/v1/entities/flagged/ — all entities flagged in projects owned by the current user."""

    def get(self, request):
        from ingestion.models import Project as ProjectModel
        user_projects = ProjectModel.objects.filter(owner=request.user)
        entities = (
            Entity.objects
            .filter(document_id__project__in=user_projects, is_flagged=True)
            .select_related('document_id', 'document_id__project')
            .order_by('-document_id__project__name', 'canonical_name')
        )
        results = [
            {
                'id': str(e.id),
                'canonical_name': e.canonical_name,
                'entity_type': e.entity_type,
                'confidence': e.confidence,
                'project_id': str(e.document_id.project.id),
                'project_name': e.document_id.project.name,
                'document_name': e.document_id.filename,
            }
            for e in entities
        ]
        return Response({'flagged_entities': results, 'count': len(results)}, status=status.HTTP_200_OK)


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
        from django.db.models import Count, Min, Max, Q as DQ

        entity_type = request.query_params.get('type')
        search = (request.query_params.get('search') or '').strip()

        # Admins can see all entities; regular users see only their own
        base_filter = DQ() if (request.user.is_staff or request.user.is_superuser) else DQ(project__owner=request.user)

        # Aggregate at canonical_name level across projects
        agg = (
            Entity.objects
            .filter(base_filter, is_flagged=False)
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
        if search:
            agg = agg.filter(canonical_name__icontains=search)

        try:
            page_size = max(1, min(100, int(request.query_params.get('page_size', 50))))
        except (ValueError, TypeError):
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
                    base_filter,
                    canonical_name=item['canonical_name'],
                    entity_type=item['entity_type'],
                )
                .values('id', 'project_id')
                .first()
            )
            item['representative_id'] = str(rep['id']) if rep else None
            item['representative_project_id'] = str(rep['project_id']) if rep else None

        return Response({
            'count': total,
            'page': page,
            'next': None,
            'previous': None,
            'results': results,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# T038 — Project Provider View
# ---------------------------------------------------------------------------
_PROVIDER_MODELS: dict[str, list[str]] = {
    'groq': ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    'openai': ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    'azure_openai': ['gpt-4o', 'gpt-35-turbo'],
    'gemini': ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
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


class LLMConnectionTestView(AuthenticatedAPIView):
    """GET /api/v1/settings/llm/test/?provider=...&model=..."""

    def get(self, request):
        from .services.nl_query import _call_provider

        provider_param = (request.query_params.get('provider') or '').strip().lower() or None
        model_param = (request.query_params.get('model') or '').strip() or None

        try:
            resolved = resolve_provider_model(provider_param, model_param)
        except ValueError as exc:
            payload = {
                'provider': provider_param or '',
                'model': model_param or '',
                'status': 'error',
                'error_message': str(exc),
                'latency_ms': 0,
            }
            serializer = LLMConnectionTestSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            return Response(serializer.validated_data, status=status.HTTP_400_BAD_REQUEST)

        start = time.perf_counter()
        try:
            validate_provider_runtime_config(resolved.provider)
            _call_provider('Reply with exactly: OK', resolved.provider, resolved.model, max_tokens=8)
            payload = {
                'provider': resolved.provider,
                'model': resolved.model,
                'status': 'ok',
                'error_message': None,
                'latency_ms': int((time.perf_counter() - start) * 1000),
            }
            serializer = LLMConnectionTestSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        except ProviderConfigError as exc:
            payload = {
                'provider': resolved.provider,
                'model': resolved.model,
                'status': 'error',
                'error_message': str(exc),
                'latency_ms': int((time.perf_counter() - start) * 1000),
            }
            serializer = LLMConnectionTestSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            return Response(serializer.validated_data, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            error_kind = classify_provider_error(exc)
            payload = {
                'provider': resolved.provider,
                'model': resolved.model,
                'status': 'error',
                'error_message': f"{error_kind}: {str(exc)}",
                'latency_ms': int((time.perf_counter() - start) * 1000),
            }
            serializer = LLMConnectionTestSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            return Response(serializer.validated_data, status=status.HTTP_200_OK)


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


# ─────────────────────────────────────────────────────────────────────────────
# Export Views
# ─────────────────────────────────────────────────────────────────────────────

class ProjectExportEntitiesCSVView(AuthenticatedAPIView):
    """Export all entities for a project as CSV."""

    def get(self, request, id):
        try:
            project = Project.objects.get(pk=id)
        except Project.DoesNotExist:
            return Response({'detail': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

        entities = (
            Entity.objects.filter(document_id__project=project, is_flagged=False)
            .select_related('document_id')
            .order_by('canonical_name')
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['canonical_name', 'entity_type', 'confidence', 'document', 'is_flagged'])
        for e in entities:
            writer.writerow([
                e.canonical_name,
                e.entity_type,
                round(e.confidence, 4) if e.confidence is not None else '',
                e.document_id.filename if e.document_id else '',
                e.is_flagged,
            ])

        filename = f"{project.name}_entities_{timezone.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ProjectExportRelationsCSVView(AuthenticatedAPIView):
    """Export all relations for a project as CSV."""

    def get(self, request, id):
        try:
            project = Project.objects.get(pk=id)
        except Project.DoesNotExist:
            return Response({'detail': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

        relations = (
            Relation.objects.filter(project=project)
            .select_related('source_entity', 'target_entity')
            .order_by('label')
        )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['source_entity', 'relation_type', 'target_entity', 'confidence'])
        for r in relations:
            writer.writerow([
                r.source_entity.canonical_name if r.source_entity else '',
                r.label,
                r.target_entity.canonical_name if r.target_entity else '',
                round(r.confidence, 4) if r.confidence is not None else '',
            ])

        filename = f"{project.name}_relations_{timezone.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


def _gather_report_data(project):
    """Collect all structured data needed for report generation."""
    from django.db.models import Count, Avg, Q as DQ
    from ingestion.models import Chunk

    documents = list(Document.objects.filter(project=project).order_by('upload_timestamp'))
    entities = Entity.objects.filter(document_id__project=project, is_flagged=False)
    relations = Relation.objects.filter(project=project).select_related('source_entity', 'target_entity')

    doc_count = len(documents)
    entity_count = entities.count()
    relation_count = relations.count()

    # Entity breakdown by type
    type_counts = list(
        entities.values('entity_type').annotate(count=Count('id')).order_by('-count')
    )

    # Most influential entities: ranked by number of relations (degree centrality)
    from django.db.models import OuterRef, Subquery
    entity_ids = list(entities.values_list('id', flat=True).distinct())
    rel_counts = {}
    for eid in entity_ids:
        cnt = Relation.objects.filter(
            project=project
        ).filter(
            DQ(source_entity_id=eid) | DQ(target_entity_id=eid)
        ).count()
        rel_counts[eid] = cnt

    # Get top 25 entities by relation count, then by avg confidence
    top_entity_qs = list(
        entities.values('id', 'canonical_name', 'entity_type')
        .annotate(avg_conf=Avg('confidence'))
        .distinct()
    )
    for e in top_entity_qs:
        e['relation_count'] = rel_counts.get(e['id'], 0)
    top_entity_qs.sort(key=lambda x: (x['relation_count'], x.get('avg_conf', 0)), reverse=True)
    top_entities = top_entity_qs[:25]

    # Influential entities: top 10 by relation degree for narrative
    influential_entities = [
        {
            'name': e['canonical_name'],
            'type': e['entity_type'],
            'connections': e['relation_count'],
            'confidence': round(e.get('avg_conf', 0) * 100),
        }
        for e in top_entities[:10]
    ]

    # Key relations
    top_relations = list(relations.order_by('-confidence')[:40])

    # Per-document entity highlights
    doc_entities = {}
    for d in documents:
        ents = list(
            Entity.objects.filter(document_id=d, is_flagged=False)
            .values('canonical_name', 'entity_type', 'confidence')
            .order_by('-confidence')[:5]
        )
        doc_entities[d.id] = ents

    # Representative chunks from each document — more context for LLM
    doc_chunks = {}
    for d in documents:
        chunks = list(
            Chunk.objects.filter(document=d)
            .order_by('chunk_index')
            .values_list('text', flat=True)[:10]
        )
        doc_chunks[d.id] = chunks

    # Concept note
    concept_text = (get_project_context(project) or '').strip()

    return {
        'documents': documents,
        'doc_count': doc_count,
        'entity_count': entity_count,
        'relation_count': relation_count,
        'type_counts': type_counts,
        'top_entities': top_entities,
        'influential_entities': influential_entities,
        'top_relations': top_relations,
        'doc_entities': doc_entities,
        'doc_chunks': doc_chunks,
        'concept_text': concept_text,
    }


def _generate_report_narrative(project, data: dict) -> dict:
    """
    Use the project's configured LLM to generate narrative sections for the report.
    Returns dict with keys: executive_summary, stakeholder_analysis,
    relationship_analysis, cross_references, conclusions.
    Falls back to structured summaries if LLM call fails.
    """
    from ner.services.nl_query import _call_provider

    provider_config = resolve_provider_model(
        (getattr(project, 'provider', '') or '').strip() or None,
        (getattr(project, 'model', '') or '').strip() or None,
    )
    provider = provider_config.provider
    model = provider_config.model

    # Build context
    doc_names = [d.filename for d in data['documents']]

    # Influential entities block with connection counts
    influential_block = '\n'.join(
        f"  {i+1}. {e['name']} ({e['type']}) — {e['connections']} connections, {e['confidence']}% confidence"
        for i, e in enumerate(data.get('influential_entities', data['top_entities'])[:15])
    )

    entity_type_summary = ', '.join(
        f"{r['entity_type']}: {r['count']}" for r in data['type_counts']
    )

    relation_list = '\n'.join(
        f"  • {r.source_entity.canonical_name if r.source_entity else '?'} "
        f"[{r.label}] "
        f"{r.target_entity.canonical_name if r.target_entity else '?'}"
        for r in data['top_relations'][:30]
    )

    # Document excerpts — more context, up to 10 docs × 800 chars
    excerpts_block = ''
    for d in data['documents'][:10]:
        chunks = data['doc_chunks'].get(d.id, [])
        if chunks:
            excerpt = ' '.join(chunks)[:800]
            excerpts_block += f"\n\n[Document: {d.filename}]\n{excerpt}"

    concept_block = f"\nProject mandate/concept note:\n{data['concept_text'][:800]}" if data['concept_text'] else ''

    prompt = f"""You are a senior development sector analyst. Write a comprehensive, professional stakeholder analysis report for: "{project.name}".
{concept_block}

ANALYSIS BASE:
- Documents analysed: {data['doc_count']} ({', '.join(doc_names)})
- Total stakeholders identified: {data['entity_count']}
- Total relationships mapped: {data['relation_count']}
- Stakeholder types: {entity_type_summary}

MOST INFLUENTIAL STAKEHOLDERS (ranked by network connections):
{influential_block}

KEY RELATIONSHIPS IDENTIFIED:
{relation_list}

DOCUMENT EXCERPTS (source evidence):
{excerpts_block}

---

Write ALL FIVE sections below. Use ONLY evidence from the data above. Reference specific stakeholder names and relationships. Be analytical, not generic. Write full paragraphs with substance.

SECTION 1 — EXECUTIVE SUMMARY
Write 3-5 sentences summarising: what this stakeholder landscape looks like, who the dominant actors are, and the overall relationship dynamics. Be specific.

SECTION 2 — KEY STAKEHOLDERS
Write 4-6 paragraphs. Group actors by type (organisations, individuals, governments, etc.). For the top 5 most connected stakeholders, describe their specific role, their key relationships, and their significance to the project. Name them explicitly.

SECTION 3 — RELATIONSHIP NETWORK
Write 3-4 paragraphs analysing the most significant relationships. Describe power dynamics, funding flows, oversight structures, and implementation chains. Cite specific relationships from the data (e.g. "X funds Y", "A oversees B").

SECTION 4 — CROSS-DOCUMENT ANALYSIS
Write 2-3 paragraphs. Which stakeholders appear across multiple documents? What themes recur? Are there contradictions or complementary narratives between documents?

SECTION 5 — CONCLUSIONS & RECOMMENDATIONS
Write exactly 4-6 bullet points (start each with •). Include: 2-3 key findings about the stakeholder landscape, and 2-3 concrete recommended next steps or areas for further investigation. Be specific to this project.

Format: Write each section heading in ALL CAPS on its own line, then the text immediately below."""

    try:
        raw = _call_provider(prompt, provider, model, max_tokens=3000)
    except Exception as e:
        logger.warning('Report LLM call failed: %s', e)
        raw = None

    if not raw:
        influential = data.get('influential_entities', [])
        top_names = ', '.join(e.get('name', e.get('canonical_name', '')) for e in influential[:8]) or 'None extracted'
        rel_examples = '; '.join(
            f"{r.source_entity.canonical_name if r.source_entity else '?'} {r.label} {r.target_entity.canonical_name if r.target_entity else '?'}"
            for r in data['top_relations'][:5]
        ) or 'None found'
        return {
            'executive_summary': (
                f"This report analyses the stakeholder landscape for \"{project.name}\" based on "
                f"{data['doc_count']} document(s). A total of {data['entity_count']} stakeholders and "
                f"{data['relation_count']} relationships were identified. The most connected actors are: {top_names}."
            ),
            'stakeholder_analysis': (
                f"Key stakeholders by connection count: {influential_block or top_names}."
            ),
            'relationship_analysis': f"Key relationships identified: {rel_examples}. See relationship table below for full list.",
            'cross_references': 'See per-document entity breakdown below.',
            'conclusions': (
                f"• {data['entity_count']} stakeholders identified across {data['doc_count']} documents.\n"
                f"• Most connected actors: {top_names}.\n"
                f"• {data['relation_count']} relationships mapped.\n"
                f"• Further investigation recommended for low-confidence entities.\n"
                f"• Review flagged entities to improve extraction quality."
            ),
        }

    # Parse sections from LLM output
    sections = {
        'executive_summary': '',
        'stakeholder_analysis': '',
        'relationship_analysis': '',
        'cross_references': '',
        'conclusions': '',
    }
    import re
    markers = [
        ('executive_summary',    r'SECTION\s+1\s*[—\-–]?\s*EXECUTIVE SUMMARY|EXECUTIVE SUMMARY'),
        ('stakeholder_analysis', r'SECTION\s+2\s*[—\-–]?\s*KEY STAKEHOLDERS|KEY STAKEHOLDERS'),
        ('relationship_analysis',r'SECTION\s+3\s*[—\-–]?\s*RELATIONSHIP NETWORK|RELATIONSHIP NETWORK'),
        ('cross_references',     r'SECTION\s+4\s*[—\-–]?\s*CROSS-DOCUMENT ANALYSIS|CROSS-DOCUMENT ANALYSIS'),
        ('conclusions',          r'SECTION\s+5\s*[—\-–]?\s*CONCLUSIONS|CONCLUSIONS'),
    ]
    for i, (key, pattern) in enumerate(markers):
        next_pattern = markers[i + 1][1] if i + 1 < len(markers) else None
        m = re.search(pattern, raw, re.IGNORECASE)
        if m:
            start = m.end()
            if next_pattern:
                m2 = re.search(next_pattern, raw[start:], re.IGNORECASE)
                end = start + m2.start() if m2 else len(raw)
            else:
                end = len(raw)
            sections[key] = raw[start:end].strip().lstrip(':—-\n ').strip()

    # Fill any completely empty sections
    if not any(sections.values()):
        sections['executive_summary'] = raw[:2000]

    # If conclusions is empty, extract last portion of raw text
    if not sections['conclusions']:
        # Try to find bullet points anywhere in the raw text
        bullet_matches = re.findall(r'[•\-\*]\s+.+', raw)
        if bullet_matches:
            sections['conclusions'] = '\n'.join(bullet_matches[-6:])
        else:
            sections['conclusions'] = raw[-600:].strip()

    return sections


def _clean_narrative(text: str) -> str:
    """Strip markdown formatting from LLM output for clean report rendering."""
    import re
    if not text:
        return ''
    # Remove bold/italic markers (triple → double → single, order matters)
    text = re.sub(r'\*{3}(.+?)\*{3}', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'\*{2}(.+?)\*{2}', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'_{2}(.+?)_{2}', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'_(.+?)_', r'\1', text)
    # Remove heading markers
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Remove stray asterisks
    text = text.replace('*', '')
    return text.strip()


def _build_project_report_docx(project):
    """Build an LLM-narrated DOCX stakeholder analysis report."""
    from docx import Document as DocxDocument
    from docx.shared import Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    data = _gather_report_data(project)
    narrative = _generate_report_narrative(project, data)

    doc = DocxDocument()

    # ── Cover ─────────────────────────────────────────────────────────────────
    title = doc.add_heading('Stakeholder Analysis Report', level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    h1 = doc.add_heading(project.name, level=1)
    h1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta = doc.add_paragraph(f'Generated: {timezone.now().strftime("%d %B %Y")}')
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if project.description:
        doc.add_paragraph(project.description)

    # Stats table
    doc.add_paragraph('')
    summary_table = doc.add_table(rows=1, cols=3)
    summary_table.style = 'Light List Accent 1'
    hdr = summary_table.rows[0].cells
    hdr[0].text = 'Documents'; hdr[1].text = 'Stakeholders'; hdr[2].text = 'Relationships'
    row = summary_table.add_row().cells
    row[0].text = str(data['doc_count'])
    row[1].text = str(data['entity_count'])
    row[2].text = str(data['relation_count'])
    doc.add_paragraph('')

    # ── Executive Summary ─────────────────────────────────────────────────────
    doc.add_heading('Executive Summary', level=2)
    doc.add_paragraph(_clean_narrative(narrative['executive_summary']))
    doc.add_paragraph('')

    # ── Key Stakeholders ──────────────────────────────────────────────────────
    doc.add_heading('Key Stakeholders', level=2)
    doc.add_paragraph(_clean_narrative(narrative['stakeholder_analysis']))
    doc.add_paragraph('')

    # Stakeholder type breakdown
    if data['type_counts']:
        doc.add_heading('Stakeholder Types', level=3)
        type_table = doc.add_table(rows=1, cols=2)
        type_table.style = 'Light List Accent 1'
        hdr = type_table.rows[0].cells
        hdr[0].text = 'Type'; hdr[1].text = 'Count'
        for row_data in data['type_counts']:
            row = type_table.add_row().cells
            row[0].text = row_data['entity_type']; row[1].text = str(row_data['count'])
        doc.add_paragraph('')

    # Most influential stakeholders
    if data.get('influential_entities'):
        doc.add_heading('Most Influential Stakeholders', level=3)
        inf_table = doc.add_table(rows=1, cols=4)
        inf_table.style = 'Light List Accent 1'
        hdr = inf_table.rows[0].cells
        hdr[0].text = 'Stakeholder'; hdr[1].text = 'Type'; hdr[2].text = 'Connections'; hdr[3].text = 'Confidence'
        for e in data['influential_entities'][:12]:
            row = inf_table.add_row().cells
            row[0].text = e['name']
            row[1].text = e['type']
            row[2].text = str(e['connections'])
            row[3].text = f"{e['confidence']}%"
        doc.add_paragraph('')

    # ── Relationship Network ───────────────────────────────────────────────────
    doc.add_heading('Relationship Network', level=2)
    doc.add_paragraph(_clean_narrative(narrative['relationship_analysis']))
    doc.add_paragraph('')

    if data['top_relations']:
        doc.add_heading('Key Relationships', level=3)
        rel_table = doc.add_table(rows=1, cols=3)
        rel_table.style = 'Light List Accent 1'
        hdr = rel_table.rows[0].cells
        hdr[0].text = 'Source'; hdr[1].text = 'Relationship'; hdr[2].text = 'Target'
        for r in data['top_relations'][:30]:
            row = rel_table.add_row().cells
            row[0].text = r.source_entity.canonical_name if r.source_entity else ''
            row[1].text = r.label
            row[2].text = r.target_entity.canonical_name if r.target_entity else ''
        doc.add_paragraph('')

    # ── Cross-Document Analysis ────────────────────────────────────────────────
    doc.add_heading('Cross-Document Analysis', level=2)
    doc.add_paragraph(_clean_narrative(narrative['cross_references']))
    doc.add_paragraph('')

    doc.add_heading('Per-Document Stakeholder Breakdown', level=3)
    for d in data['documents']:
        p = doc.add_paragraph(style='List Bullet')
        p.add_run(d.filename).bold = True
        uploaded = d.upload_timestamp.strftime('%d %b %Y') if d.upload_timestamp else 'unknown'
        p.add_run(f' — uploaded {uploaded}')
        ents = data['doc_entities'].get(d.id, [])
        if ents:
            names = ', '.join(e['canonical_name'] for e in ents[:5])
            doc.add_paragraph(f'Top stakeholders: {names}', style='List Bullet 2')
    doc.add_paragraph('')

    # ── Conclusions ────────────────────────────────────────────────────────────
    doc.add_heading('Conclusions & Recommendations', level=2)
    conclusions_text = _clean_narrative(narrative['conclusions'])
    import re as _re
    for line in _re.split(r'\n|(?<=\.) ', conclusions_text):
        line = line.strip().lstrip('•-–').strip()
        if line:
            p = doc.add_paragraph(style='List Bullet')
            p.add_run(line)

    return doc


class ProjectExportReportDOCXView(AuthenticatedAPIView):
    """Export a full stakeholder analysis report as DOCX."""

    def get(self, request, id):
        try:
            project = Project.objects.get(pk=id)
        except Project.DoesNotExist:
            return Response({'detail': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

        doc = _build_project_report_docx(project)

        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)

        filename = f"{project.name}_stakeholder_report_{timezone.now().strftime('%Y%m%d')}.docx"
        response = HttpResponse(
            buffer.read(),
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class ProjectExportReportPDFView(AuthenticatedAPIView):
    """Export an LLM-narrated stakeholder analysis report as PDF."""

    def get(self, request, id):
        try:
            project = Project.objects.get(pk=id)
        except Project.DoesNotExist:
            return Response({'detail': 'Project not found.'}, status=status.HTTP_404_NOT_FOUND)

        import re as _re
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        FONT_REGULAR, FONT_BOLD, use_unicode = resolve_pdf_fonts()

        def _s(text: str) -> str:
            return str(text) if use_unicode else pdf_safe(text)

        data = _gather_report_data(project)
        narrative = _generate_report_narrative(project, data)

        buffer = io.BytesIO()
        doc_pdf = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=2.2*cm, rightMargin=2.2*cm, topMargin=2.2*cm, bottomMargin=2.2*cm,
        )
        styles = getSampleStyleSheet()

        DARK   = colors.HexColor('#1a1f35')
        ACCENT = colors.HexColor('#3d6fff')
        GREY   = colors.HexColor('#6b7280')
        STRIPE = colors.HexColor('#f5f7fa')
        GRID_C = colors.HexColor('#d0d5e8')

        title_style  = ParagraphStyle('RTitle', parent=styles['Title'],
                            fontName=FONT_BOLD, fontSize=22, spaceAfter=4, textColor=DARK)
        h1_style     = ParagraphStyle('RH1',    parent=styles['Normal'],
                            fontName=FONT_BOLD, fontSize=16, spaceAfter=4, textColor=ACCENT)
        h2_style     = ParagraphStyle('RH2',    parent=styles['Normal'],
                            fontName=FONT_BOLD, fontSize=13, spaceBefore=16, spaceAfter=5, textColor=DARK)
        h3_style     = ParagraphStyle('RH3',    parent=styles['Normal'],
                            fontName=FONT_BOLD, fontSize=11, spaceBefore=10, spaceAfter=4, textColor=DARK)
        body_style   = ParagraphStyle('RBody',  parent=styles['Normal'],
                            fontName=FONT_REGULAR, fontSize=10, leading=15, spaceAfter=5)
        meta_style   = ParagraphStyle('RMeta',  parent=styles['Normal'],
                            fontName=FONT_REGULAR, fontSize=9, textColor=GREY)
        bullet_style = ParagraphStyle('RBullet', parent=styles['Normal'],
                            fontName=FONT_REGULAR, fontSize=10, leading=14, leftIndent=16, spaceAfter=4)
        # White text for table column headers (rendered on blue background)
        tbl_hdr_style = ParagraphStyle('RTblHdr', parent=styles['Normal'],
                            fontName=FONT_BOLD, fontSize=9, textColor=colors.white)

        def tbl_style():
            return TableStyle([
                ('BACKGROUND',    (0, 0), (-1, 0), ACCENT),
                ('FONTNAME',      (0, 0), (-1, 0), FONT_BOLD),
                ('FONTSIZE',      (0, 0), (-1, -1), 9),
                ('ROWBACKGROUNDS',(0, 1), (-1, -1), [colors.white, STRIPE]),
                ('GRID',          (0, 0), (-1, -1), 0.4, GRID_C),
                ('TOPPADDING',    (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING',   (0, 0), (-1, -1), 6),
                ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
                ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
            ])

        def section_text(raw: str):
            """Yield Paragraph flowables for a cleaned narrative section."""
            cleaned = _clean_narrative(raw)
            for para in cleaned.split('\n\n'):
                para = para.strip()
                if para:
                    yield Paragraph(_s(para), body_style)

        story = []

        # ── Cover ─────────────────────────────────────────────────────────────
        story.append(Paragraph('Stakeholder Analysis Report', title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(_s(project.name), h1_style))
        story.append(Paragraph(f'Generated: {timezone.now().strftime("%d %B %Y")}', meta_style))
        if project.description:
            story.append(Spacer(1, 6))
            story.append(Paragraph(_s(project.description), body_style))
        story.append(HRFlowable(width='100%', thickness=1, color=ACCENT, spaceAfter=14))

        # Stats summary table
        stats_data = [
            [Paragraph('Documents', tbl_hdr_style),
             Paragraph('Stakeholders', tbl_hdr_style),
             Paragraph('Relationships', tbl_hdr_style)],
            [Paragraph(str(data['doc_count']), body_style),
             Paragraph(str(data['entity_count']), body_style),
             Paragraph(str(data['relation_count']), body_style)],
        ]
        stats_tbl = Table(stats_data, colWidths=[5*cm, 5*cm, 5*cm])
        stats_tbl.setStyle(tbl_style())
        story.append(stats_tbl)
        story.append(Spacer(1, 16))

        # ── Executive Summary ─────────────────────────────────────────────────
        story.append(Paragraph('Executive Summary', h2_style))
        story.extend(section_text(narrative['executive_summary']))
        story.append(Spacer(1, 10))

        # ── Key Stakeholders ──────────────────────────────────────────────────
        story.append(Paragraph('Key Stakeholders', h2_style))
        story.extend(section_text(narrative['stakeholder_analysis']))
        story.append(Spacer(1, 8))

        # Stakeholder type breakdown
        if data['type_counts']:
            story.append(Paragraph('Stakeholder Types', h3_style))
            type_data = [[Paragraph('Type', tbl_hdr_style), Paragraph('Count', tbl_hdr_style)]] + [
                [Paragraph(_s(r['entity_type']), body_style), Paragraph(str(r['count']), body_style)]
                for r in data['type_counts']
            ]
            type_tbl = Table(type_data, colWidths=[11*cm, 4*cm])
            type_tbl.setStyle(tbl_style())
            story.append(type_tbl)
            story.append(Spacer(1, 10))

        # Influential entities
        if data.get('influential_entities'):
            story.append(Paragraph('Most Influential Stakeholders', h3_style))
            inf_data = [[
                Paragraph('Stakeholder', tbl_hdr_style),
                Paragraph('Type', tbl_hdr_style),
                Paragraph('Connections', tbl_hdr_style),
                Paragraph('Confidence', tbl_hdr_style),
            ]] + [
                [
                    Paragraph(_s(e['name']), body_style),
                    Paragraph(_s(e['type']), body_style),
                    Paragraph(str(e['connections']), body_style),
                    Paragraph(f"{e['confidence']}%", body_style),
                ]
                for e in data['influential_entities'][:12]
            ]
            inf_tbl = Table(inf_data, colWidths=[6*cm, 3.5*cm, 2.5*cm, 2.5*cm])
            inf_tbl.setStyle(tbl_style())
            story.append(inf_tbl)
            story.append(Spacer(1, 10))

        # ── Relationship Network ──────────────────────────────────────────────
        story.append(Paragraph('Relationship Network', h2_style))
        story.extend(section_text(narrative['relationship_analysis']))
        story.append(Spacer(1, 8))

        if data['top_relations']:
            story.append(Paragraph('Key Relationships', h3_style))
            rel_data = [[
                Paragraph('Source', tbl_hdr_style),
                Paragraph('Relationship', tbl_hdr_style),
                Paragraph('Target', tbl_hdr_style),
            ]] + [
                [
                    Paragraph(_s(r.source_entity.canonical_name if r.source_entity else ''), body_style),
                    Paragraph(_s(r.label), body_style),
                    Paragraph(_s(r.target_entity.canonical_name if r.target_entity else ''), body_style),
                ]
                for r in data['top_relations'][:30]
            ]
            rel_tbl = Table(rel_data, colWidths=[5*cm, 5*cm, 5*cm])
            rel_tbl.setStyle(tbl_style())
            story.append(rel_tbl)
            story.append(Spacer(1, 10))

        # ── Cross-Document Analysis ───────────────────────────────────────────
        story.append(Paragraph('Cross-Document Analysis', h2_style))
        story.extend(section_text(narrative['cross_references']))
        story.append(Spacer(1, 8))

        story.append(Paragraph('Per-Document Stakeholder Breakdown', h3_style))
        for d in data['documents']:
            uploaded = d.upload_timestamp.strftime('%d %b %Y') if d.upload_timestamp else 'unknown'
            doc_para = Paragraph(
                f'<b>{_s(d.filename)}</b> '
                f'<font size="8" color="#6b7280">uploaded {uploaded}</font>',
                bullet_style,
            )
            story.append(doc_para)
            ents = data['doc_entities'].get(d.id, [])
            if ents:
                names = ', '.join(_s(e['canonical_name']) for e in ents[:5])
                story.append(Paragraph(
                    f'Top stakeholders: {names}',
                    ParagraphStyle('indent', parent=body_style,
                                   fontName=FONT_REGULAR, leftIndent=28, fontSize=9, textColor=GREY),
                ))
        story.append(Spacer(1, 10))

        # ── Conclusions & Recommendations ─────────────────────────────────────
        story.append(Paragraph('Conclusions & Recommendations', h2_style))
        conclusions_text = _clean_narrative(narrative['conclusions'])
        for line in _re.split(r'\n', conclusions_text):
            line = line.strip().lstrip('•-–').strip()
            if line:
                story.append(Paragraph(f'\u2022 {_s(line)}', bullet_style))

        doc_pdf.build(story)
        buffer.seek(0)

        filename = f"{project.name}_stakeholder_report_{timezone.now().strftime('%Y%m%d')}.pdf"
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


# ─── US-014: Stakeholder Personas ────────────────────────────────────────────

class PersonaListView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/personas/"""

    def get(self, request, id):
        from .models import StakeholderPersona
        from .serializers import StakeholderPersonaSerializer
        project = _get_project_for_user_or_404(id, request.user)
        personas = StakeholderPersona.objects.filter(project=project).select_related('entity_type')
        serializer = StakeholderPersonaSerializer(personas, many=True)
        return Response(
            {'count': personas.count(), 'results': serializer.data},
            status=status.HTTP_200_OK,
        )


class PersonaGenerateView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/personas/generate/"""

    def post(self, request, id):
        from .tasks import generate_personas_task
        project = _get_project_for_user_or_404(id, request.user)
        has_entities = Entity.objects.filter(project=project).exists()
        if not has_entities:
            return Response(
                {'error': 'no_entities', 'detail': 'No entities extracted for this project yet.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            _set_generation_status(
                _persona_generation_cache_key(str(project.id)),
                'running',
                'Persona generation is in progress.',
            )
            generate_personas_task.delay(str(project.id))
            return Response(
                {'status': 'generating', 'message': 'Persona generation started. Poll /personas/ for results.'},
                status=status.HTTP_202_ACCEPTED,
            )
        except Exception as exc:
            _set_generation_status(
                _persona_generation_cache_key(str(project.id)),
                'error',
                'Failed to start persona generation. Please retry.',
            )
            return Response(
                {
                    'error': 'llm_error',
                    'error_kind': classify_provider_error(exc),
                    'detail': 'Failed to start persona generation. Please retry.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# ─── US-014: Workplan ────────────────────────────────────────────────────────

class WorkplanView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/workplan/"""

    def get(self, request, id):
        from .models import WorkplanComponent
        from .serializers import WorkplanComponentSerializer
        project = _get_project_for_user_or_404(id, request.user)
        components = WorkplanComponent.objects.filter(project=project).prefetch_related(
            'tasks', 'tasks__related_entity', 'tasks__related_entity__entity_type'
        )
        generated = components.exists()
        serializer = WorkplanComponentSerializer(components, many=True)
        return Response(
            {'project': str(project.id), 'generated': generated, 'components': serializer.data},
            status=status.HTTP_200_OK,
        )


class WorkplanStatusView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/workplan/status/"""

    def get(self, request, id):
        from .models import WorkplanComponent, WorkplanTask
        project = _get_project_for_user_or_404(id, request.user)

        component_count = WorkplanComponent.objects.filter(project=project).count()
        task_count = WorkplanTask.objects.filter(component__project=project).count()

        section_6_complete = ReportSection.objects.filter(
            project=project,
            section__section_number=6,
            status=ReportSection.STATUS_DONE,
        ).exists()

        fallback_status = 'completed' if component_count > 0 else 'idle'
        generation = _get_generation_status(
            _workplan_generation_cache_key(str(project.id)),
            fallback_status=fallback_status,
        )

        return Response(
            {
                'generated': component_count > 0,
                'section_6_complete': section_6_complete,
                'component_count': component_count,
                'task_count': task_count,
                'generation_status': generation['status'],
                'generation_message': generation['message'],
            },
            status=status.HTTP_200_OK,
        )


class PersonaStatusView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/personas/status/"""

    def get(self, request, id):
        from .models import StakeholderPersona

        project = _get_project_for_user_or_404(id, request.user)
        persona_count = StakeholderPersona.objects.filter(project=project).count()
        fallback_status = 'completed' if persona_count > 0 else 'idle'
        generation = _get_generation_status(
            _persona_generation_cache_key(str(project.id)),
            fallback_status=fallback_status,
        )

        return Response(
            {
                'generated': persona_count > 0,
                'count': persona_count,
                'generation_status': generation['status'],
                'generation_message': generation['message'],
            },
            status=status.HTTP_200_OK,
        )


class WorkplanGenerateView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/workplan/generate/"""

    def post(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)

        try:
            _set_generation_status(
                _workplan_generation_cache_key(str(project.id)),
                'running',
                'Workplan generation is in progress.',
            )
            generate_workplan_task.delay(str(project.id))
            return Response(
                {'status': 'generating', 'message': 'Workplan generation started. Poll /workplan/ for results.'},
                status=status.HTTP_202_ACCEPTED,
            )
        except Exception as exc:
            _set_generation_status(
                _workplan_generation_cache_key(str(project.id)),
                'error',
                'Failed to start workplan generation. Please retry.',
            )
            return Response(
                {
                    'error': 'llm_error',
                    'error_kind': classify_provider_error(exc),
                    'detail': 'Failed to start workplan generation. Please retry.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# ─── US-014: Report Staleness ─────────────────────────────────────────────────

class ReportStalenessView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/report/staleness/"""

    def get(self, request, id):
        from django.db.models import Min
        project = _get_project_for_user_or_404(id, request.user)

        stale_sections = list(
            ReportSection.objects.filter(
                project=project, status=ReportSection.STATUS_STALE
            ).values_list('section__section_number', flat=True)
        )

        stakeholder_table_stale = project.stakeholder_table_stale

        # Count new entities created after the oldest stale section
        new_entity_count = 0
        if stale_sections:
            oldest_stale_at = ReportSection.objects.filter(
                project=project, status=ReportSection.STATUS_STALE
            ).aggregate(oldest=Min('generated_at'))['oldest']
            if oldest_stale_at:
                new_entity_count = Entity.objects.filter(
                    project=project,
                    created_at__gt=oldest_stale_at,
                ).count()

        return Response(
            {
                'stale_sections': stale_sections,
                'stakeholder_table_stale': stakeholder_table_stale,
                'new_entity_count': new_entity_count,
            },
            status=status.HTTP_200_OK,
        )


class ReportSectionKeepView(AuthenticatedAPIView):
    """PATCH /api/v1/projects/{id}/report/{section_id}/keep/"""

    def patch(self, request, id, section_id):
        project = _get_project_for_user_or_404(id, request.user)
        section = get_object_or_404(ReportSection, id=section_id, project=project)

        if section.status != ReportSection.STATUS_STALE:
            return Response(
                {'error': 'not_stale', 'detail': 'Section is not in stale status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        section.status = ReportSection.STATUS_DONE
        section.save(update_fields=['status', 'updated_at'])
        return Response(
            {'status': 'done', 'section_id': str(section_id)},
            status=status.HTTP_200_OK,
        )


class StakeholderTableKeepCurrentView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/stakeholders/priority/keep-current/"""

    def post(self, request, id):
        from ingestion.models import Project as ProjectModel
        project = _get_project_for_user_or_404(id, request.user)
        ProjectModel.objects.filter(id=project.id).update(stakeholder_table_stale=False)
        return Response(
            {'status': 'ok', 'stakeholder_table_stale': False},
            status=status.HTTP_200_OK,
        )


# ─── US-014: Workflow Status ──────────────────────────────────────────────────

class WorkflowStatusView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/workflow/"""

    def get(self, request, id):
        project = _get_project_for_user_or_404(id, request.user)
        workflow = project.get_workflow_status()
        return Response(workflow, status=status.HTTP_200_OK)


# ─── US-014: Report Export ────────────────────────────────────────────────────

class ReportExportStatusView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/report/export/status/"""

    def get(self, request, id):
        from .services.report_export import get_export_status
        project = _get_project_for_user_or_404(id, request.user)
        export_status = get_export_status(project)
        serializer = ReportExportStatusSerializer(export_status)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ReportExportView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/report/export/?format=pdf|docx"""

    def get(self, request, id):
        import re
        from .services.report_export import get_export_status, generate_pdf_report, generate_docx_report
        project = _get_project_for_user_or_404(id, request.user)

        export_format = (request.query_params.get('format') or '').strip().lower()
        if export_format not in ('pdf', 'docx'):
            return Response(
                {'error': 'invalid_format', 'detail': 'format must be pdf or docx'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        export_info = get_export_status(project)
        if not export_info['can_export']:
            return Response(
                {'error': 'no_complete_sections', 'detail': 'Complete at least one report section to export.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            initiative_name = ''
            try:
                initiative_name = project.initiative_profile.initiative_name or project.name
            except Exception:
                initiative_name = project.name
            safe_name = re.sub(r'[^\w\-_]', '_', initiative_name).strip('_') or 'report'

            if export_format == 'pdf':
                content = generate_pdf_report(project)
                response = HttpResponse(content, content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="{safe_name}_stakeholder_analysis.pdf"'
            else:
                content = generate_docx_report(project)
                response = HttpResponse(
                    content,
                    content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                )
                response['Content-Disposition'] = f'attachment; filename="{safe_name}_stakeholder_analysis.docx"'

            return response
        except Exception as e:
            logger.error("Report export error for project %s: %s", id, e)
            return Response(
                {'error': 'export_failed', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ─── US-014-04: Enriched Entity Detail ───────────────────────────────────────

class ProjectEntityDetailView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/entities/{entity_id}/

    Returns entity data extended with stakeholder priority, persona, and
    report section references for the given project context.
    """

    def get(self, request, id, entity_id):
        from .models import StakeholderPersona, EngagementNote as EngNote
        from .serializers import GlobalEntityProfileSerializer

        project = _get_project_for_user_or_404(id, request.user)
        entity = get_object_or_404(
            Entity,
            id=entity_id,
            project=project,
        )

        # Base serialization
        serializer = GlobalEntityProfileSerializer(entity, context={'request': request})
        data = dict(serializer.data)

        # Stakeholder priority from EngagementNote
        stakeholder_priority = None
        try:
            note = EngNote.objects.filter(project=project, entity=entity).first()
            if note:
                # Get rank from priority scores
                from ner.services.priority_table import compute_priority_scores
                priority_rows = compute_priority_scores(project)
                rank = None
                for i, row in enumerate(priority_rows, 1):
                    if str(row.get('entity_id')) == str(entity.id):
                        rank = i
                        break
                stakeholder_priority = {
                    'rank': rank,
                    'category': entity.entity_type,
                    'priority': 'High' if rank and rank <= 5 else ('Medium' if rank and rank <= 15 else 'Low'),
                    'priority_reason': note.note_text[:500] if note.note_text else '',
                    'ask_request': '',
                }
        except Exception as e:
            logger.debug("Entity enrichment: priority lookup failed: %s", e)

        # Persona matching entity type
        persona_data = None
        try:
            persona = StakeholderPersona.objects.filter(
                project=project,
                entity_type__name__iexact=entity.entity_type,
            ).first()
            if persona:
                persona_data = {
                    'archetype_label': persona.archetype_label,
                    'persona_name': persona.persona_name,
                }
        except Exception as e:
            logger.debug("Entity enrichment: persona lookup failed: %s", e)

        # Report sections where entity is cited
        appears_in = []
        try:
            entity_id_str = str(entity.id)
            for section in ReportSection.objects.filter(
                project=project, status=ReportSection.STATUS_DONE
            ).select_related('section'):
                citations = section.citations or []
                if entity_id_str in citations or any(
                    str(c) == entity_id_str for c in citations
                ):
                    appears_in.append({
                        'section_number': section.section.section_number,
                        'report_chapter_title': section.section.title,
                    })
        except Exception as e:
            logger.debug("Entity enrichment: report sections lookup failed: %s", e)

        # Stakeholder table existence flag
        has_stakeholder_table = EngNote.objects.filter(project=project).exists()

        data['stakeholder_priority'] = stakeholder_priority
        data['persona'] = persona_data
        data['appears_in_report_sections'] = appears_in
        data['has_stakeholder_table'] = has_stakeholder_table

        return Response(data, status=status.HTTP_200_OK)
