"""US-014 tests for workflow status computation and API endpoint."""

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Document, InitiativeProfile, Project
from ner.models import ReportSection, SMQSection, SMQTemplate


User = get_user_model()


class TestWorkflowStatus(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('workflow_user', 'workflow@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.project = Project.objects.create(name='Workflow Project', owner=self.user)
        self.template = SMQTemplate.objects.create(title='Workflow Template', is_active=True)
        self.section = SMQSection.objects.create(
            template=self.template,
            section_number=1,
            title='Section 1',
            question_prompts='Q1',
            order=1,
            is_active=True,
        )

    def test_project_get_workflow_status_step_1_complete_when_initiative_name_set(self):
        InitiativeProfile.objects.create(project=self.project, initiative_name='Education Reform')
        status_data = self.project.get_workflow_status()
        first_step = status_data['steps'][0]
        self.assertEqual(first_step['number'], 1)
        self.assertTrue(first_step['complete'])

    def test_project_get_workflow_status_step_2_complete_when_document_processed(self):
        Document.objects.create(
            filename='doc.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
        )
        status_data = self.project.get_workflow_status()
        step2 = next(step for step in status_data['steps'] if step['number'] == 2)
        self.assertTrue(step2['complete'])

    def test_project_get_workflow_status_step_5_complete_when_done_report_exists(self):
        ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_DONE,
            generated_text='Complete report section',
        )
        status_data = self.project.get_workflow_status()
        step5 = next(step for step in status_data['steps'] if step['number'] == 5)
        self.assertTrue(step5['complete'])

    def test_workflow_status_view_returns_current_step_and_steps_with_urls(self):
        response = self.client.get(f'/api/v1/projects/{self.project.id}/workflow/')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn('current_step', body)
        self.assertIn('steps', body)
        self.assertEqual(len(body['steps']), 7)
        self.assertEqual(body['steps'][0]['url'], f'/projects/{self.project.id}/intake')
        self.assertEqual(body['steps'][-1]['url'], f'/projects/{self.project.id}/report?tab=export')
