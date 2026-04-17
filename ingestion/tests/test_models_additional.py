from django.contrib.auth import get_user_model
from django.test import TestCase

from ingestion.models import Project, ConceptNote, InitiativeProfile

User = get_user_model()


class TestIngestionModelsAdditional(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('ing_extra', 'ing_extra@example.com', 'Pass123')
        self.project = Project.objects.create(name='Additional Project', owner=self.user)

    def test_project_str_contains_name_and_status(self):
        text = str(self.project)
        self.assertIn('Additional Project', text)
        self.assertIn(self.project.status, text)

    def test_derive_next_step_returns_first_incomplete(self):
        steps = [
            {'number': 1, 'label': 'A', 'url': '/a', 'complete': True},
            {'number': 2, 'label': 'B', 'url': '/b', 'complete': False},
        ]
        result = Project.derive_next_step(steps)
        self.assertEqual(result['number'], 2)
        self.assertEqual(result['url'], '/b')

    def test_derive_next_step_returns_none_when_complete(self):
        steps = [{'number': 1, 'label': 'A', 'url': '/a', 'complete': True}]
        self.assertIsNone(Project.derive_next_step(steps))

    def test_concept_note_and_profile_str(self):
        note = ConceptNote.objects.create(project=self.project, content='hello')
        profile = InitiativeProfile.objects.create(project=self.project, initiative_name='Initiative X')
        self.assertIn(str(self.project.id), str(note))
        self.assertIn(str(self.project.id), str(profile))
