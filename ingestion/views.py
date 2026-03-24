"""API views for the ingestion app."""
import logging
from django.db import connection, OperationalError
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser
from rest_framework.parsers import JSONParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny

from ingestion.models import Project, ConceptNote, Document, get_or_create_default_project
from ingestion.serializers import (
    DocumentSerializer,
    ProjectSummarySerializer,
    ProjectWriteSerializer,
    ConceptNoteSerializer,
)
from ingestion.services.extractor import ExtractionError
from ingestion.services.pipeline import ingest_document, IngestionError

logger = logging.getLogger(__name__)

ALLOWED_FORMATS = {'pdf', 'docx', 'txt'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def resolve_project_or_404(project_id):
    return get_object_or_404(Project, id=project_id)


def resolve_project_for_user_or_404(project_id, user):
    return get_object_or_404(Project, id=project_id, owner=user)


def resolve_document_for_user_or_404(document_id, user):
    return get_object_or_404(Document, id=document_id, project__owner=user)


class AuthenticatedAPIView(APIView):
    permission_classes = [IsAuthenticated]


class ProjectListCreateView(AuthenticatedAPIView):
    """GET/POST /api/v1/projects/."""

    def get(self, request):
        projects = (
            Project.objects
            .filter(owner=request.user)
            .annotate(document_count=Count('documents', distinct=True))
            .annotate(entity_count=Count('documents__entities', distinct=True))
            .order_by('-updated_at')
        )
        serializer = ProjectSummarySerializer(projects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ProjectWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = serializer.save(owner=request.user)
        logger.info('[PROJECT] created project=%s owner=%s', project.id, request.user.id)
        payload = ProjectSummarySerializer(
            Project.objects
            .filter(owner=request.user)
            .annotate(document_count=Count('documents', distinct=True))
            .annotate(entity_count=Count('documents__entities', distinct=True))
            .get(id=project.id)
        ).data
        return Response(payload, status=status.HTTP_201_CREATED)


class ProjectDetailView(AuthenticatedAPIView):
    """GET/PATCH/DELETE /api/v1/projects/{id}/."""

    def get(self, request, id):
        project = (
            Project.objects
            .filter(owner=request.user)
            .annotate(document_count=Count('documents', distinct=True))
            .annotate(entity_count=Count('documents__entities', distinct=True))
            .filter(id=id)
            .first()
        )
        if not project:
            return Response({'error': 'project_not_found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProjectSummarySerializer(project).data, status=status.HTTP_200_OK)

    def patch(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        serializer = ProjectWriteSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info('[PROJECT] updated project=%s owner=%s', project.id, request.user.id)
        hydrated = (
            Project.objects
            .filter(owner=request.user)
            .annotate(document_count=Count('documents', distinct=True))
            .annotate(entity_count=Count('documents__entities', distinct=True))
            .get(id=project.id)
        )
        return Response(ProjectSummarySerializer(hydrated).data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        logger.info('[PROJECT] deleting project=%s owner=%s', project.id, request.user.id)
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectConceptNoteView(AuthenticatedAPIView):
    """GET/POST /api/v1/projects/{id}/concept-note/."""

    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        note = getattr(project, 'concept_note', None)
        if not note:
            return Response({'error': 'concept_note_not_found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ConceptNoteSerializer(note, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        note = getattr(project, 'concept_note', None)
        is_create = note is None

        payload = {
            'content': request.data.get('content', ''),
            'attachment': request.FILES.get('attachment') or request.data.get('attachment'),
        }
        serializer = ConceptNoteSerializer(note, data=payload, partial=not is_create, context={'request': request})
        serializer.is_valid(raise_exception=True)
        saved_note = serializer.save(project=project)
        logger.info('[PROJECT] concept_note upsert project=%s owner=%s', project.id, request.user.id)
        response_serializer = ConceptNoteSerializer(saved_note, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED if is_create else status.HTTP_200_OK)


class ProjectDocumentUploadView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/documents/."""

    parser_classes = [MultiPartParser]

    def get(self, request, id):
        from django.db.models import Avg, Case, When, IntegerField, Value, Sum
        from ner.models import Entity, NERRun

        project = resolve_project_for_user_or_404(id, request.user)
        include_stats = request.query_params.get('include_stats', '').lower() in ('true', '1')
        docs = (
            Document.objects.filter(project=project)
            .annotate(entity_count=Count('entities', distinct=True))
            .annotate(relation_count=Count('relations', distinct=True))
            .order_by('-upload_timestamp')
        )
        data = DocumentSerializer(docs, many=True).data
        for item, doc in zip(data, docs):
            item['entity_count'] = doc.entity_count
            item['relation_count'] = doc.relation_count
            if include_stats and doc.processing_status == Document.STATUS_COMPLETED:
                entities = Entity.objects.filter(document_id=doc, is_flagged=False)
                high = entities.filter(confidence__gte=0.8).count()
                medium = entities.filter(confidence__gte=0.5, confidence__lt=0.8).count()
                low = entities.filter(confidence__lt=0.5).count()
                top_entities = list(
                    entities.order_by('-confidence').values('id', 'canonical_name', 'entity_type', 'confidence')[:5]
                )
                for e in top_entities:
                    e['id'] = str(e['id'])
                runs = NERRun.objects.filter(document_id=doc, status=NERRun.STATUS_COMPLETED)
                total_relations = runs.aggregate(total=Sum('relations_created'))['total'] or 0
                item['stats'] = {
                    'entity_count': doc.entity_count,
                    'relation_count': total_relations,
                    'confidence_distribution': {'high': high, 'medium': medium, 'low': low},
                    'top_entities': top_entities,
                }
            else:
                item['stats'] = None
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        file_obj = request.FILES.get('file')

        if file_obj is None:
            return Response(
                {'error': 'No file provided. Include a file in the "file" form field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_obj.size > MAX_FILE_SIZE:
            return Response(
                {'error': 'File size exceeds the 50 MB limit.'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        filename = file_obj.name or ''
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext not in ALLOWED_FORMATS:
            return Response(
                {'error': 'Unsupported file format. Accepted formats: pdf, docx, txt.'},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        try:
            logger.info('[UPLOAD] start project=%s user=%s filename=%s', project.id, request.user.id, filename)
            document = ingest_document(file_obj, filename, ext, project=project)
            logger.info('[UPLOAD] success document=%s project=%s user=%s', document.id, project.id, request.user.id)
        except ExtractionError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except IngestionError:
            logger.exception("Ingestion pipeline failed for file %s", filename)
            return Response(
                {'error': 'Ingestion failed. Please try again or contact support.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IngestView(AuthenticatedAPIView):
    """
    POST /api/v1/documents/  — Upload and ingest a document.
    GET  /api/v1/documents/  — List all uploaded documents (most recent first).
    """
    parser_classes = [MultiPartParser]

    def get(self, request):
        from ingestion.models import Document
        from django.db.models import Prefetch
        from ner.models import NERRun
        docs = (
            Document.objects
            .filter(project__owner=request.user)
            .annotate(entity_count=Count('entities', distinct=True))
            .annotate(relation_count=Count('relations', distinct=True))
            .prefetch_related(
                Prefetch('ner_runs', queryset=NERRun.objects.order_by('-created_at'), to_attr='_latest_ner_runs')
            )
            .order_by('-upload_timestamp')
        )
        data = DocumentSerializer(docs, many=True).data
        # Append entity_count, relation_count and last NER run metadata
        for item, doc in zip(data, docs):
            item['entity_count'] = doc.entity_count
            item['relation_count'] = doc.relation_count
            last_run = doc._latest_ner_runs[0] if doc._latest_ner_runs else None
            item['last_run'] = {
                'provider': last_run.provider,
                'model': last_run.model,
                'duration_seconds': last_run.duration_seconds,
                'run_at': last_run.created_at.isoformat(),
            } if last_run else None
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        project = get_or_create_default_project(owner=request.user)
        file_obj = request.FILES.get('file')

        if file_obj is None:
            return Response(
                {'error': 'No file provided. Include a file in the "file" form field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_obj.size > MAX_FILE_SIZE:
            return Response(
                {'error': 'File size exceeds the 50 MB limit.'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        filename = file_obj.name or ''
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

        if ext not in ALLOWED_FORMATS:
            return Response(
                {'error': 'Unsupported file format. Accepted formats: pdf, docx, txt.'},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        try:
            logger.info('[UPLOAD] legacy start project=%s user=%s filename=%s', project.id, request.user.id, filename)
            document = ingest_document(file_obj, filename, ext, project=project)
            logger.info('[UPLOAD] legacy success document=%s project=%s user=%s', document.id, project.id, request.user.id)
        except ExtractionError as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except IngestionError:
            logger.exception("Ingestion pipeline failed for file %s", filename)
            return Response(
                {'error': 'Ingestion failed. Please try again or contact support.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DocumentDetailView(AuthenticatedAPIView):
    """
    DELETE /api/v1/documents/{id}/  — Delete a document and all its associated data.
    """

    def delete(self, request, id):
        doc = Document.objects.filter(id=id, project__owner=request.user).first()
        if not doc:
            return Response(
                {'error': 'document_not_found', 'detail': f'Document {id} does not exist'},
                status=status.HTTP_404_NOT_FOUND,
            )
        logger.info('[UPLOAD] delete document=%s project=%s user=%s', doc.id, doc.project_id, request.user.id)
        doc.delete()  # cascades to Chunk, Entity, NERRun
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectDocumentDetailView(AuthenticatedAPIView):
    """
    DELETE /api/v1/projects/{id}/documents/{doc_id}/  — Remove a document from a project.
    GET    /api/v1/projects/{id}/documents/{doc_id}/status/  — Polling endpoint.
    """

    def delete(self, request, id, doc_id):
        project = resolve_project_for_user_or_404(id, request.user)
        doc = Document.objects.filter(id=doc_id, project=project).first()
        if not doc:
            return Response({'error': 'document_not_found'}, status=status.HTTP_404_NOT_FOUND)
        logger.info('[UPLOAD] delete document=%s project=%s user=%s', doc.id, project.id, request.user.id)
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectDocumentStatusView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/documents/{doc_id}/status/"""

    def get(self, request, id, doc_id):
        project = resolve_project_for_user_or_404(id, request.user)
        doc = (
            Document.objects
            .filter(id=doc_id, project=project)
            .annotate(entity_count=Count('entities', distinct=True))
            .first()
        )
        if not doc:
            return Response({'error': 'document_not_found'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': str(doc.id),
            'processing_status': doc.processing_status,
            'chunk_count': doc.chunk_count,
            'entity_count': doc.entity_count,
            'error_message': doc.error_message,
        }, status=status.HTTP_200_OK)


class HealthView(APIView):
    """
    GET /health

    Returns service liveness and database connectivity status.
    Responds within 1 second under normal conditions.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        try:
            connection.ensure_connection()
            return Response(
                {'status': 'healthy', 'database': 'connected'},
                status=status.HTTP_200_OK,
            )
        except OperationalError:
            logger.warning("Health check: database unreachable.")
            return Response(
                {'status': 'unhealthy', 'database': 'unreachable'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
