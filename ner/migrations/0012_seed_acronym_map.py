# Seed baseline acronym expansions for US-06

from django.db import migrations


def seed_acronyms(apps, schema_editor):
    AcronymMap = apps.get_model('ner', 'AcronymMap')

    seeds = [
        ('UNDP', 'United Nations Development Programme', 10),
        ('WHO', 'World Health Organization', 10),
        ('SDG', 'Sustainable Development Goals', 10),
        ('UNICEF', "United Nations Children's Fund", 10),
        ('FAO', 'Food and Agriculture Organization', 10),
        ('UN', 'United Nations', 10),
        ('UNHCR', 'United Nations High Commissioner for Refugees', 10),
        ('WFP', 'World Food Programme', 10),
        ('ILO', 'International Labour Organization', 10),
        ('UNESCO', 'United Nations Educational, Scientific and Cultural Organization', 10),
    ]

    for acronym, expansion, priority in seeds:
        AcronymMap.objects.update_or_create(
            acronym=acronym,
            defaults={
                'expansion': expansion,
                'active': True,
                'priority': priority,
            },
        )


def unseed_acronyms(apps, schema_editor):
    AcronymMap = apps.get_model('ner', 'AcronymMap')
    AcronymMap.objects.filter(
        acronym__in=['UNDP', 'WHO', 'SDG', 'UNICEF', 'FAO', 'UN', 'UNHCR', 'WFP', 'ILO', 'UNESCO']
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0011_entity_dedup_alias_models'),
    ]

    operations = [
        migrations.RunPython(seed_acronyms, unseed_acronyms),
    ]
