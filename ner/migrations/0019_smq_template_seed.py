import os
import re
from django.db import migrations


def _parse_sections(raw_text: str) -> list[tuple[int, str, str]]:
    lines = [line.rstrip() for line in raw_text.splitlines()]
    sections: list[tuple[int, str, str]] = []

    current_number = None
    current_title = ''
    current_prompts: list[str] = []

    header_pattern = re.compile(r'^(\d+)\.\s+(.*)$')

    for line in lines:
        match = header_pattern.match(line.strip())
        if match:
            if current_number is not None:
                prompt_text = '\n'.join(item for item in current_prompts if item.strip()).strip()
                sections.append((current_number, current_title, prompt_text))
            current_number = int(match.group(1))
            current_title = match.group(2).strip()
            current_prompts = []
            continue

        if current_number is not None and line.strip():
            current_prompts.append(line.strip())

    if current_number is not None:
        prompt_text = '\n'.join(item for item in current_prompts if item.strip()).strip()
        sections.append((current_number, current_title, prompt_text))

    return sections


def seed_smq_template(apps, schema_editor):
    SMQTemplate = apps.get_model('ner', 'SMQTemplate')
    SMQSection = apps.get_model('ner', 'SMQSection')

    base_dir = os.path.dirname(__file__)
    smq_path = os.path.abspath(os.path.join(base_dir, '..', '..', 'docs', 'smq.txt'))

    if not os.path.exists(smq_path):
        return

    with open(smq_path, 'r', encoding='utf-8') as fh:
        raw = fh.read()

    sections = _parse_sections(raw)
    if not sections:
        return

    template, _ = SMQTemplate.objects.get_or_create(
        title='Stakeholder Mapping Questionnaire',
        defaults={
            'description': 'Default 8-section stakeholder mapping questionnaire.',
            'is_active': True,
        },
    )

    for index, (section_number, title, question_prompts) in enumerate(sections):
        SMQSection.objects.get_or_create(
            template=template,
            section_number=section_number,
            defaults={
                'title': title,
                'question_prompts': question_prompts,
                'order': index,
                'is_active': True,
            },
        )


def unseed_smq_template(apps, schema_editor):
    SMQTemplate = apps.get_model('ner', 'SMQTemplate')
    SMQTemplate.objects.filter(title='Stakeholder Mapping Questionnaire').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0018_smq_template'),
    ]

    operations = [
        migrations.RunPython(seed_smq_template, reverse_code=unseed_smq_template),
    ]
