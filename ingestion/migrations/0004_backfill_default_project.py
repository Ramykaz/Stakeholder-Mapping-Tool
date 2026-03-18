from django.db import migrations


def backfill_default_project(apps, schema_editor):
    Project = apps.get_model('ingestion', 'Project')
    Document = apps.get_model('ingestion', 'Document')

    default_project, _ = Project.objects.get_or_create(
        name='Default Project',
        defaults={
            'description': 'Auto-created default project for legacy migrated records.',
            'status': 'active',
        },
    )

    Document.objects.filter(project__isnull=True).update(project=default_project)


def reverse_backfill_default_project(apps, schema_editor):
    Project = apps.get_model('ingestion', 'Project')
    Document = apps.get_model('ingestion', 'Document')

    try:
        default_project = Project.objects.get(name='Default Project')
    except Project.DoesNotExist:
        return

    Document.objects.filter(project=default_project).update(project=None)


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0003_project_conceptnote_and_document_fk'),
    ]

    operations = [
        migrations.RunPython(backfill_default_project, reverse_backfill_default_project),
    ]
