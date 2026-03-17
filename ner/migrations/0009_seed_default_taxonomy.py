# Generated migration — seed default entity labels and relationship types

from django.db import migrations


def seed_defaults(apps, schema_editor):
    EntityLabel = apps.get_model('ner', 'EntityLabel')
    RelationshipType = apps.get_model('ner', 'RelationshipType')

    entity_defaults = [
        ('Person', 'Individual stakeholder', 'hexagon', '#2563eb', 1),
        ('Organization', 'Organization or institution', 'ellipse', '#059669', 2),
        ('Location', 'Geographic location', 'diamond', '#7c3aed', 3),
        ('Role', 'Position or role', 'rectangle', '#d97706', 4),
        ('Event', 'Event or convening', 'round-rectangle', '#dc2626', 5),
        ('Project', 'Project or initiative', 'triangle', '#0ea5e9', 6),
    ]

    relation_defaults = [
        ('funded', 'Funding relationship', True, '#2563eb', 1),
        ('partnered', 'Partnership relationship', False, '#059669', 2),
        ('participated', 'Participation relationship', True, '#7c3aed', 3),
        ('implemented', 'Implementation relationship', True, '#d97706', 4),
        ('mentored', 'Mentorship relationship', True, '#dc2626', 5),
        ('organized', 'Organization relationship', True, '#0ea5e9', 6),
        ('attended', 'Attendance relationship', True, '#9333ea', 7),
        ('advised', 'Advisory relationship', True, '#ea580c', 8),
    ]

    for name, description, node_shape, color, display_order in entity_defaults:
        EntityLabel.objects.get_or_create(
            name=name,
            defaults={
                'description': description,
                'node_shape': node_shape,
                'color': color,
                'active': True,
                'display_order': display_order,
            },
        )

    for name, description, directional, color, display_order in relation_defaults:
        RelationshipType.objects.get_or_create(
            name=name,
            defaults={
                'description': description,
                'directional': directional,
                'color': color,
                'active': True,
                'display_order': display_order,
            },
        )


def reverse_seed_defaults(apps, schema_editor):
    EntityLabel = apps.get_model('ner', 'EntityLabel')
    RelationshipType = apps.get_model('ner', 'RelationshipType')

    EntityLabel.objects.filter(
        name__in=['Person', 'Organization', 'Location', 'Role', 'Event', 'Project']
    ).delete()
    RelationshipType.objects.filter(
        name__in=['funded', 'partnered', 'participated', 'implemented', 'mentored', 'organized', 'attended', 'advised']
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0008_entitylabel_relationshiptype'),
    ]

    operations = [
        migrations.RunPython(seed_defaults, reverse_seed_defaults),
    ]
