"""Entity profile API access-scoping tests."""

from rest_framework.test import APITestCase

from ner.models import EntityAlias
from ner.tests.factories import (
    create_entity,
    create_project_with_document,
    create_relation,
    create_run_for_document,
    create_user_with_token,
)


class TestEntityProfileApi(APITestCase):
    def setUp(self):
        self.owner, owner_token = create_user_with_token('profile_owner')
        self.other_user, _ = create_user_with_token('profile_other')
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {owner_token.key}')

        self.project, self.document = create_project_with_document(self.owner)
        self.run = create_run_for_document(self.document)
        self.entity = create_entity(self.document, self.run, self.project, name='UNDP')
        other = create_entity(self.document, self.run, self.project, name='MoF')
        create_relation(self.document, self.run, self.project, self.entity, other, label='FUNDS', confidence=0.75)
        EntityAlias.objects.create(entity=self.entity, alias_text='United Nations Development Programme', normalized_alias='united nations development programme')

    def test_profile_endpoint_returns_aliases_projects_relationships(self):
        response = self.client.get(f'/api/v1/entities/{self.entity.id}/profile/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['canonical_name'], 'UNDP')
        self.assertTrue(len(data.get('projects', [])) >= 1)
        self.assertTrue(len(data.get('aliases', [])) >= 1)
        self.assertTrue(len(data.get('relationships', [])) >= 1)

    def test_profile_endpoint_forbidden_for_non_owner(self):
        _, other_token = create_user_with_token('profile_intruder')
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {other_token.key}')

        response = self.client.get(f'/api/v1/entities/{self.entity.id}/profile/')
        self.assertEqual(response.status_code, 404)
