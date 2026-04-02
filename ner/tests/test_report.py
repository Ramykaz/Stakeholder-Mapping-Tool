"""US4 tests for report generation service behavior."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from ingestion.models import Chunk, Document, Project
from ner.models import ProjectSMQAnswer, ProjectSMQResponse, ReportSection, SMQSection, SMQTemplate
from ner.services.report_generator import generate_all_sections, generate_report_section


User = get_user_model()


class _ImmediateFuture:
    def __init__(self, value=None):
        self._value = value

    def result(self):
        return self._value


class _ImmediateExecutor:
    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def submit(self, fn, *args, **kwargs):
        return _ImmediateFuture(fn(*args, **kwargs))


class TestReportGenerator(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('report_user', 'report@example.com', 'Password123')
        self.project = Project.objects.create(name='Report Project', owner=self.user)
        self.document = Document.objects.create(
            filename='report.txt',
            file_format='txt',
            processing_status='completed',
            project=self.project,
        )
        self.chunk = Chunk.objects.create(
            document=self.document,
            text='Evidence chunk for generated report section.',
            embedding=[0.0] * 384,
            chunk_index=0,
            token_count=8,
        )

        self.template = SMQTemplate.objects.create(title='Test Template', is_active=True)
        self.section = SMQSection.objects.create(
            template=self.template,
            section_number=1,
            title='Stakeholder Landscape',
            question_prompts='Who are key actors?',
            order=1,
            is_active=True,
        )

        response = ProjectSMQResponse.objects.create(project=self.project)
        ProjectSMQAnswer.objects.create(
            response=response,
            section=self.section,
            answer_text='SMQ baseline answer',
            ai_generated=False,
        )

    @patch('ner.services.report_generator.close_old_connections', return_value=None)
    @patch('ner.services.report_generator._call_provider')
    @patch('ner.services.report_generator.search_chunks')
    @patch('ner.services.report_generator.embed_query')
    def test_generate_report_section_saves_done_on_success(self, mock_embed, mock_search, mock_call, _mock_close):
        mock_embed.return_value = [0.0] * 384
        mock_search.return_value = [self.chunk]
        mock_call.return_value = 'Generated report narrative with citation.'

        generate_report_section(str(self.project.id), str(self.section.id))

        report = ReportSection.objects.get(project=self.project, section=self.section)
        self.assertEqual(report.status, ReportSection.STATUS_DONE)
        self.assertEqual(report.generated_text, 'Generated report narrative with citation.')
        self.assertTrue(report.citations)
        self.assertEqual(report.error_message, '')

    @patch('ner.services.report_generator.close_old_connections', return_value=None)
    @patch('ner.services.report_generator._call_provider', side_effect=RuntimeError('provider failed'))
    @patch('ner.services.report_generator.search_chunks', return_value=[])
    @patch('ner.services.report_generator.embed_query', return_value=[0.0] * 384)
    def test_generate_report_section_saves_error_on_failure(self, _mock_embed, _mock_search, _mock_call, _mock_close):
        generate_report_section(str(self.project.id), str(self.section.id))

        report = ReportSection.objects.get(project=self.project, section=self.section)
        self.assertEqual(report.status, ReportSection.STATUS_ERROR)
        self.assertIn('provider failed', report.error_message)

    @patch('ner.services.report_generator.ThreadPoolExecutor', _ImmediateExecutor)
    def test_generate_all_sections_creates_records_and_transitions_done(self):
        section_two = SMQSection.objects.create(
            template=self.template,
            section_number=2,
            title='Power and Influence',
            question_prompts='Who has influence?',
            order=2,
            is_active=True,
        )

        def _mark_done(project_id: str, section_id: str) -> None:
            report = ReportSection.objects.get(project_id=project_id, section_id=section_id)
            report.status = ReportSection.STATUS_DONE
            report.save(update_fields=['status', 'updated_at'])

        with patch('ner.services.report_generator.generate_report_section', side_effect=_mark_done):
            generate_all_sections(self.project, [str(self.section.id), str(section_two.id)])

        reports = ReportSection.objects.filter(project=self.project).order_by('section__section_number')
        self.assertEqual(reports.count(), 2)
        self.assertTrue(all(item.status == ReportSection.STATUS_DONE for item in reports))
