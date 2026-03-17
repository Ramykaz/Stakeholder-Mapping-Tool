"""Serializers for NER entities, runs, relations, and taxonomy models."""

from rest_framework import serializers
from .models import Entity, NERRun, Relation, EntityLabel, RelationshipType


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
            'run',
            'created_at',
        ]
        read_only_fields = fields


class NERRunSerializer(serializers.ModelSerializer):
    """Serialize NER run metadata for document history views."""

    class Meta:
        model = NERRun
        fields = [
            'id',
            'document_id',
            'provider',
            'model',
            'status',
            'tokens_input',
            'tokens_output',
            'tokens_cached',
            'cost_usd',
            'duration_seconds',
            'relations_created',
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
            'run_id': str(obj.run_id) if obj.run_id else None,
            'raw_mentions_count': len(obj.raw_mentions),
        }


class RelationSerializer(serializers.ModelSerializer):
    """Serialize Relation model to JSON with full triplet data."""

    source_entity_id = serializers.UUIDField(source='source_entity.id', read_only=True)
    source_entity_name = serializers.CharField(source='source_entity.canonical_name', read_only=True)
    target_entity_id = serializers.UUIDField(source='target_entity.id', read_only=True)
    target_entity_name = serializers.CharField(source='target_entity.canonical_name', read_only=True)
    run_id = serializers.UUIDField(source='run.id', read_only=True)

    class Meta:
        model = Relation
        fields = [
            'id',
            'document_id',
            'run_id',
            'source_entity_id',
            'source_entity_name',
            'target_entity_id',
            'target_entity_name',
            'label',
            'confidence',
            'created_at',
        ]
        read_only_fields = fields


class EntityLabelSerializer(serializers.ModelSerializer):
    """Serialize configurable entity labels for admin taxonomy management."""

    class Meta:
        model = EntityLabel
        fields = [
            'id',
            'name',
            'description',
            'node_shape',
            'color',
            'active',
            'display_order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RelationshipTypeSerializer(serializers.ModelSerializer):
    """Serialize configurable relationship types for admin taxonomy management."""

    class Meta:
        model = RelationshipType
        fields = [
            'id',
            'name',
            'description',
            'directional',
            'color',
            'active',
            'display_order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
