"""API views for the ingestion app."""
import logging
from django.db import connection, OperationalError
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import status

from ingestion.serializers import DocumentSerializer
from ingestion.services.extractor import ExtractionError
from ingestion.services.pipeline import ingest_document, IngestionError

logger = logging.getLogger(__name__)

ALLOWED_FORMATS = {'pdf', 'docx', 'txt'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class IngestView(APIView):
    """
    POST /api/v1/documents/

    Accepts a multipart file upload (PDF, DOCX, or TXT ≤50 MB).
    Runs the ingestion pipeline synchronously and returns the created Document.
    """
    parser_classes = [MultiPartParser]

    def post(self, request):
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
            document = ingest_document(file_obj, filename, ext)
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


class HealthView(APIView):
    """
    GET /health

    Returns service liveness and database connectivity status.
    Responds within 1 second under normal conditions.
    """

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
