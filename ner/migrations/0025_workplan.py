from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0012_project_workflow_fields'),
        ('ner', '0024_stakeholder_persona'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkplanComponent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('order', models.PositiveIntegerField(default=0)),
                ('title', models.CharField(max_length=255)),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='workplan_components',
                    to='ingestion.project',
                )),
            ],
            options={
                'db_table': 'ner_workplan_component',
                'ordering': ['order'],
            },
        ),
        migrations.CreateModel(
            name='WorkplanTask',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('order', models.PositiveIntegerField(default=0)),
                ('task_description', models.TextField()),
                ('suggested_owner', models.CharField(blank=True, default='', max_length=255)),
                ('timeline', models.CharField(blank=True, default='', max_length=255)),
                ('dependencies', models.TextField(blank=True, default='')),
                ('kpis', models.TextField(blank=True, default='')),
                ('component', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tasks',
                    to='ner.workplancomponent',
                )),
                ('related_entity', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='workplan_tasks',
                    to='ner.entity',
                )),
            ],
            options={
                'db_table': 'ner_workplan_task',
                'ordering': ['order'],
            },
        ),
    ]
