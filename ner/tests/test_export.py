"""US-014 tests for report export service and API endpoints."""

from unittest.mock import patch
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Project
from ner.models import ReportSection, SMQSection, SMQTemplate
from ner.services.report_export import generate_docx_report, generate_pdf_report, get_export_status
from ner.views import ReportExportView


User = get_user_model()


class TestReportExport(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('export_user', 'export@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.project = Project.objects.create(name='Export Project', owner=self.user)
        self.template = SMQTemplate.objects.create(title='Export Template', is_active=True)
        self.section = SMQSection.objects.create(
            template=self.template,
            section_number=1,
            title='Stakeholder Overview',
            question_prompts='Q1',
            order=1,
            is_active=True,
        )

    def test_get_export_status_true_false_and_complete_count(self):
        status_empty = get_export_status(self.project)
        self.assertFalse(status_empty['can_export'])
        self.assertEqual(status_empty['complete_sections'], 0)

        ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_DONE,
            generated_text='Done section text',
        )
        status_done = get_export_status(self.project)
        self.assertTrue(status_done['can_export'])
        self.assertEqual(status_done['complete_sections'], 1)

    def test_generate_pdf_report_returns_non_empty_bytes(self):
        ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_DONE,
            generated_text='Stakeholder report section text.',
        )
        payload = generate_pdf_report(self.project)
        self.assertIsInstance(payload, (bytes, bytearray))
        self.assertGreater(len(payload), 0)

    def test_generate_docx_report_returns_non_empty_bytes(self):
        ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_DONE,
            generated_text='Stakeholder report section text.',
        )
        payload = generate_docx_report(self.project)
        self.assertIsInstance(payload, (bytes, bytearray))
        self.assertGreater(len(payload), 0)

    def test_report_export_view_returns_400_when_no_complete_sections(self):
        request = SimpleNamespace(query_params={'format': 'pdf'}, user=self.user)
        with patch('ner.views._get_project_for_user_or_404', return_value=self.project):
            response = ReportExportView().get(request, id=str(self.project.id))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'no_complete_sections')

    def test_report_export_view_returns_200_with_pdf_and_docx_headers(self):
        ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_DONE,
            generated_text='Ready for export',
        )

        with patch('ner.services.report_export.generate_pdf_report', return_value=b'%PDF-test'):
            request_pdf = SimpleNamespace(query_params={'format': 'pdf'}, user=self.user)
            with patch('ner.views._get_project_for_user_or_404', return_value=self.project):
                pdf_response = ReportExportView().get(request_pdf, id=str(self.project.id))
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response['Content-Type'], 'application/pdf')
        self.assertIn('attachment; filename=', pdf_response['Content-Disposition'])
        self.assertIn('_stakeholder_analysis.pdf', pdf_response['Content-Disposition'])

        with patch('ner.services.report_export.generate_docx_report', return_value=b'PK-test'):
            request_docx = SimpleNamespace(query_params={'format': 'docx'}, user=self.user)
            with patch('ner.views._get_project_for_user_or_404', return_value=self.project):
                docx_response = ReportExportView().get(request_docx, id=str(self.project.id))
        self.assertEqual(docx_response.status_code, 200)
        self.assertEqual(
            docx_response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        self.assertIn('attachment; filename=', docx_response['Content-Disposition'])
        self.assertIn('_stakeholder_analysis.docx', docx_response['Content-Disposition'])

    @patch('ner.services.report_export.generate_pdf_report', return_value=b'%PDF-test')
    def test_report_export_api_accepts_format_query_param(self, _mock_pdf):
        ReportSection.objects.create(
            project=self.project,
            section=self.section,
            status=ReportSection.STATUS_DONE,
            generated_text='Ready for export',
        )

        response = self.client.get(f'/api/v1/projects/{self.project.id}/report/export/?format=pdf')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('_stakeholder_analysis.pdf', response['Content-Disposition'])
