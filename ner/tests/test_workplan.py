"""US-014 tests for workplan generation service and endpoints."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Document, Project
from ner.models import Entity, ReportSection, SMQSection, SMQTemplate, WorkplanComponent
from ner.services.workplan_generator import generate_workplan_for_project


User = get_user_model()


class TestWorkplan(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('workplan_user', 'workplan@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.project = Project.objects.create(name='Workplan Project', owner=self.user)
        self.document = Document.objects.create(
            filename='workplan.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
        )

        self.template = SMQTemplate.objects.create(title='Workplan Template', is_active=True)
        self.section_6 = SMQSection.objects.create(
            template=self.template,
            section_number=6,
            title='Stakeholder Engagement Strategies',
            question_prompts='How will stakeholders be engaged?',
            order=6,
            is_active=True,
        )

    def _make_entity(self, name: str, entity_type: str = 'ORGANIZATION') -> Entity:
        return Entity.objects.create(
            entity_type=entity_type,
            canonical_name=name,
            normalized_name=name.lower(),
            raw_mentions=[name],
            confidence=0.88,
            mention_count_dedup=1,
            document_id=self.document,
            project=self.project,
        )

    @patch('ner.services.priority_table.compute_priority_scores', return_value=[])
    @patch('ner.services.workplan_generator._call_provider')
    def test_generate_workplan_falls_back_when_section_6_not_complete(self, mock_call, _mock_scores):
        ReportSection.objects.create(
            project=self.project,
            section=self.section_6,
            status=ReportSection.STATUS_PENDING,
            generated_text='Draft content',
        )
        mock_call.return_value = (
            '{"components":[{"title":"Fallback Component","tasks":[{"task_description":"Fallback task",'
            '"suggested_owner":"Owner","timeline":"Q1","dependencies":"","kpis":"Done",'
            '"related_stakeholder":""}]}]}'
        )

        created = generate_workplan_for_project(str(self.project.id))
        self.assertEqual(created, 1)

    @patch('ner.services.priority_table.compute_priority_scores')
    @patch('ner.services.workplan_generator._call_provider')
    def test_generate_workplan_creates_structure_and_links_related_entity(self, mock_call, mock_scores):
        ReportSection.objects.create(
            project=self.project,
            section=self.section_6,
            status=ReportSection.STATUS_DONE,
            generated_text='Completed section 6 narrative',
        )
        linked_entity = self._make_entity('UNDP')
        mock_scores.return_value = [{'name': 'UNDP', 'entity_type': 'ORGANIZATION'}]
        mock_call.return_value = (
            '{"components":[{"title":"Capacity Building","tasks":[{'
            '"task_description":"Run training","suggested_owner":"UNDP","timeline":"Q2",'
            '"dependencies":"Baseline","kpis":"80% attendance","related_stakeholder":"undp"}]}]}'
        )

        created = generate_workplan_for_project(str(self.project.id))

        self.assertEqual(created, 1)
        component = WorkplanComponent.objects.get(project=self.project)
        self.assertEqual(component.tasks.count(), 1)
        task = component.tasks.first()
        self.assertEqual(task.related_entity_id, linked_entity.id)

    @patch('ner.services.priority_table.compute_priority_scores', return_value=[])
    @patch('ner.services.workplan_generator._call_provider')
    def test_generate_workplan_replaces_existing_workplan(self, mock_call, _mock_scores):
        ReportSection.objects.create(
            project=self.project,
            section=self.section_6,
            status=ReportSection.STATUS_DONE,
            generated_text='Completed section 6 narrative',
        )

        existing = WorkplanComponent.objects.create(project=self.project, order=0, title='Old Component')
        existing.tasks.create(order=0, task_description='Old task')

        mock_call.return_value = (
            '{"components":[{"title":"New Component","tasks":[{"task_description":"New task",'
            '"suggested_owner":"Owner","timeline":"Q3","dependencies":"","kpis":"Done",'
            '"related_stakeholder":""}]}]}'
        )

        generate_workplan_for_project(str(self.project.id))

        components = WorkplanComponent.objects.filter(project=self.project)
        self.assertEqual(components.count(), 1)
        self.assertEqual(components.first().title, 'New Component')

    @patch('ner.views.generate_workplan_task.delay')
    def test_workplan_generate_view_starts_even_when_section_6_incomplete(self, mock_delay):
        ReportSection.objects.create(
            project=self.project,
            section=self.section_6,
            status=ReportSection.STATUS_PENDING,
            generated_text='',
        )

        response = self.client.post(f'/api/v1/projects/{self.project.id}/workplan/generate/', data={}, format='json')

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['status'], 'generating')
        mock_delay.assert_called_once_with(str(self.project.id))
