from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from rest_framework.authtoken.models import Token

from ingestion.models import Project


User = get_user_model()


class TestProjectProviderValidation(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='provider_validation_user',
            email='provider_validation_user@example.com',
            password='Password123',
        )
        token = Token.objects.create(user=self.user)
        self.client = Client()
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Token {token.key}'

        self.project = Project.objects.create(
            name='Provider Validation Project',
            owner=self.user,
            provider='openai',
            model='gpt-5-mini',
        )

    def test_patch_provider_without_model_resets_to_provider_default_model(self):
        response = self.client.patch(
            f'/api/v1/projects/{self.project.id}/',
            data={'provider': 'groq'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['provider'], 'groq')
        self.assertEqual(data['model'], 'llama-3.1-8b-instant')

        self.project.refresh_from_db()
        self.assertEqual(self.project.provider, 'groq')
        self.assertEqual(self.project.model, 'llama-3.1-8b-instant')

    def test_patch_incompatible_model_for_existing_provider_returns_400(self):
        self.project.provider = 'groq'
        self.project.model = 'llama-3.1-8b-instant'
        self.project.save(update_fields=['provider', 'model'])

        response = self.client.patch(
            f'/api/v1/projects/{self.project.id}/',
            data={'model': 'gpt-5-mini'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('model', data)
        self.assertIn("Unsupported model 'gpt-5-mini' for provider 'groq'", str(data['model']))
