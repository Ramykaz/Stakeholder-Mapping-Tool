"""Unit tests for ingestion/services/pipeline.py.

All external I/O (extract_text, embed_chunks, DB) is mocked so these
tests run fast without requiring a live database or model.
"""

import io
import pytest
from unittest.mock import MagicMock, patch
import numpy as np


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fake_embeddings(chunks):
    """Return a list of 384-dim zero arrays matching the chunk count."""
    return [np.zeros(384) for _ in chunks]


# ─────────────────────────────────────────────────────────────────────────────
# _mark_failed
# ─────────────────────────────────────────────────────────────────────────────

class TestMarkFailed:
    def test_sets_status_failed(self):
        from ingestion.services.pipeline import _mark_failed
        doc = MagicMock()
        _mark_failed(doc, 'boom')
        assert doc.processing_status == 'failed'

    def test_stores_error_message(self):
        from ingestion.services.pipeline import _mark_failed
        doc = MagicMock()
        _mark_failed(doc, 'extraction error')
        assert doc.error_message == 'extraction error'

    def test_truncates_long_error_message(self):
        from ingestion.services.pipeline import _mark_failed
        doc = MagicMock()
        long_msg = 'x' * 3000
        _mark_failed(doc, long_msg)
        assert len(doc.error_message) <= 2000

    def test_saves_with_update_fields(self):
        from ingestion.services.pipeline import _mark_failed
        doc = MagicMock()
        _mark_failed(doc, 'error')
        doc.save.assert_called_once_with(update_fields=['processing_status', 'error_message'])

    def test_handles_none_error_message(self):
        from ingestion.services.pipeline import _mark_failed
        doc = MagicMock()
        _mark_failed(doc, None)
        assert doc.error_message == ''

    def test_does_not_raise_when_save_fails(self):
        from ingestion.services.pipeline import _mark_failed
        doc = MagicMock()
        doc.save.side_effect = Exception('DB offline')
        # Must not propagate
        _mark_failed(doc, 'err')


# ─────────────────────────────────────────────────────────────────────────────
# ingest_document
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestIngestDocument:
    def _make_doc(self):
        doc = MagicMock()
        doc.id = 'test-doc-id'
        doc.filename = 'test.pdf'
        doc.chunk_count = 0
        doc.processing_status = 'pending'
        return doc

    def _run_success(self, doc):
        from ingestion.services.pipeline import ingest_document

        chunks = ['chunk one', 'chunk two', 'chunk three']
        embeddings = _fake_embeddings(chunks)

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.Chunk') as MockChunk,
            patch('ingestion.services.pipeline.extract_text', return_value='raw text here'),
            patch('ingestion.services.pipeline.clean_text', return_value='cleaned text'),
            patch('ingestion.services.pipeline.chunk_text', return_value=chunks),
            patch('ingestion.services.pipeline.embed_chunks', return_value=embeddings),
            patch('ingestion.services.pipeline.count_tokens', return_value=10),
        ):
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'
            MockDoc.FORMAT_TXT = 'txt'
            MockChunk.objects.bulk_create.return_value = []

            file_obj = io.BytesIO(b'fake pdf content')
            result = ingest_document(file_obj, 'test.pdf', 'pdf')
        return result, doc

    def test_returns_document_on_success(self):
        doc = self._make_doc()
        result, _ = self._run_success(doc)
        assert result is doc

    def test_sets_completed_status_on_success(self):
        doc = self._make_doc()
        self._run_success(doc)
        assert doc.processing_status == 'completed'

    def test_creates_chunks_on_success(self):
        doc = self._make_doc()
        from ingestion.services.pipeline import ingest_document

        chunks = ['chunk a', 'chunk b']
        embeddings = _fake_embeddings(chunks)

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.Chunk') as MockChunk,
            patch('ingestion.services.pipeline.extract_text', return_value='text'),
            patch('ingestion.services.pipeline.clean_text', return_value='cleaned'),
            patch('ingestion.services.pipeline.chunk_text', return_value=chunks),
            patch('ingestion.services.pipeline.embed_chunks', return_value=embeddings),
            patch('ingestion.services.pipeline.count_tokens', return_value=5),
        ):
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'
            bulk_mock = MagicMock(return_value=[])
            MockChunk.objects.bulk_create = bulk_mock

            file_obj = io.BytesIO(b'pdf')
            ingest_document(file_obj, 'test.pdf', 'pdf')

        bulk_mock.assert_called_once()
        created_chunks = bulk_mock.call_args[0][0]
        assert len(created_chunks) == 2

    def test_marks_failed_on_extraction_error(self):
        from ingestion.services.pipeline import ingest_document
        from ingestion.services.extractor import ExtractionError

        doc = self._make_doc()

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.extract_text', side_effect=ExtractionError('no text')),
        ):
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'

            with pytest.raises(ExtractionError):
                ingest_document(io.BytesIO(b''), 'empty.pdf', 'pdf')

        assert doc.processing_status == 'failed'

    def test_marks_failed_on_embedding_error(self):
        from ingestion.services.pipeline import ingest_document, IngestionError
        from ingestion.services.embedder import EmbeddingError

        doc = self._make_doc()

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.extract_text', return_value='text'),
            patch('ingestion.services.pipeline.clean_text', return_value='cleaned'),
            patch('ingestion.services.pipeline.chunk_text', return_value=['chunk']),
            patch('ingestion.services.pipeline.embed_chunks', side_effect=EmbeddingError('model failed')),
        ):
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'

            with pytest.raises(IngestionError):
                ingest_document(io.BytesIO(b''), 'test.pdf', 'pdf')

        assert doc.processing_status == 'failed'

    def test_marks_failed_when_no_chunks_extracted(self):
        from ingestion.services.pipeline import ingest_document
        from ingestion.services.extractor import ExtractionError

        doc = self._make_doc()

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.extract_text', return_value='some text'),
            patch('ingestion.services.pipeline.clean_text', return_value='cleaned'),
            patch('ingestion.services.pipeline.chunk_text', return_value=[]),
        ):
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'

            with pytest.raises(ExtractionError):
                ingest_document(io.BytesIO(b''), 'test.pdf', 'pdf')

        assert doc.processing_status == 'failed'


