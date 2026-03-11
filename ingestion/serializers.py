"""DRF serializers for the ingestion app."""
from rest_framework import serializers
from ingestion.models import Document


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            'id',
            'filename',
            'file_format',
            'upload_timestamp',
            'processing_status',
            'chunk_count',
        ]
        read_only_fields = fields
