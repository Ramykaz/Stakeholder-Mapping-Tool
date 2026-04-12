from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0013_web_source'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='cleaned_text',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='document',
            name='extracted_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='document',
            name='raw_text',
            field=models.TextField(blank=True, default=''),
        ),
    ]
