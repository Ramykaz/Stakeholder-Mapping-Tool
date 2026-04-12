"""Integration tests for report status lifecycle and transient error handling."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Project
from ner.models import ReportSection, SMQSection, SMQTemplate


User = get_user_model()


class TestProjectReportViewTransientErrors(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('report_view_user', 'report_view@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.project = Project.objects.create(name='Report View Project', owner=self.user)
        self.template = SMQTemplate.objects.create(title='Report View Template', is_active=True)
        self.section = SMQSection.objects.create(
            template=self.template,
            section_number=1,
            title='Section 1',
            question_prompts='Question 1',
            order=1,
            is_active=True,
        )

    def test_old_timeout_error_is_reset_to_pending_on_report_load(self):
        report = ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_ERROR,
            error_message='Generation timed out. Please retry or use Stop generation and restart.',
        )
        ReportSection.objects.filter(id=report.id).update(updated_at=timezone.now() - timedelta(minutes=3))

        response = self.client.get(f'/api/v1/projects/{self.project.id}/report/')

        self.assertEqual(response.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, ReportSection.STATUS_PENDING)
        self.assertEqual(report.error_message, '')

        section_payload = response.json()['sections'][0]
        self.assertEqual(section_payload['status'], ReportSection.STATUS_PENDING)
        self.assertEqual(section_payload['error_message'], '')

    def test_old_stopped_error_is_reset_to_pending_on_report_load(self):
        report = ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_ERROR,
            error_message='Generation stopped by user.',
        )
        ReportSection.objects.filter(id=report.id).update(updated_at=timezone.now() - timedelta(minutes=3))

        response = self.client.get(f'/api/v1/projects/{self.project.id}/report/')

        self.assertEqual(response.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, ReportSection.STATUS_PENDING)
        self.assertEqual(report.error_message, '')

    def test_recent_timeout_error_remains_visible(self):
        report = ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_ERROR,
            error_message='Generation timed out. Please retry or use Stop generation and restart.',
        )

        response = self.client.get(f'/api/v1/projects/{self.project.id}/report/')

        self.assertEqual(response.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, ReportSection.STATUS_ERROR)
        self.assertIn('timed out', report.error_message.lower())

    def test_old_non_transient_error_is_not_reset(self):
        report = ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_ERROR,
            error_message='Generation failed: provider credentials are invalid.',
        )
        ReportSection.objects.filter(id=report.id).update(updated_at=timezone.now() - timedelta(minutes=3))

        response = self.client.get(f'/api/v1/projects/{self.project.id}/report/')

        self.assertEqual(response.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.status, ReportSection.STATUS_ERROR)
        self.assertIn('provider credentials', report.error_message)
