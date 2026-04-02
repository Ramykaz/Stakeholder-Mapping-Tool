from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0010_extractionguidance'),
        ('ner', '0020_project_smq_response'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReportSection',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('generating', 'Generating'), ('done', 'Done'), ('error', 'Error')], default='pending', max_length=16)),
                ('generated_text', models.TextField(blank=True, default='')),
                ('citations', models.JSONField(default=list)),
                ('error_message', models.TextField(blank=True, default='')),
                ('cache_key', models.CharField(blank=True, default='', max_length=64)),
                ('generated_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_sections', to='ingestion.project')),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_sections', to='ner.smqsection')),
            ],
            options={
                'db_table': 'ner_report_section',
                'unique_together': {('project', 'section')},
            },
        ),
    ]
