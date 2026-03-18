import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0003_project_conceptnote_and_document_fk'),
        ('ner', '0012_seed_acronym_map'),
    ]

    operations = [
        migrations.AddField(
            model_name='entity',
            name='project',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entities', to='ingestion.project'),
        ),
        migrations.AddField(
            model_name='relation',
            name='project',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='relations', to='ingestion.project'),
        ),
    ]
