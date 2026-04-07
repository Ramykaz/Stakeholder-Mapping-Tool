"""
Ingestion pipeline orchestrator.

Coordinates: extract → chunk → embed → atomic DB write.
Document record persists on failure (status='failed'); Chunk records do not.
"""
import logging
import time
from django.db import transaction

from ingestion.models import Document, Chunk
from ingestion.services.extractor import extract_text, ExtractionError
from ingestion.services.chunker import chunk_text, count_tokens
from ingestion.services.embedder import embed_chunks, EmbeddingError

logger = logging.getLogger(__name__)


class IngestionError(Exception):
    """Raised when the ingestion pipeline fails after extraction."""


def ingest_text_document(text: str, title: str, project=None) -> Document:
    """Ingest already-extracted text through chunk/embed/storage pipeline."""
    document = Document.objects.create(
        filename=(title or 'web-source.txt')[:255],
        file_format=Document.FORMAT_TXT,
        project=project,
        processing_status=Document.STATUS_PENDING,
    )
    logger.info("[INGEST] START text document=%s filename=%s", document.id, document.filename)

    try:
        chunks_text = chunk_text(text or '')
        if not chunks_text:
            raise ExtractionError("No extractable text found in the web source.")

        try:
            embeddings = embed_chunks(chunks_text)
        except EmbeddingError as exc:
            raise IngestionError(f"Embedding generation failed: {exc}") from exc

        with transaction.atomic():
            chunk_objects = [
                Chunk(
                    document=document,
                    text=chunks_text[i],
                    embedding=embeddings[i].tolist(),
                    chunk_index=i,
                    token_count=count_tokens(chunks_text[i]),
                )
                for i in range(len(chunks_text))
            ]
            Chunk.objects.bulk_create(chunk_objects)

            document.processing_status = Document.STATUS_COMPLETED
            document.chunk_count = len(chunk_objects)
            document.save(update_fields=['processing_status', 'chunk_count'])
    except ExtractionError as exc:
        _mark_failed(document, str(exc))
        raise
    except IngestionError as exc:
        _mark_failed(document, str(exc))
        raise
    except Exception as exc:
        _mark_failed(document, str(exc))
        raise IngestionError(f"Unexpected ingestion error: {exc}") from exc

    return document


def ingest_document(file_obj, filename: str, file_format: str, project=None) -> Document:
    """
    Run the full ingestion pipeline for an uploaded file.

    Creates a Document record immediately (status=pending), then:
    1. Extracts text from the file.
    2. Chunks the text into semantic segments.
    3. Embeds each chunk using the loaded model.
    4. Atomically writes all Chunk records and updates Document to 'completed'.

    On any failure after Document creation, the Document is updated to
    'failed' and no Chunk records are persisted (transaction rollback).

    Args:
        file_obj: File-like object to read from.
        filename: Original filename (stored as-is).
        file_format: One of 'pdf', 'docx', 'txt'.

    Returns:
        The completed Document instance.

    Raises:
        ExtractionError: If no text can be extracted (re-raised; caller handles as 422).
        IngestionError: If chunking, embedding, or storage fails (caller handles as 500).
    """
    # Create the Document record upfront so we can record failure status.
    document = Document.objects.create(
        filename=filename,
        file_format=file_format,
        project=project,
        processing_status=Document.STATUS_PENDING,
    )
    logger.info("[INGEST] START  document=%s filename=%s", document.id, filename)
    _t_ingest_start = time.perf_counter()

    try:
        # Step 1: Extract text (may raise ExtractionError).
        _t0 = time.perf_counter()
        text = extract_text(file_obj, file_format)
        logger.info("[INGEST] step=extract_text  chars=%d  duration=%.2fs", len(text), time.perf_counter() - _t0)

        # Step 2: Chunk the text.
        _t0 = time.perf_counter()
        chunks_text = chunk_text(text)
        if not chunks_text:
            raise ExtractionError(
                "No extractable text found in the uploaded document."
            )
        logger.info("[INGEST] step=chunk_text  chunks=%d  duration=%.2fs", len(chunks_text), time.perf_counter() - _t0)

        # Step 3: Embed all chunks.
        _t0 = time.perf_counter()
        try:
            embeddings = embed_chunks(chunks_text)
        except EmbeddingError as exc:
            raise IngestionError(f"Embedding generation failed: {exc}") from exc
        logger.info("[INGEST] step=embed_chunks  chunks=%d  duration=%.2fs", len(chunks_text), time.perf_counter() - _t0)

        # Step 4: Atomic storage — all chunks or none.
        _t0 = time.perf_counter()
        try:
            with transaction.atomic():
                chunk_objects = [
                    Chunk(
                        document=document,
                        text=chunks_text[i],
                        embedding=embeddings[i].tolist(),
                        chunk_index=i,
                        token_count=count_tokens(chunks_text[i]),
                    )
                    for i in range(len(chunks_text))
                ]
                Chunk.objects.bulk_create(chunk_objects)

                document.processing_status = Document.STATUS_COMPLETED
                document.chunk_count = len(chunk_objects)
                document.save(update_fields=['processing_status', 'chunk_count'])

        except Exception as exc:
            raise IngestionError(f"Storage failed: {exc}") from exc
        logger.info("[INGEST] step=db_write  chunks=%d  duration=%.2fs", len(chunks_text), time.perf_counter() - _t0)

    except ExtractionError as exc:
        _mark_failed(document, str(exc))
        raise  # Re-raised as-is so the view can return 422.

    except IngestionError as exc:
        _mark_failed(document, str(exc))
        raise  # Re-raised as-is so the view can return 500.

    except Exception as exc:
        _mark_failed(document, str(exc))
        raise IngestionError(f"Unexpected ingestion error: {exc}") from exc

    logger.info(
        "[INGEST] DONE  document=%s  chunks=%d  total=%.2fs",
        document.id, document.chunk_count, time.perf_counter() - _t_ingest_start,
    )
    return document


def _mark_failed(document: Document, error_message: str = '') -> None:
    """Best-effort: update Document status to failed outside any transaction."""
    try:
        document.processing_status = Document.STATUS_FAILED
        document.error_message = error_message[:2000] if error_message else ''
        document.save(update_fields=['processing_status', 'error_message'])
    except Exception as exc:
        logger.error("Failed to update document %s status to 'failed': %s", document.id, exc)


