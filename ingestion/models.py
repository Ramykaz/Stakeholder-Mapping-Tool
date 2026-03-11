"""Database models for the document ingestion pipeline."""
import uuid
from django.db import models
from pgvector.django import VectorField


class Document(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    FORMAT_PDF = 'pdf'
    FORMAT_DOCX = 'docx'
    FORMAT_TXT = 'txt'
    FORMAT_CHOICES = [
        (FORMAT_PDF, 'PDF'),
        (FORMAT_DOCX, 'DOCX'),
        (FORMAT_TXT, 'TXT'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    filename = models.CharField(max_length=255)
    file_format = models.CharField(max_length=10, choices=FORMAT_CHOICES)
    upload_timestamp = models.DateTimeField(auto_now_add=True)
    processing_status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    # Set after successful completion; NULL while pending or failed.
    chunk_count = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'ingestion_documents'

    def __str__(self):
        return f"{self.filename} [{self.processing_status}]"


class Chunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name='chunks'
    )
    text = models.TextField()
    embedding = VectorField(dimensions=384)
    # 0-based position within the source document.
    chunk_index = models.IntegerField()
    # Verified pre-embedding; must be between 1 and 256.
    token_count = models.IntegerField()

    class Meta:
        db_table = 'ingestion_chunks'
        unique_together = [('document', 'chunk_index')]

    def __str__(self):
        return f"Chunk {self.chunk_index} of document {self.document_id}"
