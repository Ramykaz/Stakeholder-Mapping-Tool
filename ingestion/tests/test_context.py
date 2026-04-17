"""Unit tests for ingestion.services.context.get_project_context."""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from django.contrib.auth import get_user_model
from django.test import TestCase

from ingestion.models import Project, ConceptNote, InitiativeProfile

User = get_user_model()


class TestGetProjectContext(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('ctx_user', 'ctx@example.com', 'Pass123')
        self.project = Project.objects.create(name='Context Project', owner=self.user)

    def test_returns_initiative_profile_context_string_when_present(self):
        from ingestion.services.context import get_project_context
        profile = InitiativeProfile.objects.create(
            project=self.project,
            initiative_name='Education Reform',
            host_organization='UNDP',
            country='Kenya',
        )
        result = get_project_context(self.project)
        self.assertIn('Education Reform', result)

    def test_falls_back_to_concept_note_when_no_initiative_profile(self):
        from ingestion.services.context import get_project_context
        ConceptNote.objects.create(
            project=self.project,
            content='This project focuses on climate adaptation.',
        )
        result = get_project_context(self.project)
        self.assertEqual(result, 'This project focuses on climate adaptation.')

    def test_falls_back_to_project_description_when_no_note(self):
        from ingestion.services.context import get_project_context
        self.project.description = 'A high-level project description.'
        self.project.save()
        result = get_project_context(self.project)
        self.assertEqual(result, 'A high-level project description.')

    def test_returns_empty_string_when_nothing_set(self):
        from ingestion.services.context import get_project_context
        result = get_project_context(self.project)
        self.assertEqual(result, '')

    def test_skips_blank_concept_note_content(self):
        from ingestion.services.context import get_project_context
        ConceptNote.objects.create(project=self.project, content='   ')
        self.project.description = 'Fallback description'
        self.project.save()
        result = get_project_context(self.project)
        self.assertEqual(result, 'Fallback description')

    def test_initiative_profile_takes_priority_over_concept_note(self):
        from ingestion.services.context import get_project_context
        InitiativeProfile.objects.create(
            project=self.project,
            initiative_name='Water Sanitation Initiative',
        )
        ConceptNote.objects.create(
            project=self.project,
            content='Should not be returned.',
        )
        result = get_project_context(self.project)
        self.assertIn('Water Sanitation Initiative', result)
        self.assertNotIn('Should not be returned.', result)
