from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0012_project_workflow_fields'),
        ('ner', '0023_report_section_stale'),
    ]

    operations = [
        migrations.CreateModel(
            name='StakeholderPersona',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('persona_name', models.CharField(max_length=255)),
                ('archetype_label', models.CharField(max_length=255)),
                ('demographics', models.TextField()),
                ('motivations', models.JSONField(default=list)),
                ('frustrations', models.JSONField(default=list)),
                ('representative_entities', models.JSONField(default=list)),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('entity_type', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='stakeholder_personas',
                    to='ner.entitylabel',
                )),
                ('project', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='stakeholder_personas',
                    to='ingestion.project',
                )),
            ],
            options={
                'db_table': 'ner_stakeholder_persona',
                'ordering': ['entity_type__label'],
                'unique_together': {('project', 'entity_type')},
            },
        ),
    ]
