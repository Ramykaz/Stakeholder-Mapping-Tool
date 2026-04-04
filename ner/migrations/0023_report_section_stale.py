from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0022_engagement_note'),
    ]

    operations = [
        migrations.AlterField(
            model_name='reportsection',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('generating', 'Generating'),
                    ('done', 'Done'),
                    ('error', 'Error'),
                    ('stale', 'Stale'),
                ],
                default='pending',
                max_length=16,
            ),
        ),
    ]
