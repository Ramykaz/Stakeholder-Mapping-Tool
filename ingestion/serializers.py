"""DRF serializers for the ingestion app."""
import unicodedata

from rest_framework import serializers
from ingestion.models import Document, Project, ConceptNote, InitiativeProfile, ExtractionGuidance, WebSource


class ProjectSummarySerializer(serializers.ModelSerializer):
    document_count = serializers.IntegerField(read_only=True)
    entity_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Project
        fields = [
            'id',
            'name',
            'description',
            'status',
            'provider',
            'model',
            'document_count',
            'entity_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'document_count', 'entity_count', 'created_at', 'updated_at']


class ProjectWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['name', 'description', 'status', 'provider', 'model']

    def validate_provider(self, value):
        if not value:
            return value
        allowed = {'groq', 'openai', 'azure_openai', 'gemini'}
        if value.strip().lower() not in allowed:
            raise serializers.ValidationError(f"provider must be one of: {', '.join(sorted(allowed))}")
        return value.strip().lower()


class ConceptNoteSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(source='project.id', read_only=True)
    attachment_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ConceptNote
        fields = ['project_id', 'content', 'attachment', 'attachment_url', 'updated_at']
        read_only_fields = ['project_id', 'attachment_url', 'updated_at']

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get('request')
        url = obj.attachment.url
        return request.build_absolute_uri(url) if request else url


class InitiativeProfileSerializer(serializers.ModelSerializer):
    project = serializers.UUIDField(source='project.id', read_only=True)

    class Meta:
        model = InitiativeProfile
        fields = [
            'id',
            'project',
            'initiative_name',
            'host_organization',
            'country',
            'geography',
            'thematic_area',
            'core_objectives',
            'expected_outcomes',
            'target_beneficiaries',
            'success_metrics',
            'stakeholder_focus',
            'updated_at',
        ]
        read_only_fields = ['id', 'project', 'updated_at']


class ExtractionGuidanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractionGuidance
        fields = ['id', 'text', 'order', 'enabled', 'source']
        read_only_fields = ['id', 'source']

    def validate_text(self, value):
        text = (value or '').strip()
        if not text:
            raise serializers.ValidationError('text must not be blank')
        return text


class DocumentSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(source='project.id', read_only=True)
    # Annotated by views; fall back to 0 when not present
    entity_count = serializers.SerializerMethodField()
    relation_count = serializers.SerializerMethodField()
    extraction_state = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id',
            'project_id',
            'filename',
            'file_format',
            'upload_timestamp',
            'processing_status',
            'chunk_count',
            'error_message',
            'extracted_at',
            'extraction_state',
            'entity_count',
            'relation_count',
        ]
        read_only_fields = fields

    def get_entity_count(self, obj):
        return getattr(obj, 'entity_count', 0) or 0

    def get_relation_count(self, obj):
        return getattr(obj, 'relation_count', 0) or 0

    def get_extraction_state(self, obj):
        if getattr(obj, 'is_extracting', False):
            return 'extracting'
        if obj.processing_status == Document.STATUS_FAILED:
            return 'failed'
        if obj.extracted_at:
            return 'extracted'
        return 'not_extracted'


class WebSourceSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(source='project.id', read_only=True)
    document_id = serializers.UUIDField(source='document.id', allow_null=True, read_only=True)

    class Meta:
        model = WebSource
        fields = [
            'id',
            'project_id',
            'source_type',
            'url',
            'crawl_depth',
            'raw_text',
            'title',
            'status',
            'page_count',
            'character_count',
            'error_message',
            'document_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'project_id',
            'status',
            'page_count',
            'character_count',
            'error_message',
            'document_id',
            'created_at',
            'updated_at',
        ]

    @staticmethod
    def _sanitize_url(url: str) -> str:
        raw = (url or '').strip()
        return ''.join(char for char in raw if not unicodedata.category(char).startswith('C'))

    def validate(self, attrs):
        source_type = (attrs.get('source_type') or '').strip().lower()
        url = self._sanitize_url(attrs.get('url') or '')
        attrs['url'] = url
        raw_text = (attrs.get('raw_text') or '').strip()
        title = (attrs.get('title') or '').strip()
        crawl_depth = attrs.get('crawl_depth', 1)

        if source_type in {WebSource.SOURCE_URL, WebSource.SOURCE_CRAWL} and not url:
            raise serializers.ValidationError({'url': 'url is required for url/crawl sources'})

        if source_type == WebSource.SOURCE_PASTE:
            if not raw_text:
                raise serializers.ValidationError({'raw_text': 'raw_text is required for paste source'})
            if not title:
                raise serializers.ValidationError({'title': 'title is required for paste source'})

        if source_type == WebSource.SOURCE_CRAWL and (crawl_depth < 1 or crawl_depth > 2):
            raise serializers.ValidationError({'crawl_depth': 'crawl_depth must be between 1 and 2'})

        return attrs
