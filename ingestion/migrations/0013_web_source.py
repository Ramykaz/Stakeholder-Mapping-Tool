from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0012_project_workflow_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='WebSource',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('source_type', models.CharField(choices=[('url', 'URL'), ('crawl', 'Crawl'), ('paste', 'Paste')], max_length=16)),
                ('url', models.TextField(blank=True, default='')),
                ('crawl_depth', models.PositiveSmallIntegerField(default=1)),
                ('raw_text', models.TextField(blank=True, default='')),
                ('title', models.CharField(blank=True, default='', max_length=255)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('processing', 'Processing'), ('processed', 'Processed'), ('error', 'Error')], default='queued', max_length=20)),
                ('page_count', models.PositiveIntegerField(default=0)),
                ('character_count', models.PositiveIntegerField(default=0)),
                ('error_message', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('document', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='web_sources', to='ingestion.document')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='web_sources', to='ingestion.project')),
            ],
            options={
                'db_table': 'ingestion_web_sources',
            },
        ),
        migrations.AddIndex(
            model_name='websource',
            index=models.Index(fields=['project', 'status', 'updated_at'], name='ingestion_w_project_f11d2d_idx'),
        ),
        migrations.AddIndex(
            model_name='websource',
            index=models.Index(fields=['source_type', 'status'], name='ingestion_w_source__d3e5d1_idx'),
        ),
    ]
