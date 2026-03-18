from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0005_project_owner'),
        ('ner', '0014_backfill_project_fk'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContextualEntitySummary',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('summary_text', models.TextField()),
                ('evidence_hash', models.CharField(blank=True, default='', max_length=128)),
                ('generated_by_provider', models.CharField(blank=True, default='internal', max_length=64)),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(db_index=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contextual_summaries', to='ner.entity')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entity_summaries', to='ingestion.project')),
            ],
            options={
                'db_table': 'ner_contextual_entity_summary',
            },
        ),
        migrations.AddConstraint(
            model_name='contextualentitysummary',
            constraint=models.UniqueConstraint(fields=('entity', 'project'), name='ner_contextual_summary_entity_project_uniq'),
        ),
        migrations.AddIndex(
            model_name='contextualentitysummary',
            index=models.Index(fields=['project', 'expires_at'], name='ner_ctx_summary_proj_exp_idx'),
        ),
    ]
