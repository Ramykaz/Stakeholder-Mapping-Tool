"""API views for the ingestion app."""
import re
import logging
from django.db import transaction
from django.db import connection, OperationalError
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser
from rest_framework.parsers import JSONParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny

from ingestion.models import Project, ConceptNote, Document, InitiativeProfile, ExtractionGuidance, WebSource, get_or_create_default_project
from ingestion.serializers import (
    DocumentSerializer,
    ProjectSummarySerializer,
    ProjectWriteSerializer,
    ConceptNoteSerializer,
    InitiativeProfileSerializer,
    ExtractionGuidanceSerializer,
    WebSourceSerializer,
)
from ingestion.services.extractor import ExtractionError
from ingestion.services.pipeline import ingest_document, IngestionError
from ingestion.services.context import get_project_context
from ingestion.tasks import process_web_source
from ingestion.services.web_source import process_web_source_record

logger = logging.getLogger(__name__)

ALLOWED_FORMATS = {'pdf', 'docx', 'txt', 'md'}
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
            return Response(
                {
                    'project_id': str(project.id),
                    'content': '',
                    'attachment': None,
                    'attachment_url': None,
                    'updated_at': None,
                },
                status=status.HTTP_200_OK,
            )
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


class InitiativeProfileView(AuthenticatedAPIView):
    """GET/PUT/PATCH /api/v1/projects/{id}/intake/."""

    parser_classes = [JSONParser]

    def get(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        profile = getattr(project, 'initiative_profile', None)

        if profile:
            serializer = InitiativeProfileSerializer(profile)
            return Response(serializer.data, status=status.HTTP_200_OK)

        concept_note = getattr(project, 'concept_note', None)
        defaults = {
            'id': None,
            'project': str(project.id),
            'initiative_name': '',
            'host_organization': '',
            'country': '',
            'geography': '',
            'thematic_area': '',
            'core_objectives': (concept_note.content or '').strip() if concept_note else '',
            'expected_outcomes': '',
            'target_beneficiaries': '',
            'success_metrics': '',
            'stakeholder_focus': '',
            'updated_at': None,
        }
        return Response(defaults, status=status.HTTP_200_OK)

    def _save_profile(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        profile, _ = InitiativeProfile.objects.get_or_create(project=project)
        serializer = InitiativeProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        saved_profile = serializer.save()

        auto_items = []
        if (saved_profile.thematic_area or '').strip():
            auto_items.append(f"Prioritize entities and relationships related to thematic area: {saved_profile.thematic_area.strip()}.")
        country_or_geo = (saved_profile.country or saved_profile.geography or '').strip()
        if country_or_geo:
            auto_items.append(f"Give extra attention to context and stakeholders in: {country_or_geo}.")
        if (saved_profile.host_organization or '').strip():
            auto_items.append(f"Treat {saved_profile.host_organization.strip()} as a primary implementing stakeholder.")
        if (saved_profile.target_beneficiaries or '').strip():
            auto_items.append(f"Highlight target beneficiary groups: {saved_profile.target_beneficiaries.strip()}.")
        if (saved_profile.success_metrics or '').strip():
            auto_items.append(f"Capture references to measurable success metrics: {saved_profile.success_metrics.strip()}.")
        if (saved_profile.stakeholder_focus or '').strip():
            auto_items.append(f"Apply stakeholder focus guidance: {saved_profile.stakeholder_focus.strip()}.")

        ExtractionGuidance.objects.filter(project=project, source=ExtractionGuidance.SOURCE_AUTO).delete()
        max_order = ExtractionGuidance.objects.filter(project=project).aggregate(max_order=Max('order')).get('max_order')
        next_order = (max_order + 1) if max_order is not None else 0
        for idx, text in enumerate(auto_items):
            ExtractionGuidance.objects.create(
                project=project,
                text=text,
                order=next_order + idx,
                enabled=True,
                source=ExtractionGuidance.SOURCE_AUTO,
            )

        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, id):
        return self._save_profile(request, id)

    def patch(self, request, id):
        return self._save_profile(request, id)


class ProjectContextPreviewView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/context-preview/."""

    def get(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        return Response({'project': str(project.id), 'context': get_project_context(project)}, status=status.HTTP_200_OK)


class WorkflowStatusView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/workflow/."""

    def get(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        workflow = project.get_workflow_status()
        return Response(
            {
                'current_step': workflow.get('current_step', 1),
                'steps': workflow.get('steps', []),
                'next_step': workflow.get('next_step'),
            },
            status=status.HTTP_200_OK,
        )


class ExtractionGuidanceListView(AuthenticatedAPIView):
    """GET/POST /api/v1/projects/{id}/guidance/."""

    parser_classes = [JSONParser]

    def get(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        queryset = ExtractionGuidance.objects.filter(project=project).order_by('order', 'created_at')
        serializer = ExtractionGuidanceSerializer(queryset, many=True)
        return Response({'count': len(serializer.data), 'results': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        payload = dict(request.data or {})
        if 'order' not in payload:
            max_order = ExtractionGuidance.objects.filter(project=project).aggregate(max_order=Max('order')).get('max_order')
            payload['order'] = (max_order + 1) if max_order is not None else 0
        serializer = ExtractionGuidanceSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(project=project)
        return Response(ExtractionGuidanceSerializer(obj).data, status=status.HTTP_201_CREATED)


class ExtractionGuidanceDetailView(AuthenticatedAPIView):
    """PATCH/DELETE /api/v1/projects/{id}/guidance/{guidance_id}/."""

    parser_classes = [JSONParser]

    def patch(self, request, id, guidance_id):
        project = resolve_project_for_user_or_404(id, request.user)
        obj = get_object_or_404(ExtractionGuidance, id=guidance_id, project=project)
        serializer = ExtractionGuidanceSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id, guidance_id):
        project = resolve_project_for_user_or_404(id, request.user)
        obj = get_object_or_404(ExtractionGuidance, id=guidance_id, project=project)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExtractionGuidanceReorderView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/guidance/reorder/."""

    parser_classes = [JSONParser]

    def post(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        order_ids = request.data.get('order', []) if isinstance(request.data, dict) else []
        if not isinstance(order_ids, list):
            return Response({'error': 'validation_error', 'detail': 'order must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = ExtractionGuidance.objects.filter(project=project, id__in=order_ids)
        if queryset.count() != len(order_ids):
            return Response({'error': 'validation_error', 'detail': 'order contains unknown guidance ids'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for index, item_id in enumerate(order_ids):
                ExtractionGuidance.objects.filter(project=project, id=item_id).update(order=index)

        return Response({'status': 'reordered'}, status=status.HTTP_200_OK)


class ProjectWebSourceListCreateView(AuthenticatedAPIView):
    """GET/POST /api/v1/projects/{id}/web-sources/."""

    parser_classes = [JSONParser]

    def get(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        queryset = WebSource.objects.filter(project=project).order_by('-created_at')
        serializer = WebSourceSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, id):
        project = resolve_project_for_user_or_404(id, request.user)
        serializer = WebSourceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        web_source = serializer.save(project=project, status=WebSource.STATUS_QUEUED)

        try:
            process_web_source.delay(str(web_source.id))
        except Exception:
            process_web_source_record(str(web_source.id))

        return Response(WebSourceSerializer(web_source).data, status=status.HTTP_201_CREATED)


class ProjectWebSourceDetailView(AuthenticatedAPIView):
    """DELETE /api/v1/projects/{id}/web-sources/{web_source_id}/."""

    def delete(self, request, id, web_source_id):
        project = resolve_project_for_user_or_404(id, request.user)
        web_source = get_object_or_404(WebSource, id=web_source_id, project=project)
        linked_document = web_source.document
        web_source.delete()
        if linked_document and linked_document.project_id == project.id:
            linked_document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectDocumentUploadView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/documents/."""

    parser_classes = [MultiPartParser]

    def get(self, request, id):
        from django.db.models import Avg, Case, When, IntegerField, Value, Sum, Exists, OuterRef
        from ner.models import Entity, EntityMention, NERRun, Relation

        project = resolve_project_for_user_or_404(id, request.user)
        include_stats = request.query_params.get('include_stats', '').lower() in ('true', '1')
        pending_run_qs = NERRun.objects.filter(document_id=OuterRef('pk'), status=NERRun.STATUS_PENDING)
        docs = (
            Document.objects.filter(project=project)
            .annotate(is_extracting=Exists(pending_run_qs))
            .order_by('-upload_timestamp')
        )
        data = DocumentSerializer(docs, many=True).data
        for item, doc in zip(data, docs):
            mention_backed_entity_count = (
                EntityMention.objects
                .filter(document=doc, entity__project=project, entity__is_flagged=False)
                .values('entity_id')
                .distinct()
                .count()
            )
            if mention_backed_entity_count == 0:
                mention_backed_entity_count = Entity.objects.filter(
                    project=project,
                    document_id=doc,
                    is_flagged=False,
                ).count()

            scoped_relation_count = Relation.objects.filter(project=project).filter(
                Q(source_document=doc) | Q(document_id=doc)
            ).distinct().count()

            item['entity_count'] = mention_backed_entity_count
            item['relation_count'] = scoped_relation_count
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
                    e['name'] = e.pop('canonical_name')
                    e['type'] = e.pop('entity_type')
                item['stats'] = {
                    'entity_count': mention_backed_entity_count,
                    'relation_count': scoped_relation_count,
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
        normalized_ext = 'txt' if ext == 'md' else ext
        if ext not in ALLOWED_FORMATS:
            return Response(
                {'error': 'Unsupported file format. Accepted formats: pdf, docx, txt, md.'},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        try:
            logger.info('[UPLOAD] start project=%s user=%s filename=%s', project.id, request.user.id, filename)
            document = ingest_document(file_obj, filename, normalized_ext, project=project)
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
        normalized_ext = 'txt' if ext == 'md' else ext

        if ext not in ALLOWED_FORMATS:
            return Response(
                {'error': 'Unsupported file format. Accepted formats: pdf, docx, txt, md.'},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        try:
            logger.info('[UPLOAD] legacy start project=%s user=%s filename=%s', project.id, request.user.id, filename)
            document = ingest_document(file_obj, filename, normalized_ext, project=project)
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


class ProjectDocumentContextView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/documents/{doc_id}/context/"""

    @staticmethod
    def _resolve_document_text(doc: Document) -> tuple[str, str]:
        cleaned_text = (doc.cleaned_text or '').strip()
        if cleaned_text:
            return cleaned_text, 'cleaned_text'

        raw_text = (doc.raw_text or '').strip()
        if raw_text:
            return raw_text, 'raw_text'

        chunk_rows = list(
            doc.chunks
            .order_by('chunk_index')
            .values_list('text', flat=True)
        )
        chunk_text = '\n\n'.join((item or '').strip() for item in chunk_rows if (item or '').strip())
        if chunk_text:
            return chunk_text, 'chunks'

        return '', 'none'

    @staticmethod
    def _collect_snippets(text: str, focus_terms: list[str], radius: int = 220, limit: int = 6) -> list[dict]:
        if not text:
            return []

        lowered = text.lower()
        snippets: list[dict] = []
        seen: set[tuple[int, int]] = set()

        for term in focus_terms:
            query = (term or '').strip().lower()
            if len(query) < 2:
                continue

            for match in re.finditer(re.escape(query), lowered):
                start = max(0, match.start() - radius)
                end = min(len(text), match.end() + radius)
                key = (start, end)
                if key in seen:
                    continue
                seen.add(key)
                snippets.append({'start': start, 'end': end, 'text': text[start:end].strip()})
                if len(snippets) >= limit:
                    return snippets

        return snippets

    def get(self, request, id, doc_id):
        project = resolve_project_for_user_or_404(id, request.user)
        doc = Document.objects.filter(id=doc_id, project=project).first()
        if not doc:
            return Response({'error': 'document_not_found'}, status=status.HTTP_404_NOT_FOUND)

        focus_terms = request.query_params.getlist('focus')
        document_text, text_source = self._resolve_document_text(doc)
        snippets = self._collect_snippets(document_text, focus_terms)

        return Response(
            {
                'document_id': str(doc.id),
                'filename': doc.filename,
                'focus_terms': [term for term in focus_terms if (term or '').strip()],
                'snippets': snippets,
                'cleaned_text': document_text,
                'text_source': text_source,
            },
            status=status.HTTP_200_OK,
        )


class ProjectDocumentStatusView(AuthenticatedAPIView):
    """GET /api/v1/projects/{id}/documents/{doc_id}/status/"""

    def get(self, request, id, doc_id):
        project = resolve_project_for_user_or_404(id, request.user)
        from django.db.models import Exists, OuterRef
        from ner.models import NERRun

        pending_run_qs = NERRun.objects.filter(document_id=OuterRef('pk'), status=NERRun.STATUS_PENDING)
        doc = (
            Document.objects
            .filter(id=doc_id, project=project)
            .annotate(entity_count=Count('entities', distinct=True))
            .annotate(is_extracting=Exists(pending_run_qs))
            .first()
        )
        if not doc:
            return Response({'error': 'document_not_found'}, status=status.HTTP_404_NOT_FOUND)
        extraction_state = 'extracting' if getattr(doc, 'is_extracting', False) else ('extracted' if doc.extracted_at else 'not_extracted')
        if doc.processing_status == Document.STATUS_FAILED:
            extraction_state = 'failed'
        return Response({
            'id': str(doc.id),
            'processing_status': doc.processing_status,
            'chunk_count': doc.chunk_count,
            'entity_count': doc.entity_count,
            'extracted_at': doc.extracted_at,
            'extraction_state': extraction_state,
            'error_message': doc.error_message,
        }, status=status.HTTP_200_OK)


class ProjectDocumentReextractView(AuthenticatedAPIView):
    """POST /api/v1/projects/{id}/documents/{doc_id}/reextract/"""

    def post(self, request, id, doc_id):
        project = resolve_project_for_user_or_404(id, request.user)
        document = Document.objects.filter(id=doc_id, project=project).first()
        if not document:
            return Response({'error': 'document_not_found'}, status=status.HTTP_404_NOT_FOUND)

        from ner.services.pipeline import extract_relations_for_document, extract_relations_only_for_document

        document.extracted_at = None
        document.save(update_fields=['extracted_at'])

        provider = str((request.data or {}).get('provider', '')).strip() if isinstance(request.data, dict) else ''
        model = str((request.data or {}).get('model', '')).strip() if isinstance(request.data, dict) else ''

        result = extract_relations_for_document(
            str(document.id),
            provider=provider or None,
            model=model or None,
        )
        if result.get('relations_created', 0) == 0 and result.get('entities_created', 0) >= 2:
            fallback = extract_relations_only_for_document(
                str(document.id),
                provider=provider or None,
                model=model or None,
            )
            result['relations_created'] = fallback.get('relations_created', 0)

        from django.utils import timezone
        document.extracted_at = timezone.now()
        document.save(update_fields=['extracted_at'])

        return Response(
            {
                'status': 'completed',
                'project_id': str(project.id),
                'document_id': str(document.id),
                'entities_created': int(result.get('entities_created', 0) or 0),
                'relations_created': int(result.get('relations_created', 0) or 0),
            },
            status=status.HTTP_200_OK,
        )


class HealthView(APIView):
    """
    GET /health

    Returns service liveness, database connectivity, and cache/Redis status.
    Responds within 1 second under normal conditions.
    All checks are best-effort — partial degradation returns 200 with component status.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        checks: dict = {}

        # Database check
        try:
            connection.ensure_connection()
            checks['database'] = 'connected'
        except OperationalError:
            logger.warning("Health check: database unreachable.")
            checks['database'] = 'unreachable'

        # Cache / Redis check
        try:
            from django.core.cache import cache
            _probe_key = '_health_probe'
            cache.set(_probe_key, '1', timeout=5)
            if cache.get(_probe_key) == '1':
                checks['cache'] = 'connected'
            else:
                checks['cache'] = 'degraded'
        except Exception:  # noqa: BLE001
            checks['cache'] = 'unreachable'

        all_healthy = all(v in ('connected',) for v in checks.values())
        checks['status'] = 'healthy' if all_healthy else 'degraded'

        http_status = (
            status.HTTP_200_OK if checks['database'] == 'connected'
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(checks, status=http_status)
