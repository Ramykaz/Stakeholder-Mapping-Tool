from django.db import migrations


def backfill_entity_relation_project(apps, schema_editor):
    Entity = apps.get_model('ner', 'Entity')
    Relation = apps.get_model('ner', 'Relation')

    for entity in Entity.objects.filter(project__isnull=True).select_related('document_id'):
        project = getattr(entity.document_id, 'project', None)
        if project is not None:
            entity.project = project
            entity.save(update_fields=['project'])

    for relation in Relation.objects.filter(project__isnull=True).select_related('document_id'):
        project = getattr(relation.document_id, 'project', None)
        if project is not None:
            relation.project = project
            relation.save(update_fields=['project'])


def reverse_backfill_entity_relation_project(apps, schema_editor):
    Entity = apps.get_model('ner', 'Entity')
    Relation = apps.get_model('ner', 'Relation')

    Entity.objects.update(project=None)
    Relation.objects.update(project=None)


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0004_backfill_default_project'),
        ('ner', '0013_add_project_fk_to_entity_and_relation'),
    ]

    operations = [
        migrations.RunPython(backfill_entity_relation_project, reverse_backfill_entity_relation_project),
    ]
