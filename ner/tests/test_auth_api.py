"""Tests for authentication endpoints and admin-role access behavior."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase


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
