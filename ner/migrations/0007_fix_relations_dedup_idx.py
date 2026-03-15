from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0006_add_relations'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='relation',
            name='relations_dedup_idx',
        ),
        migrations.AddConstraint(
            model_name='relation',
            constraint=models.UniqueConstraint(
                fields=['document_id', 'source_entity', 'target_entity', 'label'],
                name='relations_dedup_idx',
            ),
        ),
    ]
