from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0009_initiativeprofile'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExtractionGuidance',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('text', models.TextField()),
                ('order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='extraction_guidance_items', to='ingestion.project')),
            ],
            options={
                'db_table': 'extraction_guidance',
                'ordering': ['order', 'created_at'],
            },
        ),
    ]
