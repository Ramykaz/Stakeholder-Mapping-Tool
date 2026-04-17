"""Unit/integration tests for ingestion.services.pipeline."""

import numpy as np
from unittest.mock import MagicMock, patch
from django.test import TestCase
from django.contrib.auth import get_user_model

from ingestion.models import Document, Project
from ingestion.services.pipeline import (
    ingest_document,
    ingest_text_document,
    _mark_failed,
    IngestionError,
)
from ingestion.services.extractor import ExtractionError
from ingestion.services.embedder import EmbeddingError

User = get_user_model()


def _make_embeddings(n: int, dims: int = 384):
    """Return a 2-D numpy array (n, dims) suitable as embed_chunks return value."""
    return np.zeros((n, dims), dtype='float32')


class TestIngestDocument(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('pipeline_user', 'pipe@example.com', 'Password123')
        self.project = Project.objects.create(name='Pipeline Project', owner=self.user)

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    @patch('ingestion.services.pipeline.extract_text')
    def test_happy_path_creates_document_and_chunks(self, mock_extract, mock_chunk, mock_embed):
        mock_extract.return_value = 'Raw text content from PDF.'
        mock_chunk.return_value = ['chunk one', 'chunk two']
        mock_embed.return_value = _make_embeddings(2)

        doc = ingest_document(
            file_obj=MagicMock(),
            filename='test.pdf',
            file_format='pdf',
            project=self.project,
        )

        assert doc.processing_status == Document.STATUS_COMPLETED
        assert doc.chunk_count == 2
        assert doc.filename == 'test.pdf'
        assert doc.project == self.project
        assert doc.chunks.count() == 2

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    @patch('ingestion.services.pipeline.extract_text')
    def test_document_persisted_before_pipeline_runs(self, mock_extract, mock_chunk, mock_embed):
        """Document record is created (status=pending) even if pipeline later fails."""
        mock_extract.side_effect = ExtractionError('No text found')
        mock_chunk.return_value = []
        mock_embed.return_value = _make_embeddings(0)

        with self.assertRaises(ExtractionError):
            ingest_document(
                file_obj=MagicMock(),
                filename='empty.pdf',
                file_format='pdf',
            )

        # Document should exist in DB, marked failed
        doc = Document.objects.filter(filename='empty.pdf').first()
        assert doc is not None
        assert doc.processing_status == Document.STATUS_FAILED

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    @patch('ingestion.services.pipeline.extract_text')
    def test_extraction_error_marks_document_failed_and_reraises(self, mock_extract, mock_chunk, mock_embed):
        mock_extract.side_effect = ExtractionError('Could not parse PDF')

        with self.assertRaises(ExtractionError):
            ingest_document(file_obj=MagicMock(), filename='bad.pdf', file_format='pdf')

        doc = Document.objects.filter(filename='bad.pdf').first()
        assert doc.processing_status == Document.STATUS_FAILED
        assert 'Could not parse PDF' in doc.error_message

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    @patch('ingestion.services.pipeline.extract_text')
    def test_empty_chunks_raises_extraction_error(self, mock_extract, mock_chunk, mock_embed):
        mock_extract.return_value = 'Some raw text'
        mock_chunk.return_value = []

        with self.assertRaises(ExtractionError, msg='No extractable text'):
            ingest_document(file_obj=MagicMock(), filename='empty_chunks.pdf', file_format='pdf')

        doc = Document.objects.filter(filename='empty_chunks.pdf').first()
        assert doc.processing_status == Document.STATUS_FAILED

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    @patch('ingestion.services.pipeline.extract_text')
    def test_embedding_error_wrapped_as_ingestion_error(self, mock_extract, mock_chunk, mock_embed):
        mock_extract.return_value = 'Some text'
        mock_chunk.return_value = ['chunk one']
        mock_embed.side_effect = EmbeddingError('model not loaded')

        with self.assertRaises(IngestionError):
            ingest_document(file_obj=MagicMock(), filename='embed_fail.pdf', file_format='pdf')

        doc = Document.objects.filter(filename='embed_fail.pdf').first()
        assert doc.processing_status == Document.STATUS_FAILED
        assert 'Embedding generation failed' in doc.error_message

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    @patch('ingestion.services.pipeline.extract_text')
    def test_ingestion_error_marks_failed_and_reraises(self, mock_extract, mock_chunk, mock_embed):
        mock_extract.return_value = 'Some text'
        mock_chunk.return_value = ['chunk one']
        mock_embed.side_effect = EmbeddingError('embed error')

        with self.assertRaises(IngestionError):
            ingest_document(file_obj=MagicMock(), filename='ing_err.pdf', file_format='pdf')

        doc = Document.objects.filter(filename='ing_err.pdf').first()
        assert doc.processing_status == Document.STATUS_FAILED

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    @patch('ingestion.services.pipeline.extract_text')
    def test_no_chunks_stored_on_failure(self, mock_extract, mock_chunk, mock_embed):
        """Transaction rollback: no chunks in DB when pipeline fails after chunking."""
        mock_extract.return_value = 'text'
        mock_chunk.return_value = ['chunk one']
        mock_embed.side_effect = EmbeddingError('fail')

        with self.assertRaises(IngestionError):
            ingest_document(file_obj=MagicMock(), filename='no_chunks.pdf', file_format='pdf')

        doc = Document.objects.filter(filename='no_chunks.pdf').first()
        assert doc.chunks.count() == 0


class TestIngestTextDocument(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('text_pipeline_user', 'txpipe@example.com', 'Pass123')
        self.project = Project.objects.create(name='Text Pipeline Project', owner=self.user)

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    def test_happy_path(self, mock_chunk, mock_embed):
        mock_chunk.return_value = ['chunk a', 'chunk b', 'chunk c']
        mock_embed.return_value = _make_embeddings(3)

        doc = ingest_text_document(
            text='Full text of a web article.',
            title='Web Article',
            project=self.project,
        )

        assert doc.processing_status == Document.STATUS_COMPLETED
        assert doc.chunk_count == 3
        assert doc.filename == 'Web Article'
        assert doc.chunks.count() == 3

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    def test_empty_chunks_raises_extraction_error(self, mock_chunk, mock_embed):
        mock_chunk.return_value = []

        with self.assertRaises(ExtractionError):
            ingest_text_document(text='Some text', title='Article')

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    def test_embedding_error_wrapped_as_ingestion_error(self, mock_chunk, mock_embed):
        mock_chunk.return_value = ['chunk']
        mock_embed.side_effect = EmbeddingError('model not loaded')

        with self.assertRaises(IngestionError):
            ingest_text_document(text='Some text', title='Article')

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    def test_title_truncated_at_255(self, mock_chunk, mock_embed):
        mock_chunk.return_value = ['chunk']
        mock_embed.return_value = _make_embeddings(1)

        long_title = 'A' * 300
        doc = ingest_text_document(text='text', title=long_title)

        assert len(doc.filename) <= 255

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    def test_empty_title_defaults_to_web_source(self, mock_chunk, mock_embed):
        mock_chunk.return_value = ['chunk']
        mock_embed.return_value = _make_embeddings(1)

        doc = ingest_text_document(text='text', title='')
        assert doc.filename == 'web-source.txt'

    @patch('ingestion.services.pipeline.embed_chunks')
    @patch('ingestion.services.pipeline.chunk_text')
    def test_is_web_source_flag_uses_clean_web_text(self, mock_chunk, mock_embed):
        """is_web_source=True must call clean_web_text instead of clean_text."""
        mock_chunk.return_value = ['chunk']
        mock_embed.return_value = _make_embeddings(1)

        with patch('ingestion.services.pipeline.clean_web_text') as mock_web_clean, \
             patch('ingestion.services.pipeline.clean_text') as mock_clean:
            mock_web_clean.return_value = 'cleaned web text'
            ingest_text_document(text='raw', title='Web', is_web_source=True)

        mock_web_clean.assert_called_once()
        mock_clean.assert_not_called()


class TestMarkFailed(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('mark_fail_user', 'mf@example.com', 'Pass123')

    def test_sets_status_to_failed(self):
        doc = Document.objects.create(
            filename='doc.pdf',
            file_format='pdf',
            processing_status=Document.STATUS_PENDING,
        )
        _mark_failed(doc, 'something went wrong')
        doc.refresh_from_db()
        assert doc.processing_status == Document.STATUS_FAILED
        assert doc.error_message == 'something went wrong'

    def test_truncates_long_error_message(self):
        doc = Document.objects.create(
            filename='long_err.pdf',
            file_format='pdf',
            processing_status=Document.STATUS_PENDING,
        )
        long_msg = 'X' * 3000
        _mark_failed(doc, long_msg)
        doc.refresh_from_db()
        assert len(doc.error_message) <= 2000

    def test_empty_error_message(self):
        doc = Document.objects.create(
            filename='no_msg.pdf',
            file_format='pdf',
            processing_status=Document.STATUS_PENDING,
        )
        _mark_failed(doc)
        doc.refresh_from_db()
        assert doc.processing_status == Document.STATUS_FAILED
        assert doc.error_message == ''

    def test_does_not_raise_on_db_error(self):
        """_mark_failed swallows DB errors (best-effort)."""
        doc = Document.objects.create(
            filename='swallow.pdf',
            file_format='pdf',
            processing_status=Document.STATUS_PENDING,
        )
        with patch.object(doc, 'save', side_effect=Exception('DB connection lost')):
            # Should not raise — best-effort
            _mark_failed(doc, 'some error')
