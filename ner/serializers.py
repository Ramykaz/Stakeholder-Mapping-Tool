"""Serializers for NER entities, runs, relations, and taxonomy models."""

from rest_framework import serializers
from .models import (
    Entity,
    NERRun,
    Relation,
    EntityLabel,
    RelationshipType,
    EntityAlias,
    EntityReviewCandidate,
)


class EntityAliasSerializer(serializers.ModelSerializer):
    """Serialize alias records linked to a canonical entity."""

    class Meta:
        model = EntityAlias
        fields = [
            'id',
            'entity',
            'alias_text',
            'normalized_alias',
            'source',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class EntitySerializer(serializers.ModelSerializer):
    """Serialize Entity model to JSON."""

    aliases = serializers.SerializerMethodField(read_only=True)
    parent_entity = serializers.SerializerMethodField(read_only=True)
    parent_entity_id = serializers.UUIDField(source='parent_entity.id', read_only=True)

    class Meta:
        model = Entity
        fields = [
            'id',
            'entity_type',
            'canonical_name',
            'normalized_name',
            'aliases',
            'parent_entity',
            'parent_entity_id',
            'needs_review',
            'mention_count_dedup',
            'raw_mentions',
            'confidence',
            'chunk_id',
            'document_id',
            'run',
            'created_at',
        ]
        read_only_fields = fields

    def get_aliases(self, obj):
        return [alias.alias_text for alias in obj.aliases.all()]

    def get_parent_entity(self, obj):
        if not obj.parent_entity_id:
            return None
        return {
            'id': str(obj.parent_entity_id),
            'canonical_name': obj.parent_entity.canonical_name,
        }


class EntityReviewCandidateSerializer(serializers.ModelSerializer):
    """Serialize near-duplicate review candidates for UI review workflows."""

    left_entity_name = serializers.CharField(source='left_entity.canonical_name', read_only=True)
    right_entity_name = serializers.CharField(source='right_entity.canonical_name', read_only=True)
    resolved_by_username = serializers.CharField(source='resolved_by.username', read_only=True)

    class Meta:
        model = EntityReviewCandidate
        fields = [
            'id',
            'document',
            'left_entity',
            'left_entity_name',
            'right_entity',
            'right_entity_name',
            'entity_type',
            'similarity_score',
            'status',
            'resolved_by',
            'resolved_by_username',
            'resolved_at',
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
            'parent_entity_id': str(obj.parent_entity_id) if obj.parent_entity_id else None,
            'needs_review': obj.needs_review,
            'mention_count_dedup': obj.mention_count_dedup,
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


class GlobalEntityProfileSerializer(serializers.ModelSerializer):
    projects = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Entity
        fields = ['id', 'canonical_name', 'entity_type', 'projects']
        read_only_fields = fields

    def get_projects(self, obj):
        request = self.context.get('request')
        owner = getattr(request, 'user', None)
        queryset = Entity.objects.filter(canonical_name=obj.canonical_name)
        if owner and owner.is_authenticated:
            queryset = queryset.filter(document_id__project__owner=owner)

        memberships = (
            queryset
            .exclude(project__isnull=True)
            .values('project__id', 'project__name')
            .distinct()
        )
        return [
            {'id': row['project__id'], 'name': row['project__name']}
            for row in memberships
        ]
