# Generated migration — add configurable taxonomy models for extraction

import uuid
from django.db import migrations, models
from django.db.models.functions import Lower


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0007_fix_relations_dedup_idx'),
    ]

    operations = [
        migrations.CreateModel(
            name='EntityLabel',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=64)),
                ('description', models.TextField(blank=True, default='')),
                ('node_shape', models.CharField(max_length=32)),
                ('color', models.CharField(max_length=32)),
                ('active', models.BooleanField(db_index=True, default=True)),
                ('display_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'ner_entity_label',
            },
        ),
        migrations.CreateModel(
            name='RelationshipType',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=64)),
                ('description', models.TextField(blank=True, default='')),
                ('directional', models.BooleanField(default=True)),
                ('color', models.CharField(max_length=32)),
                ('active', models.BooleanField(db_index=True, default=True)),
                ('display_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'ner_relationship_type',
            },
        ),
        migrations.AddIndex(
            model_name='entitylabel',
            index=models.Index(fields=['active', 'display_order'], name='ner_entity__active_0cc10f_idx'),
        ),
        migrations.AddIndex(
            model_name='relationshiptype',
            index=models.Index(fields=['active', 'display_order'], name='ner_relatio_active_c1ad63_idx'),
        ),
        migrations.AddConstraint(
            model_name='entitylabel',
            constraint=models.UniqueConstraint(
                Lower('name'),
                name='ner_entity_label_name_ci_uniq',
            ),
        ),
        migrations.AddConstraint(
            model_name='relationshiptype',
            constraint=models.UniqueConstraint(
                Lower('name'),
                name='ner_relationship_type_name_ci_uniq',
            ),
        ),
    ]
