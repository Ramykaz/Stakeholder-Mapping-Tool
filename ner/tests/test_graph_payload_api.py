"""Graph payload contract tests for style/degree/confidence fields."""

from rest_framework.test import APITestCase

from ner.tests.factories import (
    create_entity,
    create_project_with_document,
    create_relation,
    create_run_for_document,
    create_user_with_token,
)


class TestGraphPayloadApi(APITestCase):
    def setUp(self):
        self.user, token = create_user_with_token('graph_payload_user')
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.project, self.document = create_project_with_document(self.user)
        self.run = create_run_for_document(self.document)

    def test_project_graph_includes_style_degree_and_confidence(self):
        left = create_entity(self.document, self.run, self.project, name='UNDP')
        right = create_entity(self.document, self.run, self.project, name='MoF')
        create_relation(self.document, self.run, self.project, left, right, label='FUNDS', confidence=0.84)

        response = self.client.get(f'/api/v1/projects/{self.project.id}/graph/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['total_nodes'], 2)
        self.assertEqual(payload['total_edges'], 1)
        first = payload['nodes'][0]
        self.assertIn('degree', first)
        self.assertIn('style', first)
        self.assertIn('color', first['data'])
        self.assertIn('degree', first['data'])
        self.assertIn('confidence', payload['edges'][0]['data'])
