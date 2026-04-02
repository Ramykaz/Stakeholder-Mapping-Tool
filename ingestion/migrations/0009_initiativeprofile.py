from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0008_project_provider_model'),
    ]

    operations = [
        migrations.CreateModel(
            name='InitiativeProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('initiative_name', models.CharField(blank=True, default='', max_length=255)),
                ('geography', models.CharField(blank=True, default='', max_length=255)),
                ('thematic_area', models.CharField(blank=True, default='', max_length=255)),
                ('core_objectives', models.TextField(blank=True, default='')),
                ('expected_outcomes', models.TextField(blank=True, default='')),
                ('stakeholder_focus', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.OneToOneField(on_delete=models.deletion.CASCADE, related_name='initiative_profile', to='ingestion.project')),
            ],
            options={
                'db_table': 'initiative_profiles',
            },
        ),
    ]
