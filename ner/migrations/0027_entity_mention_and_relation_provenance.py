from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0014_document_extraction_state_and_clean_text'),
        ('ner', '0026_projectsmqanswer_notes_text'),
    ]

    operations = [
        migrations.AddField(
            model_name='relation',
            name='excerpt',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='relation',
            name='source_document',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='sourced_relations',
                to='ingestion.document',
            ),
        ),
        migrations.CreateModel(
            name='EntityMention',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('excerpt', models.TextField(blank=True, default='')),
                ('confidence_score', models.FloatField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('chunk', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entity_mentions', to='ingestion.chunk')),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entity_mentions', to='ingestion.document')),
                ('entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mentions', to='ner.entity')),
            ],
            options={
                'db_table': 'ner_entity_mention',
            },
        ),
        migrations.AddIndex(
            model_name='entitymention',
            index=models.Index(fields=['document', 'entity'], name='ner_mention_doc_entity_idx'),
        ),
    ]
