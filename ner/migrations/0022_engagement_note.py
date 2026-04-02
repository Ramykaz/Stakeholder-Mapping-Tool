from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0010_extractionguidance'),
        ('ner', '0021_report_section'),
    ]

    operations = [
        migrations.CreateModel(
            name='EngagementNote',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('note_text', models.TextField()),
                ('generated_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('entity', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='engagement_notes', to='ner.entity')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='engagement_notes', to='ingestion.project')),
            ],
            options={
                'db_table': 'ner_engagement_note',
                'unique_together': {('project', 'entity')},
            },
        ),
    ]
