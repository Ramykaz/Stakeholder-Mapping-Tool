from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0007_rename_projects_status_95fcb9_idx_projects_status_3c11ef_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='provider',
            field=models.CharField(max_length=32, blank=True, default=''),
        ),
        migrations.AddField(
            model_name='project',
            name='model',
            field=models.CharField(max_length=64, blank=True, default=''),
        ),
    ]
