# Generated migration — add duration_seconds to NERRun

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0004_rename_ner_entity_run_id_7f8c75_idx_ner_entity_run_id_572735_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='nerrun',
            name='duration_seconds',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