# ─────────────────────────────────────────────────────────────────────────────
# ingest_text_document
# ─────────────────────────────────────────────────────────────────────────────

class TestIngestTextDocument:
    def test_creates_document_with_correct_filename(self):
        from ingestion.services.pipeline import ingest_text_document

        doc = MagicMock()
        doc.id = 'text-doc'
        doc.chunk_count = 0

        chunks = ['para one', 'para two']
        embeddings = _fake_embeddings(chunks)

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.Chunk') as MockChunk,
            patch('ingestion.services.pipeline.transaction') as mock_txn,
            patch('ingestion.services.pipeline.clean_text', return_value='cleaned'),
            patch('ingestion.services.pipeline.chunk_text', return_value=chunks),
            patch('ingestion.services.pipeline.embed_chunks', return_value=embeddings),
            patch('ingestion.services.pipeline.count_tokens', return_value=8),
        ):
            mock_txn.atomic.return_value.__enter__ = MagicMock(return_value=None)
            mock_txn.atomic.return_value.__exit__ = MagicMock(return_value=False)
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'
            MockDoc.FORMAT_TXT = 'txt'
            MockChunk.objects.bulk_create.return_value = []

            result = ingest_text_document('raw text content', 'My Report', project=None)

        assert result is doc
        create_kwargs = MockDoc.objects.create.call_args[1]
        assert create_kwargs['filename'] == 'My Report'

    def test_uses_clean_web_text_for_web_source(self):
        from ingestion.services.pipeline import ingest_text_document

        doc = MagicMock()
        doc.id = 'web-doc'
        doc.chunk_count = 0

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.Chunk') as MockChunk,
            patch('ingestion.services.pipeline.transaction') as mock_txn,
            patch('ingestion.services.pipeline.clean_web_text', return_value='cleaned web') as mock_web_clean,
            patch('ingestion.services.pipeline.clean_text') as mock_clean,
            patch('ingestion.services.pipeline.chunk_text', return_value=['chunk']),
            patch('ingestion.services.pipeline.embed_chunks', return_value=_fake_embeddings(['chunk'])),
            patch('ingestion.services.pipeline.count_tokens', return_value=5),
        ):
            mock_txn.atomic.return_value.__enter__ = MagicMock(return_value=None)
            mock_txn.atomic.return_value.__exit__ = MagicMock(return_value=False)
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'
            MockDoc.FORMAT_TXT = 'txt'
            MockChunk.objects.bulk_create.return_value = []

            ingest_text_document('raw web html', 'web-source.txt', is_web_source=True)

        mock_web_clean.assert_called_once_with('raw web html')
        mock_clean.assert_not_called()

    def test_marks_failed_and_raises_when_no_chunks(self):
        from ingestion.services.pipeline import ingest_text_document
        from ingestion.services.extractor import ExtractionError

        doc = MagicMock()

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.clean_text', return_value=''),
            patch('ingestion.services.pipeline.chunk_text', return_value=[]),
        ):
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'
            MockDoc.FORMAT_TXT = 'txt'

            with pytest.raises(ExtractionError):
                ingest_text_document('', 'blank.txt')

        assert doc.processing_status == 'failed'

    def test_defaults_filename_when_empty(self):
        from ingestion.services.pipeline import ingest_text_document

        doc = MagicMock()
        doc.id = 'fallback-doc'
        doc.chunk_count = 0

        with (
            patch('ingestion.services.pipeline.Document') as MockDoc,
            patch('ingestion.services.pipeline.Chunk') as MockChunk,
            patch('ingestion.services.pipeline.transaction') as mock_txn,
            patch('ingestion.services.pipeline.clean_text', return_value='text'),
            patch('ingestion.services.pipeline.chunk_text', return_value=['c']),
            patch('ingestion.services.pipeline.embed_chunks', return_value=_fake_embeddings(['c'])),
            patch('ingestion.services.pipeline.count_tokens', return_value=1),
        ):
            mock_txn.atomic.return_value.__enter__ = MagicMock(return_value=None)
            mock_txn.atomic.return_value.__exit__ = MagicMock(return_value=False)
            MockDoc.objects.create.return_value = doc
            MockDoc.STATUS_PENDING = 'pending'
            MockDoc.STATUS_COMPLETED = 'completed'
            MockDoc.STATUS_FAILED = 'failed'
            MockDoc.FORMAT_TXT = 'txt'
            MockChunk.objects.bulk_create.return_value = []

            ingest_text_document('some text', '')

        create_kwargs = MockDoc.objects.create.call_args[1]
        assert create_kwargs['filename'] == 'web-source.txt'
