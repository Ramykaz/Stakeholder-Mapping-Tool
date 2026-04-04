"""US-014 tests for report staleness behavior and endpoints."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Document, Project
from ner.models import Entity, ReportSection, SMQSection, SMQTemplate
from ner.services.report_staleness import flag_stale_report_sections


User = get_user_model()


class TestStaleness(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('stale_user', 'stale@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.project = Project.objects.create(name='Stale Project', owner=self.user)
        self.document = Document.objects.create(
            filename='stale.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
        )

        self.template = SMQTemplate.objects.create(title='Stale Template', is_active=True)
        self.section_1 = SMQSection.objects.create(
            template=self.template,
            section_number=1,
            title='Section 1',
            question_prompts='Q1',
            order=1,
            is_active=True,
        )
        self.section_2 = SMQSection.objects.create(
            template=self.template,
            section_number=2,
            title='Section 2',
            question_prompts='Q2',
            order=2,
            is_active=True,
        )

    def _make_entity(self, name: str):
        return Entity.objects.create(
            entity_type='PERSON',
            canonical_name=name,
            normalized_name=name.lower(),
            raw_mentions=[name],
            confidence=0.9,
            mention_count_dedup=1,
            document_id=self.document,
            project=self.project,
        )

    def test_flag_stale_report_sections_updates_done_only_and_sets_project_flag(self):
        done_section = ReportSection.objects.create(
            project=self.project,
            section=self.section_1,
            status=ReportSection.STATUS_DONE,
            generated_text='Done text',
        )
        pending_section = ReportSection.objects.create(
            project=self.project,
            section=self.section_2,
            status=ReportSection.STATUS_PENDING,
            generated_text='Pending text',
        )

        flagged = flag_stale_report_sections(str(self.project.id))

        self.assertEqual(flagged, 1)
        done_section.refresh_from_db()
        pending_section.refresh_from_db()
        self.project.refresh_from_db()
        self.assertEqual(done_section.status, ReportSection.STATUS_STALE)
        self.assertEqual(pending_section.status, ReportSection.STATUS_PENDING)
        self.assertTrue(self.project.stakeholder_table_stale)

    def test_report_section_keep_view_sets_done_and_preserves_text(self):
        stale = ReportSection.objects.create(
            project=self.project,
            section=self.section_1,
            status=ReportSection.STATUS_STALE,
            generated_text='Keep this exact text',
        )

        response = self.client.patch(
            f'/api/v1/projects/{self.project.id}/report/{stale.id}/keep/',
            data={},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        stale.refresh_from_db()
        self.assertEqual(stale.status, ReportSection.STATUS_DONE)
        self.assertEqual(stale.generated_text, 'Keep this exact text')

    def test_report_section_keep_view_returns_400_if_not_stale(self):
        section = ReportSection.objects.create(
            project=self.project,
            section=self.section_1,
            status=ReportSection.STATUS_DONE,
            generated_text='Already done',
        )

        response = self.client.patch(
            f'/api/v1/projects/{self.project.id}/report/{section.id}/keep/',
            data={},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], 'not_stale')

    def test_stakeholder_table_keep_current_view_sets_flag_false(self):
        self.project.stakeholder_table_stale = True
        self.project.save(update_fields=['stakeholder_table_stale'])

        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/stakeholders/priority/keep-current/',
            data={},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.project.refresh_from_db()
        self.assertFalse(self.project.stakeholder_table_stale)

    def test_report_staleness_view_returns_sections_and_new_entity_count(self):
        stale = ReportSection.objects.create(
            project=self.project,
            section=self.section_1,
            status=ReportSection.STATUS_STALE,
            generated_text='Stale text',
            generated_at=timezone.now() - timedelta(days=1),
        )
        self.project.stakeholder_table_stale = True
        self.project.save(update_fields=['stakeholder_table_stale'])
        self._make_entity('New Entity Since Stale')

        response = self.client.get(f'/api/v1/projects/{self.project.id}/report/staleness/')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn(stale.section.section_number, body['stale_sections'])
        self.assertTrue(body['stakeholder_table_stale'])
        self.assertGreaterEqual(body['new_entity_count'], 1)
