"""Serializers for Entity model and Cytoscape graph data."""

from rest_framework import serializers
from .models import Entity


class EntitySerializer(serializers.ModelSerializer):
    """Serialize Entity model to JSON."""

    class Meta:
        model = Entity
        fields = [
            'id',
            'entity_type',
            'canonical_name',
            'raw_mentions',
            'confidence',
            'chunk_id',
            'document_id',
            'created_at',
        ]
        read_only_fields = fields


class CytoscapeNodeSerializer(serializers.ModelSerializer):
    """Serialize Entity as Cytoscape.js node with data field."""

    label = serializers.CharField(source='canonical_name', read_only=True)
    data = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Entity
        fields = ['id', 'label', 'data']

    def get_data(self, obj):
        """Return Cytoscape data field with entity metadata."""
        return {
            'entity_id': str(obj.id),
            'entity_type': obj.entity_type,
            'confidence': obj.confidence,
            'document_id': str(obj.document_id),
            'chunk_id': str(obj.chunk_id) if obj.chunk_id else None,
            'raw_mentions_count': len(obj.raw_mentions),
        }
