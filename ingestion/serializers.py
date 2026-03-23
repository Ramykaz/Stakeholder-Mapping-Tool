"""DRF serializers for the ingestion app."""
from rest_framework import serializers
from ingestion.models import Document, Project, ConceptNote


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
            'document_count',
            'entity_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'document_count', 'entity_count', 'created_at', 'updated_at']


class ProjectWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['name', 'description', 'status']


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


class DocumentSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(source='project.id', read_only=True)
    # Annotated by views; fall back to 0 when not present
    entity_count = serializers.SerializerMethodField()
    relation_count = serializers.SerializerMethodField()

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
            'entity_count',
            'relation_count',
        ]
        read_only_fields = fields

    def get_entity_count(self, obj):
        return getattr(obj, 'entity_count', 0) or 0

    def get_relation_count(self, obj):
        return getattr(obj, 'relation_count', 0) or 0
