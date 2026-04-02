from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0010_extractionguidance'),
        ('ner', '0019_smq_template_seed'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectSMQResponse',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='smq_response', to='ingestion.project')),
            ],
            options={
                'db_table': 'ner_project_smq_response',
            },
        ),
        migrations.CreateModel(
            name='ProjectSMQAnswer',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('answer_text', models.TextField(blank=True, default='')),
                ('ai_generated', models.BooleanField(default=False)),
                ('is_stale', models.BooleanField(default=False)),
                ('last_generated_at', models.DateTimeField(blank=True, null=True)),
                ('chunk_ids_used', models.JSONField(default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('response', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='answers', to='ner.projectsmqresponse')),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_answers', to='ner.smqsection')),
            ],
            options={
                'db_table': 'ner_project_smq_answer',
                'unique_together': {('response', 'section')},
            },
        ),
    ]
