"""Extended auth view tests: ChangePassword, ForgotPassword, ResetPassword, MeView."""

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

User = get_user_model()


class TestChangePasswordView(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('chpw_user', 'chpw@example.com', 'OldPass123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.url = reverse('auth-change-password')

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        response = self.client.post(self.url, {
            'current_password': 'OldPass123',
            'new_password': 'NewPass456!',
        }, format='json')
        assert response.status_code == 401

    def test_wrong_current_password_returns_400(self):
        response = self.client.post(self.url, {
            'current_password': 'WrongPassword',
            'new_password': 'NewPass456!',
        }, format='json')
        assert response.status_code == 400
        assert 'Current password' in response.json().get('detail', '')

    @override_settings(AUTH_PASSWORD_VALIDATORS=[
        {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
         'OPTIONS': {'min_length': 8}}
    ])
    def test_weak_new_password_returns_400(self):
        response = self.client.post(self.url, {
            'current_password': 'OldPass123',
            'new_password': '123',
        }, format='json')
        assert response.status_code == 400

    def test_success_rotates_token(self):
        old_key = self.token.key
        response = self.client.post(self.url, {
            'current_password': 'OldPass123',
            'new_password': 'NewSecurePass456!',
        }, format='json')
        assert response.status_code == 200
        data = response.json()
        assert 'token' in data
        assert data['token'] != old_key

    def test_success_password_actually_changed(self):
        self.client.post(self.url, {
            'current_password': 'OldPass123',
            'new_password': 'NewSecurePass456!',
        }, format='json')
        self.user.refresh_from_db()
        assert self.user.check_password('NewSecurePass456!')
        assert not self.user.check_password('OldPass123')


class TestForgotPasswordView(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('forgot_user', 'forgot@example.com', 'Pass123')
        self.url = reverse('auth-forgot-password')

    def test_returns_200_for_registered_email(self):
        response = self.client.post(self.url, {'email': 'forgot@example.com'}, format='json')
        assert response.status_code == 200

    def test_returns_200_for_unregistered_email_to_avoid_enumeration(self):
        response = self.client.post(self.url, {'email': 'nobody@example.com'}, format='json')
        assert response.status_code == 200
        assert 'reset link' in response.json().get('detail', '').lower()

    def test_missing_email_returns_400(self):
        response = self.client.post(self.url, {}, format='json')
        assert response.status_code == 400

    @override_settings(DEBUG=True)
    def test_debug_mode_returns_reset_path(self):
        response = self.client.post(self.url, {'email': 'forgot@example.com'}, format='json')
        assert response.status_code == 200
        data = response.json()
        assert '_debug_reset_path' in data
        assert 'reset-password' in data['_debug_reset_path']

    @override_settings(DEBUG=False)
    def test_production_mode_hides_reset_path(self):
        response = self.client.post(self.url, {'email': 'forgot@example.com'}, format='json')
        data = response.json()
        assert '_debug_reset_path' not in data


class TestResetPasswordView(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('reset_user', 'reset@example.com', 'Pass123')
        self.url = reverse('auth-reset-password')

    def _get_reset_token(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        return uid, token

    def test_missing_fields_returns_400(self):
        response = self.client.post(self.url, {}, format='json')
        assert response.status_code == 400

    def test_invalid_uid_returns_400(self):
        response = self.client.post(self.url, {
            'uid': 'invalid_uid',
            'token': 'some-token',
            'new_password': 'NewPass789!',
        }, format='json')
        assert response.status_code == 400
        assert 'Invalid reset link' in response.json().get('detail', '')

    def test_invalid_token_returns_400(self):
        uid, _ = self._get_reset_token()
        response = self.client.post(self.url, {
            'uid': uid,
            'token': 'invalid-token',
            'new_password': 'NewPass789!',
        }, format='json')
        assert response.status_code == 400
        assert 'invalid or has expired' in response.json().get('detail', '')

    def test_valid_token_resets_password(self):
        uid, token = self._get_reset_token()
        response = self.client.post(self.url, {
            'uid': uid,
            'token': token,
            'new_password': 'NewSecurePass789!',
        }, format='json')
        assert response.status_code == 200
        self.user.refresh_from_db()
        assert self.user.check_password('NewSecurePass789!')

    def test_valid_token_deletes_existing_tokens(self):
        Token.objects.create(user=self.user)
        uid, token = self._get_reset_token()
        self.client.post(self.url, {
            'uid': uid,
            'token': token,
            'new_password': 'NewSecurePass789!',
        }, format='json')
        assert Token.objects.filter(user=self.user).count() == 0

    @override_settings(AUTH_PASSWORD_VALIDATORS=[
        {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
         'OPTIONS': {'min_length': 8}}
    ])
    def test_weak_new_password_rejected(self):
        uid, token = self._get_reset_token()
        response = self.client.post(self.url, {
            'uid': uid,
            'token': token,
            'new_password': '123',
        }, format='json')
        assert response.status_code == 400


class TestMeView(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('me_user', 'me@example.com', 'Pass123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.url = reverse('auth-me')

    def test_get_returns_user_payload(self):
        response = self.client.get(self.url)
        assert response.status_code == 200
        data = response.json()
        assert data['user']['username'] == 'me_user'
        assert data['user']['email'] == 'me@example.com'

    def test_unauthenticated_returns_401(self):
        self.client.credentials()
        response = self.client.get(self.url)
        assert response.status_code == 401

    def test_patch_updates_username(self):
        response = self.client.patch(self.url, {'username': 'new_name'}, format='json')
        assert response.status_code == 200
        self.user.refresh_from_db()
        assert self.user.username == 'new_name'

    def test_patch_duplicate_username_returns_400(self):
        User.objects.create_user('taken_name', 'taken@example.com', 'Pass123')
        response = self.client.patch(self.url, {'username': 'taken_name'}, format='json')
        assert response.status_code == 400

    def test_patch_duplicate_email_returns_400(self):
        User.objects.create_user('other_user', 'other@example.com', 'Pass123')
        response = self.client.patch(self.url, {'email': 'other@example.com'}, format='json')
        assert response.status_code == 400
