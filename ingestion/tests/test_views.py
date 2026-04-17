"""Contract tests for POST /api/v1/documents/ (IngestView)."""
import uuid
import pytest
from unittest.mock import patch, MagicMock
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from rest_framework.test import force_authenticate

factory = APIRequestFactory()
User = get_user_model()


def _make_mock_document(**kwargs):
    """Build a mock Document with all serializer fields populated."""
    doc = MagicMock()
    doc.id = kwargs.get('id', uuid.uuid4())
    doc.filename = kwargs.get('filename', 'test.pdf')
    doc.file_format = kwargs.get('file_format', 'pdf')
    doc.upload_timestamp = kwargs.get('upload_timestamp', '2026-03-10T00:00:00Z')
    doc.processing_status = kwargs.get('processing_status', 'completed')
    doc.chunk_count = kwargs.get('chunk_count', 5)
    return doc


@pytest.mark.django_db
class TestIngestView:
    def _authed_request(self, method: str, path: str, payload=None):
        user = User.objects.create_user(username=f'user_{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', password='Password123')
        if method.lower() == 'post':
            request = factory.post(path, payload or {}, format='multipart')
        else:
            request = factory.get(path, payload or {}, format='json')
        force_authenticate(request, user=user)
        return request

    @patch('ingestion.views.ingest_document')
    def test_valid_pdf_returns_201(self, mock_ingest):
        from ingestion.views import IngestView

        mock_ingest.return_value = _make_mock_document()
        pdf_file = SimpleUploadedFile('report.pdf', b'%PDF-1.4 content', content_type='application/pdf')

        request = self._authed_request('post', '/api/v1/documents/', {'file': pdf_file})
        response = IngestView.as_view()(request)

        assert response.status_code == 201
        data = response.data
        assert 'id' in data
        assert 'filename' in data
        assert 'processing_status' in data
        assert 'chunk_count' in data

    @patch('ingestion.views.ingest_document')
    def test_valid_docx_returns_201(self, mock_ingest):
        from ingestion.views import IngestView

        mock_ingest.return_value = _make_mock_document(file_format='docx', filename='report.docx')
        docx_file = SimpleUploadedFile(
            'report.docx', b'PK content',
            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )

        request = self._authed_request('post', '/api/v1/documents/', {'file': docx_file})
        response = IngestView.as_view()(request)

        assert response.status_code == 201

    @patch('ingestion.views.ingest_document')
    def test_valid_txt_returns_201(self, mock_ingest):
        from ingestion.views import IngestView

        mock_ingest.return_value = _make_mock_document(file_format='txt', filename='notes.txt')
        txt_file = SimpleUploadedFile('notes.txt', b'Plain text content', content_type='text/plain')

        request = self._authed_request('post', '/api/v1/documents/', {'file': txt_file})
        response = IngestView.as_view()(request)

        assert response.status_code == 201

    @patch('ingestion.views.ingest_document')
    def test_valid_markdown_returns_201(self, mock_ingest):
        from ingestion.views import IngestView

        mock_ingest.return_value = _make_mock_document(file_format='txt', filename='notes.md')
        md_file = SimpleUploadedFile('notes.md', b'# Header\n\nSome markdown content', content_type='text/markdown')

        request = self._authed_request('post', '/api/v1/documents/', {'file': md_file})
        response = IngestView.as_view()(request)

        assert response.status_code == 201

    def test_oversized_file_returns_413(self):
        from ingestion.views import IngestView

        tiny_file = SimpleUploadedFile('big.pdf', b'tiny', content_type='application/pdf')
        tiny_file.size = 60 * 1024 * 1024  # lie about the size

        request = self._authed_request('post', '/api/v1/documents/', {'file': tiny_file})
        response = IngestView.as_view()(request)

        assert response.status_code == 413
        assert 'error' in response.data

    def test_unsupported_format_returns_415(self):
        from ingestion.views import IngestView

        bad_file = SimpleUploadedFile('spreadsheet.xlsx', b'content', content_type='application/vnd.ms-excel')

        request = self._authed_request('post', '/api/v1/documents/', {'file': bad_file})
        response = IngestView.as_view()(request)

        assert response.status_code == 415
        assert 'error' in response.data

    @patch('ingestion.views.ingest_document')
    def test_extraction_error_returns_422(self, mock_ingest):
        from ingestion.views import IngestView
        from ingestion.services.extractor import ExtractionError

        mock_ingest.side_effect = ExtractionError("No extractable text found.")
        pdf_file = SimpleUploadedFile('empty.pdf', b'%PDF-1.4 no text', content_type='application/pdf')

        request = self._authed_request('post', '/api/v1/documents/', {'file': pdf_file})
        response = IngestView.as_view()(request)

        assert response.status_code == 422
        assert 'error' in response.data

    @patch('ingestion.views.ingest_document')
    def test_ingestion_error_returns_500_structured_json(self, mock_ingest):
        from ingestion.views import IngestView
        from ingestion.services.pipeline import IngestionError

        mock_ingest.side_effect = IngestionError("Database write failed.")
        txt_file = SimpleUploadedFile('doc.txt', b'Some text', content_type='text/plain')

        request = self._authed_request('post', '/api/v1/documents/', {'file': txt_file})
        response = IngestView.as_view()(request)

        assert response.status_code == 500
        # Must return structured JSON, not Django traceback HTML
        assert 'error' in response.data
        assert isinstance(response.data['error'], str)

    def test_missing_file_field_returns_400(self):
        from ingestion.views import IngestView

        request = self._authed_request('post', '/api/v1/documents/', {})
        response = IngestView.as_view()(request)

        assert response.status_code == 400
        assert 'error' in response.data
