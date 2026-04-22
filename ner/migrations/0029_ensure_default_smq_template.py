from django.db import migrations


DEFAULT_TEMPLATE_TITLE = 'Stakeholder Mapping Questionnaire'
DEFAULT_TEMPLATE_DESCRIPTION = 'Default 8-section stakeholder mapping questionnaire.'

DEFAULT_SECTIONS = [
    (
        1,
        'Define the Objectives of [The Initiative]',
        """What is the core mission of [The Initiative]?
Why is this [The Initiative] being created in this specific country?
What problems in the local [theme] industry or [The Initiative] aim to solve?
What are the expected long-term outcomes of [The Initiative]?
What are the measurable goals for success?
How will success be defined for [The Initiative] (e.g., number of graduates, employment rate)?
How will [The Initiative] contribute to the local [theme] ecosystem?""",
    ),
    (
        2,
        'Identify Stakeholders',
        """Who are the key stakeholders involved or impacted by [The Initiative]?
Who will be directly affected by [The Initiative]'s outcomes (students, instructors, employers)?
Are there any indirect stakeholders (government bodies, local communities, technology companies)?
What role does each stakeholder group play in [The Initiative]'s development and success?
What will be the contributions of each group (e.g., funding, expertise, mentorship)?
Are there any stakeholders who will have a minimal role but still require consideration (e.g., media, general public)?""",
    ),
    (
        3,
        'Categorize Stakeholders',
        """What are the relative levels of power and interest for each stakeholder group?
How much influence does each stakeholder have over [The Initiative]'s decisions or outcomes?
How invested is each group in [The Initiative]'s success?
Which stakeholders need the most attention and communication?
Which groups have the most power and interest in [The Initiative]'s results?
Which stakeholders need to be actively managed and engaged, and which ones need periodic updates?""",
    ),
    (
        4,
        'Assess Stakeholder Needs and Expectations',
        """What are the key expectations and needs of each stakeholder group?
What are the expectations of students (e.g., education quality, job placement support)?
What do employers want from [The Initiative] (e.g., a skilled talent pool, industry partnerships)?
What are the expectations of government or educational bodies (e.g., job creation, skill development)?
How can these expectations influence [The Initiative]'s operations or curriculum?
Are there any conflicting expectations between stakeholders (e.g., employers vs. students)?
How should [The Initiative] balance these needs?""",
    ),
    (
        5,
        'Analyze Stakeholder Impact and Influence',
        """How much power does each stakeholder group have to shape [The Initiative]'s direction?
Which stakeholders have decision-making authority (e.g., investors, government agencies)?
How will key influencers like large companies or industry professionals impact [The Initiative]'s success?
What potential impact will each stakeholder have on [The Initiative]'s outcomes?
How will stakeholders like employers, students, or instructors affect [The Initiative]'s overall success or failure?
Are there risks posed by stakeholders who may not fully support [The Initiative]?""",
    ),
    (
        6,
        'Develop Stakeholder Engagement Strategies',
        """What engagement strategies will best serve each stakeholder group?
For high-power, high-interest stakeholders, what strategies can be used to manage their involvement effectively?
For low-power, high-interest stakeholders, how can we keep them informed and engaged?
What communication methods will work best for different stakeholder groups?
Should communication with stakeholders be formal or informal (e.g., meetings, emails, social media)?
How often should updates be provided to each group?""",
    ),
    (
        7,
        'Monitor and Evaluate Stakeholder Relationships',
        """How will we monitor the effectiveness of our stakeholder engagement strategies?
What metrics can be used to evaluate stakeholder satisfaction and involvement?
How will feedback be collected from stakeholders throughout [The Initiative]'s lifecycle?
How can we identify when adjustments to stakeholder engagement are necessary?
What signs indicate that a stakeholder's expectations are not being met?
How can we address any emerging issues or dissatisfaction early on?""",
    ),
    (
        8,
        'Iterate and Refine the Strategy',
        """How can we adapt the stakeholder engagement strategies over time?
Are there any stakeholders whose power or interest levels may change during [The Initiative]'s duration?
How should we adjust our approach if new stakeholders emerge or if stakeholders' expectations shift?
How will the insights gathered from stakeholder monitoring influence future decisions?
What adjustments will be made based on stakeholder feedback and [The Initiative]'s progress?
How can we ensure continuous alignment between stakeholder interests and [The Initiative]'s objectives?""",
    ),
]


def ensure_default_template(apps, schema_editor):
    SMQTemplate = apps.get_model('ner', 'SMQTemplate')
    SMQSection = apps.get_model('ner', 'SMQSection')

    template, _ = SMQTemplate.objects.get_or_create(
        title=DEFAULT_TEMPLATE_TITLE,
        defaults={
            'description': DEFAULT_TEMPLATE_DESCRIPTION,
            'is_active': True,
        },
    )

    if not template.is_active:
        template.is_active = True
        template.save(update_fields=['is_active'])

    for index, (section_number, title, prompts) in enumerate(DEFAULT_SECTIONS):
        section, created = SMQSection.objects.get_or_create(
            template=template,
            section_number=section_number,
            defaults={
                'title': title,
                'question_prompts': prompts,
                'order': index,
                'is_active': True,
            },
        )

        if not created:
            updates = []
            if (section.title or '').strip() != title:
                section.title = title
                updates.append('title')
            if (section.question_prompts or '').strip() != prompts:
                section.question_prompts = prompts
                updates.append('question_prompts')
            if section.order != index:
                section.order = index
                updates.append('order')
            if not section.is_active:
                section.is_active = True
                updates.append('is_active')
            if updates:
                section.save(update_fields=updates)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('ner', '0028_add_ai_feedback'),
    ]

    operations = [
        migrations.RunPython(ensure_default_template, reverse_code=noop_reverse),
    ]
