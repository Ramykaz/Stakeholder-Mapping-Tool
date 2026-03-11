"""Entity models for NER pipeline."""

from uuid import uuid4
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from ingestion.models import Document, Chunk


class Entity(models.Model):
    """Named entity extracted from document chunks."""

    ENTITY_TYPES = (
        ('PERSON', 'Person'),
        ('ORGANIZATION', 'Organization'),
        ('LOCATION', 'Location'),
        ('ROLE', 'Role'),
    )

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    entity_type = models.CharField(
        max_length=20,
        choices=ENTITY_TYPES,
        db_index=True,
    )
    canonical_name = models.CharField(
        max_length=255,
        db_index=True,
    )
    raw_mentions = models.JSONField(default=list)  # List of surface forms from text
    confidence = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        db_index=True,
    )
    document_id = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='entities',
    )
    chunk_id = models.ForeignKey(
        Chunk,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='entities',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('canonical_name', 'document_id', 'entity_type')]
        db_table = 'ner_entity'
        indexes = [
            models.Index(fields=['document_id', 'entity_type']),
            models.Index(fields=['document_id', 'confidence']),
        ]

    def __str__(self):
        return f"{self.canonical_name} ({self.entity_type})"
