"""Database models for the document ingestion pipeline."""
import uuid
from django.db import models
from django.conf import settings
from pgvector.django import VectorField


class Project(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_ARCHIVED = 'archived'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_ARCHIVED, 'Archived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    provider = models.CharField(max_length=32, blank=True, default='')
    model = models.CharField(max_length=64, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'projects'
        indexes = [
            models.Index(fields=['status', 'updated_at']),
            models.Index(fields=['owner', 'updated_at']),
        ]

    def __str__(self):
        return f"{self.name} [{self.status}]"


class ConceptNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='concept_note')
    content = models.TextField(blank=True, default='')
    attachment = models.FileField(upload_to='concept_notes/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'concept_notes'

    def __str__(self):
        return f"ConceptNote<{self.project_id}>"


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
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        related_name='documents',
        null=True,
        blank=True,
    )
    upload_timestamp = models.DateTimeField(auto_now_add=True)
    processing_status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    # Set after successful completion; NULL while pending or failed.
    chunk_count = models.IntegerField(null=True, blank=True)
    # Populated when processing_status='failed'
    error_message = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'ingestion_documents'

    def __str__(self):
        return f"{self.filename} [{self.processing_status}]"


def get_or_create_default_project(owner=None) -> Project:
    defaults = {
        'description': 'Auto-created default project for legacy migrated records.',
        'status': Project.STATUS_ACTIVE,
    }
    if owner is not None:
        defaults['owner'] = owner

    lookup = {'name': 'Default Project'}
    if owner is not None:
        lookup['owner'] = owner

    project, _ = Project.objects.get_or_create(
        defaults=defaults,
        **lookup,
    )
    return project


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
