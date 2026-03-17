# Generated migration for US-06 entity deduplication + alias system

from django.conf import settings
from django.db import migrations, models
from django.db.models.functions import Lower
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0010_relation_canonical_dedup'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='entity',
            name='mention_count_dedup',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='entity',
            name='needs_review',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='entity',
            name='normalized_name',
            field=models.CharField(db_index=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='entity',
            name='parent_entity',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='phase_variants', to='ner.entity'),
        ),
        migrations.CreateModel(
            name='AcronymMap',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('acronym', models.CharField(max_length=64)),
                ('expansion', models.CharField(max_length=255)),
                ('active', models.BooleanField(db_index=True, default=True)),
                ('priority', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'ner_acronym_map',
            },
        ),
        migrations.CreateModel(
            name='EntityAlias',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('alias_text', models.CharField(max_length=255)),
                ('normalized_alias', models.CharField(db_index=True, max_length=255)),
                ('source', models.CharField(choices=[('extraction', 'Extraction'), ('manual', 'Manual'), ('acronym', 'Acronym')], default='extraction', max_length=16)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='aliases', to='ner.entity')),
            ],
            options={
                'db_table': 'ner_entity_alias',
            },
        ),
        migrations.CreateModel(
            name='EntityReviewCandidate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('entity_type', models.CharField(db_index=True, max_length=20)),
                ('similarity_score', models.FloatField()),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('merged', 'Merged'), ('kept_separate', 'Kept Separate'), ('resolved_stale', 'Resolved Stale')], db_index=True, default='pending', max_length=20)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entity_review_candidates', to='ingestion.document')),
                ('left_entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='left_review_candidates', to='ner.entity')),
                ('resolved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='resolved_entity_review_candidates', to=settings.AUTH_USER_MODEL)),
                ('right_entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='right_review_candidates', to='ner.entity')),
            ],
            options={
                'db_table': 'ner_entity_review_candidate',
            },
        ),
        migrations.AddIndex(
            model_name='acronymmap',
            index=models.Index(fields=['active', 'priority'], name='ner_acronym_act_pri_idx'),
        ),
        migrations.AddIndex(
            model_name='entityreviewcandidate',
            index=models.Index(fields=['document', 'status'], name='ner_review_doc_status_idx'),
        ),
        migrations.AddIndex(
            model_name='entityreviewcandidate',
            index=models.Index(fields=['entity_type', 'status'], name='ner_review_type_status_idx'),
        ),
        migrations.AddConstraint(
            model_name='acronymmap',
            constraint=models.UniqueConstraint(Lower('acronym'), name='ner_acronym_map_acronym_ci_uniq'),
        ),
        migrations.AddConstraint(
            model_name='entityalias',
            constraint=models.UniqueConstraint(fields=('entity', 'normalized_alias'), name='ner_entity_alias_unique_per_entity'),
        ),
        migrations.AddConstraint(
            model_name='entityreviewcandidate',
            constraint=models.CheckConstraint(check=models.Q(('left_entity', models.F('right_entity')), _negated=True), name='ner_review_no_self_pair'),
        ),
        migrations.AddConstraint(
            model_name='entityreviewcandidate',
            constraint=models.UniqueConstraint(fields=('document', 'left_entity', 'right_entity', 'status'), name='ner_review_unique_pair_status'),
        ),
    ]
