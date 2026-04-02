from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0010_extractionguidance'),
    ]

    operations = [
        migrations.AddField(
            model_name='initiativeprofile',
            name='country',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='initiativeprofile',
            name='host_organization',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='initiativeprofile',
            name='success_metrics',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='initiativeprofile',
            name='target_beneficiaries',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='extractionguidance',
            name='enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='extractionguidance',
            name='source',
            field=models.CharField(choices=[('manual', 'Manual'), ('auto', 'Auto')], default='manual', max_length=16),
        ),
    ]
