"""US-014 tests for stakeholder personas service and endpoints."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from ingestion.models import Document, Project
from ner.models import Entity, EntityLabel, StakeholderPersona
from ner.services.persona_generator import _generate_single_persona, generate_personas_for_project


User = get_user_model()


class TestPersonas(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('persona_user', 'persona@example.com', 'Password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.project = Project.objects.create(name='Persona Project', owner=self.user)
        self.document = Document.objects.create(
            filename='persona.txt',
            file_format='txt',
            processing_status=Document.STATUS_COMPLETED,
            project=self.project,
        )

        self.person_label = EntityLabel.objects.filter(name__iexact='PERSON').first()
        if self.person_label is None:
            self.person_label = EntityLabel.objects.create(
                name='PERSON',
                description='Person',
                node_shape='ellipse',
                color='#2ec4a5',
                active=True,
                display_order=1,
            )

        self.org_label = EntityLabel.objects.filter(name__iexact='ORGANIZATION').first()
        if self.org_label is None:
            self.org_label = EntityLabel.objects.create(
                name='ORGANIZATION',
                description='Organization',
                node_shape='box',
                color='#3d6fff',
                active=True,
                display_order=2,
            )

    def _make_entity(self, entity_type: str, name: str):
        return Entity.objects.create(
            entity_type=entity_type,
            canonical_name=name,
            normalized_name=name.lower(),
            raw_mentions=[name],
            confidence=0.9,
            mention_count_dedup=1,
            document_id=self.document,
            project=self.project,
        )

    @patch('ner.services.persona_generator._call_provider')
    def test_generate_personas_for_project_creates_for_types_with_available_entities(self, mock_call):
        for idx in range(3):
            self._make_entity('PERSON', f'Person {idx}')
        for idx in range(2):
            self._make_entity('ORGANIZATION', f'Org {idx}')

        mock_call.return_value = (
            '{"persona_name":"Policy Architect","archetype_label":"Institutional Champion",'
            '"demographics":"Profile text","motivations":["m1","m2","m3"],'
            '"frustrations":["f1","f2","f3"]}'
        )

        created = generate_personas_for_project(str(self.project.id))

        self.assertEqual(created, 2)
        personas = StakeholderPersona.objects.filter(project=self.project)
        self.assertEqual(personas.count(), 2)
        labels = {str(name).upper() for name in personas.values_list('entity_type__name', flat=True)}
        self.assertIn('PERSON', labels)
        self.assertIn('ORGANIZATION', labels)

    @patch('ner.services.persona_generator._call_provider')
    def test_generate_personas_for_project_creates_from_single_entity_type(self, mock_call):
        self._make_entity('PERSON', 'Alice')

        mock_call.return_value = (
            '{"persona_name":"Policy Architect","archetype_label":"Institutional Champion",'
            '"demographics":"Profile text","motivations":["m1","m2","m3"],'
            '"frustrations":["f1","f2","f3"]}'
        )

        created = generate_personas_for_project(str(self.project.id))

        self.assertEqual(created, 1)
        personas = StakeholderPersona.objects.filter(project=self.project)
        self.assertEqual(personas.count(), 1)
        self.assertEqual(personas.first().entity_type_id, self.person_label.id)

    @patch('ner.services.persona_generator._call_provider')
    def test_generate_personas_replaces_existing_on_regeneration(self, mock_call):
        for idx in range(3):
            self._make_entity('PERSON', f'Person {idx}')

        StakeholderPersona.objects.create(
            project=self.project,
            entity_type=self.person_label,
            persona_name='Old Persona',
            archetype_label='Old Archetype',
            demographics='Old demographics',
            motivations=['a', 'b', 'c'],
            frustrations=['x', 'y', 'z'],
            representative_entities=[],
        )

        mock_call.return_value = (
            '{"persona_name":"New Persona","archetype_label":"New Archetype",'
            '"demographics":"New demographics","motivations":["m1","m2","m3"],'
            '"frustrations":["f1","f2","f3"]}'
        )

        generate_personas_for_project(str(self.project.id))

        personas = StakeholderPersona.objects.filter(project=self.project)
        self.assertEqual(personas.count(), 1)
        self.assertEqual(personas.first().persona_name, 'New Persona')

    @patch('ner.services.persona_generator._call_provider', return_value='not valid json')
    def test_generate_single_persona_returns_none_on_json_parse_failure(self, _mock_call):
        result = _generate_single_persona(
            entity_type_name='Person',
            entity_names=['Alice', 'Bob', 'Carol'],
            descriptions=[],
            project_context='Context',
            provider='groq',
            model='llama-3.3-70b-versatile',
        )
        self.assertIsNone(result)

    @patch('ner.services.persona_generator._call_provider')
    def test_generate_single_persona_parses_json_when_response_content_is_wrapped(self, mock_call):
        mock_call.return_value = '```json\n{"persona_name":"A","archetype_label":"B","demographics":"C","motivations":["1","2","3"],"frustrations":["4","5","6"]}\n```'

        result = _generate_single_persona(
            entity_type_name='Person',
            entity_names=['Alice'],
            descriptions=[],
            project_context='Context',
            provider='azure_openai',
            model='gpt-5-mini',
        )

        self.assertIsNotNone(result)
        self.assertEqual(result['persona_name'], 'A')

    def test_persona_list_view_returns_expected_schema(self):
        persona = StakeholderPersona.objects.create(
            project=self.project,
            entity_type=self.person_label,
            persona_name='Policy Architect',
            archetype_label='Institutional Champion',
            demographics='Demographics',
            motivations=['m1', 'm2', 'm3'],
            frustrations=['f1', 'f2', 'f3'],
            representative_entities=[{'id': 'x', 'name': 'Alice'}],
        )

        response = self.client.get(f'/api/v1/projects/{self.project.id}/personas/')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['count'], 1)
        self.assertEqual(body['results'][0]['id'], str(persona.id))
        self.assertIn('entity_type_label', body['results'][0])

    def test_persona_generate_view_returns_202(self):
        self._make_entity('PERSON', 'Alice')
        with patch('ner.tasks.generate_personas_task.delay', return_value=None):
            response = self.client.post(f'/api/v1/projects/{self.project.id}/personas/generate/', data={}, format='json')

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['status'], 'generating')

    def test_persona_generate_view_returns_400_without_entities(self):
        response = self.client.post(f'/api/v1/projects/{self.project.id}/personas/generate/', data={}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], 'no_entities')
