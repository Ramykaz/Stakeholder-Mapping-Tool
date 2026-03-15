# Generated migration — add Relation model and relations_created to NERRun

from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0005_nerrun_duration_seconds'),
        ('ingestion', '0002_noop'),
    ]

    operations = [
        # Add relations_created field to NERRun
        migrations.AddField(
            model_name='nerrun',
            name='relations_created',
            field=models.IntegerField(blank=True, null=True),
        ),
        # Create Relation model
        migrations.CreateModel(
            name='Relation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('label', models.CharField(max_length=100)),
                ('confidence', models.FloatField(validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(1.0)])),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('document_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='relations', to='ingestion.document')),
                ('run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='relations', to='ner.nerrun')),
                ('source_entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='outgoing_relations', to='ner.entity')),
                ('target_entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='incoming_relations', to='ner.entity')),
            ],
            options={
                'db_table': 'relations',
            },
        ),
        # Add indexes
        migrations.AddIndex(
            model_name='relation',
            index=models.Index(fields=['document_id'], name='relations_document_id_idx'),
        ),
        migrations.AddIndex(
            model_name='relation',
            index=models.Index(fields=['source_entity'], name='relations_source_entity_idx'),
        ),
        migrations.AddIndex(
            model_name='relation',
            index=models.Index(fields=['target_entity'], name='relations_target_entity_idx'),
        ),
        migrations.AddIndex(
            model_name='relation',
            index=models.Index(fields=['run'], name='relations_run_id_idx'),
        ),
        # Add CHECK constraint for no self-loops
        migrations.AddConstraint(
            model_name='relation',
            constraint=models.CheckConstraint(
                check=~models.Q(source_entity=models.F('target_entity')),
                name='no_self_loops',
            ),
        ),
        # Add unique constraint for deduplication
        migrations.AddConstraint(
            model_name='relation',
            constraint=models.UniqueConstraint(
                fields=['document_id', 'source_entity', 'target_entity'],
                name='relations_dedup_idx',
            ),
        ),
    ]
