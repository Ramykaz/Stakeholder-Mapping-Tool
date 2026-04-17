"""Unit tests for ingestion.tasks (Celery task wrappers)."""

import uuid
from unittest.mock import MagicMock, patch

import pytest


class TestProcessWebSourceTask:
    @patch('ingestion.services.web_source.process_web_source_record')
    def test_returns_correct_dict_with_document_id(self, mock_process):
        """Task returns web_source_id, status, and document_id from the processed record."""
        web_source_id = str(uuid.uuid4())
        document_id = str(uuid.uuid4())

        mock_record = MagicMock()
        mock_record.id = uuid.UUID(web_source_id)
        mock_record.status = 'completed'
        mock_record.document_id = uuid.UUID(document_id)
        mock_process.return_value = mock_record

        from ingestion.tasks import process_web_source
        result = process_web_source.run(web_source_id)

        assert result['web_source_id'] == web_source_id
        assert result['status'] == 'completed'
        assert result['document_id'] == document_id

    @patch('ingestion.services.web_source.process_web_source_record')
    def test_returns_none_document_id_when_no_document(self, mock_process):
        """document_id is None when the web source has no associated document."""
        web_source_id = str(uuid.uuid4())

        mock_record = MagicMock()
        mock_record.id = uuid.UUID(web_source_id)
        mock_record.status = 'failed'
        mock_record.document_id = None
        mock_process.return_value = mock_record

        from ingestion.tasks import process_web_source
        result = process_web_source.run(web_source_id)

        assert result['document_id'] is None
        assert result['status'] == 'failed'

    @patch('ingestion.services.web_source.process_web_source_record')
    def test_calls_process_web_source_record_with_correct_id(self, mock_process):
        """process_web_source_record is called with the exact web_source_id passed to the task."""
        web_source_id = str(uuid.uuid4())

        mock_record = MagicMock()
        mock_record.id = uuid.UUID(web_source_id)
        mock_record.status = 'completed'
        mock_record.document_id = None
        mock_process.return_value = mock_record

        from ingestion.tasks import process_web_source
        process_web_source.run(web_source_id)

        mock_process.assert_called_once_with(web_source_id)

    @patch('ingestion.services.web_source.process_web_source_record')
    def test_propagates_exceptions(self, mock_process):
        """Exceptions from process_web_source_record are not swallowed."""
        mock_process.side_effect = ValueError('Web source not found')

        from ingestion.tasks import process_web_source
        with pytest.raises(ValueError, match='Web source not found'):
            process_web_source.run(str(uuid.uuid4()))
