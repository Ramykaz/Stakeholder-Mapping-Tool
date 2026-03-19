from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0005_project_owner'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='error_message',
            field=models.TextField(blank=True, default=''),
        ),
    ]
