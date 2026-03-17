# Generated migration — align relation deduplication constraint with canonical non-directional handling

from django.db import migrations, models
from django.db.models import F
from django.db.models.functions import Lower


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0009_seed_default_taxonomy'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='relation',
            name='relations_dedup_idx',
        ),
        migrations.AddConstraint(
            model_name='relation',
            constraint=models.UniqueConstraint(
                Lower('label'),
                F('document_id'),
                F('source_entity'),
                F('target_entity'),
                name='relations_dedup_label_ci_idx',
            ),
        ),
    ]
