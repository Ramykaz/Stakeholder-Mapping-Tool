"""Tests for authentication endpoints and admin-role access behavior."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from ingestion.models import Project, Document


User = get_user_model()


class TestAuthAPI(APITestCase):
    @override_settings(ADMIN_EMAIL_DOMAIN='undp.org', ADMIN_AUTO_ADMIN_EMAILS=['user@undp.org'])
    def test_register_allowlisted_undp_email_auto_assigns_admin(self):
        response = self.client.post(
            reverse('auth-register'),
            {
                'username': 'undp_admin',
                'email': 'user@undp.org',
                'password': 'Password123',
            },
            format='json',
        )

        assert response.status_code == 201
        data = response.json()
        assert data['user']['is_admin'] is True

        user = User.objects.get(username='undp_admin')
        assert user.is_staff is True

    @override_settings(ADMIN_EMAIL_DOMAIN='undp.org', ADMIN_AUTO_ADMIN_EMAILS=['other@undp.org'])
    def test_register_non_allowlisted_undp_email_remains_regular_user(self):
        response = self.client.post(
            reverse('auth-register'),
            {
                'username': 'undp_regular',
                'email': 'user@undp.org',
                'password': 'Password123',
            },
            format='json',
        )

        assert response.status_code == 201
        data = response.json()
        assert data['user']['is_admin'] is False

        user = User.objects.get(username='undp_regular')
        assert user.is_staff is False

    def test_register_non_undp_email_remains_regular_user(self):
        response = self.client.post(
            reverse('auth-register'),
            {
                'username': 'external_user',
                'email': 'user@example.com',
                'password': 'Password123',
            },
            format='json',
        )

        assert response.status_code == 201
        data = response.json()
        assert data['user']['is_admin'] is False

        user = User.objects.get(username='external_user')
        assert user.is_staff is False

    def test_register_login_me_logout_flow(self):
        register_response = self.client.post(
            reverse('auth-register'),
            {
                'username': 'alice',
                'email': 'alice@example.com',
                'password': 'Password123',
            },
            format='json',
        )
        assert register_response.status_code == 201
        register_data = register_response.json()
        assert 'token' in register_data
        assert register_data['user']['username'] == 'alice'
        assert register_data['user']['is_admin'] is False

        login_response = self.client.post(
            reverse('auth-login'),
            {
                'username': 'alice',
                'password': 'Password123',
            },
            format='json',
        )
        assert login_response.status_code == 200
        login_token = login_response.json()['token']

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {login_token}')
        me_response = self.client.get(reverse('auth-me'))
        assert me_response.status_code == 200
        assert me_response.json()['user']['username'] == 'alice'

        logout_response = self.client.post(reverse('auth-logout'), {}, format='json')
        assert logout_response.status_code == 200
        assert not Token.objects.filter(key=login_token).exists()

    def test_login_wrong_password_returns_specific_error(self):
        User.objects.create_user(
            username='bob',
            email='bob@example.com',
            password='Password123',
        )

        response = self.client.post(
            reverse('auth-login'),
            {'username': 'bob', 'password': 'wrong-pass'},
            format='json',
        )

        assert response.status_code == 400
        data = response.json()
        assert data['code'] == 'incorrect_password'

    def test_login_unknown_user_returns_invalid_credentials(self):
        response = self.client.post(
            reverse('auth-login'),
            {'username': 'does-not-exist', 'password': 'Password123'},
            format='json',
        )

        assert response.status_code == 400
        data = response.json()
        assert data['code'] == 'invalid_credentials'

    def test_register_invalid_email_returns_400(self):
        response = self.client.post(
            reverse('auth-register'),
            {
                'username': 'bad-email',
                'email': 'bad-email-format',
                'password': 'Password123',
            },
            format='json',
        )
        assert response.status_code == 400
        assert 'email' in response.json()

    def test_register_short_password_returns_400(self):
        response = self.client.post(
            reverse('auth-register'),
            {
                'username': 'short-pass',
                'email': 'short@example.com',
                'password': '123',
            },
            format='json',
        )
        assert response.status_code == 400
        assert 'password' in response.json()

    def test_user_data_isolation_for_documents(self):
        user_a = User.objects.create_user('user_a', 'a@example.com', 'Password123')
        token_a = Token.objects.create(user=user_a)
        project_a = Project.objects.create(name='A', owner=user_a)
        doc_a = Document.objects.create(filename='a.txt', file_format='txt', processing_status='completed', project=project_a)

        user_b = User.objects.create_user('user_b', 'b@example.com', 'Password123')
        token_b = Token.objects.create(user=user_b)
        project_b = Project.objects.create(name='B', owner=user_b)
        Document.objects.create(filename='b.txt', file_format='txt', processing_status='completed', project=project_b)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token_a.key}')
        docs_a = self.client.get('/api/v1/documents/')
        assert docs_a.status_code == 200
        ids_a = {row['id'] for row in docs_a.json()}
        assert str(doc_a.id) in ids_a

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token_b.key}')
        docs_b = self.client.get('/api/v1/documents/')
        assert docs_b.status_code == 200
        ids_b = {row['id'] for row in docs_b.json()}
        assert str(doc_a.id) not in ids_b

    def test_protected_endpoints_require_authentication(self):
        response = self.client.get('/api/v1/projects/')
        assert response.status_code == 401

        response_docs = self.client.get('/api/v1/documents/')
        assert response_docs.status_code == 401

    def test_project_access_isolated_per_user(self):
        owner = User.objects.create_user('owner', 'owner@example.com', 'Password123')
        owner_token = Token.objects.create(user=owner)
        project = Project.objects.create(name='owner-project', owner=owner)

        stranger = User.objects.create_user('stranger', 'stranger@example.com', 'Password123')
        stranger_token = Token.objects.create(user=stranger)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {stranger_token.key}')
        response = self.client.get(f'/api/v1/projects/{project.id}/')
        assert response.status_code == 404

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {owner_token.key}')
        response_owner = self.client.get(f'/api/v1/projects/{project.id}/')
        assert response_owner.status_code == 200

    def test_admin_taxonomy_requires_admin_role(self):
        regular_user = User.objects.create_user(
            username='regular',
            email='regular@example.com',
            password='Password123',
        )
        regular_token = Token.objects.create(user=regular_user)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {regular_token.key}')
        regular_response = self.client.get('/api/v1/admin/entity-labels/')
        assert regular_response.status_code == 403

        admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='Password123',
            is_staff=True,
        )
        admin_token = Token.objects.create(user=admin_user)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {admin_token.key}')
        admin_response = self.client.get('/api/v1/admin/entity-labels/')
        assert admin_response.status_code == 200
