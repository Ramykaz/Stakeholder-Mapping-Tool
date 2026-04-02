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
    ContextualEntitySummary,
    SMQTemplate,
    SMQSection,
    ProjectSMQResponse,
    ProjectSMQAnswer,
    ReportSection,
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
    aliases = serializers.SerializerMethodField(read_only=True)
    projects = serializers.SerializerMethodField(read_only=True)
    relationships = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Entity
        fields = ['id', 'canonical_name', 'entity_type', 'confidence', 'aliases', 'projects', 'relationships']
        read_only_fields = fields

    def get_aliases(self, obj):
        request = self.context.get('request')
        owner = getattr(request, 'user', None)
        queryset = Entity.objects.filter(canonical_name=obj.canonical_name)
        if owner and owner.is_authenticated:
            queryset = queryset.filter(document_id__project__owner=owner)

        alias_values = (
            EntityAlias.objects.filter(entity__in=queryset)
            .values_list('alias_text', flat=True)
            .distinct()
        )
        return sorted(value for value in alias_values if value)

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

    def get_relationships(self, obj):
        request = self.context.get('request')
        owner = getattr(request, 'user', None)
        canonical_entities = Entity.objects.filter(canonical_name=obj.canonical_name)
        if owner and owner.is_authenticated:
            canonical_entities = canonical_entities.filter(document_id__project__owner=owner)

        entity_ids = list(canonical_entities.values_list('id', flat=True))

        from django.db.models import Q
        relations = (
            Relation.objects
            .filter(Q(source_entity_id__in=entity_ids) | Q(target_entity_id__in=entity_ids))
            .select_related('source_entity', 'target_entity', 'project')
            .order_by('-confidence')
            .distinct()
        )

        seen = set()
        result = []
        for rel in relations[:100]:
            key = str(rel.id)
            if key in seen:
                continue
            seen.add(key)
            result.append({
                'relation_id': key,
                'project_id': str(rel.project_id) if rel.project_id else None,
                'source_entity_id': str(rel.source_entity_id),
                'source_entity_name': rel.source_entity.canonical_name if rel.source_entity else '',
                'target_entity_id': str(rel.target_entity_id),
                'target_entity_name': rel.target_entity.canonical_name if rel.target_entity else '',
                'relation_type': rel.label,
                'confidence': rel.confidence,
                'supporting_excerpts': [],
            })
            if len(result) >= 50:
                break
        return result


class ContextualSummaryRequestSerializer(serializers.Serializer):
    project_id = serializers.UUIDField(required=True)
    refresh = serializers.BooleanField(required=False, default=False)


class ContextualSummarySerializer(serializers.ModelSerializer):
    entity_id = serializers.UUIDField(source='entity.id', read_only=True)
    project_id = serializers.UUIDField(source='project.id', read_only=True)
    summary = serializers.CharField(source='summary_text', read_only=True)
    source = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ContextualEntitySummary
        fields = ['entity_id', 'project_id', 'summary', 'source', 'generated_at', 'expires_at']
        read_only_fields = fields

    def get_source(self, _obj):
        return 'cache'


class SMQSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMQSection
        fields = ['id', 'section_number', 'title', 'question_prompts', 'order']
        read_only_fields = fields


class SMQTemplateSerializer(serializers.ModelSerializer):
    sections = SMQSectionSerializer(many=True, read_only=True)

    class Meta:
        model = SMQTemplate
        fields = ['id', 'title', 'description', 'sections']
        read_only_fields = fields


class ProjectSMQAnswerSerializer(serializers.ModelSerializer):
    section_id = serializers.UUIDField(source='section.id', read_only=True)
    section_number = serializers.IntegerField(source='section.section_number', read_only=True)
    section_title = serializers.CharField(source='section.title', read_only=True)

    class Meta:
        model = ProjectSMQAnswer
        fields = [
            'id',
            'section_id',
            'section_number',
            'section_title',
            'answer_text',
            'ai_generated',
            'is_stale',
            'last_generated_at',
            'chunk_ids_used',
        ]
        read_only_fields = ['id', 'section_id', 'section_number', 'section_title', 'last_generated_at', 'chunk_ids_used']


class ProjectSMQResponseSerializer(serializers.ModelSerializer):
    answers = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectSMQResponse
        fields = ['id', 'project', 'answers']
        read_only_fields = fields

    def get_answers(self, obj):
        queryset = obj.answers.select_related('section').order_by('section__section_number')
        return ProjectSMQAnswerSerializer(queryset, many=True).data


class ReportSectionSerializer(serializers.ModelSerializer):
    section_id = serializers.UUIDField(source='section.id', read_only=True)
    section_number = serializers.IntegerField(source='section.section_number', read_only=True)
    section_title = serializers.CharField(source='section.title', read_only=True)

    class Meta:
        model = ReportSection
        fields = [
            'section_id',
            'section_number',
            'section_title',
            'status',
            'generated_text',
            'citations',
            'error_message',
            'generated_at',
        ]
        read_only_fields = fields


class StakeholderPrioritySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    entity_id = serializers.UUIDField()
    name = serializers.CharField()
    entity_type = serializers.CharField()
    mention_count = serializers.IntegerField()
    avg_confidence = serializers.FloatField()
    degree = serializers.IntegerField()
    priority_score = serializers.FloatField()
    engagement_note = serializers.CharField(allow_null=True, required=False)
