from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0011_intake_profile_expansion_and_guidance_flags'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='workflow_step',
            field=models.IntegerField(default=1),
        ),
        migrations.AddField(
            model_name='project',
            name='stakeholder_table_stale',
            field=models.BooleanField(default=False),
        ),
    ]
