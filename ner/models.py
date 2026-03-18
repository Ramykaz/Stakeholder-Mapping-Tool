"""Entity models for NER pipeline."""

from decimal import Decimal
from uuid import uuid4
from django.conf import settings
from django.db import models
from django.db.models import F
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models.functions import Lower
from ingestion.models import Document, Chunk, Project


class NERRun(models.Model):
    """One extraction run for a document with provider/model usage metadata."""

    STATUS_PENDING = 'pending'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    document_id = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='ner_runs',
    )
    provider = models.CharField(max_length=32, db_index=True)
    model = models.CharField(max_length=64, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    tokens_input = models.IntegerField(default=0)
    tokens_output = models.IntegerField(default=0)
    tokens_cached = models.IntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=12, decimal_places=6, default=Decimal('0.000000'))
    duration_seconds = models.FloatField(null=True, blank=True)
    relations_created = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ner_run'
        indexes = [
            models.Index(fields=['document_id', 'created_at']),
            models.Index(fields=['provider', 'model']),
        ]

    def __str__(self):
        return f"{self.provider}:{self.model} run {self.id}"


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
    normalized_name = models.CharField(
        max_length=255,
        default='',
        db_index=True,
    )
    raw_mentions = models.JSONField(default=list)  # List of surface forms from text
    confidence = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        db_index=True,
    )
    needs_review = models.BooleanField(default=False, db_index=True)
    mention_count_dedup = models.PositiveIntegerField(default=0)
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
    run = models.ForeignKey(
        NERRun,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='entities',
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='entities',
    )
    parent_entity = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='phase_variants',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('canonical_name', 'document_id', 'entity_type', 'run')]
        db_table = 'ner_entity'
        indexes = [
            models.Index(fields=['document_id', 'entity_type']),
            models.Index(fields=['document_id', 'confidence']),
            models.Index(fields=['run', 'entity_type']),
        ]

    def __str__(self):
        return f"{self.canonical_name} ({self.entity_type})"


class Relation(models.Model):
    """Directional, labeled relationship between two named entities."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    document_id = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='relations',
    )
    run = models.ForeignKey(
        NERRun,
        on_delete=models.CASCADE,
        related_name='relations',
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='relations',
    )
    source_entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='outgoing_relations',
    )
    target_entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='incoming_relations',
    )
    label = models.CharField(max_length=100)
    confidence = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'relations'
        indexes = [
            models.Index(fields=['document_id'], name='relations_document_id_idx'),
            models.Index(fields=['source_entity'], name='relations_source_entity_idx'),
            models.Index(fields=['target_entity'], name='relations_target_entity_idx'),
            models.Index(fields=['run'], name='relations_run_id_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(source_entity=models.F('target_entity')),
                name='no_self_loops',
            ),
            models.UniqueConstraint(
                Lower('label'),
                F('document_id'),
                F('source_entity'),
                F('target_entity'),
                name='relations_dedup_label_ci_idx',
            ),
        ]

    def __str__(self):
        return f"{self.source_entity} → {self.label} → {self.target_entity}"


class ContextualEntitySummary(models.Model):
    """Cached project-scoped narrative summary for an entity."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='contextual_summaries',
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='entity_summaries',
    )
    summary_text = models.TextField()
    evidence_hash = models.CharField(max_length=128, blank=True, default='')
    generated_by_provider = models.CharField(max_length=64, blank=True, default='internal')
    generated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ner_contextual_entity_summary'
        constraints = [
            models.UniqueConstraint(
                fields=['entity', 'project'],
                name='ner_contextual_summary_entity_project_uniq',
            ),
        ]
        indexes = [
            models.Index(fields=['project', 'expires_at'], name='ner_ctx_summary_proj_exp_idx'),
        ]

    def __str__(self):
        return f"Summary<{self.entity_id}:{self.project_id}>"


class EntityLabel(models.Model):
    """Configurable entity taxonomy used for extraction and graph display."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=64)
    description = models.TextField(blank=True, default='')
    node_shape = models.CharField(max_length=32)
    color = models.CharField(max_length=32)
    active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ner_entity_label'
        indexes = [
            models.Index(fields=['active', 'display_order'], name='ner_entity__active_0cc10f_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower('name'),
                name='ner_entity_label_name_ci_uniq',
            ),
        ]

    def __str__(self):
        return self.name


class RelationshipType(models.Model):
    """Configurable relationship taxonomy used by joint extraction."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=64)
    description = models.TextField(blank=True, default='')
    directional = models.BooleanField(default=True)
    color = models.CharField(max_length=32)
    active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ner_relationship_type'
        indexes = [
            models.Index(fields=['active', 'display_order'], name='ner_relatio_active_c1ad63_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower('name'),
                name='ner_relationship_type_name_ci_uniq',
            ),
        ]

    def __str__(self):
        return self.name


class EntityAlias(models.Model):
    """Alias text forms that resolve to a canonical entity."""

    SOURCE_EXTRACTION = 'extraction'
    SOURCE_MANUAL = 'manual'
    SOURCE_ACRONYM = 'acronym'
    SOURCE_CHOICES = (
        (SOURCE_EXTRACTION, 'Extraction'),
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_ACRONYM, 'Acronym'),
    )

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='aliases',
    )
    alias_text = models.CharField(max_length=255)
    normalized_alias = models.CharField(max_length=255, db_index=True)
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default=SOURCE_EXTRACTION)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ner_entity_alias'
        constraints = [
            models.UniqueConstraint(
                fields=['entity', 'normalized_alias'],
                name='ner_entity_alias_unique_per_entity',
            ),
        ]

    def __str__(self):
        return f"{self.alias_text} -> {self.entity.canonical_name}"


class AcronymMap(models.Model):
    """DB-managed acronym expansion dictionary for entity normalization."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    acronym = models.CharField(max_length=64)
    expansion = models.CharField(max_length=255)
    active = models.BooleanField(default=True, db_index=True)
    priority = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ner_acronym_map'
        indexes = [
            models.Index(fields=['active', 'priority'], name='ner_acronym_act_pri_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower('acronym'),
                name='ner_acronym_map_acronym_ci_uniq',
            ),
        ]

    def __str__(self):
        return f"{self.acronym} -> {self.expansion}"


class EntityReviewCandidate(models.Model):
    """Pending or resolved review decisions for borderline dedup candidates."""

    STATUS_PENDING = 'pending'
    STATUS_MERGED = 'merged'
    STATUS_KEPT_SEPARATE = 'kept_separate'
    STATUS_RESOLVED_STALE = 'resolved_stale'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_MERGED, 'Merged'),
        (STATUS_KEPT_SEPARATE, 'Kept Separate'),
        (STATUS_RESOLVED_STALE, 'Resolved Stale'),
    )

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='entity_review_candidates',
    )
    left_entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='left_review_candidates',
    )
    right_entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='right_review_candidates',
    )
    entity_type = models.CharField(max_length=20, db_index=True)
    similarity_score = models.FloatField(validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_entity_review_candidates',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ner_entity_review_candidate'
        indexes = [
            models.Index(fields=['document', 'status'], name='ner_review_doc_status_idx'),
            models.Index(fields=['entity_type', 'status'], name='ner_review_type_status_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(left_entity=models.F('right_entity')),
                name='ner_review_no_self_pair',
            ),
            models.UniqueConstraint(
                fields=['document', 'left_entity', 'right_entity', 'status'],
                name='ner_review_unique_pair_status',
            ),
        ]

    def __str__(self):
        return f"{self.left_entity_id}:{self.right_entity_id} ({self.status})"
