"""Unit tests for ingestion.services.web_source helper functions."""

from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


class TestSanitizeUrl:
    def test_strips_control_characters(self):
        from ingestion.services.web_source import _sanitize_url
        url = 'https://example.com/\x00path\x1f'
        assert _sanitize_url(url) == 'https://example.com/path'

    def test_preserves_normal_url(self):
        from ingestion.services.web_source import _sanitize_url
        url = 'https://example.com/path?q=1&page=2'
        assert _sanitize_url(url) == url

    def test_strips_leading_trailing_whitespace(self):
        from ingestion.services.web_source import _sanitize_url
        url = '  https://example.com/  '
        assert _sanitize_url(url) == 'https://example.com/'

    def test_empty_string_returns_empty(self):
        from ingestion.services.web_source import _sanitize_url
        assert _sanitize_url('') == ''

    def test_none_returns_empty(self):
        from ingestion.services.web_source import _sanitize_url
        assert _sanitize_url(None) == ''


class TestExtractTextFromHtml:
    def test_extracts_text_strips_script_and_style(self):
        from ingestion.services.web_source import _extract_text_from_html
        html = '<html><body><script>js code</script><style>css</style><p>Visible text</p></body></html>'
        result = _extract_text_from_html(html)
        assert 'Visible text' in result
        assert 'js code' not in result
        assert 'css' not in result

    def test_returns_empty_for_empty_html(self):
        from ingestion.services.web_source import _extract_text_from_html
        result = _extract_text_from_html('')
        assert result == ''

    def test_strips_blank_lines(self):
        from ingestion.services.web_source import _extract_text_from_html
        html = '<html><body><p>Line one</p><p>   </p><p>Line two</p></body></html>'
        result = _extract_text_from_html(html)
        lines = [line for line in result.splitlines() if line.strip()]
        assert len(lines) == 2

    def test_extracts_text_from_heading_and_paragraph(self):
        from ingestion.services.web_source import _extract_text_from_html
        html = '<h1>Title</h1><p>Body text here.</p>'
        result = _extract_text_from_html(html)
        assert 'Title' in result
        assert 'Body text here.' in result


class TestBlockedAccessMessage:
    def test_includes_url_and_status_code(self):
        from ingestion.services.web_source import _blocked_access_message
        msg = _blocked_access_message('https://example.com', 403)
        assert 'https://example.com' in msg
        assert '403' in msg

    def test_includes_helpful_suggestion(self):
        from ingestion.services.web_source import _blocked_access_message
        msg = _blocked_access_message('https://example.com', 401)
        assert 'Paste Text' in msg or 'bot' in msg.lower()


class TestProcessWebSourceRecord(TestCase):
    def setUp(self):
        from ingestion.models import Project
        self.user = User.objects.create_user('ws_user', 'ws@example.com', 'Pass123')
        self.project = Project.objects.create(name='Web Source Project', owner=self.user)

    def _make_web_source(self, source_type, **kwargs):
        from ingestion.models import WebSource
        return WebSource.objects.create(
            project=self.project,
            source_type=source_type,
            **kwargs,
        )

    @patch('ingestion.services.web_source.ingest_text_document')
    def test_paste_source_processes_raw_text(self, mock_ingest):
        from ingestion.models import WebSource, Document
        mock_doc = Document.objects.create(
            filename='Pasted notes.txt', file_format='txt',
            processing_status=Document.STATUS_COMPLETED, project=self.project,
        )
        mock_ingest.return_value = mock_doc

        ws = self._make_web_source(
            WebSource.SOURCE_PASTE,
            raw_text='Some pasted content here.',
            title='My Notes',
        )
        from ingestion.services.web_source import process_web_source_record
        result = process_web_source_record(str(ws.id))

        assert result.status == WebSource.STATUS_PROCESSED
        mock_ingest.assert_called_once()

    @patch('ingestion.services.web_source.ingest_text_document')
    def test_paste_source_empty_text_sets_error(self, mock_ingest):
        from ingestion.models import WebSource
        ws = self._make_web_source(
            WebSource.SOURCE_PASTE,
            raw_text='',
            title='Empty',
        )
        from ingestion.services.web_source import process_web_source_record
        result = process_web_source_record(str(ws.id))

        assert result.status == WebSource.STATUS_ERROR
        assert 'No extractable text' in result.error_message
        mock_ingest.assert_not_called()

    @patch('ingestion.services.web_source._fetch_url_text')
    @patch('ingestion.services.web_source.ingest_text_document')
    def test_url_source_fetches_and_ingests(self, mock_ingest, mock_fetch):
        from ingestion.models import WebSource, Document
        mock_fetch.return_value = ('Fetched article text', 'Article Title')
        mock_doc = Document.objects.create(
            filename='article.txt', file_format='txt',
            processing_status=Document.STATUS_COMPLETED, project=self.project,
        )
        mock_ingest.return_value = mock_doc

        ws = self._make_web_source(
            WebSource.SOURCE_URL,
            url='https://example.com/article',
        )
        from ingestion.services.web_source import process_web_source_record
        result = process_web_source_record(str(ws.id))

        assert result.status == WebSource.STATUS_PROCESSED
        mock_fetch.assert_called_once_with('https://example.com/article')

    @patch('ingestion.services.web_source._fetch_url_text')
    def test_url_source_fetch_error_sets_error_status(self, mock_fetch):
        from ingestion.models import WebSource
        mock_fetch.side_effect = ValueError('Blocked: 403')

        ws = self._make_web_source(
            WebSource.SOURCE_URL,
            url='https://blocked.example.com',
        )
        from ingestion.services.web_source import process_web_source_record
        result = process_web_source_record(str(ws.id))

        assert result.status == WebSource.STATUS_ERROR
        assert 'Blocked' in result.error_message

    def test_unsupported_source_type_sets_error(self):
        from ingestion.models import WebSource
        ws = WebSource.objects.create(
            project=self.project,
            source_type='unknown',
        )
        from ingestion.services.web_source import process_web_source_record
        result = process_web_source_record(str(ws.id))

        assert result.status == WebSource.STATUS_ERROR
        assert 'Unsupported' in result.error_message
