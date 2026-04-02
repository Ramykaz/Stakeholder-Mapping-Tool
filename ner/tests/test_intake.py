"""US1 tests for initiative intake profile and context fallback behavior."""

from unittest.mock import PropertyMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from ingestion.models import ConceptNote, InitiativeProfile, Project
from ingestion.services.context import get_project_context


User = get_user_model()


class TestInitiativeProfileContext(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('intake_user', 'intake@example.com', 'Password123')

    def test_to_context_string_with_all_fields(self):
        project = Project.objects.create(name='P1', owner=self.user)
        profile = InitiativeProfile.objects.create(
            project=project,
            initiative_name='Resilience Program',
            geography='Kenya',
            thematic_area='Climate',
            core_objectives='Strengthen adaptation.',
            expected_outcomes='Reduced vulnerability.',
            stakeholder_focus='Local communities.',
        )

        context = profile.to_context_string()
        self.assertIn('Initiative Name: Resilience Program', context)
        self.assertIn('Geography: Kenya', context)
        self.assertIn('Thematic Area: Climate', context)
        self.assertIn('Core Objectives: Strengthen adaptation.', context)
        self.assertIn('Expected Outcomes: Reduced vulnerability.', context)
        self.assertIn('Stakeholder Focus: Local communities.', context)

    def test_to_context_string_with_partial_fields(self):
        project = Project.objects.create(name='P2', owner=self.user)
        profile = InitiativeProfile.objects.create(
            project=project,
            initiative_name='  ',
            geography='Nepal',
            core_objectives='  Improve services  ',
        )

        context = profile.to_context_string()
        self.assertNotIn('Initiative Name:', context)
        self.assertIn('Geography: Nepal', context)
        self.assertIn('Core Objectives: Improve services', context)

    def test_to_context_string_with_empty_fields(self):
        project = Project.objects.create(name='P3', owner=self.user)
        profile = InitiativeProfile.objects.create(project=project)

        context = profile.to_context_string()
        self.assertEqual(context, '')

    def test_get_project_context_uses_initiative_profile_first(self):
        project = Project.objects.create(name='P4', owner=self.user, description='Project description')
        ConceptNote.objects.create(project=project, content='Concept note text')
        InitiativeProfile.objects.create(
            project=project,
            initiative_name='Priority Profile',
            core_objectives='Profile should win',
        )

        context = get_project_context(project)
        self.assertIn('Initiative Name: Priority Profile', context)
        self.assertNotEqual(context, 'Concept note text')

    def test_get_project_context_falls_back_to_concept_note(self):
        project = Project.objects.create(name='P5', owner=self.user, description='Project description')
        ConceptNote.objects.create(project=project, content='Concept fallback')

        context = get_project_context(project)
        self.assertEqual(context, 'Concept fallback')

    def test_get_project_context_falls_back_to_description_then_empty(self):
        project = Project.objects.create(name='P6', owner=self.user, description='Description fallback')
        self.assertEqual(get_project_context(project), 'Description fallback')

        empty_project = Project.objects.create(name='P7', owner=self.user, description='  ')
        self.assertEqual(get_project_context(empty_project), '')

    def test_get_project_context_handles_initiative_profile_missing(self):
        project = Project.objects.create(name='P8', owner=self.user, description='From description')

        with patch.object(
            Project,
            'initiative_profile',
            new_callable=PropertyMock,
            side_effect=InitiativeProfile.DoesNotExist,
        ):
            context = get_project_context(project)

        self.assertEqual(context, 'From description')
