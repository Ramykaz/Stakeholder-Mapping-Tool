# Generated migration for Entity model

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('ingestion', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Entity',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('entity_type', models.CharField(choices=[('PERSON', 'Person'), ('ORGANIZATION', 'Organization'), ('LOCATION', 'Location'), ('ROLE', 'Role')], db_index=True, max_length=20)),
                ('canonical_name', models.CharField(db_index=True, max_length=255)),
                ('raw_mentions', models.JSONField(default=list)),
                ('confidence', models.FloatField(db_index=True, validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(1.0)])),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('chunk_id', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entities', to='ingestion.chunk')),
                ('document_id', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entities', to='ingestion.document')),
            ],
            options={
                'db_table': 'ner_entity',
                'unique_together': {('canonical_name', 'document_id', 'entity_type')},
            },
        ),
        migrations.AddIndex(
            model_name='entity',
            index=models.Index(fields=['document_id', 'entity_type'], name='ner_entity_document_id_entity_type_idx'),
        ),
        migrations.AddIndex(
            model_name='entity',
            index=models.Index(fields=['document_id', 'confidence'], name='ner_entity_document_id_confidence_idx'),
        ),
    ]
