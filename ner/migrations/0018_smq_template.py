from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0017_entity_is_flagged'),
    ]

    operations = [
        migrations.CreateModel(
            name='SMQTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'ner_smq_template',
            },
        ),
        migrations.CreateModel(
            name='SMQSection',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('section_number', models.PositiveIntegerField()),
                ('title', models.CharField(max_length=255)),
                ('question_prompts', models.TextField()),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('template', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='sections', to='ner.smqtemplate')),
            ],
            options={
                'db_table': 'ner_smq_section',
                'ordering': ['order', 'section_number'],
                'unique_together': {('template', 'section_number')},
            },
        ),
    ]
