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
    workflow_step = models.IntegerField(default=1)
    stakeholder_table_stale = models.BooleanField(default=False)
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

    @staticmethod
    def derive_next_step(steps: list[dict]) -> dict | None:
        """Return the first incomplete step payload, or None when all are complete."""
        for step in steps:
            if not step.get('complete', False):
                return {
                    'number': step.get('number'),
                    'label': step.get('label'),
                    'url': step.get('url'),
                    'description': step.get('description', ''),
                }
        return None

    def get_workflow_status(self) -> dict:
        """Compute current workflow step and return full step status array."""
        steps_config = [
            {
                'number': 1,
                'label': 'Define initiative',
                'url': f'/projects/{self.id}/intake',
                'description': 'Fill in the initiative profile and objectives',
            },
            {
                'number': 2,
                'label': 'Upload documents',
                'url': f'/projects/{self.id}/documents',
                'description': 'Upload and process source documents for analysis',
            },
            {
                'number': 3,
                'label': 'Run extraction',
                'url': f'/projects/{self.id}/analyze',
                'description': 'Extract entities and relationships from documents',
            },
            {
                'number': 4,
                'label': 'Review graph',
                'url': f'/projects/{self.id}/map',
                'description': 'Review and refine the extracted knowledge graph',
            },
            {
                'number': 5,
                'label': 'Generate report',
                'url': f'/projects/{self.id}/report',
                'description': 'Generate the stakeholder analysis report sections',
            },
            {
                'number': 6,
                'label': 'Stakeholder table',
                'url': f'/projects/{self.id}/stakeholders',
                'description': 'Generate and review the stakeholder priority table',
            },
            {
                'number': 7,
                'label': 'Export',
                'url': f'/projects/{self.id}/report?tab=export',
                'description': 'Export the completed report as PDF or Word document',
            },
        ]

        # Compute completion for each step
        try:
            profile = self.initiative_profile
            step1_complete = bool(profile.initiative_name and profile.initiative_name.strip())
        except Exception:
            step1_complete = False

        from ingestion.models import Document
        step2_complete = Document.objects.filter(
            project=self,
            processing_status=Document.STATUS_COMPLETED,
        ).exists()

        # Steps 3 and 4: any entity extracted via NERRun for this project
        from ner.models import NERRun
        has_entities = NERRun.objects.filter(
            document_id__project=self,
            status='completed',
        ).exists()
        step3_complete = has_entities
        step4_complete = has_entities

        # Step 5: any ReportSection with status='done'
        from ner.models import ReportSection
        step5_complete = ReportSection.objects.filter(
            project=self, status=ReportSection.STATUS_DONE
        ).exists()

        # Step 6: any EngagementNote exists (proxy for priority table generated)
        from ner.models import EngagementNote
        step6_complete = EngagementNote.objects.filter(project=self).exists()

        # Step 7: always False (no persistent export record in MVP)
        step7_complete = False

        completions = [
            step1_complete, step2_complete, step3_complete,
            step4_complete, step5_complete, step6_complete, step7_complete,
        ]

        steps = []
        current_step = 7  # default to last if all complete
        for i, config in enumerate(steps_config):
            complete = completions[i]
            steps.append({
                'number': config['number'],
                'label': config['label'],
                'complete': complete,
                'url': config['url'],
                'description': config['description'],
            })
            if not complete and current_step == 7:
                current_step = config['number']

        return {
            'current_step': current_step,
            'steps': steps,
            'next_step': self.derive_next_step(steps),
        }


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


class InitiativeProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='initiative_profile')
    initiative_name = models.CharField(max_length=255, blank=True, default='')
    host_organization = models.CharField(max_length=255, blank=True, default='')
    country = models.CharField(max_length=255, blank=True, default='')
    geography = models.CharField(max_length=255, blank=True, default='')
    thematic_area = models.CharField(max_length=255, blank=True, default='')
    core_objectives = models.TextField(blank=True, default='')
    expected_outcomes = models.TextField(blank=True, default='')
    target_beneficiaries = models.TextField(blank=True, default='')
    success_metrics = models.TextField(blank=True, default='')
    stakeholder_focus = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'initiative_profiles'

    def __str__(self):
        return f"InitiativeProfile<{self.project_id}>"

    def to_context_string(self) -> str:
        fields = [
            ('Initiative Name', self.initiative_name),
            ('Host Organization', self.host_organization),
            ('Country', self.country),
            ('Geography', self.geography),
            ('Thematic Area', self.thematic_area),
            ('Core Objectives', self.core_objectives),
            ('Expected Outcomes', self.expected_outcomes),
            ('Target Beneficiaries', self.target_beneficiaries),
            ('Success Metrics', self.success_metrics),
            ('Stakeholder Focus', self.stakeholder_focus),
        ]
        lines = [f"{label}: {value.strip()}" for label, value in fields if (value or '').strip()]
        return '\n'.join(lines)


class ExtractionGuidance(models.Model):
    SOURCE_MANUAL = 'manual'
    SOURCE_AUTO = 'auto'
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_AUTO, 'Auto'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='extraction_guidance_items')
    text = models.TextField()
    order = models.PositiveIntegerField(default=0)
    enabled = models.BooleanField(default=True)
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'extraction_guidance'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"ExtractionGuidance<{self.project_id}:{self.order}>"


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


class WebSource(models.Model):
    SOURCE_URL = 'url'
    SOURCE_CRAWL = 'crawl'
    SOURCE_PASTE = 'paste'
    SOURCE_CHOICES = [
        (SOURCE_URL, 'URL'),
        (SOURCE_CRAWL, 'Crawl'),
        (SOURCE_PASTE, 'Paste'),
    ]

    STATUS_QUEUED = 'queued'
    STATUS_PROCESSING = 'processing'
    STATUS_PROCESSED = 'processed'
    STATUS_ERROR = 'error'
    STATUS_CHOICES = [
        (STATUS_QUEUED, 'Queued'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_PROCESSED, 'Processed'),
        (STATUS_ERROR, 'Error'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='web_sources')
    source_type = models.CharField(max_length=16, choices=SOURCE_CHOICES)
    url = models.TextField(blank=True, default='')
    crawl_depth = models.PositiveSmallIntegerField(default=1)
    raw_text = models.TextField(blank=True, default='')
    title = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    page_count = models.PositiveIntegerField(default=0)
    character_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True, default='')
    document = models.ForeignKey(
        Document,
        on_delete=models.SET_NULL,
        related_name='web_sources',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ingestion_web_sources'
        indexes = [
            models.Index(fields=['project', 'status', 'updated_at']),
            models.Index(fields=['source_type', 'status']),
        ]

    def __str__(self):
        label = self.title or self.url or str(self.id)
        return f"WebSource<{self.source_type}:{label}>"


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
